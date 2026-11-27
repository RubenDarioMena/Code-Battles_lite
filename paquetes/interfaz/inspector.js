/** instalarInspector: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarInspector(ctx) {
  // Inspector del panel inferior (bajo el editor): sin nombre ni estado, solo lo que el programa
  // abierto puede usar: funciones, propiedades, sus variables y constantes, y la red de sensores.
  function variablesPrograma() {
    const toks = ctx.lexico(ctx.$codigo.value).filter(t => !["esp", "nl", "com"].includes(t[0])), out = new Map();
    toks.forEach((t, i) => { if (["const", "let", "var"].includes(t[1]) && toks[i + 1] && toks[i + 1][0] === "id" && !out.has(toks[i + 1][1])) out.set(toks[i + 1][1], t[1]); });
    return [...out];
  }
  const varFactory = id => /^[A-Za-z_$][\w$]*$/.test(ctx.varDe(id)) && ctx.mundo.entidades.filter(e => ctx.varDe(e.id) === ctx.varDe(id)).length === 1 && !ctx.FN_PROPIAS.has(ctx.varDe(id)) && !ctx.KW.has(ctx.varDe(id)) && !(ctx.varDe(id) in window) ? ctx.varDe(id) : JSON.stringify(id);
  function htmlFactoryAPI() {
    return ctx.grupo("Encargos de R1", ctx.fila(ctx.tk("fn", "await pickUp(lugar, material)", "await pickUp(/* lugar */, /* material */);")),
      ctx.fila(ctx.tk("fn", "await deliver(lugar)", "await deliver(/* lugar */);")), ctx.fila(ctx.tk("fn", "await wait(segundos)", "await wait(1);")))
      + ctx.grupo("Lecturas", ...ctx.mundo.entidades.flatMap(e => ctx.factory.MATERIALES.map(mat => ctx.fila(ctx.tk("fn", `count("${e.id}", "${mat}")`, `count(${varFactory(e.id)}, ${JSON.stringify(mat)})`)))))
      + ctx.grupo("Lugares", ...ctx.mundo.entidades.map(e => ctx.fila(ctx.tk("var", e.id, varFactory(e.id)))));
  }
  function pintarPieIns() {
    if (ctx.ES_CAMPAIGN) { const $p = ctx.$("pie-ins"); if ($p && ctx.mundo) $p.innerHTML = ctx.uiC.pie(); return; }
    if (ctx.ES_FACTORY) { const $p = ctx.$("pie-ins"); $p.innerHTML = ctx.htmlInterfaz(htmlFactoryAPI()); ctx.aplicarTextosInspector($p); return; }
    const $p = ctx.$("pie-ins"), e = ctx.mundo && ctx.mundo.porId[ctx.progSel];
    if (!$p) return;
    if (!e) { $p.innerHTML = ctx.htmlInterfaz(`<p class="nota" ${ctx.hojaInspector("inspector.pista.sin_lanzador")}>${ctx.esc(ctx.textoInspector("inspector.pista.sin_lanzador"))}</p>`); ctx.aplicarTextosInspector($p); return; }
    const vars = variablesPrograma(), red = ctx.mundo.sensores;
    $p.innerHTML = ctx.htmlInterfaz(`<div class="pie-ins-cols">`
      + ctx.grupo("Funciones",
        ctx.fila(ctx.tk("fn", "autoTarget(tipo, sensor)", "autoTarget(/* tipo de enemigo */, /* sensor */)", { fin: "// → posición {x, y, z} o null" }), ctx.nota("→ posición")),
        ctx.fila(ctx.tk("fn", "regularShoot(lugar)", "regularShoot(/* lugar */);"), ctx.nota("1 disparo/s")),
        ctx.fila(ctx.tk("fn", "burstFire(lugar)", "burstFire(/* lugar */);"), ctx.nota("ráfaga")),
        ctx.fila(ctx.tk("fn", "stopFire()", "stopFire();")),
        ctx.fila(ctx.tk("fn", "await esperar(segundos)", "await esperar(0.5);"), ctx.nota("pausa")))
      + ctx.grupo("Propiedades",
        ctx.fila(ctx.tk("prop", "missiles", "missiles"), `<span class="sep">=</span>`, ctx.tkValor(e.misiles, `${e.id}:missiles`), ctx.nota(`/ ${ctx.def.cargador}`)),
        ctx.fila(ctx.tk("prop", "failureRate", "failureRate"), `<span class="sep">=</span>`, ctx.tkValor(ctx.r3(e.falla), `${e.id}:failureRate`)),
        ctx.fila(ctx.tk("prop", "fireRate", "fireRate"), `<span class="sep">=</span>`, ctx.tkValor(ctx.cadencia(e.modo), `${e.id}:fireRate`)),
        ctx.fila(ctx.tk("prop", "mode", "mode"), `<span class="sep">=</span>`, ctx.tkValor(e.modo, `${e.id}:mode`)),
        ctx.fila(ctx.tk("prop", "jammed", "jammed"), `<span class="sep">=</span>`, ctx.tkValor(e.atascado, `${e.id}:jammed`)),
        ctx.fila(ctx.tk("prop", "target", "target"), `<span class="sep">=</span>`, `<span class="nota" data-vivo="${e.id}:target">${ctx.esc(ctx.fmtLugar(e.lugar))}</span>`),
        ctx.fila(ctx.tk("prop", "sensors", "sensors"), `<span class="sep">=</span>`, ctx.tk("str", '"visual"', '"visual"'), ctx.tk("str", '"thermal"', '"thermal"')))
      + ctx.grupo("Variables y constantes", vars.length
        ? ctx.fila(...vars.map(([n, k]) => `<span class="var-prog">${ctx.tk("var", n, n)}${ctx.nota(k)}</span>`))
        : ctx.fila(ctx.nota(`<span ${ctx.hojaInspector("inspector.pista.sin_variables")}>${ctx.esc(ctx.textoInspector("inspector.pista.sin_variables"))}</span>`)))
      + (red.length ? ctx.grupo("Red de sensores", ...red.map(x => ctx.fila(ctx.tk("fn", `${ctx.varDe(x.id)}.detect(tipo)`, `${ctx.varDe(x.id)}.detect(/* tipo de enemigo */)`, { fin: "// → posición actual o null" }),
        ctx.tk("prop", `${ctx.varDe(x.id)}.count`, `${ctx.varDe(x.id)}.count`), `<span class="sep">=</span>`, ctx.tkValor(ctx.enRango(x).length, `${x.id}:count`)))) : "")
      + `</div>`);
    ctx.aplicarTextosInspector($p);
  }
  /** @type {ReturnType<typeof setTimeout> | number} */
  let tPieIns = 0;

  // Signos vitales: gráficos propios que se leen de un vistazo (cargador, failureRate y su historia, vida).
  const historia = new Map();   // id de lanzador → [[t, failureRate], …] de los últimos 30 s de juego
  const VENTANA = 30;
  function muestrear() {
    for (const l of ctx.mundo.lanzadores) {
      const h = historia.get(l.id) || (historia.set(l.id, []), historia.get(l.id));
      if (!h.length || h[h.length - 1][0] !== ctx.mundo.t) h.push([ctx.mundo.t, l.falla]);
      while (h.length && h[0][0] < ctx.mundo.t - VENTANA) h.shift();
    }
  }
  const celdas = (n, total, extra = "") => `<div class="celdas ${extra}">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`;
  const CLAVES_VITAL = { Misiles: "inspector.vital.misiles", "En rango": "inspector.vital.en_rango", Alcance: "inspector.vital.alcance",
    Cola: "inspector.vital.cola", Reparaciones: "inspector.vital.reparaciones", Entregados: "inspector.vital.entregados",
    Suministro: "inspector.vital.suministro", Vida: "inspector.vital.vida", Altura: "inspector.vital.altura", Posición: "inspector.vital.posicion" };
  const vital = (k, v, cuerpo = "") => {
    const clave = CLAVES_VITAL[k], metrica = ctx.CLAVES_METRICA[k], titulo = clave ? `<span ${ctx.hojaInspector(clave)}>${ctx.esc(ctx.textoInspector(clave))}</span>` : metrica ? ctx.spanInspector(`inspector.metrica.${metrica}`) : k;
    return `<div class="vital"><div class="k"><span>${titulo}</span>${v != null ? `<b>${v}</b>` : ""}</div>${cuerpo}</div>`;
  };
  function traza(id) {
    const h = historia.get(id) || [];
    const max = Math.max(0.2, ...h.map(p => p[1])) * 1.1, t1 = ctx.mundo.t, t0 = t1 - VENTANA;
    const pts = h.map(([t, f]) => `${((t - t0) / VENTANA * 100).toFixed(2)},${(30 - f / max * 28).toFixed(2)}`);
    const linea = pts.length > 1 ? `<path class="area" d="M${pts[0].split(",")[0]},30L${pts.join("L")}L${pts[pts.length - 1].split(",")[0]},30Z"/><polyline class="linea" points="${pts.join(" ")}"/>` : "";
    return `<svg class="traza" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><line class="base" x1="0" y1="30" x2="100" y2="30"/>${linea}</svg>
      <div class="traza-pie"><span>−${VENTANA} s</span><span><span ${ctx.hojaInspector("inspector.traza.escala")}>${ctx.esc(ctx.textoInspector("inspector.traza.escala"))}</span> 0–${ctx.r3(max)}</span><span ${ctx.hojaInspector("inspector.traza.ahora")}>${ctx.esc(ctx.textoInspector("inspector.traza.ahora"))}</span></div>`;
  }
  function htmlVitales(e) {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.vitales(e);
    if (["robot", "bodega", "fundidora"].includes(e.clase)) return ctx.metricasDe(e).map(([k, v]) => vital(ctx.esc(k), ctx.esc(v))).join("");
    if (e.clase === "lanzador") {
      return vital("Misiles", `${e.misiles}/${ctx.def.cargador}`, celdas(e.misiles, ctx.def.cargador))
        + vital("failureRate", ctx.r3(e.falla), `<div class="medidor"><i style="width:${Math.min(100, Math.round(e.falla * 100))}%"></i></div>`)
        + `<div class="vital" style="grid-column:1/-1"><div class="k"><span>failureRate · <span ${ctx.hojaInspector("inspector.traza.ultimos", { segundos: VENTANA })}>${ctx.esc(ctx.textoInspector("inspector.traza.ultimos", { segundos: VENTANA }))}</span></span><b>${ctx.esc(e.modo)}</b></div>${traza(e.id)}</div>`;
    }
    if (e.clase === "vibracion") return vital("En rango", ctx.enRango(e).length) + vital("Alcance", `${e.alcance} casillas`);
    if (e.clase === "reparador") return vital("Cola", ctx.esc(ctx.mundo.colaReparar.join(", ") || "vacía")) + vital("Reparaciones", e.st.reparaciones);
    if (e.clase === "deposito") return vital("Entregados", ctx.mundo.consumidos) + vital("Suministro", `${ctx.def.suministro} misil/s`);
    return vital("Vida", `${e.hp}/${e.hpMax}`, celdas(e.hp, e.hpMax, "vida")) + vital("Altura", `${e.z} m`) + vital("Posición", `x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}`);
  }
  ctx.$("inspector").addEventListener("click", (ev) => {
    const b = /** @type {any} */ (ev.target).closest("[data-accion]");
    // Un token de la tira (la minificha de Campaign-V2) se arma o inserta como en la ficha: no la abre.
    if (!b) { if (ctx.insEstado === "tira" && /** @type {any} */ (ev.target).closest(".ins-tira") && !(/** @type {any} */ (ev.target).closest(".tk"))) ctx.abrirInspector(); return; }
    const a = b.dataset.accion;
    if (a === "programa") { ctx.verPanel("codigo"); ctx.abrirPestana("programa"); ctx.abrirPrograma(ctx.seleccion); }
    else if (a === "centrar") ctx.centrarEn(ctx.seleccion);
    else if (a === "abrir") ctx.abrirInspector();
    else if (a === "plegar") ctx.ponerInspector("tira");
    else if (a === "cerrar") ctx.ponerInspector("cerrado");
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (ctx.$("hoja-reto")?.hidden === false) ctx.abrirHoja(false);
    else if (ctx.insEstado === "abierto") ctx.ponerInspector("tira");
  });
  function valorVivo(clave) {
    if (ctx.ES_CAMPAIGN) return ctx.uiC.vivo(clave);
    const [id, p] = clave.split(":");
    if (clave === "cola") return ctx.mundo.colaReparar.join(", ") || "vacía";
    const e = ctx.mundo.porId[id] || ctx.mundo.enemigos.find(x => x.id === id);
    if (!e) return null;
    switch (p) {
      case "missiles": return e.misiles;
      case "charges": return e.cargas;
      case "failureRate": return ctx.r3(e.falla);
      case "fireRate": return ctx.cadencia(e.modo);
      case "mode": return e.modo;
      case "jammed": return e.atascado;
      case "target": return ctx.fmtLugar(e.lugar);
      case "count": return ctx.enRango(e).length;
      case "hp": return `${e.hp}/${e.hpMax}`;
      case "pos": return `x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}`;
    }
    return null;
  }
  // Valores vivos del inspector; con un documento Python, True/False/None.
  const textoVivo = (el, v) => { const t = el.classList.contains("tk-str") ? JSON.stringify(v) : String(v); return ctx.edicion.lenguaje === "python" ? ctx.aPython(t) : t; };
  function actualizarVivos() {
    const $i = ctx.$("inspector");
    muestrear();
    for (const el of ctx.$("pie-ins").querySelectorAll("[data-vivo]")) {
      const v = valorVivo(el.dataset.vivo); if (v == null) continue;
      const txt = textoVivo(el, v);
      if (el.textContent !== txt) { el.textContent = txt; if (el.dataset.ins != null) el.dataset.ins = txt; }
    }
    const e = ctx.seleccion && (ctx.mundo.porId[ctx.seleccion] || ctx.mundo.enemigos.find(x => x.id === ctx.seleccion));
    if ([...ctx.seleccionadas].some(id => !ctx.unidadPorId(id))) { ctx.seleccionar([...ctx.seleccionadas].filter(id => ctx.unidadPorId(id)), { inspeccionar: "conservar" }); return; }
    if (!e) return;
    for (const el of $i.querySelectorAll("[data-vivo]")) {
      const v = valorVivo(el.dataset.vivo); if (v == null) continue;
      const txt = textoVivo(el, v);
      if (el.textContent !== txt) { el.textContent = txt; if (el.dataset.ins != null) el.dataset.ins = txt; }
    }
    const barra = $i.querySelector("[data-barra]"); if (barra && !ctx.ES_CAMPAIGN) barra.style.width = `${Math.round(e.falla * 100)}%`;
    const est = $i.querySelector("[data-estado]"); if (est) { const [cls] = ctx.estadoDe(e); est.className = `estado ${cls}`; est.textContent = ctx.textoEstadoInspector(e); }
    const vit = ctx.$("ins-vitales"); if (vit) { const h = htmlVitales(e); if (vit.innerHTML !== h) vit.innerHTML = h; }
    const met = $i.querySelector("[data-metricas]"), metricas = met && ctx.metricasDe(e); if (metricas) { const h = ctx.htmlMetricas(metricas); if (met.innerHTML !== h) met.innerHTML = h; }
  }

  // Doble clic (o doble toque) inserta; un clic solo arma el token y explica qué insertará.
  let armado = { clave: null, t: 0 };
  document.addEventListener("click", (ev) => {
    const t = /** @type {any} */ (ev.target).closest(".tk"); if (!t) return;
    const $p = ctx.$("pista-tk");
    if (t.dataset.ajeno) { if ($p) { const mensaje = `${t.dataset.ajeno}. Desde aquí puedes leer sus propiedades.`; if (ctx.CMGPresentacion) ctx.CMGPresentacion.rotular($p, mensaje); else $p.textContent = mensaje; } return; }
    const ahora = performance.now();
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".tk.armado")).forEach(x => x.classList.remove("armado"));
    if (armado.clave === t.dataset.clave && ahora - armado.t < 550) {
      armado = { clave: null, t: 0 };
      ctx.insertarRef(t.dataset.ins, t.dataset.fin);
      ctx.insercion.dobleClic++;
      t.classList.add("hecho"); setTimeout(() => t.classList.remove("hecho"), 400);
      if ($p) $p.innerHTML = ctx.htmlInterfaz(`Insertado <code>${ctx.esc(t.dataset.ins)}</code> en ${ctx.esc(ctx.progSel)}.`);
    } else {
      armado = { clave: t.dataset.clave, t: ahora };
      t.classList.add("armado");
      if ($p) $p.innerHTML = ctx.htmlInterfaz(`Doble clic inserta <code>${ctx.esc(t.dataset.ins)}</code> donde está el cursor del programa.`);
    }
  });
  // Una paleta que no se puede armar (p. ej. una caché con archivos de versiones distintas) no debe
  // cortar el arranque: el juego sigue sin botones y lo avisa en el editor.

  const paletaSegura = hacer => { try { return hacer(); } catch (e) { ctx.paletaRota ||= e; console.error("Paleta no disponible:", e); return { atajos: [] }; } };
  const { atajos: ATAJOS } = paletaSegura(() => ctx.CMGPaleta.crear({
    serie: ctx.SERIE, extension: ctx.extension,
    sensor: () => ctx.mundo && ctx.mundo.sensores[0] ? ctx.varDe(ctx.mundo.sensores[0].id) : null,
  }));
  const preferenciasEditor = prefijo => ({
    leer(k, d) { try { const v = ctx.plataforma.almacen.leer(prefijo + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    escribir(k, v) { try { ctx.plataforma.almacen.escribir(prefijo + k, JSON.stringify(v)); } catch { /* sesión */ } },
  });
  const preferenciasVistas = preferenciasEditor(`cmg-juego-${ctx.PREFIJO}`);
  if (ctx.ES_FACTORY) for (const [k, viejo] of [["modo", "modo"], ["idioma-seudo", "idioma"]]) {
    if (preferenciasVistas.leer(k, null) == null) try { const v = JSON.parse(ctx.plataforma.almacen.leer(`cmg-banco02:${viejo}`)); if (v != null) preferenciasVistas.escribir(k, v); } catch { /* importación de solo lectura */ }
  }
  const editorPrograma = ctx.CMGEditor.crear({
    raiz: ctx.$("v-programa"), app: ctx.$("app"), ambito: document, elemento: ctx.$, adoptar: true, atajosGlobales: true,
    documento: { id: "inicio", lenguaje: "js", texto: "", revision: 0 },
    adaptadores: ctx.PYTHON ? { js: ctx.CMGAdaptadorJS, python: ctx.CMGAdaptadorPython } : { js: ctx.CMGAdaptadorJS }, serie: ctx.SERIE, aplazarVistas: true,
    preferencias: preferenciasEditor("cmg-juego-"), preferenciasVistas,
    soloLectura: () => ctx.edicionBloqueada, alEjecutar: () => ctx.alternarEjecucion(),
    alAtajo: () => ctx.insercion.atajo++, alArrastrar: () => ctx.insercion.arrastre++,
    proveedor: {
      funciones: () => ctx.proveedorEditor.funciones(), firma: f => ctx.extension?.funciones().find(x => x.nombre === f)?.firma ?? ctx.FIRMAS[f] ?? null,
      sugerencias: c => ctx.edicion.lenguaje === "python" ? ctx.sugerenciasPython(c) : ctx.sugerencias(c),
      vocabulario: l => l === "python" ? ctx.vocabularioPython() : ({ objetos: ["console", "yo", ...ctx.nombresVar()], funciones: [...ctx.FN_PROPIAS], miembros: [...ctx.FN_MIEMBRO], propiedades: [...ctx.PROPS] }),
      atajos: l => l === "python" ? ctx.atajosPython() : ATAJOS,
    },
    datos: () => ctx.cmg.datos(), inicial: () => ctx.cmg.inicial(),
  });
  // La fachada se rehace al cambiar de lenguaje: se llama siempre a la vigente.
  const viva = nombre => (...args) => editorPrograma.fachada[nombre](...args);
  const insertar = viva("insertar"), envolver = viva("envolver"), alternarComentario = viva("alternarComentario"), medirEditor = viva("medirEditor"),
    pintarResaltado = viva("pintarResaltado"), seleccionarHueco = viva("seleccionarHueco"), avisoEditor = viva("aviso");
  const pintarPaleta = () => editorPrograma.fachada.atajos(ctx.edicion.lenguaje === "python" ? ctx.atajosPython() : ATAJOS);
  const $editor = ctx.$("editor");
  ctx.$("codigo").addEventListener("input", () => { clearTimeout(tPieIns); tPieIns = setTimeout(pintarPieIns, 350); });

  document.addEventListener("dragstart", (ev) => {
    const t = /** @type {any} */ (ev.target).closest && /** @type {any} */ (ev.target).closest(".tk[data-ins]"); if (!t) return;
    ev.dataTransfer.setData("text/plain", t.dataset.ins); ev.dataTransfer.effectAllowed = "copy";
    $editor.classList.add("soltar");
  });
  document.addEventListener("dragend", () => $editor.classList.remove("soltar"));

  return {
    variablesPrograma, varFactory, htmlFactoryAPI, pintarPieIns, historia, celdas, vital,
    htmlVitales, actualizarVivos, paletaSegura, editorPrograma, insertar, envolver,
    alternarComentario, medirEditor, pintarResaltado, seleccionarHueco, avisoEditor, pintarPaleta,
    $editor
  };
}
