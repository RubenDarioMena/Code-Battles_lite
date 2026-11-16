/** instalarInfoReto: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarInfoReto(ctx) {
  // ---------- Información del reto desde el editor ----------
  // Pestañas: objetivo, metas en vivo, enemigos del reto, pista escalonada y último intento.

  const MOTIVOS = { brecha: "Brecha", atascos: "Demasiados atascos", tiempo: "Fuera de tiempo", limite: "Tiempo agotado", derribos: "Pocos derribos", error: "Error en el programa", detenido: "Detenido", reinicio: "Reiniciado" };
  // Estado de cada meta: «ok» (verde), «rota» (rojo) o «pendiente». Al acabar un intento todas quedan decididas.
  function estadoMetas() {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.metas();
    if (ctx.ES_FACTORY) return ctx.def.metas.map((meta, i) => {
      const e = ctx.mundo.porId[meta.id], valor = meta.tipo === "vaciar" ? e.stock[meta.mat] || 0 : e.recibido[meta.mat] || 0;
      return { k: `factory-${i}`, nombre: `${ctx.esc(meta.id)} ← ${ctx.esc(meta.mat)}`, meta: meta.tipo === "vaciar" ? ctx.ti18n("retos.meta.vaciar") : ctx.ti18n("retos.meta.minimo", { n: meta.n }), valor: meta.tipo === "vaciar" ? valor : `${valor}/${meta.n}`, estado: ctx.metaCumplida(meta) ? "ok" : ctx.finActual ? "rota" : "pendiente" };
    });
    const m = ctx.mundo, me = ctx.def.metas, acabado = ctx.finActual === "victoria" || ctx.finActual === "fallo";
    const decide = (rota, ok) => rota ? "rota" : ok ? "ok" : acabado ? "rota" : "pendiente";
    const filas = [{ k: "brechas", nombre: ctx.ti18n("retos.meta.brechas"), meta: ctx.ti18n("retos.meta.maximo", { n: me.brechasMax }), valor: m.brechas, estado: decide(m.brechas > me.brechasMax, acabado && m.brechas <= me.brechasMax) }];
    if (me.derribosMin != null) filas.push({ k: "derribos", nombre: ctx.ti18n("retos.meta.derribos"), meta: ctx.ti18n("retos.meta.minimo", { n: me.derribosMin }), valor: `${m.derribos}/${m.total}`, estado: decide(false, m.derribos >= me.derribosMin) });
    else filas.push({ k: "derribos", nombre: ctx.ti18n("retos.meta.derribados"), meta: ctx.ti18n("retos.meta.contar"), valor: `${m.derribos}/${m.total}`, estado: "info" });
    if (me.atascosMax != null) filas.push({ k: "atascos", nombre: ctx.ti18n("retos.meta.atascos"), meta: ctx.ti18n("retos.meta.maximo", { n: me.atascosMax }), valor: m.atascos, estado: decide(m.atascos > me.atascosMax, acabado && m.atascos <= me.atascosMax) });
    if (me.tiempoMax != null) filas.push({ k: "tiempo", nombre: ctx.ti18n("retos.meta.tiempo"), meta: ctx.ti18n("retos.meta.hasta", { n: me.tiempoMax }), valor: `${ctx.coma(m.t)} s`, estado: decide(m.t > me.tiempoMax + 1e-9, ctx.finActual === "victoria") });
    return filas;
  }
  // Pista escalonada: la pista del reto en partes (frases). La primera se puede pedir siempre;
  // cada intento fallido muestra la siguiente y permite pedir una más.
  const partesPista = () => ctx.ES_CAMPAIGN ? ctx.uiC.pistas() : (ctx.def.pista || "").split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«"])/).map(t => t.trim()).filter(Boolean).map((t, i) => ctx.textoReto(`pista.${i}`, t));
  let pistas = ctx.guardado.leer("pistas", {});
  // En Campaign cada hito lleva la cuenta de sus propias pistas.
  const clavePista = () => ctx.ES_CAMPAIGN ? `campaign-h${ctx.mundo.hito}` : ctx.claveReto();
  const pistaDe = () => ({ vistas: 0, fallos: 0, ...(pistas[clavePista()] || {}) });
  function guardarPista(p) { pistas = { ...pistas, [clavePista()]: p }; ctx.guardado.escribir("pistas", pistas); }
  function pistaTrasFallo() {
    const p = pistaDe(), n = partesPista().length;
    p.fallos++; p.vistas = Math.min(n, Math.max(p.vistas, p.fallos));
    guardarPista(p);
    return p.vistas ? { n, i: p.vistas, texto: partesPista()[p.vistas - 1] } : null;
  }
  // Último intento: lo que guarda la telemetría, más el detalle del aviso y los errores de sintaxis previos.

  function ultimoIntento() {
    const t = [...ctx.telemetria].reverse().find(x => x.reto === ctx.retoIdx + 1 && x.motivo !== "reinicio");
    const extra = ctx.ultimoAviso[ctx.claveReto()];
    if (extra && (!t || extra.cuando >= Date.parse(t.inicio))) return extra;
    return t ? { resultado: t.resultado, motivo: t.motivo, texto: t.mensaje, linea: t.linea, id: t.programa, intento: t.intento, t: t.tiempoJuego, cpd: t.costePorDerribo, derribos: `${t.derribos}/${t.enemigos}` } : null;
  }
  const marca = (estado) => `<i class="marca ${estado}" aria-hidden="true"></i>`;
  const num = (v) => Number.isInteger(v) ? String(v) : ctx.coma(v);
  const INFO = {
    objetivo: () => `<section class="objetivo" data-i18n-aria-label="juego.info_reto.objetivo" aria-label="${ctx.esc(ctx.ti18n("juego.info_reto.objetivo"))}"><p id="info-reto-txt">${ctx.hojaReto("objetivo", ctx.def.objetivo)}</p><div class="leccion" id="info-reto-leccion">${ctx.hojaReto("leccion", ctx.def.leccion)}</div></section>`,
    metas: () => {
      const m = ctx.mundo, filas = estadoMetas();
      const est = ctx.ti18n(`retos.estado.${ctx.finActual === "victoria" ? "victoria" : ctx.finActual === "fallo" || ctx.finActual === "error" ? "fallo" : ctx.ejec ? "activo" : ctx.finActual ? "detenido" : "inicial"}`);
      return `<p class="info-nota">${ctx.esc(est)}${ctx.finActual || ctx.ejec ? "" : ctx.ti18n("retos.estado.nota")}</p><ul class="metas-lista">${filas.map(f =>
        `<li class="meta-fila ${f.estado}" data-meta="${f.k}">${marca(f.estado)}<span class="m-nombre">${f.nombre} <small>${ctx.esc(f.meta)}</small></span><b class="m-valor">${f.valor}</b></li>`).join("")}</ul>`;
    },
    enemigos: () => {
      if (ctx.ES_FACTORY) return `<p class="info-nota">Este reto no tiene enemigos.</p>`;
      const tipos = new Map();
      for (const o of ctx.def.oleadas) {
        const tp = ctx.TIPOS[o.tipo], x = tipos.get(o.tipo) || { n: 0, hp: new Set(), vel: new Set() };
        x.n += o.n; x.hp.add(o.hp ?? tp.hp); x.vel.add(o.vel ?? tp.vel); tipos.set(o.tipo, x);
      }
      const rango = (set, f) => [...set].sort((a, b) => a - b).map(f).join(" / ");
      const vib = (ctx.def.sensores || []).map(s => s.id);
      return `<div class="enemigos-lista">${[...tipos].map(([t, x]) => {
        const tp = ctx.TIPOS[t], ven = ["cámara", ...(tp.frio ? [] : ["térmico"]), ...(tp.suelo ? vib : [])];
        return `<article class="enemigo-ficha" data-tipo="${t}">
          <img class="retrato" src="img/enemigos/${t}.png" alt="Modelo de ${ctx.esc(tp.nombre)}" width="96" height="72" loading="lazy">
          <div><h4>${ctx.esc(tp.nombre[0].toUpperCase() + tp.nombre.slice(1))} <code>"${t}"</code> <span class="cuenta">× ${x.n}</span></h4>
          <dl><dt>vida</dt><dd>${rango(x.hp, v => `${v} ${v === 1 ? "impacto" : "impactos"}`)}</dd><dt>velocidad</dt><dd>${rango(x.vel, num)} c/s</dd>
          <dt>altura</dt><dd>${num(tp.z)} m${tp.suelo ? " · suelo" : ""}</dd><dt>lo ven</dt><dd>${ven.map(ctx.esc).join(" · ")}${tp.frio ? ' <span class="no">· el térmico no</span>' : ""}</dd></dl></div></article>`;
      }).join("")}</div>${ctx.def.niebla ? `<p class="info-nota">Niebla: la cámara ve ${num(ctx.SENSOR.visual.niebla)} casillas y el térmico ${num(ctx.SENSOR.thermal.niebla)}.</p>` : ""}`;
    },
    pista: () => {
      const partes = partesPista(), p = pistaDe(), n = partes.length, abiertas = Math.min(n, p.fallos + 1);
      if (!n) return `<p class="info-nota">${ctx.hojaUIReto("retos.pista.sin")}</p>`;
      const vistas = partes.slice(0, p.vistas).map((t, i) => `<li><span class="parte">${i + 1}/${n}</span> ${ctx.hojaReto(`pista.${i}`, t)}</li>`).join("");
      const pie = p.vistas >= n ? `<p class="info-nota">${ctx.hojaUIReto("retos.pista.completa")}</p>`
        : p.vistas < abiertas ? `<button class="btn chico" type="button" data-info-accion="ver-pista">${ctx.hojaUIReto(p.vistas ? "retos.pista.siguiente" : "retos.pista.ver")} <small>${p.vistas + 1}/${n}</small></button>`
        : `<p class="info-nota bloqueada"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>${ctx.hojaUIReto("retos.pista.bloqueada", { i: p.vistas + 1, n })}</p>`;
      return `${vistas ? `<ol class="pista-partes">${vistas}</ol>` : `<p class="info-nota">${ctx.hojaUIReto(n === 1 ? "retos.pista.intro_una" : "retos.pista.intro", { n })}</p>`}${pie}`;
    },
    intento: () => {
      const u = ultimoIntento();
      if (!u) return `<p class="info-nota">Aún no hay intentos en este reto.</p>`;
      const titulo = u.resultado === "victoria" ? (ctx.ES_FACTORY ? "Reto cumplido" : "Base intacta") : u.resultado === "error" || u.resultado === "sintaxis" ? (u.linea ? `Error en la línea ${u.linea} de ${u.id}` : `Error en el programa de ${u.id}`) : MOTIVOS[u.motivo] || "Intento";
      const cls = u.resultado === "victoria" ? "ok" : u.resultado === "detenido" ? "pendiente" : "rota";
      const rec = ctx.ES_FACTORY ? (ctx.records[ctx.claveReto()]?.regla === "comun-v1" ? ctx.records[ctx.claveReto()].valor : null) : ctx.records[ctx.claveReto()];

      return `<div class="intento ${cls}">${marca(cls)}<div><h4>${ctx.esc(titulo)}</h4>${u.intento ? `<p class="info-nota">Intento ${u.intento}${u.t != null ? ` · ${ctx.coma(u.t)} s` : ""}${u.derribos ? ` · ${u.derribos} derribados` : ""}</p>` : ""}</div></div>
        ${u.texto ? `<p class="motivo">${ctx.esc(u.texto)}</p>` : ""}
        <div class="fila-botones">${u.linea ? `<button class="btn chico primario" type="button" data-info-accion="linea">Ir a la línea ${u.linea}</button>` : ""}${cls === "rota" && partesPista().length ? `<button class="btn chico" type="button" data-info-accion="a-pista">Ver pista</button>` : ""}</div>
        ${ctx.ES_FACTORY && rec != null ? `<p class="economia">Récord: ${ctx.coma(rec)} s</p>` : ""}
        ${!ctx.ES_FACTORY && (u.cpd != null || rec != null) ? `<p class="economia">₵ por derribo ${u.cpd != null ? ctx.coma(u.cpd) : "—"}${rec != null ? ` · récord ${ctx.coma(rec)}` : ""}</p>` : ""}`;
    },
  };
  // Punto de estado en las pestañas: metas (verde, rojo) e intento (rojo si falló).
  function estadosPestanas() {
    const filas = estadoMetas().filter(f => f.estado !== "info");
    const m = filas.some(f => f.estado === "rota") ? "rota" : filas.length && filas.every(f => f.estado === "ok") ? "ok" : "";
    const u = ultimoIntento(), i = !u ? "" : u.resultado === "victoria" ? "ok" : u.resultado === "detenido" ? "" : "rota";
    const p = pistaDe(), n = partesPista().length, nueva = p.vistas < Math.min(n, p.fallos + 1) && p.fallos > 0 ? "nueva" : "";
    for (const [k, v] of [["metas", m], ["intento", i], ["pista", nueva]]) ctx.$(`info-t-${k}`).dataset.estado = v;
  }
  // Teléfono: el inspector del programa y la consola son pestañas de esta ficha (el panel inferior se retira
  // para dar sitio al código). Se muestran los mismos nodos del panel, así siguen vivos sus valores y mensajes;
  // al cambiar de pestaña o cerrar la ficha vuelven a su sitio.
  const PORTALES = { inspector: "pie-ins", consola: "pie-con" };
  const conPortales = () => ctx.$("app").dataset.forma === "movil";
  function devolverPortales() {
    const cuerpo = ctx.$("pie-cuerpo");
    if (ctx.$("pie-ins").parentElement !== cuerpo) cuerpo.prepend(ctx.$("pie-ins"));
    if (ctx.$("pie-con").parentElement !== cuerpo) cuerpo.append(ctx.$("pie-con"));
  }
  const avisarInfo = () => ctx.$("app").dispatchEvent(new CustomEvent("cmg:info", { detail: { pestana: ctx.infoPestana, abierta: !ctx.$("info-reto").hidden } }));
  function pintarInfoReto() {
    if (PORTALES[ctx.infoPestana] && !conPortales()) ctx.infoPestana = "objetivo";
    ctx.actualizarContenidoReto();
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("#info-pestanas [data-info]"))) {
      const si = b.dataset.info === ctx.infoPestana;
      b.setAttribute("aria-selected", String(si)); b.tabIndex = si ? 0 : -1;
    }
    ctx.$("info-cuerpo").setAttribute("aria-labelledby", `info-t-${ctx.infoPestana}`);
    devolverPortales();
    if (PORTALES[ctx.infoPestana]) ctx.$("info-cuerpo").replaceChildren(ctx.$(PORTALES[ctx.infoPestana]));
    else ctx.$("info-cuerpo").innerHTML = ctx.htmlInterfaz(INFO[ctx.infoPestana]());
    estadosPestanas();
  }
  // En vivo: las metas y los puntos se repintan con el marcador (pintarHud), solo con la ficha abierta.
  function vivoInfoReto() {
    if (ctx.$("info-reto").hidden) return;
    if (ctx.infoPestana === "metas") ctx.$("info-cuerpo").innerHTML = ctx.htmlInterfaz(INFO.metas());
    estadosPestanas();
  }
  function elegirInfo(k, foco) {
    ctx.infoPestana = k; pintarInfoReto();
    const b = ctx.$(`info-t-${ctx.infoPestana}`); b.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (foco) b.focus();
    avisarInfo();
  }
  function abrirInfoReto(si, pestana) {
    if (pestana) ctx.infoPestana = pestana;
    if (si) pintarInfoReto(); else devolverPortales();
    ctx.$("info-reto").hidden = !si;
    ctx.$("b-info-reto").setAttribute("aria-expanded", String(si));
    if (si) ctx.$(`info-t-${ctx.infoPestana}`).scrollIntoView({ block: "nearest", inline: "nearest" });
    avisarInfo();
  }
  // Al pasar del teléfono a PC con el inspector o la consola en la ficha, vuelven al panel inferior.
  ctx.$("app").addEventListener("cmg:forma", () => {
    if (conPortales()) return;
    if (!ctx.$("info-reto").hidden && PORTALES[ctx.infoPestana]) elegirInfo("objetivo");
    devolverPortales();
  });
  ctx.$("b-info-reto").addEventListener("pointerdown", (ev) => ev.preventDefault());  // el código conserva el foco
  ctx.$("b-info-reto").addEventListener("click", () => abrirInfoReto(ctx.$("info-reto").hidden));
  ctx.$("info-reto-cerrar").addEventListener("click", () => abrirInfoReto(false));
  ctx.$("info-pestanas").addEventListener("click", (ev) => {
    const b = /** @type {any} */ (ev.target).closest("[data-info]");
    if (b && !ctx.$("info-tira").classList.contains("arrastrada")) elegirInfo(b.dataset.info);
  });
  ctx.$("info-pestanas").addEventListener("keydown", (ev) => {
    // Solo las pestañas a la vista: inspector y consola existen únicamente en el teléfono.
    const ks = [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("#info-pestanas [data-info]"))].filter(b => b.getClientRects().length).map(b => b.dataset.info), i = ks.indexOf(ctx.infoPestana);
    const j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : ev.key === "Home" ? 0 : ev.key === "End" ? ks.length - 1 : null;
    if (j == null) return;
    ev.preventDefault(); elegirInfo(ks[(j + ks.length) % ks.length], true);
  });
  ctx.$("info-cuerpo").addEventListener("click", (ev) => {
    const a = /** @type {any} */ (ev.target).closest("[data-info-accion]"); if (!a) return;
    const acc = a.dataset.infoAccion;
    if (acc === "ver-pista") { const p = pistaDe(); p.vistas = Math.min(partesPista().length, p.vistas + 1); guardarPista(p); pintarInfoReto(); }
    else if (acc === "a-pista") elegirInfo("pista");
    else if (acc === "linea") { const u = ultimoIntento(); abrirInfoReto(false); ctx.abrirPrograma(u.id); ctx.irALinea(u.linea); }
  });
  // En PC la ficha flota y se cierra al tocar fuera. En el teléfono es una hoja que convive con el código
  // (se puede leer el inspector mientras se escribe): se cierra con su flecha o llevando el asa hasta abajo.
  document.addEventListener("pointerdown", (ev) => { if (!ctx.$("info-reto").hidden && !conPortales() && !/** @type {any} */ (ev.target).closest("#info-reto, #b-info-reto")) abrirInfoReto(false); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !ctx.$("info-reto").hidden) { abrirInfoReto(false); ctx.$("b-info-reto").focus(); } });
  ctx.$("b-reto").addEventListener("click", () => ctx.abrirHoja(ctx.$("hoja-reto").hidden));
  ctx.$("hoja-reto").addEventListener("click", (ev) => { if (/** @type {any} */ (ev.target).closest("[data-cerrar-hoja]")) ctx.abrirHoja(false); });

  function textoInicial(d, id) {
    if (d.serie === "factory") return (d.inicial[id] || []).join("\n") + "\n";
    const lineas = d.inicial[id] || [];
    if (d.serie === "campaign" && d.vivos.includes(id)) return lineas.join("\n") + "\n";
    if (!lineas.length) return `/* Programa de ${id}.\n * Doble clic en el inspector inserta nombres, funciones y valores. */\n\n`;
    return `/* Programa de ${id} · el código de partida está comentado.\n * Quita las // (Ctrl+/ o el botón «//») o escribe el tuyo. */\n` + lineas.map(l => "// " + l).join("\n") + "\n";
  }
  // Todas las unidades con programa, estén encendidas o no (en War y Factory son las mismas).
  const conPrograma = d => d.serie === "campaign" ? d.robots : ctx.programablesDe(d);
  function cargarProgramas() {
    let g = ctx.guardado.leer(`prog-${ctx.claveReto()}`, null);
    if (ctx.ES_FACTORY && g == null) {
      // Importación única y de solo lectura; nunca escribimos en cmg-banco02.
      try { const viejo = JSON.parse(ctx.plataforma.almacen.leer(`cmg-banco02:prog-${ctx.retoIdx}`)); if (viejo) g = { R1: (viejo.fuente !== "texto" || (viejo.comentado != null && viejo.texto === viejo.comentado)) && viejo.modelo ? ctx.factory.retos.generar(viejo.modelo).codigo : viejo.texto }; } catch { /* dato antiguo inválido */ }
      g ||= { R1: textoInicial(ctx.def, "R1") };
      ctx.guardado.escribir(`prog-${ctx.claveReto()}`, g);
    }
    g ||= {};
    return Object.fromEntries(conPrograma(ctx.def).map(l => [l.id, typeof g[l.id] === "string" ? g[l.id] : textoInicial(ctx.def, l.id)]));
  }
  function cargarFuentes() {
    if (!ctx.PYTHON) return {};
    const g = ctx.guardado.leer(`fuentes-${ctx.claveReto()}`, null) || {}, ids = new Set(conPrograma(ctx.def).map(l => l.id));
    return Object.fromEntries(Object.entries(g).filter(([id, f]) => ids.has(id) && f && f.lenguaje === "python" && typeof f.texto === "string")
      .map(([id, f]) => [id, { lenguaje: "python", texto: f.texto, enUso: f.enUso !== false }]));
  }
  const copiaFuentes = () => JSON.parse(JSON.stringify(ctx.fuentes));

  function guardarProgramas() {
    clearTimeout(ctx.tGuardar);
    const clave = `prog-${ctx.claveReto()}`, copia = { ...ctx.programas }, claveF = `fuentes-${ctx.claveReto()}`, copiaF = ctx.PYTHON ? copiaFuentes() : null;
    ctx.tGuardar = setTimeout(() => { ctx.guardado.escribir(clave, copia); if (copiaF) ctx.guardado.escribir(claveF, copiaF); }, 300);
  }

  function guardarFactoryAhora() {
    clearTimeout(ctx.tGuardar);
    ctx.guardado.escribir(`prog-${ctx.claveReto()}`, { ...ctx.programas });
    if (ctx.PYTHON) ctx.guardado.escribir(`fuentes-${ctx.claveReto()}`, copiaFuentes());
  }
  // Lenguaje y texto de cada unidad.
  const lenguajeDe = id => ctx.PYTHON && ctx.fuentes[id] && ctx.fuentes[id].enUso ? "python" : "js";
  const textoDe = id => lenguajeDe(id) === "python" ? ctx.fuentes[id].texto : ctx.programas[id];
  function ponerTexto(id, t) { if (lenguajeDe(id) === "python") ctx.fuentes[id].texto = t; else ctx.programas[id] = t; }
  // E7: el programa de partida en Python sale del de JS, convertido por el árbol.
  function textoInicialPython(d, id) {
    const lineas = d.inicial[id] || [];
    if (d.serie === "factory") { const r = convertirAPython(textoInicial(d, id)); if (r.ok) return r.texto; }
    if (!lineas.length || d.serie === "factory") return `# Programa de ${id} en Python.\n# Doble clic en el inspector inserta nombres, funciones y valores.\n\n`;
    const r = convertirAPython(lineas.join("\n"));
    const cuerpo = r.ok ? r.texto.replace(/\n$/, "").split("\n") : lineas;
    if (d.serie === "campaign" && d.vivos.includes(id) && r.ok) return cuerpo.join("\n") + "\n";
    return `# Programa de ${id} · el código de partida está comentado.\n# Quita los # (Ctrl+/ o el botón de comentar) o escribe el tuyo.\n` + cuerpo.map(l => "# " + l).join("\n") + "\n";
  }
  function convertirAPython(js) {
    ctx.nombresPython ||= new Map(ctx.proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    return ctx.CMGJSaPython.convertir(js, { acorn: ctx.acorn, nombres: ctx.nombresPython, objetoONulo: ["autoTarget", "detect"], huecos: { re: ctx.RE_HUECO, aPython: ctx.CMGEditorPython.aHueco } });
  }
  // Add/Replace sobre las fuentes Python: el aplicador escribe en un objeto estable por reto.

  const vistaPython = () => new Proxy({}, { get: (_, id) => ctx.fuentes[id] ? ctx.fuentes[id].texto : undefined, set: (_, id, v) => { if (ctx.fuentes[id]) ctx.fuentes[id].texto = v; return true; } });
  addEventListener("pagehide", () => { if (ctx.ES_FACTORY && ctx.def) guardarFactoryAhora(); });

  function nuevoMundo(nIntento = ctx.intento + 1) {
    ctx.COLS = ctx.def.mapa?.cols || 32; ctx.ROWS = ctx.def.mapa?.rows || 18;
    ctx.partida = ctx.crearPartida({ reglas: ctx.reglas, escenario: { reto: ctx.def, ...(ctx.ES_FACTORY ? { intento: nIntento } : ctx.ES_CAMPAIGN ? { guardado: ctx.estadoCampaign } : {}) }, semilla: ctx.ES_FACTORY ? nIntento : ctx.semilla });
    ctx.mundo = ctx.partida.mundo;
    ctx.anfitrion = null; ctx.conductor = null; ctx.finActual = null; ctx.eventos = []; ctx.desdeRegistro = 0; ctx.registrosPendientes.clear(); ctx.eventosSucios = true;
    ctx.consolasCampaign = { log: 0, info: 0, warn: 0, error: 0 };
    ctx.invalidarEscena();
    if (ctx.V3) ctx.V3.construir();
    for (const o of ctx.etiquetas.values()) { o.etq.remove(); o.g.remove(); }
    ctx.etiquetas.clear(); ctx.globos.clear();
    ctx.seleccionadas = new Set([...ctx.seleccionadas].filter(id => ctx.unidadPorId(id)));
    if (!ctx.seleccionadas.size) ctx.seleccionadas.add(ctx.programablesDe(ctx.def)[0].id);
    ctx.seleccion = [...ctx.seleccionadas][0];
    if (ctx.V3) ctx.V3.anillosDe(ctx.seleccion);
    const programables = [...ctx.seleccionadas].filter(id => Object.hasOwn(ctx.programas, id));
    ctx.configurarEdicion(programables.length ? programables : [ctx.progSel]);
    ctx.historia.clear();
    ctx.pintarMaquinas(); ctx.pintarInspector(); ctx.pintarPieIns();
    ctx.metasClave = "";
  }

  function elegirReto(i) {
    if (ctx.ES_FACTORY && ctx.def && ctx.programas.R1 !== undefined) guardarFactoryAhora();
    clearTimeout(ctx.tFicha); ctx.cancelarArrastre(); ctx.ultimoToque = null;
    ctx.cerrarProgramas();
    ctx.retoIdx = i; ctx.guardado.escribir(`${ctx.PREFIJO}reto`, i);
    ctx.def = ctx.defActual();
    if (ctx.ES_CAMPAIGN) { ctx.estadoCampaign = (ctx.guardado.leer(ctx.CLAVE_VIVO, null) || {}).mundo || null; ctx.hitoPendiente = null; }
    if (!ctx.ES_FACTORY && !ctx.ES_CAMPAIGN) ctx.avisar("cmg:reto", { reto: i + 1, titulo: ctx.def.titulo });
    ctx.intento = ctx.telemetria.filter(t => t.reto === i + 1).length;
    if (!ctx.semillaFija) ctx.semilla = ctx.intento + 1;
    ctx.programas = cargarProgramas();
    ctx.fuentes = cargarFuentes(); ctx.textosPython = vistaPython();
    ctx.borradoresMulti.clear();
    ctx.progSel = ctx.programablesDe(ctx.def)[0].id;
    ctx.seleccion = ctx.programablesDe(ctx.def)[0].id;
    ctx.seleccionadas = new Set([ctx.seleccion]);
    ctx.edicion = { ids: [], mixto: false };
    ctx.lineaCorre = {}; ctx.lineaErr = null;
    nuevoMundo();
    ctx.actualizarContenidoReto();
    ctx.$("reto-n").textContent = ctx.ES_CAMPAIGN ? ctx.mundo.hito : i === ctx.IDX_PROPIO ? "✎" : i + 1;
    if (ctx.ES_CAMPAIGN && !ctx.historialC.length) ctx.guardarCheckpoint();
    ctx.$("objetivo-corto").textContent = ctx.textoReto("objetivo");
    ctx.pintarPaleta();
    ctx.$("objetivo-txt").textContent = ctx.textoReto("objetivo");
    ctx.$("leccion").textContent = ctx.textoReto("leccion");
    if (!ctx.$("info-reto").hidden) pintarInfoReto();
    ctx.ocultarBanner(); ctx.limpiarConsola(); ctx.cerrarAvisos();
    ctx.pintarRetos(); ctx.pintarProgs(); ctx.abrirPrograma(ctx.progSel); ctx.pintarResumen(); ctx.pintarEventosYa(); pintarControles(); ctx.pintarEscenario();
  }


  function actualizarReloj() {
    const tiempo = (ctx.mundo ? ctx.mundo.t : 0).toFixed(1);
    const reloj = ctx.ti18n("partida.reloj.formato", { tiempo });
    ctx.$("reloj").textContent = reloj + (!ctx.ES_FACTORY && ctx.mundo && ctx.mundo.def.niebla ? ctx.ti18n("partida.reloj.niebla") : "");
  }
  function pintarHud(refrescarInfo = true) {
    actualizarReloj();
    if (ctx.ES_FACTORY || ctx.ES_CAMPAIGN) {
      const html = estadoMetas().map(f => `<span class="meta${f.estado === "ok" ? " cumplida" : f.estado === "rota" ? " rota" : ""}">${f.nombre} <b>${f.valor}</b></span>`).join("") + (ctx.ES_CAMPAIGN ? ctx.uiC.hudExtra() : "");
      if (html !== ctx.metasClave) { ctx.metasClave = html; ctx.$("metas").innerHTML = html; if (refrescarInfo) vivoInfoReto(); }
      return;
    }
    const m = ctx.mundo, me = ctx.def.metas;
    const clave = [ctx.CMGI18n?.idioma, m.brechas, m.derribos, m.atascos, m.consumidos, m.reparaciones, ctx.finActual, me.tiempoMax != null && m.t > me.tiempoMax].join("|");
    if (clave === ctx.metasClave) return;
    ctx.metasClave = clave;
    if (refrescarInfo) vivoInfoReto();
    const cpd = m.derribos ? (ctx.coste() / m.derribos).toFixed(1) : "—", rec = ctx.records[ctx.claveReto()];
    let html = `<span class="meta${m.brechas > me.brechasMax ? " rota" : ""}">${ctx.esc(ctx.ti18n("retos.hud.brechas"))} <b>${m.brechas}</b> · ${ctx.esc(ctx.ti18n("retos.hud.max", { n: me.brechasMax }))}</span>`;
    html += `<span class="meta${m.total && m.derribos === m.total ? " cumplida" : ""}">${ctx.esc(ctx.ti18n("retos.hud.derribados"))} <b>${m.derribos}/${m.total}</b>${me.derribosMin != null ? ` · ${ctx.esc(ctx.ti18n("retos.hud.min", { n: me.derribosMin }))}` : ""}</span>`;
    html += `<span class="meta${me.atascosMax != null && m.atascos > me.atascosMax ? " rota" : ""}">${ctx.esc(ctx.ti18n("retos.hud.atascos"))} <b>${m.atascos}</b>${me.atascosMax != null ? ` · ${ctx.esc(ctx.ti18n("retos.hud.max", { n: me.atascosMax }))}` : ""}</span>`;
    if (me.tiempoMax != null) html += `<span class="meta${m.t > me.tiempoMax ? " rota" : ""}">≤ ${me.tiempoMax} s</span>`;
    html += `<span class="meta optimo" title="${ctx.esc(ctx.ti18n("retos.hud.coste_tip"))}">${ctx.esc(ctx.ti18n("retos.hud.coste"))} <b>${cpd}</b>${rec != null ? ` · ${ctx.esc(ctx.ti18n("retos.hud.record", { n: rec.toFixed(1) }))}` : ""}</span>`;
    ctx.$("metas").innerHTML = html;
  }

  function actualizarEtiquetasControles() {
    const corriendo = !!ctx.ejec;
    const $e = ctx.$("b-ejecutar");
    $e.textContent = ctx.ti18n(corriendo ? "partida.ejecutar.detener" : "partida.ejecutar.ejecutar");
    for (const $ec of [ctx.$("b-ejecutar-cod"), ctx.$("b-ejecutar-flot")]) {
      $ec.textContent = ctx.ti18n(corriendo ? "partida.ejecutar.detener_editor" : "partida.ejecutar.ejecutar_editor");
    }
    // Teléfono: el mismo botón, solo con su icono (▶ / ■).
    const $em = ctx.$("b-ejecutar-movil");
    $em.setAttribute("aria-label", ctx.ti18n(corriendo ? "partida.ejecutar.detener_corto" : "partida.ejecutar.ejecutar_corto"));
    $em.dataset.tip = ctx.ti18n(corriendo ? "partida.ejecutar.detener_corto" : "partida.ejecutar.ejecutar_corto");
    const $p = ctx.$("b-pausa");
    $p.textContent = ctx.ti18n(ctx.pausa ? "partida.pausa.seguir" : "partida.pausa.pausar");
    const reto = ctx.retoIdx === ctx.IDX_PROPIO
      ? ctx.ti18n("partida.intento.escenario_propio")
      : ctx.ti18n("partida.intento.reto", { numero: ctx.retoIdx + 1 });
    ctx.$("intento-txt").textContent = ctx.ES_CAMPAIGN ? ctx.ti18n("campaign.intento", { numero: ctx.intento + (corriendo ? 0 : 1), hito: ctx.hitoActual().clave }) : ctx.ti18n("partida.intento.etiqueta", { numero: ctx.intento + (corriendo ? 0 : 1), reto });
    if (ctx.ES_CAMPAIGN) { const $r = ctx.$("b-reiniciar"); $r.textContent = ctx.ti18n(confirmarCheckpoint ? "campaign.reiniciar.confirmar" : "campaign.reiniciar", { hito: ctx.hitoActual().clave }); $r.dataset.tip = ctx.ti18n("campaign.reiniciar.tip"); }
  }
  function pintarControles() {
    const corriendo = !!ctx.ejec;
    const $e = ctx.$("b-ejecutar");
    $e.classList.toggle("primario", !corriendo); $e.classList.toggle("peligro", corriendo);
    for (const $ec of [ctx.$("b-ejecutar-cod"), ctx.$("b-ejecutar-flot")]) {
      $ec.classList.toggle("primario", !corriendo); $ec.classList.toggle("peligro", corriendo);
    }
    ctx.$("b-ejecutar-movil").classList.toggle("corriendo", corriendo);
    const $p = ctx.$("b-pausa");
    $p.disabled = !corriendo;
    actualizarEtiquetasControles();
    ctx.$("b-vel").textContent = `${ctx.velocidad}×`;
    ctx.$("semilla-txt").textContent = corriendo || ctx.semillaFija ? ctx.semilla : ctx.intento + 1;
    ctx.$("semilla-fija").checked = ctx.semillaFija;
    ctx.$codigo.readOnly = corriendo;
  }
  ctx.$("b-ejecutar").addEventListener("click", () => ctx.ejec ? ctx.detener() : ctx.ejecutar());
  // EJECUTAR del editor (pantalla completa): corre el código, pasa a la batalla y cierra el inspector.
  // Si hay un error, la batalla muestra su aviso con el enlace a la línea.
  // Con las herramientas plegadas, el mismo botón flota abajo a la izquierda del código.
  function ejecutarDesdeCodigo() {
    if (ctx.ejec) { ctx.detener(); return; }
    ctx.ejecutar();
    if (ctx.ejec) ctx.ponerInspector("cerrado");
    ctx.verPanel("mapa");
  }
  ctx.$("b-ejecutar-cod").addEventListener("click", ejecutarDesdeCodigo);
  ctx.$("b-ejecutar-flot").addEventListener("click", ejecutarDesdeCodigo);
  // Barra superior del teléfono: ejecutar sin quitar el foco al código (el teclado no se cierra).
  // Comentar pasó a la barra de inserción; su sitio es ahora el interruptor del modo sin teclado (layout.js).
  ctx.$("b-ejecutar-movil").addEventListener("pointerdown", (ev) => ev.preventDefault());
  ctx.$("b-ejecutar-movil").addEventListener("click", ejecutarDesdeCodigo);
  ctx.$("b-pausa").addEventListener("click", () => { ctx.pausa = !ctx.pausa; pintarControles(); });
  ctx.$("b-vel").addEventListener("click", () => { ctx.velocidad = ctx.velocidad === 1 ? 2 : ctx.velocidad === 2 ? 4 : ctx.velocidad === 4 ? 8 : 1; pintarControles(); });
  let confirmarCheckpoint = false;
  ctx.$("b-reiniciar").addEventListener("click", () => {
    if (ctx.ES_CAMPAIGN) {
      // Vuelve al inicio del hito en curso (su checkpoint); pide confirmación con un segundo toque.
      if (!confirmarCheckpoint) { confirmarCheckpoint = true; actualizarEtiquetasControles(); setTimeout(() => { confirmarCheckpoint = false; actualizarEtiquetasControles(); }, 3000); return; }
      confirmarCheckpoint = false;
      const cp = [...ctx.historialC].reverse().find(c => c.hito === ctx.mundo.hito) || ctx.historialC[ctx.historialC.length - 1];
      if (cp) ctx.volverA(cp, false);
      return;
    }
    if (ctx.ejec) ctx.terminar("detenido", "reinicio", null);
    nuevoMundo(); ctx.lineaCorre = {}; ctx.lineaErr = null; ctx.marcasSucias = true; ctx.ocultarBanner(); ctx.cerrarAvisos(); pintarControles();
  });
  ctx.$("semilla-fija").addEventListener("change", (ev) => {
    ctx.semillaFija = ev.target.checked; ctx.guardado.escribir("semillaFija", ctx.semillaFija);
    if (ctx.semillaFija && !ctx.ejec && ctx.finActual == null) ctx.semilla = ctx.intento + 1;
    pintarControles();
  });

  // Vista 3D o plano
  function aplicarVista(v) {
    ctx.vista = ctx.V3 ? v : "2d";
    ctx.guardado.escribir(`${ctx.PREFIJO}vista`, v);
    ctx.$("c3d").hidden = ctx.vista !== "3d"; ctx.$("c2d").hidden = ctx.vista !== "2d";
    ctx.$("sin3d").hidden = !!ctx.V3;
    ctx.$("b-centrar").hidden = ctx.vista !== "3d";
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-vista]")).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vista === ctx.vista)));
    tamanoCampo();
  }
  /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-vista]")).forEach(b => b.addEventListener("click", () => aplicarVista(b.dataset.vista)));
  ctx.$("b-centrar").addEventListener("click", () => ctx.V3 && ctx.V3.recentrar());
  function tamanoCampo() { if (ctx.V3) ctx.V3.redimensionar(); }
  new ResizeObserver(tamanoCampo).observe(ctx.$("campo"));

  return {
    partesPista, pistaDe, pistaTrasFallo, INFO, pintarInfoReto, textoInicial, copiaFuentes,
    guardarProgramas, lenguajeDe, textoDe, ponerTexto, textoInicialPython, convertirAPython,
    vistaPython, nuevoMundo, elegirReto, actualizarReloj, pintarHud, actualizarEtiquetasControles,
    pintarControles, aplicarVista
  };
}
