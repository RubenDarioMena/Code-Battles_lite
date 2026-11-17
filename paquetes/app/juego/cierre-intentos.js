/** Presentación y guardado al terminar un intento.
 * @param {any} ctx */
export function instalarCierreIntentos(ctx) {
  function terminar(resultado, motivo, texto, linea, idProg) {
    if (ctx.ES_CAMPAIGN) return ctx.terminarCampaign(resultado, motivo, texto, linea, idProg);
    if (!ctx.mundo || !ctx.ejec) return;
    if (resultado === "victoria") ctx.plataforma.logros?.desbloquear("CBL_PRUEBA_VICTORIA");
    const m = ctx.mundo;
    const codigos = ctx.ejec ? ctx.ejec.codigos : { ...ctx.programas };
    const inicio = ctx.ejec ? ctx.ejec.inicio : new Date().toISOString();
    const acabados = ctx.ejec ? [...ctx.ejec.progs.values()].filter(p => ctx.anfitrion.estado(p.id) === "fin") : [];
    const lenguajes = ctx.ejec ? { ...ctx.ejec.lenguajes } : Object.fromEntries(Object.keys(codigos).map(id => [id, ctx.lenguajeDe(id)]));
    ctx.finActual = resultado;
    ctx.cerrarProgramas();
    ctx.__banco.alTerminar?.(resultado, motivo, texto, linea, idProg);
    if (resultado !== "error") { ctx.lineaCorre = {}; ctx.marcasSucias = true; }
    const lineas = Object.entries(codigos).reduce((a, [id, c]) => a + c.split("\n").filter(l => l.trim() && !(lenguajes[id] === "python" ? /^\s*#/ : /^\s*(\/\/|\/\*|\*)/).test(l)).length, 0);
    const lenguajeIntento = [...new Set(Object.values(lenguajes))].sort().join("+") || "js";
    if (ctx.ES_FACTORY) return terminarFactory(resultado, motivo, texto, linea, idProg, codigos, inicio, lenguajes, lenguajeIntento);
    const cpd = m.derribos ? ctx.coste() / m.derribos : null;
    const lanz = Object.fromEntries(m.lanzadores.map(l => [l.id, { ...l.st, fallaMax: ctx.r3(l.st.fallaMax), tRafaga: ctx.r2(l.st.tRafaga) }]));
    ctx.telemetria.push({
      sandbox: "03_lanzamisiles", reto: ctx.retoIdx + 1, titulo: ctx.def.titulo, intento: ctx.intento, semilla: ctx.semilla, vista: ctx.vista, inicio,
      resultado, motivo, mensaje: texto, linea: linea ?? null, programa: idProg ?? null,
      tiempoJuego: ctx.r2(m.t), brechas: m.brechas, derribos: m.derribos, enemigos: m.total, misiles: m.consumidos, impactos: m.impactos,
      precision: m.consumidos ? ctx.r3(m.impactos / m.consumidos) : null, atascos: m.atascos, reparaciones: m.reparaciones,
      coste: ctx.coste(), costePorDerribo: cpd == null ? null : ctx.r2(cpd), lanzadores: lanz, detalleAtascos: m.detalleAtascos, uso: ctx.registroActual().uso, consolas: ctx.registroActual().consolas,
      inserciones: { ...ctx.insercion }, lineas, codigos, lenguajes, escenario: ctx.retoIdx === ctx.IDX_PROPIO ? ctx.def : undefined,
    });
    ctx.insercion = { dobleClic: 0, arrastre: 0, atajo: 0 };
    ctx.guardado.escribir("telemetria", ctx.telemetria);
    ctx.avisar("cmg:intento", ctx.telemetria[ctx.telemetria.length - 1]);
    const stats = `${m.derribos}/${m.total} derribados · ${m.consumidos} misiles · precisión ${m.consumidos ? Math.round(m.impactos / m.consumidos * 100) : 0} % · ${m.atascos} ${m.atascos === 1 ? "atasco" : "atascos"} · ${ctx.coma(m.t)} s`;
    if (resultado === "victoria") {
      if (!ctx.hechos.includes(ctx.claveReto())) { ctx.hechos.push(ctx.claveReto()); ctx.guardado.escribir("hechos", ctx.hechos); }
      const ant = ctx.records[ctx.claveReto()];
      let record;
      if (cpd == null) record = "";
      else if (ant == null || cpd < ant - 1e-9) {
        ctx.records[ctx.claveReto()] = ctx.r2(cpd); ctx.guardado.escribir("records", ctx.records);
        ctx.recordsLenguaje[ctx.claveReto()] = lenguajeIntento; ctx.guardado.escribir("records-lenguaje", ctx.recordsLenguaje);
        record = `<p class="record">Coste por derribo <b>₵ ${ctx.coma(cpd)}</b>${ctx.etiquetaLenguaje(lenguajeIntento)} · <span class="mejora">${ant == null ? "primer récord" : `nuevo récord (antes ₵ ${ctx.coma(ant)})`}</span></p>`;
      } else record = `<p class="record">Coste por derribo <b>₵ ${ctx.coma(cpd)}</b>${ctx.etiquetaLenguaje(lenguajeIntento)} · <span class="peor">récord ₵ ${ctx.coma(ant)}${ctx.etiquetaLenguaje(ctx.recordsLenguaje[ctx.claveReto()])} (+${ctx.coma(cpd - ant)})</span></p>`;
      const sig = ctx.retoIdx + 1 < ctx.IDX_PROPIO;
      ctx.mostrarBanner("victoria", "Base intacta", record + `<p>₵ ${ctx.coste()} en total: ${m.consumidos} misiles × ₵ ${ctx.COSTE.misil} + ${m.reparaciones} reparaciones × ₵ ${ctx.COSTE.reparacion}. Menos misiles y menos atascos bajan el número.</p>`, stats,
        sig ? [["Siguiente reto", "primario", () => ctx.elegirReto(ctx.retoIdx + 1)], ["Otra vez", "", ctx.ocultarBanner]] : [["Otra vez", "primario", ctx.ocultarBanner]]);
      ctx.pintarRetos();
    } else if (resultado === "fallo") {
      const comentados = ctx.def.lanzadores.filter(l => lenguajes[l.id] === "python" ? !(codigos[l.id] || "").split("\n").some(x => x.trim() && !/^\s*#/.test(x)) : ctx.soloComentarios(codigos[l.id] || "")).map(l => l.id);
      let extra = comentados.length ? ` El programa de ${comentados.join(" y ")} está todo comentado: no hace nada.` : "";
      for (const p of acabados) if (!comentados.includes(p.id)) extra += ` El programa de ${p.id} terminó a los ${p.finT.toFixed(1)} s: desde entonces nadie volvió a apuntar.`;
      const pista = ctx.pistaTrasFallo();
      ctx.ultimoAviso[ctx.claveReto()] = { resultado, motivo, texto: texto + extra, intento: ctx.intento, t: ctx.r2(m.t), derribos: `${m.derribos}/${m.total}`, cpd: cpd == null ? null : ctx.r2(cpd), cuando: Date.now() };
      ctx.mostrarBanner("fallo", "Aún no", ctx.esc(texto + extra), pista ? `Pista ${pista.n > 1 ? `${pista.i}/${pista.n}` : ""}: ${pista.texto}`.replace(" :", ":") : "Revisa el registro y la consola.", [["Editar programa", "primario", () => { ctx.ocultarBanner(); ctx.verPanel("codigo"); ctx.abrirPestana("programa"); }]]);
    } else if (resultado === "error") {
      ctx.pistaTrasFallo();
      ctx.mostrarBanner("fallo", linea ? `Error en la línea ${linea} de ${idProg}` : `Error en el programa de ${idProg}`, ctx.esc(texto), null,
        [["Ir a la línea", "primario", () => { ctx.ocultarBanner(); ctx.abrirPrograma(idProg); ctx.irALinea(linea); }]]);
    }
    ctx.pintarControles(); ctx.pintarProgs(); ctx.pintarResumen(); ctx.pintarEdicion(); ctx.metasClave = "";
    if (!ctx.$("info-reto").hidden) ctx.pintarInfoReto();
  }

  function terminarFactory(resultado, motivo, texto, linea, idProg, codigos, inicio, lenguajes = {}, lenguajeIntento = "js") {
    const t = { sandbox: "factory", reto: ctx.retoIdx + 1, clave: ctx.claveReto(), titulo: ctx.def.titulo, intento: ctx.intento, inicio,
      resultado, motivo, mensaje: texto, linea: linea ?? null, programa: idProg ?? null, tiempoJuego: ctx.r2(ctx.mundo.t),
      rechazos: ctx.mundo.rechazos, derrames: ctx.mundo.derrames, viajesVacios: ctx.mundo.vacios, stockOculto: ctx.mundo.stockOculto, codigos, lenguajes };
    ctx.telemetria.push(t); ctx.guardado.escribir("factory-telemetria", ctx.telemetria);
    if (resultado === "victoria") {
      if (!ctx.hechos.includes(ctx.claveReto())) { ctx.hechos.push(ctx.claveReto()); ctx.guardado.escribir("hechos", ctx.hechos); }
      const anterior = ctx.records[ctx.claveReto()];
      if (!anterior || anterior.regla !== "comun-v1" || ctx.mundo.t < anterior.valor - 1e-9) { ctx.records[ctx.claveReto()] = { medida: "tiempo", regla: "comun-v1", valor: ctx.r2(ctx.mundo.t), lenguaje: lenguajeIntento }; ctx.guardado.escribir("records", ctx.records); }
      ctx.mostrarBanner("victoria", "Reto cumplido", `Todo entregado. <b>${ctx.coma(ctx.mundo.t)} s</b>${ctx.etiquetaLenguaje(lenguajeIntento)}`, `Intento ${ctx.intento}`, [["Otra vez", "primario", ctx.ocultarBanner]]);
    } else if (resultado === "fallo" || resultado === "error") {
      ctx.pistaTrasFallo();
      ctx.mostrarBanner("fallo", resultado === "error" ? (linea ? `Error en la línea ${linea}` : "Error en el programa") : "Aún no", ctx.esc(texto), ctx.partesPista().join(" "),
        [["Editar programa", "primario", () => { ctx.ocultarBanner(); ctx.verPanel("codigo"); if (linea) ctx.irALinea(linea); }]]);
    }
    ctx.pintarControles(); ctx.pintarProgs(); ctx.pintarResumen(); ctx.pintarEdicion(); ctx.pintarRetos(); ctx.metasClave = "";
    if (!ctx.$("info-reto").hidden) ctx.pintarInfoReto();
  }

  function detener() { if (ctx.ejec) { ctx.consola("sistema", null, null, ctx.ES_CAMPAIGN ? ctx.esc(ctx.ti18n("campaign.aviso.detenido")) : ctx.htmlInterfaz("Programa detenido.")); terminar("detenido", "detenido", null); } }

  return {
    terminar, detener
  };
}
