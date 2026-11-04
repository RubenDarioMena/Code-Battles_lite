/* Code Battle Lite · juego de programación y defensa.
 * Simulación determinista, runtime del jugador en Web Workers, vista 3D/plano, inspector y editor.
 * Inspector en tres estados con signos vitales, pulsación larga en el campo y paleta de iconos.
 * El reparto de pantalla, el teclado del teléfono y los tooltips viven en layout.js. */
(() => {
  "use strict";

  // ---------- Constantes del mundo ----------
  const ES_FACTORY = new URLSearchParams(location.search).get("serie") === "factory";
  // Python (E5): cada unidad se programa en JavaScript o en Python. Python se traduce a JS con las mismas
  // líneas (shared/python/traductor.js) y corre en el mismo Worker.
  const PYTHON = !!window.CMGAdaptadorPython && !!window.CMGPythonJS;
  let COLS = 32, ROWS = 18;      // casillas de 1 m
  const LINEA_BASE = 3;            // x de la línea roja: cruzarla es una brecha
  const DT = window.NUCLEO.DT;                 // paso fijo de simulación (tiempo de juego)
  const VIGIA_MS = 2500;           // bucle sin await
  const MAX_ORDENES = 4000;        // mensajes seguidos sin esperar
  const T_LIMITE = 400;            // tiempo de juego máximo de un intento
  const CLAVE = "cmg-banco03";
  const { TIPOS, SENSOR, LAU, MISIL, REP, COSTE } = window.WAR;
  const NIVELES = ["log", "info", "warn", "error"];

  // ---------- Funciones de los robots (provisionales) ----------
  // El color lo decide la función principal; la secundaria solo se insinúa con un arco del halo.
  // Clases y nombres son marcadores hasta fijar la taxonomía definitiva: basta con cambiar estas tablas.
  const FUNCIONES = { ofensiva: "Ofensiva", rastreo: "Rastreo y telemetría", utilitaria: "Utilitaria", fabrica: "Fábrica" };
  const FUNCION_DE = {
    lanzador: { principal: "ofensiva", secundaria: "rastreo" },
    vibracion: { principal: "rastreo" },
    reparador: { principal: "utilitaria" },
    deposito: { principal: "fabrica" },
    robot: { principal: "utilitaria" }, bodega: { principal: "fabrica" }, fundidora: { principal: "fabrica" },
  };
  const funcionDe = (e) => FUNCION_DE[e.clase] || null;
  const RADIO_DE = { lanzador: .9, vibracion: .6, deposito: 1.2, reparador: .5 };
  const radioDe = (e) => RADIO_DE[e.clase] || .6;
  // Luces de cada clase en coordenadas locales (x, altura, y del mapa). El frente mira a la derecha.
  const LUCES = { lanzador: [[.56, .32, .3], [.56, .32, -.3]], vibracion: [[0, 1.4, 0]], deposito: [[.71, .52, .55], [.71, .52, -.55]], reparador: [[.12, .7, .12]] };
  // Halo: anillo difuso en la textura, a FR del radio. Cada parada es [desplazamiento, opacidad].
  const FR = .62;
  const HALO = {
    medio: [[-.12, 0], [0, .9], [.18, 0]],
    suave: [[-.2, 0], [0, .6], [.3, 0]],
    neon: [[-.16, 0], [-.03, .35], [-.008, 1], [.008, 1], [.04, .35], [.2, 0]],
  };
  const ARCO = [2, 2.9];  // ángulos del arco de la función secundaria (arriba a la izquierda)
  const INTENSIDAD = { media: 1, baja: .55, alta: 1.6 };
  // Variantes en prueba: ?poc=1 muestra el selector y la URL conserva la elección.
  const VARIANTES = {
    paleta: { a: "A · Neón", b: "B · Contraste", c: "C · Sobria" },
    halo: { medio: "Medio", suave: "Suave", neon: "Neón", no: "Sin halo" },
    brillo: { pilotos: "Pilotos", faros: "Faros", aura: "Aura", no: "Sin brillo" },
    intensidad: { media: "Media", baja: "Baja", alta: "Alta" },
  };
  const visual = (() => {
    const q = new URLSearchParams(location.search), v = {};
    for (const [k, ops] of Object.entries(VARIANTES)) v[k] = Object.hasOwn(ops, q.get(k)) ? q.get(k) : Object.keys(ops)[0];
    return v;
  })();
  document.documentElement.dataset.paleta = visual.paleta;
  // Dirección del brillo de faros: la torre, el avance del reparador o un barrido del sensor (solo dibujo).
  const rumbos = new Map();
  function direccionDe(e, ahora) {
    if (e.clase === "lanzador") return e.yaw;
    if (e.clase === "vibracion") return ahora / 900;
    if (e.clase !== "reparador") return 0;
    const p = rumbos.get(e.id) || { x: e.cx, y: e.cy, a: 0 };
    if (Math.hypot(e.cx - p.x, e.cy - p.y) > 1e-3) p.a = Math.atan2(e.cy - p.y, e.cx - p.x);
    p.x = e.cx; p.y = e.cy; rumbos.set(e.id, p);
    return p.a;
  }

  const { RETOS: RETOS_WAR, PROPIO_BASE, POS_LANZADORES, normalizar } = window.WAR_RETOS;

  // Avisos para quien escuche fuera del juego (telemetría remota): nunca interrumpen la partida.
  const avisar = (tipo, detalle) => { try { window.dispatchEvent(new CustomEvent(tipo, { detail: detalle })); } catch { /* sin oyentes */ } };

  const RETOS = ES_FACTORY ? window.FACTORY_RETOS.RETOS : RETOS_WAR;
  const programablesDe = d => d.robots || d.lanzadores;

  // ---------- Almacenamiento local (comodidad del jugador) ----------
  const guardado = {
    leer(k, def) { try { const v = localStorage.getItem(`${CLAVE}:${k}`); return v == null ? def : JSON.parse(v); } catch { return def; } },
    escribir(k, v) { try { localStorage.setItem(`${CLAVE}:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  // ---------- Runtime del jugador (un Web Worker por lanzador) ----------
  // Las lecturas (autoTarget, propiedades, VIB_01.detect) salen de una instantánea del mundo que llega
  // cada vez que el programa despierta; las órdenes se mandan sin esperar respuesta. El tiempo de juego
  // solo avanza mientras todos los programas están en `await esperar(...)`.
  const WORKER_URL = window.RUNTIME.url;

  // ---------- Léxico (resaltado e instrumentación comparten el mismo) ----------
  const KW = new Set("await async break case catch class const continue default delete do else false finally for function if in instanceof let new null of return switch this throw true try typeof undefined var void while".split(" "));
  const FN_PROPIAS = new Set(ES_FACTORY ? ["pickUp", "deliver", "wait", "count", "recoger", "entregar", "esperar", "cuantos", "log"] : ["autoTarget", "regularShoot", "burstFire", "stopFire", "esperar", "log"]);
  const FN_MIEMBRO = new Set(["pickUp", "deliver", "wait", "count", "recoger", "entregar", "cuantos", "esperar", "autoTarget", "regularShoot", "burstFire", "stopFire", "detect", "log", "info", "warn", "error"]);
  const PROPS = new Set(["failureRate", "missiles", "mode", "jammed", "fireRate", "sensors", "target", "count"]);
  // Nombres de los huecos /* … */ que dejan las plantillas y el modo sin teclado.
  const { NOMBRES_HUECO, HUECO, RE_HUECO, lexico } = window.CMGEditorJS;
  // Vecino significativo (salta espacios y comentarios en la misma línea).
  function vecino(toks, i, dir) {
    for (let j = i + dir; j >= 0 && j < toks.length; j += dir) { const k = toks[j][0]; if (k !== "esp" && k !== "com") return toks[j]; }
    return null;
  }
  const esObjeto = (nombre) => nombre === "console" || nombre === "yo" || nombresVar().includes(nombre);

  // Cada llamada de la API lleva su número de línea, para iluminarla y para los mensajes de error.
  function instrumentar(src) {
    const locales = new Set();
    if (ES_FACTORY && window.acorn) {
      try {
        const ast = acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
        const binding = n => { if (!n) return; if (n.type === "Identifier") locales.add(n.name); else if (n.type === "RestElement") binding(n.argument); else if (n.type === "AssignmentPattern") binding(n.left); else if (n.type === "ArrayPattern") n.elements.forEach(binding); else if (n.type === "ObjectPattern") n.properties.forEach(p => binding(p.value || p.argument)); };
        const walk = n => { if (!n || typeof n !== "object") return; if (n.type === "VariableDeclarator") binding(n.id); if (n.type === "Property" && n.method) binding(n.key); if (/Function/.test(n.type || "")) { binding(n.id); (n.params || []).forEach(binding); } if (n.type === "CatchClause") binding(n.param); for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") walk(v); };
        walk(ast);
      } catch (_) { /* El worker conserva el diagnóstico de sintaxis. */ }
    }
    const toks = lexico(src); let linea = 1, out = "";
    toks.forEach(([k, t], i) => {
      if (k === "id") {
        const prev = vecino(toks, i, -1), sig = vecino(toks, i, 1);
        const miembro = prev && prev[1] === ".";
        if (!miembro && !locales.has(t) && ((FN_PROPIAS.has(t) && sig && sig[1] === "(") || (esObjeto(t) && sig && sig[1] === "."))) { out += `__L(${linea}).${t}`; return; }
      }
      out += t;
      for (const ch of t) if (ch === "\n") linea++;
    });
    return out;
  }
  const clasificar = (toks, i) => window.CMGAdaptadorJS.clasificar(toks, i, {
    objetos: ["console", "yo", ...nombresVar()], funciones: [...FN_PROPIAS], miembros: [...FN_MIEMBRO], propiedades: [...PROPS],
  });

  // ---------- Simulación (determinista: paso fijo y una semilla para los fallos) ----------
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const coma = (v, d = 1) => v.toFixed(d).replace(".", ",");
  const cadencia = window.WAR.cadencia;
  const alcance = sensor => combate.alcance(sensor);
  const enRango = sensor => combate.enRango(sensor);
  const coste = () => combate.coste();
  const crearMundo = (def, semilla) => def.serie === "factory" ? window.FACTORY.crear(def, semilla) : window.WAR.crear(def, semilla);
  const instantanea = () => ES_FACTORY ? { t: mundo.t, maq: {}, auto: {}, vib: {}, factory: window.FACTORY.instantanea(mundo) } : combate.instantanea();
  const paso = dt => (logistica || combate).paso(dt);
  const evaluar = () => (logistica || combate).evaluar();
  function registrar(maquina, linea, que, resultado, clase) {
    mundo.eventos.push({ t: +mundo.t.toFixed(2), maquina, linea: linea ?? "", que, resultado, clase });
    eventosSucios = true;
  }

  // ---------- Estado ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const varDe = (id) => id.replace(/-/g, "_");
  const nombresVar = () => mundo ? (ES_FACTORY ? mundo.maquinas : [...mundo.programables, ...mundo.sensores]).map(e => varDe(e.id)) : [];
  const RUTEO_DEF = { log: "globo", info: "globo", warn: "globo", error: "pantalla" };
  const IDX_PROPIO = RETOS.length;

  const retoFactoryInicial = () => {
    const q = new URLSearchParams(location.search).get("reto");
    if (q === "propio") return IDX_PROPIO;
    if (q != null && /^\d+$/.test(q)) return Number(q);
    let viejo = 0; try { viejo = JSON.parse(localStorage.getItem("cmg-banco02:reto")) || 0; } catch (_) { /* Sin selección antigua. */ }
    return guardado.leer("factory-reto", viejo);
  };
  let retoIdx = Math.min(IDX_PROPIO, Math.max(0, (ES_FACTORY ? retoFactoryInicial() : guardado.leer("reto", 0)) | 0));
  let propio = ES_FACTORY ? window.FACTORY_RETOS.normalizar(guardado.leer("factory-propio", (() => { try { return JSON.parse(localStorage.getItem("cmg-banco02:propio")); } catch { return null; } })())) : normalizar(guardado.leer("propio", PROPIO_BASE));
  let hechos = guardado.leer("hechos", []);
  let records = guardado.leer("records", {});
  // D6: una tabla de récords por reto; el lenguaje del intento es solo una etiqueta (War la guarda aparte para no cambiar «records»).
  let recordsLenguaje = guardado.leer("records-lenguaje", {});
  const etiquetaLenguaje = l => l && l !== "js" ? ` <span class="etq-lenguaje">${l === "python" ? "Python" : "JS + Python"}</span>` : "";
  let telemetria = guardado.leer(ES_FACTORY ? "factory-telemetria" : "telemetria", []);
  let logistica = null, combate = null;
  let ruteo = { ...RUTEO_DEF, ...guardado.leer("ruteo", {}) };
  let vista = guardado.leer(ES_FACTORY ? "factory-vista" : "vista", "3d");
  let colores = guardado.leer("colores", true);
  let tamLetra = guardado.leer("letra", 14);
  let semillaFija = !!guardado.leer("semillaFija", false);
  let def = null, programas = {}, progSel = "LAU-01";
  // Programas en Python (fuentes-<reto>): { id: { lenguaje: "python", texto, enUso } }. «programas» y
  // prog-<reto> siguen siendo solo JS; una unidad con su fuente Python en uso se edita en Python y su JS se conserva.
  let fuentes = {};
  let mundo = null, ejec = null, pausa = false, velocidad = 1, turbo = 1, intento = 0, semilla = 1;
  let seleccion = null;
  let seleccionadas = new Set();
  let edicion = { ids: [], mixto: false, lenguaje: "js" };
  const borradoresMulti = new Map();
  const claveEdicion = (ids) => [...ids].sort().join("|");
  let lineaCorre = {}, lineaErr = null;
  let insercion = { dobleClic: 0, arrastre: 0, atajo: 0 };
  let eventosSucios = false, marcasSucias = false;
  const globos = new Map();   // id de máquina → { nivel, texto, hasta }

  const defActual = () => retoIdx === IDX_PROPIO ? propio : ES_FACTORY ? RETOS[retoIdx] : normalizar(RETOS[retoIdx]);
  const claveReto = () => (ES_FACTORY ? "factory-" : "") + (retoIdx === IDX_PROPIO ? "propio" : String(retoIdx));

  // ---------- Ciclo de los programas (lockstep) ----------
  const algunoCorre = () => window.RUNTIME.algunoCorre(ejec);
  function soloComentarios(src) { return lexico(src).every(([k]) => k === "com" || k === "esp" || k === "nl"); }

  // Antes de ejecutar: huecos /* … */ sin rellenar y errores de sintaxis, con su línea.
  function revisar(src) {
    const lineas = src.split("\n");
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(new RegExp(`\\/\\*\\s*(${NOMBRES_HUECO})\\s*\\*\\/`));
      if (m && !/^\s*\/\//.test(lineas[i])) return { linea: i + 1, mensaje: `Rellena el hueco /* ${m[1]} */ antes de ejecutar. Doble clic en un valor del inspector lo pone en su lugar.` };
    }
    if (typeof acorn !== "undefined") {
      try { acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
      catch (e) { return { linea: e.loc ? e.loc.line : null, mensaje: `Error de sintaxis: ${e.message.replace(/\s*\(\d+:\d+\)$/, "")}.` }; }
    }
    return null;
  }

  function ejecutar() {
    if (edicion.mixto && $codigo.value.trim()) {
      mostrarBanner("fallo", "Aplica el borrador antes de ejecutar",
        "El borrador todavía no pertenece a los lanzadores. Usa Add para anexarlo o Replace para sustituir sus programas.", null,
        [["Volver al borrador", "primario", () => { ocultarBanner(); verPanel("codigo"); abrirPestana("programa"); $codigo.focus(); }]]);
      return;
    }
    cerrarProgramas();
    // Cada unidad, en su lenguaje: JS se revisa con acorn; Python se traduce (huecos, sangría y sintaxis con su línea).
    const codigos = {}, lenguajes = {}, fuentesTexto = {};
    for (const l of programablesDe(def)) {
      const lenguaje = lenguajeDe(l.id), texto = textoDe(l.id) || "";
      let err = null;
      lenguajes[l.id] = lenguaje; fuentesTexto[l.id] = texto;
      if (lenguaje === "python") {
        const r = window.CMGPythonJS.traducirCache(texto, opcionesPython());
        if (r.ok) codigos[l.id] = r.js;
        else err = r.diagnosticos[0];
        if (r.ok && typeof acorn !== "undefined") {
          try { acorn.parse(r.js, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
          catch (e) { err = { linea: e.loc ? e.loc.line : null, mensaje: "El traductor de Python no pudo con esta línea. Reescríbela de otra forma o avísanos." }; }
        }
      } else {
        codigos[l.id] = texto;
        err = ES_FACTORY ? null : revisar(texto);
      }
      if (err) {
        abrirPrograma(l.id); lineaErr = { id: l.id, linea: err.linea }; marcasSucias = true;
        ultimoAviso[claveReto()] = { resultado: "sintaxis", motivo: "error", texto: err.mensaje, linea: err.linea, id: l.id, cuando: Date.now() };
        avisar("cmg:intento", { reto: retoIdx + 1, titulo: def.titulo, intento: intento + 1, resultado: "sintaxis", motivo: "error", mensaje: err.mensaje, linea: err.linea, programa: l.id, codigos: { ...fuentesTexto }, lenguajes: { ...lenguajes } });
        mostrarBanner("fallo", err.linea ? `Línea ${err.linea} de ${l.id}` : `Programa de ${l.id}`, esc(err.mensaje), null, [["Ir a la línea", "primario", () => { ocultarBanner(); irALinea(err.linea); }]]);
        return;
      }
    }
    intento++;
    if (!semillaFija) semilla = intento;
    nuevoMundo(intento);
    mundo.activo = true;
    limpiarConsola(); ocultarBanner(); cerrarAvisos();
    lineaCorre = {}; lineaErr = null; marcasSucias = true;
    const snap = instantanea();
    const nombres = (ES_FACTORY ? mundo.maquinas : [...mundo.programables, ...mundo.sensores]).map(e => e.id);
    ejec = { progs: new Map(), inicio: new Date().toISOString(), codigos: {}, lenguajes };
    for (const l of mundo.programables) {
      const codigo = codigos[l.id] || "";
      const w = new Worker(WORKER_URL);
      const p = { id: l.id, worker: w, estado: "corre", desde: performance.now(), mensajes: 0, espera: null, despertar: 0 };
      w.onmessage = (ev) => alMensaje(p, ev.data);
      w.onerror = (ev) => { ev.preventDefault(); errorPrograma(p, ev.message || "Error en el programa.", null); };
      ejec.progs.set(l.id, p);
      ejec.codigos[l.id] = fuentesTexto[l.id] ?? codigo;
      w.postMessage({ type: "run", serie: def.serie, lenguaje: lenguajes[l.id], codigo: instrumentar(codigo), propia: l.id, nombres, tipos: Object.keys(TIPOS), sensores: Object.keys(SENSOR),
        conf: { fallaRafaga: LAU.fallaRafaga, cadencia: LAU.cadencia, cadenciaRafaga: LAU.cadenciaRafaga }, snap });
    }
    pausa = false;
    pintarControles(); pintarProgs(); pintarEdicion();
    if (ES_FACTORY) evaluar();
  }

  const fmtLugar = (l) => l ? `{x: ${r2(l.x)}, y: ${r2(l.y)}, z: ${r2(l.z || 0)}${l.id ? `, id: "${l.id}"` : ""}}` : "null";
  const fmtValor = (v) => v == null ? "null" : typeof v === "object" ? fmtLugar(v) : String(v);
  function contarUso(id, fn) { const u = mundo.uso[id] || (mundo.uso[id] = {}); u[fn] = (u[fn] || 0) + 1; }

  function alMensaje(p, m) {
    if (!ejec || ejec.progs.get(p.id) !== p || !mundo.activo) return;
    if (ES_FACTORY && m.type === "encargo") {
      if (p.encargo) return errorPrograma(p, `Falta await en la línea ${p.encargo.linea}: R1 seguía con ${p.encargo.texto} cuando llegó la orden de la línea ${m.linea}.`, p.encargo.linea);
      p.encargo = m; p.estado = "encargo"; p.sensoresSeguidos = 0;
      mundo.verbos[m.verbo] = (mundo.verbos[m.verbo] || 0) + 1;
      lineaCorre[p.id] = m.linea; marcasSucias = true;
      logistica.iniciarOrden(m.verbo, m.args);
      return;
    }
    if (ES_FACTORY && m.type === "lecturaFactory") {
      mundo.verbos.cuantos = (mundo.verbos.cuantos || 0) + 1;
      if ((p.sensoresSeguidos = (p.sensoresSeguidos || 0) + 1) > 500)
        return errorPrograma(p, "R1 consultó el sensor 500 veces sin hacer nada más: el bucle no avanza. ¿Falta una orden dentro del «while»?", m.linea);
      mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: m.linea, orden: m.texto, resultado: String(m.valor), sensor: true });
      lineaCorre[p.id] = m.linea; marcasSucias = eventosSucios = true;
      return;
    }
    if (m.type === "lee") {
      contarUso(p.id, m.fn);
      const s = mundo.porId[m.maquina]; if (s && s.st && s.st.lecturas != null) s.st.lecturas++;
      registrar(p.id, m.linea, m.que, fmtValor(m.valor), "sensor");
    } else if (m.type === "cmd") {
      contarUso(p.id, m.verbo);
      aplicarOrden(p.id, m);
    } else if (m.type === "consola") {
      mostrarConsola(p.id, m.linea, m.nivel, m.texto);
    } else if (m.type === "espera") {
      contarUso(p.id, "esperar");
      p.estado = "espera"; p.espera = m.id; p.despertar = mundo.t + m.s;
      lineaCorre[p.id] = m.linea; marcasSucias = true;
    } else if (m.type === "done") {
      p.acabado = true; p.estado = p.encargo ? "encargo" : "fin"; p.finT = mundo.t; lineaCorre[p.id] = null; marcasSucias = true; pintarProgs();
    } else if (m.type === "error") {
      return errorPrograma(p, m.mensaje, m.linea);
    }
    if (ES_FACTORY && m.type === "done") { evaluar(); return; }
    if ((m.type === "lee" || m.type === "cmd" || m.type === "consola") && ++p.mensajes > MAX_ORDENES)
      return errorPrograma(p, `El programa de ${p.id} dio ${MAX_ORDENES} órdenes y lecturas sin esperar. ¿Falta await esperar(...) dentro del bucle?`, m.linea);
    if ((m.type === "espera" || m.type === "done") && !algunoCorre()) avanzar();
  }

  function terminarEncargo(resultado) {
    const p = ejec && ejec.progs.get("R1"), orden = p && p.encargo;
    if (!orden) return;
    p.encargo = null;
    mundo.resultados[resultado] = (mundo.resultados[resultado] || 0) + 1;
    mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: orden.linea, orden: orden.texto, resultado });
    eventosSucios = true;
    consola(resultado === "ok" ? "log" : "warn", p.id, orden.linea, `${esc(orden.texto)} → <b>${esc(resultado)}</b>`);
    p.estado = p.acabado ? "fin" : "corre"; p.desde = performance.now();
    p.worker.postMessage({ type: "despierta", id: orden.id, resultado, snap: instantanea() });
  }

  function aplicarOrden(id, m) {
    const l = mundo.porId[id];
    if (m.verbo === "stopFire" || !m.lugar) { l.modo = "idle"; l.lugar = null; }
    else {
      const modo = m.verbo === "burstFire" ? "burst" : "regular";
      if (modo === "burst" && l.modo !== "burst") l.falla = Math.max(l.falla, LAU.fallaRafaga);
      l.modo = modo; l.lugar = m.lugar;
    }
    const arg = m.verbo === "stopFire" ? "" : fmtLugar(m.lugar);
    registrar(id, m.linea, `${m.verbo}(${arg})`, m.res, m.res === "ok" ? "ok" : "warn");
  }

  const despertarProgramas = () => window.RUNTIME.despertar(ejec, mundo, instantanea);

  let acum = 0;
  function avanzar() {
    acum = window.NUCLEO.avanzar(acum, mundo, { algunoCorre, despertarProgramas, paso });
  }

  function errorPrograma(p, mensaje, linea) {
    if (!ejec) return;
    if (ejec.lenguajes && ejec.lenguajes[p.id] === "python") mensaje = mensajePython(mensaje);
    lineaErr = { id: p.id, linea }; marcasSucias = true;
    consola("error", p.id, linea, escapeMsg(mensaje));
    terminar("error", "error", mensaje, linea, p.id);
  }
  const escapeMsg = (s) => esc(s);

  function cerrarProgramas() {
    if (ejec) for (const p of ejec.progs.values()) p.worker.terminate();
    ejec = null;
    pausa = false;
    if (mundo) { mundo.activo = false; if (ES_FACTORY) mundo.robot.tarea = null; }
  }

  function terminar(resultado, motivo, texto, linea, idProg) {
    if (!mundo || mundo.fin) return;
    const m = mundo;
    const codigos = ejec ? ejec.codigos : { ...programas };
    const inicio = ejec ? ejec.inicio : new Date().toISOString();
    const acabados = ejec ? [...ejec.progs.values()].filter(p => p.estado === "fin") : [];
    const lenguajes = ejec ? { ...ejec.lenguajes } : Object.fromEntries(Object.keys(codigos).map(id => [id, lenguajeDe(id)]));
    m.fin = resultado;
    cerrarProgramas();
    if (resultado !== "error") { lineaCorre = {}; marcasSucias = true; }
    const lineas = Object.entries(codigos).reduce((a, [id, c]) => a + c.split("\n").filter(l => l.trim() && !(lenguajes[id] === "python" ? /^\s*#/ : /^\s*(\/\/|\/\*|\*)/).test(l)).length, 0);
    const lenguajeIntento = [...new Set(Object.values(lenguajes))].sort().join("+") || "js";
    if (ES_FACTORY) return terminarFactory(resultado, motivo, texto, linea, idProg, codigos, inicio, lenguajes, lenguajeIntento);
    const cpd = m.derribos ? coste() / m.derribos : null;
    const lanz = Object.fromEntries(m.lanzadores.map(l => [l.id, { ...l.st, fallaMax: r3(l.st.fallaMax), tRafaga: r2(l.st.tRafaga) }]));
    telemetria.push({
      sandbox: "03_lanzamisiles", reto: retoIdx + 1, titulo: def.titulo, intento, semilla, vista, inicio,
      resultado, motivo, mensaje: texto, linea: linea ?? null, programa: idProg ?? null,
      tiempoJuego: r2(m.t), brechas: m.brechas, derribos: m.derribos, enemigos: m.total, misiles: m.consumidos, impactos: m.impactos,
      precision: m.consumidos ? r3(m.impactos / m.consumidos) : null, atascos: m.atascos, reparaciones: m.reparaciones,
      coste: coste(), costePorDerribo: cpd == null ? null : r2(cpd), lanzadores: lanz, detalleAtascos: m.detalleAtascos, uso: m.uso, consolas: m.consolas,
      inserciones: { ...insercion }, lineas, codigos, lenguajes, escenario: retoIdx === IDX_PROPIO ? def : undefined,
    });
    insercion = { dobleClic: 0, arrastre: 0, atajo: 0 };
    guardado.escribir("telemetria", telemetria);
    avisar("cmg:intento", telemetria[telemetria.length - 1]);
    const stats = `${m.derribos}/${m.total} derribados · ${m.consumidos} misiles · precisión ${m.consumidos ? Math.round(m.impactos / m.consumidos * 100) : 0} % · ${m.atascos} ${m.atascos === 1 ? "atasco" : "atascos"} · ${coma(m.t)} s`;
    if (resultado === "victoria") {
      if (!hechos.includes(claveReto())) { hechos.push(claveReto()); guardado.escribir("hechos", hechos); }
      const ant = records[claveReto()];
      let record;
      if (cpd == null) record = "";
      else if (ant == null || cpd < ant - 1e-9) {
        records[claveReto()] = r2(cpd); guardado.escribir("records", records);
        recordsLenguaje[claveReto()] = lenguajeIntento; guardado.escribir("records-lenguaje", recordsLenguaje);
        record = `<p class="record">Coste por derribo <b>₵ ${coma(cpd)}</b>${etiquetaLenguaje(lenguajeIntento)} · <span class="mejora">${ant == null ? "primer récord" : `nuevo récord (antes ₵ ${coma(ant)})`}</span></p>`;
      } else record = `<p class="record">Coste por derribo <b>₵ ${coma(cpd)}</b>${etiquetaLenguaje(lenguajeIntento)} · <span class="peor">récord ₵ ${coma(ant)}${etiquetaLenguaje(recordsLenguaje[claveReto()])} (+${coma(cpd - ant)})</span></p>`;
      const sig = retoIdx + 1 < IDX_PROPIO;
      mostrarBanner("victoria", "Base intacta", record + `<p>₵ ${coste()} en total: ${m.consumidos} misiles × ₵ ${COSTE.misil} + ${m.reparaciones} reparaciones × ₵ ${COSTE.reparacion}. Menos misiles y menos atascos bajan el número.</p>`, stats,
        sig ? [["Siguiente reto", "primario", () => elegirReto(retoIdx + 1)], ["Otra vez", "", ocultarBanner]] : [["Otra vez", "primario", ocultarBanner]]);
      pintarRetos();
    } else if (resultado === "fallo") {
      const comentados = def.lanzadores.filter(l => lenguajes[l.id] === "python" ? !(codigos[l.id] || "").split("\n").some(x => x.trim() && !/^\s*#/.test(x)) : soloComentarios(codigos[l.id] || "")).map(l => l.id);
      let extra = comentados.length ? ` El programa de ${comentados.join(" y ")} está todo comentado: no hace nada.` : "";
      for (const p of acabados) if (!comentados.includes(p.id)) extra += ` El programa de ${p.id} terminó a los ${p.finT.toFixed(1)} s: desde entonces nadie volvió a apuntar.`;
      const pista = pistaTrasFallo();
      ultimoAviso[claveReto()] = { resultado, motivo, texto: texto + extra, intento, t: r2(m.t), derribos: `${m.derribos}/${m.total}`, cpd: cpd == null ? null : r2(cpd), cuando: Date.now() };
      mostrarBanner("fallo", "Aún no", esc(texto + extra), pista ? `Pista ${pista.n > 1 ? `${pista.i}/${pista.n}` : ""}: ${pista.texto}`.replace(" :", ":") : "Revisa el registro y la consola.", [["Editar programa", "primario", () => { ocultarBanner(); verPanel("codigo"); abrirPestana("programa"); }]]);
    } else if (resultado === "error") {
      pistaTrasFallo();
      mostrarBanner("fallo", linea ? `Error en la línea ${linea} de ${idProg}` : `Error en el programa de ${idProg}`, esc(texto), null,
        [["Ir a la línea", "primario", () => { ocultarBanner(); abrirPrograma(idProg); irALinea(linea); }]]);
    }
    pintarControles(); pintarProgs(); pintarResumen(); pintarEdicion(); metasClave = "";
    if (!$("info-reto").hidden) pintarInfoReto();
  }

  function terminarFactory(resultado, motivo, texto, linea, idProg, codigos, inicio, lenguajes = {}, lenguajeIntento = "js") {
    mundo.revelado = true;
    const t = { sandbox: "factory", reto: retoIdx + 1, clave: claveReto(), titulo: def.titulo, intento, inicio,
      resultado, motivo, mensaje: texto, linea: linea ?? null, programa: idProg ?? null, tiempoJuego: r2(mundo.t),
      rechazos: mundo.rechazos, derrames: mundo.derrames, viajesVacios: mundo.vacios, stockOculto: mundo.stockOculto, codigos, lenguajes };
    telemetria.push(t); guardado.escribir("factory-telemetria", telemetria);
    if (resultado === "victoria") {
      if (!hechos.includes(claveReto())) { hechos.push(claveReto()); guardado.escribir("hechos", hechos); }
      const anterior = records[claveReto()];
      if (!anterior || anterior.regla !== "comun-v1" || mundo.t < anterior.valor - 1e-9) { records[claveReto()] = { medida: "tiempo", regla: "comun-v1", valor: r2(mundo.t), lenguaje: lenguajeIntento }; guardado.escribir("records", records); }
      mostrarBanner("victoria", "Reto cumplido", `Todo entregado. <b>${coma(mundo.t)} s</b>${etiquetaLenguaje(lenguajeIntento)}`, `Intento ${intento}`, [["Otra vez", "primario", ocultarBanner]]);
    } else if (resultado === "fallo" || resultado === "error") {
      pistaTrasFallo();
      mostrarBanner("fallo", resultado === "error" ? (linea ? `Error en la línea ${linea}` : "Error en el programa") : "Aún no", esc(texto), def.pista,
        [["Editar programa", "primario", () => { ocultarBanner(); verPanel("codigo"); if (linea) irALinea(linea); }]]);
    }
    pintarControles(); pintarProgs(); pintarResumen(); pintarEdicion(); pintarRetos(); metasClave = "";
    if (!$("info-reto").hidden) pintarInfoReto();
  }

  function detener() { if (ejec) { consola("sistema", null, null, "Programa detenido."); terminar("detenido", "detenido", null); } }

  function vigia(now) {
    if (!ejec) return;
    for (const p of ejec.progs.values()) {
      if (p.estado === "corre" && now - p.desde > VIGIA_MS)
        return errorPrograma(p, (ES_FACTORY ? "Un bucle giró 2.5 s sin ningún await, así que R1 nunca recibió órdenes. Cada vuelta necesita al menos un await yo.…." : `El programa de ${p.id} giró ${VIGIA_MS / 1000} s sin llegar a un await esperar(...), así que el tiempo de juego no puede avanzar. Cada vuelta del bucle necesita una espera.`), lineaCorre[p.id] ?? null);
    }
  }

  // ---------- Consola, globos y avisos a pantalla ----------
  const $consola = $("consola");
  function limpiarConsola() { $consola.innerHTML = `<div class="vacia">Aquí aparecen los console.log / warn / error y lo que reportan las máquinas.</div>`; }
  function consola(cls, id, linea, html) {
    const v = $consola.querySelector(".vacia"); if (v) v.remove();
    const d = document.createElement("div");
    d.className = `c ${cls}`;
    const ref = id ? `<button type="button" class="ref" data-ref="${esc(id)}">${esc(id)}</button>` : "";
    d.innerHTML = `<span class="l">${ref}${linea ? ` L${linea}` : ""}</span><span class="t">${html}</span>`;
    $consola.appendChild(d);
    while ($consola.children.length > 150) $consola.firstChild.remove();
    $consola.scrollTop = $consola.scrollHeight;
  }
  function globo(id, nivel, texto) { globos.set(id, { nivel, texto: String(texto).slice(0, 140), hasta: performance.now() + (nivel === "sistema" ? 2200 : 3000) }); }
  function mostrarConsola(id, linea, nivel, texto) {
    mundo.consolas[nivel] = (mundo.consolas[nivel] || 0) + 1;
    consola(nivel, id, linea, `${nivel === "log" ? "" : `<b>${nivel}</b> `}${esc(texto)}`);
    registrar(id, linea, ejec && ejec.lenguajes && ejec.lenguajes[id] === "python" ? (nivel === "log" ? "print" : nivel) : `console.${nivel}`, texto, nivel === "error" ? "bad" : nivel === "warn" ? "warn" : "sensor");
    if (ruteo[nivel] === "globo") globo(id, nivel, texto);
    else if (ruteo[nivel] === "pantalla") aviso(nivel, id, linea, texto);
  }
  function avisoSistema(texto) { consola("bad", null, null, esc(texto)); aviso("error", null, null, texto); }

  const $avisos = $("avisos");
  function aviso(nivel, id, linea, texto) {
    const ult = $avisos.lastElementChild;
    const clave = `${nivel}|${id}|${texto}`;
    if (ult && ult.dataset.clave === clave) {
      ult.dataset.n = +ult.dataset.n + 1; ult.querySelector(".veces").textContent = `×${ult.dataset.n}`; ult.dataset.hasta = performance.now() + 4500; return;
    }
    const d = document.createElement("div");
    d.className = `toast ${nivel}`; d.dataset.clave = clave; d.dataset.n = 1; d.dataset.hasta = performance.now() + 4500;
    d.innerHTML = `<span class="nivel">${esc(nivel)}</span>${id ? `<button type="button" class="ref" data-ref="${esc(id)}">${esc(id)}</button>` : ""}${linea ? `<span class="veces">L${linea}</span>` : ""}<span class="txt">${esc(texto)}</span><span class="veces"></span>`;
    $avisos.appendChild(d);
    while ($avisos.children.length > 3) $avisos.firstChild.remove();
  }
  function cerrarAvisos() { $avisos.innerHTML = ""; globos.clear(); }
  function caducarAvisos(now) { for (const d of [...$avisos.children]) if (now > +d.dataset.hasta) d.remove(); }
  // Un enlace a una máquina la selecciona y centra la cámara en ella.
  document.addEventListener("click", (ev) => {
    const r = ev.target.closest(".ref[data-ref]"); if (!r) return;
    seleccionar(r.dataset.ref); centrarEn(r.dataset.ref);
  });

  // ---------- Vista 3D ----------
  const leerVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim();
  const estadoVista = {
    get mundo() { return mundo; }, get seleccionadas() { return seleccionadas; }, get seleccion() { return seleccion; },
    get arrastreCampo() { return arrastreCampo; }, get cols() { return COLS; }, get rows() { return ROWS; },
    get col() { return col; }, get geo2() { return geo2; }, set geo2(g) { geo2 = g; },
  };
  const V3 = window.VISTAS.crear3D(estadoVista, { $, ES_FACTORY, ARCO, FR, FUNCIONES, HALO, INTENSIDAD, LINEA_BASE, LUCES, MISIL, TIPOS, alcance, direccionDe, funcionDe, leerVar, radioDe, visual });

  // ---------- Vista de plano (2D) ----------
  const $c2d = $("c2d"), ctx2 = $c2d.getContext("2d");
  let col = {};
  function leerColores() {
    for (const k of ["bg", "surface", "ink", "muted", "line", "grid", "grid-2", "suelo", "building", "building-top", "edge", "accent", "accent-soft", "bad", "warn", "base", "enemigo", "enemigo-frio", "misil", "explosion", "s-visual", "s-termico", "s-vibra", "sel", ...Object.keys(FUNCIONES).map(f => `rol-${f}`)]) col[k] = leerVar(k);
    if (V3) V3.aplicarColores();
  }
  const rgb = (hex) => { const n = parseInt(String(hex).replace("#", ""), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
  const mezclaBlanco = (hex, u) => `rgb(${rgb(hex).map(v => Math.round(v + (255 - v) * u)).join(",")})`;
  let geo2 = { T: 10, ox: 0, oy: 0 };
  const dibujar2D = window.VISTAS.crearPlano(estadoVista, { $c2d, ctx2, ES_FACTORY, LINEA_BASE, TIPOS, MISIL, SENSOR, LAU, FUNCIONES, FR, HALO, INTENSIDAD, ARCO, LUCES, visual, funcionDe, radioDe, direccionDe, alcance, rgba, mezclaBlanco, r2 });
  function proyectar2D(x, y) { return { x: geo2.ox + x * geo2.T, y: geo2.oy + y * geo2.T, visible: true }; }
  function elegir2D(px, py) {
    const x = (px - geo2.ox) / geo2.T, y = (py - geo2.oy) / geo2.T;
    let mejor = null, dm = .9;
    for (const e of [...mundo.maquinas, ...mundo.enemigos]) { const ex = e.cx ?? e.x, ey = e.cy ?? e.y, d = Math.hypot(ex - x, ey - y); if (d < dm) { dm = d; mejor = e.id; } }
    return mejor;
  }
  // Ratón y tacto comparten la selección. La cámara conserva sus botones y los gestos de dos dedos.
  const LARGO_MS = 480, $campo = $("campo"), $carga = $("carga");
  const $cajaSeleccion = $("seleccion-caja"), punterosCampo = new Set();
  let largo = null, arrastreCampo = null, ultimoToque = null, tFicha = 0;
  let campoCoordenadas = null;
  const unidades = () => [...mundo.maquinas, ...mundo.enemigos];
  const unidadPorId = (id) => mundo.porId[id] || mundo.enemigos.find(e => e.id === id);
  function puntoPantalla(e) {
    const r = $campo.getBoundingClientRect();
    const p = vista === "3d" && V3
      ? V3.proyectar(e.cx ?? e.x, e.z || 0, e.cy ?? e.y, r.width, r.height)
      : proyectar2D(e.cx ?? e.x, e.cy ?? e.y);
    return { x: p.x + r.left, y: p.y + r.top, visible: p.visible && p.x >= 0 && p.x <= r.width && p.y >= 0 && p.y <= r.height };
  }
  function unidadEn(cx, cy) {
    const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    return vista === "3d" && V3 ? V3.elegir(x, y, r.width, r.height) : elegir2D(x, y);
  }
  function coordenadasEn(cx, cy) {
    const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    const p = vista === "3d" && V3 ? V3.suelo(x, y, r.width, r.height) : { x: (x - geo2.ox) / geo2.T, y: (y - geo2.oy) / geo2.T, z: 0 };
    return p && p.x >= 0 && p.x <= COLS && p.y >= 0 && p.y <= ROWS ? { x: r2(p.x), y: r2(p.y), z: 0 } : null;
  }
  document.addEventListener("focusin", (ev) => {
    if (ev.target.matches("[data-coordenadas]")) campoCoordenadas = ev.target;
    else campoCoordenadas = null;
  });
  function escribirCoordenadas(x, y) {
    if (!campoCoordenadas || !campoCoordenadas.isConnected || campoCoordenadas.disabled || campoCoordenadas.readOnly) return false;
    const p = coordenadasEn(x, y);
    if (p) {
      campoCoordenadas.value = fmtLugar(p);
      campoCoordenadas.dispatchEvent(new Event("input", { bubbles: true }));
      campoCoordenadas.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }
  function igualesVisibles(id) {
    const e = unidadPorId(id);
    if (!e) return;
    const tipo = (u) => u.clase || `enemigo:${u.tipo}`;
    seleccionar(unidades().filter(u => tipo(u) === tipo(e) && puntoPantalla(u).visible).map(u => u.id));
  }
  function dobleEnCampo(x, y) {
    clearTimeout(tFicha); ultimoToque = null;
    if (escribirCoordenadas(x, y)) return;
    const id = unidadEn(x, y);
    if (id) igualesVisibles(id);
  }
  $campo.addEventListener("dblclick", (ev) => {
    if (ev.button !== 0 || ev.target.tagName !== "CANVAS") return;
    ev.preventDefault();
    // El doble toque ya se procesa en pointerup, sin depender del clic sintético.
    if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return;
    dobleEnCampo(ev.clientX, ev.clientY);
  });
  function cancelarLargo() { if (largo) { cancelAnimationFrame(largo.raf); clearTimeout(largo.fin); } largo = null; $carga.hidden = true; }
  function cancelarArrastre() {
    cancelarLargo(); arrastreCampo = null; $cajaSeleccion.hidden = true;
  }
  $campo.addEventListener("pointerdown", (ev) => {
    if (ev.target.tagName !== "CANVAS") return;
    cerrarHoja();
    clearTimeout(tFicha);
    punterosCampo.add(ev.pointerId);
    if (punterosCampo.size > 1) { cancelarArrastre(); ultimoToque = null; return; }
    if (ev.button !== 0) return;
    ev.target.setPointerCapture(ev.pointerId);
    // Evita que el mapa quite el foco al destino de coordenadas.
    if (campoCoordenadas) ev.preventDefault();
    const id = unidadEn(ev.clientX, ev.clientY), tactil = ev.pointerType === "touch";
    // Doble toque en el suelo y, sin soltar el segundo, arrastrar: el cuadro de selección de PC.
    const cajaTactil = tactil && !campoCoordenadas && !!ultimoToque && !ultimoToque.id
      && performance.now() - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 32;
    arrastreCampo = { puntero: ev.pointerId, tactil, cajaTactil, x: ev.clientX, y: ev.clientY, px: ev.clientX, py: ev.clientY, t0: performance.now(), id, modo: null, movido: false, base: ev.shiftKey ? [...seleccionadas] : [] };
    if (!id || campoCoordenadas || cajaTactil) return;
    const r = $campo.getBoundingClientRect();
    largo = { puntero: ev.pointerId, id, x: ev.clientX, y: ev.clientY, t0: performance.now(), raf: 0 };
    $carga.style.left = `${ev.clientX - r.left}px`; $carga.style.top = `${ev.clientY - r.top}px`; $carga.style.setProperty("--p", 0);
    // El temporizador decide; el anillo solo acompaña (sin fotogramas, la ficha se abre igual).
    largo.fin = setTimeout(() => {
      if (!arrastreCampo || !largo) return;
      const elegido = largo.id;
      arrastreCampo.ficha = true;
      cancelarLargo(); seleccionar([elegido], { inspeccionar: false });
      ponerInspector("abierto");
      if (navigator.vibrate) navigator.vibrate(12);
    }, LARGO_MS);
    const tick = (now) => {
      if (!largo) return;
      const u = (now - largo.t0 - 110) / (LARGO_MS - 110);
      if (u > 0) { $carga.hidden = false; $carga.style.setProperty("--p", Math.min(1, u).toFixed(3)); }
      largo.raf = requestAnimationFrame(tick);
    };
    largo.raf = requestAnimationFrame(tick);
  }, true);
  $campo.addEventListener("pointermove", (ev) => {
    const a = arrastreCampo;
    if (!a || a.puntero !== ev.pointerId) return;
    const distancia = Math.hypot(ev.clientX - a.x, ev.clientY - a.y);
    if (distancia > 8) a.movido = true;
    // Con un dedo, arrastrar mueve la cámara salvo que el doble toque haya armado el cuadro.
    if (a.tactil && !a.cajaTactil) {
      if (a.movido && a.modo !== "camara") { a.modo = "camara"; cancelarLargo(); }
    } else if (a.movido) {
      cancelarLargo(); a.modo = "caja";
      const r = $campo.getBoundingClientRect();
      $cajaSeleccion.hidden = false;
      Object.assign($cajaSeleccion.style, { left: `${Math.min(a.x, ev.clientX) - r.left}px`, top: `${Math.min(a.y, ev.clientY) - r.top}px`, width: `${Math.abs(ev.clientX - a.x)}px`, height: `${Math.abs(ev.clientY - a.y)}px` });
    }
    a.px = ev.clientX; a.py = ev.clientY;
  }, true);
  $campo.addEventListener("pointerup", (ev) => {
    punterosCampo.delete(ev.pointerId);
    const a = arrastreCampo;
    if (!a || a.puntero !== ev.pointerId) return;
    if (a.modo === "caja") {
      seleccionar([...a.base, ...unidades().filter(u => {
        const p = puntoPantalla(u);
        return p.visible && p.x >= Math.min(a.x, ev.clientX) && p.x <= Math.max(a.x, ev.clientX) && p.y >= Math.min(a.y, ev.clientY) && p.y <= Math.max(a.y, ev.clientY);
      }).map(u => u.id)]);
      ultimoToque = null;
    } else if (!a.movido && !a.ficha) {
      if (a.tactil) {
        const ahora = performance.now();
        if (ultimoToque && ahora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 24) dobleEnCampo(ev.clientX, ev.clientY);
        else {
          ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, id: a.id };
          if (!campoCoordenadas) {
            seleccionar(a.id, { inspeccionar: false });
            tFicha = setTimeout(() => { if (seleccion) ponerInspector(inspectorCompleto() ? "abierto" : "tira"); }, 320);
          }
        }
      } else if (!campoCoordenadas) seleccionar(a.base.length ? [...a.base, a.id].filter(Boolean) : a.id);
    }
    cancelarArrastre();
  }, true);
  for (const tipo of ["pointercancel", "lostpointercapture"]) $campo.addEventListener(tipo, (ev) => {
    punterosCampo.delete(ev.pointerId);
    if (arrastreCampo && arrastreCampo.puntero === ev.pointerId) cancelarArrastre();
  }, true);
  addEventListener("blur", () => { clearTimeout(tFicha); punterosCampo.clear(); cancelarArrastre(); });

  // ---------- Variantes visuales en prueba (?poc=1) ----------
  function aplicarVisual() {
    document.documentElement.dataset.paleta = visual.paleta;
    const q = new URLSearchParams(location.search);
    for (const k of Object.keys(VARIANTES)) q.set(k, visual[k]);
    history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
    leerColores();
    if (V3 && mundo) V3.construir();
  }
  if (new URLSearchParams(location.search).has("poc")) {
    const d = document.createElement("details"); d.className = "poc"; d.open = innerWidth > 760;
    d.innerHTML = `<summary>Variantes</summary>` + Object.entries(VARIANTES).map(([k, ops]) =>
      `<div class="g"><b>${k}</b><div class="ops">${Object.entries(ops).map(([v, t]) => `<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${visual[k] === v}">${esc(t)}</button>`).join("")}</div></div>`).join("");
    d.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-k]"); if (!b) return;
      visual[b.dataset.k] = b.dataset.v;
      d.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach(x => x.setAttribute("aria-pressed", x === b));
      aplicarVisual();
    });
    $campo.append(d);
  }

  // ---------- Etiquetas y globos sobre el campo ----------
  const $capa = $("capa"), etiquetas = new Map();
  function pintarCapa(off, ahora) {
    const W = $capa.clientWidth, H = $capa.clientHeight;
    const vivos = new Set(), puestas = [];
    for (const e of mundo.maquinas) {
      const alto = e.clase === "lanzador" ? 1.45 : e.clase === "vibracion" ? 1.7 : e.clase === "deposito" ? 1.1 : .9;
      const p = vista === "3d" && V3 ? V3.proyectar(e.cx, alto, e.cy, W, H) : proyectar2D(e.cx, e.cy - radioDe(e));
      vivos.add(e.id);
      let o = etiquetas.get(e.id);
      if (!o) {
        const etq = document.createElement("div"); etq.className = "etq";
        etq.style.setProperty("--rol", `var(--rol-${funcionDe(e).principal})`);
        const g = document.createElement("div"); g.className = "globo"; g.hidden = true;
        $capa.append(etq, g); o = { etq, g, texto: "", txtEtq: "" }; etiquetas.set(e.id, o);
      }
      const atasco = e.clase === "lanzador" && e.atascado;
      const txt = e.clase === "lanzador" ? `${e.id} · ${e.misiles}▮${atasco ? " ⚠" : ""}` : e.id;
      if (txt !== o.txtEtq) { o.etq.textContent = txt; o.txtEtq = txt; }
      o.etq.className = `etq${e.id === seleccion ? " principal" : ""}${atasco ? " atasco" : ""}`;
      // Los nombres solo aparecen en las unidades seleccionadas: sin selección no tapan a nadie.
      o.etq.hidden = !p.visible || !seleccionadas.has(e.id);
      if (!o.etq.hidden) puestas.push({ o, x: p.x, y: p.y, w: txt.length * 7.2 + 22, h: 21 });
      const gl = globos.get(e.id);
      if (gl && ahora < gl.hasta && p.visible) {
        if (o.texto !== gl.nivel + gl.texto) { o.g.textContent = gl.texto; o.g.className = `globo ${gl.nivel}`; o.texto = gl.nivel + gl.texto; }
        o.g.hidden = false; o.g.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - 22px))`;
      } else o.g.hidden = true;
    }
    for (const [id, o] of etiquetas) if (!vivos.has(id)) { o.etq.remove(); o.g.remove(); etiquetas.delete(id); }
    // Si dos etiquetas se tocan, la de más arriba en pantalla sube un escalón.
    puestas.sort((a, b) => b.y - a.y);
    const hechas = [];
    for (const q of puestas) {
      for (let i = 0, choca = true; choca && i < 12; i++) {
        const h = hechas.find(h => Math.abs(h.x - q.x) < (h.w + q.w) / 2 && q.y - q.h < h.y && h.y - h.h < q.y);
        choca = !!h; if (h) q.y = h.y - h.h - 2;
      }
      hechas.push(q);
      q.o.etq.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
    }
  }
  function centrarEn(id) {
    const e = mundo.porId[id] || mundo.enemigos.find(x => x.id === id);
    if (e && V3 && vista === "3d") V3.centrar(e.cx ?? e.x, e.cy ?? e.y);
  }

  // ---------- Retos y mundo en pantalla ----------
  function pintarRetos() {
    const chips = RETOS.map((r, i) => [i, r.titulo]).concat(ES_FACTORY ? [] : [[IDX_PROPIO, `✎ ${propio.titulo}`]]);
    $("retos").innerHTML = chips.map(([i, t]) => {
      const clave = (ES_FACTORY ? "factory-" : "") + (i === IDX_PROPIO ? "propio" : String(i)), hecho = hechos.includes(clave);
      return `<button type="button" class="reto-btn${hecho ? " hecho" : ""}" aria-pressed="${i === retoIdx}" data-i="${i}"><span class="n">${hecho ? "✓" : i === IDX_PROPIO ? "+" : i + 1}</span>${esc(t)}</button>`;
    }).join("");
  }
  $("retos").addEventListener("click", (ev) => { const b = ev.target.closest(".reto-btn"); if (b) elegirReto(+b.dataset.i); });
  function abrirHoja(si) {
    $("hoja-reto").hidden = !si;
    $("b-reto").setAttribute("aria-expanded", si);
  }
  const cerrarHoja = () => { if (!$("hoja-reto").hidden) abrirHoja(false); };
  // ---------- Información del reto desde el editor ----------
  // Pestañas: objetivo, metas en vivo, enemigos del reto, pista escalonada y último intento.
  let infoPestana = "objetivo";
  const MOTIVOS = { brecha: "Brecha", atascos: "Demasiados atascos", tiempo: "Fuera de tiempo", limite: "Tiempo agotado", derribos: "Pocos derribos", error: "Error en el programa", detenido: "Detenido", reinicio: "Reiniciado" };
  // Estado de cada meta: «ok» (verde), «rota» (rojo) o «pendiente». Al acabar un intento todas quedan decididas.
  function estadoMetas() {
    if (ES_FACTORY) return def.metas.map((meta, i) => {
      const e = mundo.porId[meta.id], valor = meta.tipo === "vaciar" ? e.stock[meta.mat] || 0 : e.recibido[meta.mat] || 0;
      return { k: `factory-${i}`, nombre: `${esc(meta.id)} ← ${esc(meta.mat)}`, meta: meta.tipo === "vaciar" ? "vaciar" : `mínimo ${meta.n}`, valor: meta.tipo === "vaciar" ? valor : `${valor}/${meta.n}`, estado: logistica.metaCumplida(meta) ? "ok" : mundo.fin ? "rota" : "pendiente" };
    });
    const m = mundo, me = def.metas, acabado = m.fin === "victoria" || m.fin === "fallo";
    const decide = (rota, ok) => rota ? "rota" : ok ? "ok" : acabado ? "rota" : "pendiente";
    const filas = [{ k: "brechas", nombre: "Brechas", meta: `máximo ${me.brechasMax}`, valor: m.brechas, estado: decide(m.brechas > me.brechasMax, acabado && m.brechas <= me.brechasMax) }];
    if (me.derribosMin != null) filas.push({ k: "derribos", nombre: "Derribos", meta: `mínimo ${me.derribosMin}`, valor: `${m.derribos}/${m.total}`, estado: decide(false, m.derribos >= me.derribosMin) });
    else filas.push({ k: "derribos", nombre: "Derribados", meta: "para contar", valor: `${m.derribos}/${m.total}`, estado: "info" });
    if (me.atascosMax != null) filas.push({ k: "atascos", nombre: "Atascos", meta: `máximo ${me.atascosMax}`, valor: m.atascos, estado: decide(m.atascos > me.atascosMax, acabado && m.atascos <= me.atascosMax) });
    if (me.tiempoMax != null) filas.push({ k: "tiempo", nombre: "Tiempo", meta: `hasta ${me.tiempoMax} s`, valor: `${coma(m.t)} s`, estado: decide(m.t > me.tiempoMax + 1e-9, m.fin === "victoria") });
    return filas;
  }
  // Pista escalonada: la pista del reto en partes (frases). La primera se puede pedir siempre;
  // cada intento fallido muestra la siguiente y permite pedir una más.
  const partesPista = () => (def.pista || "").split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«"])/).map(t => t.trim()).filter(Boolean);
  let pistas = guardado.leer("pistas", {});
  const pistaDe = () => ({ vistas: 0, fallos: 0, ...(pistas[claveReto()] || {}) });
  function guardarPista(p) { pistas = { ...pistas, [claveReto()]: p }; guardado.escribir("pistas", pistas); }
  function pistaTrasFallo() {
    const p = pistaDe(), n = partesPista().length;
    p.fallos++; p.vistas = Math.min(n, Math.max(p.vistas, p.fallos));
    guardarPista(p);
    return p.vistas ? { n, i: p.vistas, texto: partesPista()[p.vistas - 1] } : null;
  }
  // Último intento: lo que guarda la telemetría, más el detalle del aviso y los errores de sintaxis previos.
  let ultimoAviso = {};
  function ultimoIntento() {
    const t = [...telemetria].reverse().find(x => x.reto === retoIdx + 1 && x.motivo !== "reinicio");
    const extra = ultimoAviso[claveReto()];
    if (extra && (!t || extra.cuando >= Date.parse(t.inicio))) return extra;
    return t ? { resultado: t.resultado, motivo: t.motivo, texto: t.mensaje, linea: t.linea, id: t.programa, intento: t.intento, t: t.tiempoJuego, cpd: t.costePorDerribo, derribos: `${t.derribos}/${t.enemigos}` } : null;
  }
  const marca = (estado) => `<i class="marca ${estado}" aria-hidden="true"></i>`;
  const num = (v) => Number.isInteger(v) ? String(v) : coma(v);
  const INFO = {
    objetivo: () => `<section class="objetivo" aria-label="Objetivo"><p id="info-reto-txt">${esc(def.objetivo)}</p><div class="leccion" id="info-reto-leccion">${esc(def.leccion)}</div></section>`,
    metas: () => {
      const m = mundo, filas = estadoMetas();
      const est = m.fin === "victoria" ? "Cumplido" : m.fin === "fallo" || m.fin === "error" ? "No cumplido" : m.activo ? "En curso" : m.fin ? "Detenido" : "Sin ejecutar";
      return `<p class="info-nota">${esc(est)}${m.fin || m.activo ? "" : " · se marcan en vivo al ejecutar"}</p><ul class="metas-lista">${filas.map(f =>
        `<li class="meta-fila ${f.estado}" data-meta="${f.k}">${marca(f.estado)}<span class="m-nombre">${f.nombre} <small>${esc(f.meta)}</small></span><b class="m-valor">${f.valor}</b></li>`).join("")}</ul>`;
    },
    enemigos: () => {
      if (ES_FACTORY) return `<p class="info-nota">Este reto no tiene enemigos.</p>`;
      const tipos = new Map();
      for (const o of def.oleadas) {
        const tp = TIPOS[o.tipo], x = tipos.get(o.tipo) || { n: 0, hp: new Set(), vel: new Set() };
        x.n += o.n; x.hp.add(o.hp ?? tp.hp); x.vel.add(o.vel ?? tp.vel); tipos.set(o.tipo, x);
      }
      const rango = (set, f) => [...set].sort((a, b) => a - b).map(f).join(" / ");
      const vib = (def.sensores || []).map(s => s.id);
      return `<div class="enemigos-lista">${[...tipos].map(([t, x]) => {
        const tp = TIPOS[t], ven = ["cámara", ...(tp.frio ? [] : ["térmico"]), ...(tp.suelo ? vib : [])];
        return `<article class="enemigo-ficha" data-tipo="${t}">
          <img class="retrato" src="img/enemigos/${t}.png" alt="Modelo de ${esc(tp.nombre)}" width="96" height="72" loading="lazy">
          <div><h4>${esc(tp.nombre[0].toUpperCase() + tp.nombre.slice(1))} <code>"${t}"</code> <span class="cuenta">× ${x.n}</span></h4>
          <dl><dt>vida</dt><dd>${rango(x.hp, v => `${v} ${v === 1 ? "impacto" : "impactos"}`)}</dd><dt>velocidad</dt><dd>${rango(x.vel, num)} c/s</dd>
          <dt>altura</dt><dd>${num(tp.z)} m${tp.suelo ? " · suelo" : ""}</dd><dt>lo ven</dt><dd>${ven.map(esc).join(" · ")}${tp.frio ? ' <span class="no">· el térmico no</span>' : ""}</dd></dl></div></article>`;
      }).join("")}</div>${def.niebla ? `<p class="info-nota">Niebla: la cámara ve ${num(SENSOR.visual.niebla)} casillas y el térmico ${num(SENSOR.thermal.niebla)}.</p>` : ""}`;
    },
    pista: () => {
      const partes = partesPista(), p = pistaDe(), n = partes.length, abiertas = Math.min(n, p.fallos + 1);
      if (!n) return `<p class="info-nota">Este reto no tiene pista.</p>`;
      const vistas = partes.slice(0, p.vistas).map((t, i) => `<li><span class="parte">${i + 1}/${n}</span> ${esc(t)}</li>`).join("");
      const pie = p.vistas >= n ? `<p class="info-nota">Ya ves la pista completa.</p>`
        : p.vistas < abiertas ? `<button class="btn chico" type="button" data-info-accion="ver-pista">${p.vistas ? "Ver la siguiente parte" : "Ver pista"} <small>${p.vistas + 1}/${n}</small></button>`
        : `<p class="info-nota bloqueada"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>La parte ${p.vistas + 1}/${n} se desbloquea con otro intento fallido.</p>`;
      return `${vistas ? `<ol class="pista-partes">${vistas}</ol>` : `<p class="info-nota">La pista viene en ${n} ${n === 1 ? "parte" : "partes"}. Pídela cuando la necesites; cada intento fallido abre la siguiente.</p>`}${pie}`;
    },
    intento: () => {
      const u = ultimoIntento();
      if (!u) return `<p class="info-nota">Aún no hay intentos en este reto.</p>`;
      const titulo = u.resultado === "victoria" ? (ES_FACTORY ? "Reto cumplido" : "Base intacta") : u.resultado === "error" || u.resultado === "sintaxis" ? (u.linea ? `Error en la línea ${u.linea} de ${u.id}` : `Error en el programa de ${u.id}`) : MOTIVOS[u.motivo] || "Intento";
      const cls = u.resultado === "victoria" ? "ok" : u.resultado === "detenido" ? "pendiente" : "rota";
      const rec = ES_FACTORY ? (records[claveReto()]?.regla === "comun-v1" ? records[claveReto()].valor : null) : records[claveReto()];

      return `<div class="intento ${cls}">${marca(cls)}<div><h4>${esc(titulo)}</h4>${u.intento ? `<p class="info-nota">Intento ${u.intento}${u.t != null ? ` · ${coma(u.t)} s` : ""}${u.derribos ? ` · ${u.derribos} derribados` : ""}</p>` : ""}</div></div>
        ${u.texto ? `<p class="motivo">${esc(u.texto)}</p>` : ""}
        <div class="fila-botones">${u.linea ? `<button class="btn chico primario" type="button" data-info-accion="linea">Ir a la línea ${u.linea}</button>` : ""}${cls === "rota" && partesPista().length ? `<button class="btn chico" type="button" data-info-accion="a-pista">Ver pista</button>` : ""}</div>
        ${ES_FACTORY && rec != null ? `<p class="economia">Récord: ${coma(rec)} s</p>` : ""}
        ${!ES_FACTORY && (u.cpd != null || rec != null) ? `<p class="economia">₵ por derribo ${u.cpd != null ? coma(u.cpd) : "—"}${rec != null ? ` · récord ${coma(rec)}` : ""}</p>` : ""}`;
    },
  };
  // Punto de estado en las pestañas: metas (verde, rojo) e intento (rojo si falló).
  function estadosPestanas() {
    const filas = estadoMetas().filter(f => f.estado !== "info");
    const m = filas.some(f => f.estado === "rota") ? "rota" : filas.length && filas.every(f => f.estado === "ok") ? "ok" : "";
    const u = ultimoIntento(), i = !u ? "" : u.resultado === "victoria" ? "ok" : u.resultado === "detenido" ? "" : "rota";
    const p = pistaDe(), n = partesPista().length, nueva = p.vistas < Math.min(n, p.fallos + 1) && p.fallos > 0 ? "nueva" : "";
    for (const [k, v] of [["metas", m], ["intento", i], ["pista", nueva]]) $(`info-t-${k}`).dataset.estado = v;
  }
  function pintarInfoReto() {
    $("info-reto-titulo").textContent = `${retoIdx === IDX_PROPIO ? "Tu escenario" : `Reto ${retoIdx + 1}`} · ${def.titulo}`;
    for (const b of document.querySelectorAll("#info-pestanas [data-info]")) {
      const si = b.dataset.info === infoPestana;
      b.setAttribute("aria-selected", String(si)); b.tabIndex = si ? 0 : -1;
    }
    $("info-cuerpo").setAttribute("aria-labelledby", `info-t-${infoPestana}`);
    $("info-cuerpo").innerHTML = INFO[infoPestana]();
    estadosPestanas();
  }
  // En vivo: las metas y los puntos se repintan con el marcador (pintarHud), solo con la ficha abierta.
  function vivoInfoReto() {
    if ($("info-reto").hidden) return;
    if (infoPestana === "metas") $("info-cuerpo").innerHTML = INFO.metas();
    estadosPestanas();
  }
  function elegirInfo(k, foco) {
    infoPestana = k; pintarInfoReto();
    const b = $(`info-t-${k}`); b.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (foco) b.focus();
  }
  function abrirInfoReto(si, pestana) {
    if (pestana) infoPestana = pestana;
    if (si) pintarInfoReto();
    $("info-reto").hidden = !si;
    $("b-info-reto").setAttribute("aria-expanded", String(si));
    if (si) $(`info-t-${infoPestana}`).scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  $("b-info-reto").addEventListener("pointerdown", (ev) => ev.preventDefault());  // el código conserva el foco
  $("b-info-reto").addEventListener("click", () => abrirInfoReto($("info-reto").hidden));
  $("info-reto-cerrar").addEventListener("click", () => abrirInfoReto(false));
  $("info-pestanas").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-info]");
    if (b && !$("info-tira").classList.contains("arrastrada")) elegirInfo(b.dataset.info);
  });
  $("info-pestanas").addEventListener("keydown", (ev) => {
    const ks = Object.keys(INFO), i = ks.indexOf(infoPestana);
    const j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : ev.key === "Home" ? 0 : ev.key === "End" ? ks.length - 1 : null;
    if (j == null) return;
    ev.preventDefault(); elegirInfo(ks[(j + ks.length) % ks.length], true);
  });
  $("info-cuerpo").addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-info-accion]"); if (!a) return;
    const acc = a.dataset.infoAccion;
    if (acc === "ver-pista") { const p = pistaDe(); p.vistas = Math.min(partesPista().length, p.vistas + 1); guardarPista(p); pintarInfoReto(); }
    else if (acc === "a-pista") elegirInfo("pista");
    else if (acc === "linea") { const u = ultimoIntento(); abrirInfoReto(false); abrirPrograma(u.id); irALinea(u.linea); }
  });
  document.addEventListener("pointerdown", (ev) => { if (!$("info-reto").hidden && !ev.target.closest("#info-reto, #b-info-reto")) abrirInfoReto(false); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("info-reto").hidden) { abrirInfoReto(false); $("b-info-reto").focus(); } });
  $("b-reto").addEventListener("click", () => abrirHoja($("hoja-reto").hidden));
  $("hoja-reto").addEventListener("click", (ev) => { if (ev.target.closest("[data-cerrar-hoja]")) abrirHoja(false); });

  function textoInicial(d, id) {
    if (d.serie === "factory") return (d.inicial[id] || []).join("\n") + "\n";
    const lineas = d.inicial[id] || [];
    if (!lineas.length) return `/* Programa de ${id}.\n * Doble clic en el inspector inserta nombres, funciones y valores. */\n\n`;
    return `/* Programa de ${id} · el código de partida está comentado.\n * Quita las // (Ctrl+/ o el botón «//») o escribe el tuyo. */\n` + lineas.map(l => "// " + l).join("\n") + "\n";
  }
  function cargarProgramas() {
    let g = guardado.leer(`prog-${claveReto()}`, null);
    if (ES_FACTORY && g == null) {
      // Importación única y de solo lectura; nunca escribimos en cmg-banco02.
      try { const viejo = JSON.parse(localStorage.getItem(`cmg-banco02:prog-${retoIdx}`)); if (viejo) g = { R1: (viejo.fuente !== "texto" || (viejo.comentado != null && viejo.texto === viejo.comentado)) && viejo.modelo ? window.FACTORY_RETOS.generar(viejo.modelo).codigo : viejo.texto }; } catch { /* dato antiguo inválido */ }
      g ||= { R1: textoInicial(def, "R1") };
      guardado.escribir(`prog-${claveReto()}`, g);
    }
    g ||= {};
    return Object.fromEntries(programablesDe(def).map(l => [l.id, typeof g[l.id] === "string" ? g[l.id] : textoInicial(def, l.id)]));
  }
  function cargarFuentes() {
    if (!PYTHON) return {};
    const g = guardado.leer(`fuentes-${claveReto()}`, null) || {}, ids = new Set(programablesDe(def).map(l => l.id));
    return Object.fromEntries(Object.entries(g).filter(([id, f]) => ids.has(id) && f && f.lenguaje === "python" && typeof f.texto === "string")
      .map(([id, f]) => [id, { lenguaje: "python", texto: f.texto, enUso: f.enUso !== false }]));
  }
  const copiaFuentes = () => JSON.parse(JSON.stringify(fuentes));
  let tGuardar = 0;
  function guardarProgramas() {
    clearTimeout(tGuardar);
    const clave = `prog-${claveReto()}`, copia = { ...programas }, claveF = `fuentes-${claveReto()}`, copiaF = PYTHON ? copiaFuentes() : null;
    tGuardar = setTimeout(() => { guardado.escribir(clave, copia); if (copiaF) guardado.escribir(claveF, copiaF); }, 300);
  }

  function guardarFactoryAhora() {
    clearTimeout(tGuardar);
    guardado.escribir(`prog-${claveReto()}`, { ...programas });
    if (PYTHON) guardado.escribir(`fuentes-${claveReto()}`, copiaFuentes());
  }
  // Lenguaje y texto de cada unidad.
  const lenguajeDe = id => PYTHON && fuentes[id] && fuentes[id].enUso ? "python" : "js";
  const textoDe = id => lenguajeDe(id) === "python" ? fuentes[id].texto : programas[id];
  function ponerTexto(id, t) { if (lenguajeDe(id) === "python") fuentes[id].texto = t; else programas[id] = t; }
  // E7: el programa de partida en Python sale del de JS, convertido por el árbol.
  function textoInicialPython(d, id) {
    const lineas = d.inicial[id] || [];
    if (d.serie === "factory") { const r = convertirAPython(textoInicial(d, id)); if (r.ok) return r.texto; }
    if (!lineas.length || d.serie === "factory") return `# Programa de ${id} en Python.\n# Doble clic en el inspector inserta nombres, funciones y valores.\n\n`;
    const r = convertirAPython(lineas.join("\n"));
    const cuerpo = r.ok ? r.texto.replace(/\n$/, "").split("\n") : lineas;
    return `# Programa de ${id} · el código de partida está comentado.\n# Quita los # (Ctrl+/ o el botón de comentar) o escribe el tuyo.\n` + cuerpo.map(l => "# " + l).join("\n") + "\n";
  }
  function convertirAPython(js) {
    nombresPython ||= new Map(proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    return window.CMGJSaPython.convertir(js, { nombres: nombresPython, objetoONulo: ["autoTarget", "detect"], huecos: { re: RE_HUECO, aPython: window.CMGEditorPython.aHueco } });
  }
  // Add/Replace sobre las fuentes Python: el aplicador escribe en un objeto estable por reto.
  let textosPython = null;
  const vistaPython = () => new Proxy({}, { get: (_, id) => fuentes[id] ? fuentes[id].texto : undefined, set: (_, id, v) => { if (fuentes[id]) fuentes[id].texto = v; return true; } });
  addEventListener("pagehide", () => { if (ES_FACTORY && def) guardarFactoryAhora(); });

  function nuevoMundo(nIntento = intento + 1) {
    COLS = def.mapa?.cols || 32; ROWS = def.mapa?.rows || 18;
    mundo = crearMundo(def, ES_FACTORY ? nIntento : semilla);
    if (ES_FACTORY) logistica = window.FACTORY.conectar(mundo, {
      terminarOrden: terminarEncargo, terminar,
      programaAcabado: () => !!ejec && [...ejec.progs.values()].every(p => p.acabado),
      llamadaPendiente: () => !!ejec && [...ejec.progs.values()].some(p => p.encargo),
    });
    else combate = window.WAR.conectar(mundo, { registrar, terminar, avisoSistema, globo });
    if (V3) V3.construir();
    for (const o of etiquetas.values()) { o.etq.remove(); o.g.remove(); }
    etiquetas.clear(); globos.clear();
    seleccionadas = new Set([...seleccionadas].filter(id => unidadPorId(id)));
    if (!seleccionadas.size) seleccionadas.add(programablesDe(def)[0].id);
    seleccion = [...seleccionadas][0];
    if (V3) V3.anillosDe(seleccion);
    const programables = [...seleccionadas].filter(id => Object.hasOwn(programas, id));
    configurarEdicion(programables.length ? programables : [progSel]);
    historia.clear();
    pintarMaquinas(); pintarInspector(); pintarPieIns();
    metasClave = "";
  }

  function elegirReto(i) {
    if (ES_FACTORY && def && programas.R1 !== undefined) guardarFactoryAhora();
    clearTimeout(tFicha); cancelarArrastre(); ultimoToque = null;
    cerrarProgramas();
    retoIdx = i; guardado.escribir(ES_FACTORY ? "factory-reto" : "reto", i);
    def = defActual();
    if (!ES_FACTORY) avisar("cmg:reto", { reto: i + 1, titulo: def.titulo });
    intento = telemetria.filter(t => t.reto === i + 1).length;
    if (!semillaFija) semilla = intento + 1;
    programas = cargarProgramas();
    fuentes = cargarFuentes(); textosPython = vistaPython();
    borradoresMulti.clear();
    progSel = programablesDe(def)[0].id;
    seleccion = programablesDe(def)[0].id;
    seleccionadas = new Set([seleccion]);
    edicion = { ids: [], mixto: false };
    lineaCorre = {}; lineaErr = null;
    nuevoMundo();
    $("titulo").textContent = def.titulo;
    $("reto-n").textContent = i === IDX_PROPIO ? "✎" : i + 1;
    $("objetivo-corto").textContent = def.objetivo;
    pintarPaleta();
    $("objetivo-txt").textContent = def.objetivo;
    $("leccion").textContent = def.leccion;
    if (!$("info-reto").hidden) pintarInfoReto();
    ocultarBanner(); limpiarConsola(); cerrarAvisos();
    pintarRetos(); pintarProgs(); abrirPrograma(progSel); pintarResumen(); pintarEventosYa(); pintarControles(); pintarEscenario();
  }

  let metasClave = "";
  function pintarHud() {
    if (ES_FACTORY) {
      $("reloj").textContent = `t ${mundo.t.toFixed(1)} s`;
      const html = estadoMetas().map(f => `<span class="meta${f.estado === "ok" ? " cumplida" : f.estado === "rota" ? " rota" : ""}">${f.nombre} <b>${f.valor}</b></span>`).join("");
      if (html !== metasClave) { metasClave = html; $("metas").innerHTML = html; vivoInfoReto(); }
      return;
    }
    const m = mundo, me = def.metas;
    $("reloj").textContent = `t ${m.t.toFixed(1)} s${m.def.niebla ? " · niebla" : ""}`;
    const clave = [m.brechas, m.derribos, m.atascos, m.consumidos, m.reparaciones, m.fin, me.tiempoMax != null && m.t > me.tiempoMax].join("|");
    if (clave === metasClave) return;
    metasClave = clave;
    vivoInfoReto();
    const cpd = m.derribos ? (coste() / m.derribos).toFixed(1) : "—", rec = records[claveReto()];
    let html = `<span class="meta${m.brechas > me.brechasMax ? " rota" : ""}">brechas <b>${m.brechas}</b> · máx ${me.brechasMax}</span>`;
    html += `<span class="meta${m.total && m.derribos === m.total ? " cumplida" : ""}">derribados <b>${m.derribos}/${m.total}</b>${me.derribosMin != null ? ` · mín ${me.derribosMin}` : ""}</span>`;
    html += `<span class="meta${me.atascosMax != null && m.atascos > me.atascosMax ? " rota" : ""}">atascos <b>${m.atascos}</b>${me.atascosMax != null ? ` · máx ${me.atascosMax}` : ""}</span>`;
    if (me.tiempoMax != null) html += `<span class="meta${m.t > me.tiempoMax ? " rota" : ""}">≤ ${me.tiempoMax} s</span>`;
    html += `<span class="meta optimo" title="El número a optimizar: misiles y reparaciones divididos entre derribos">₵ por derribo <b>${cpd}</b>${rec != null ? ` · récord ${rec.toFixed(1)}` : ""}</span>`;
    $("metas").innerHTML = html;
  }

  function pintarControles() {
    const corriendo = !!ejec;
    const $e = $("b-ejecutar");
    $e.textContent = corriendo ? "■ Detener" : "▶ Ejecutar";
    $e.classList.toggle("primario", !corriendo); $e.classList.toggle("peligro", corriendo);
    for (const $ec of [$("b-ejecutar-cod"), $("b-ejecutar-flot")]) {
      $ec.textContent = corriendo ? "■ DETENER" : "▶ EJECUTAR";
      $ec.classList.toggle("primario", !corriendo); $ec.classList.toggle("peligro", corriendo);
    }
    const $p = $("b-pausa");
    $p.disabled = !corriendo; $p.textContent = pausa ? "Seguir" : "Pausa";
    $("b-vel").textContent = `${velocidad}×`;
    $("intento-txt").textContent = `Intento ${intento + (corriendo ? 0 : 1)} · ${retoIdx === IDX_PROPIO ? "tu escenario" : `reto ${retoIdx + 1}`}`;
    $("semilla-txt").textContent = corriendo || semillaFija ? semilla : intento + 1;
    $("semilla-fija").checked = semillaFija;
    $codigo.readOnly = corriendo;
  }
  $("b-ejecutar").addEventListener("click", () => ejec ? detener() : ejecutar());
  // EJECUTAR del editor (pantalla completa): corre el código, pasa a la batalla y cierra el inspector.
  // Si hay un error, la batalla muestra su aviso con el enlace a la línea.
  // Con las herramientas plegadas, el mismo botón flota abajo a la izquierda del código.
  function ejecutarDesdeCodigo() {
    if (ejec) { detener(); return; }
    ejecutar();
    if (ejec) ponerInspector("cerrado");
    verPanel("mapa");
  }
  $("b-ejecutar-cod").addEventListener("click", ejecutarDesdeCodigo);
  $("b-ejecutar-flot").addEventListener("click", ejecutarDesdeCodigo);
  $("b-pausa").addEventListener("click", () => { pausa = !pausa; pintarControles(); });
  $("b-vel").addEventListener("click", () => { velocidad = velocidad === 1 ? 2 : velocidad === 2 ? 4 : velocidad === 4 ? 8 : 1; pintarControles(); });
  $("b-reiniciar").addEventListener("click", () => {
    if (ejec) terminar("detenido", "reinicio", null);
    nuevoMundo(); lineaCorre = {}; lineaErr = null; marcasSucias = true; ocultarBanner(); cerrarAvisos(); pintarControles();
  });
  $("semilla-fija").addEventListener("change", (ev) => {
    semillaFija = ev.target.checked; guardado.escribir("semillaFija", semillaFija);
    if (semillaFija && !ejec && mundo.fin == null) semilla = intento + 1;
    pintarControles();
  });

  // Vista 3D o plano
  function aplicarVista(v) {
    vista = V3 ? v : "2d";
    guardado.escribir(ES_FACTORY ? "factory-vista" : "vista", v);
    $("c3d").hidden = vista !== "3d"; $("c2d").hidden = vista !== "2d";
    $("sin3d").hidden = !!V3;
    $("b-centrar").hidden = vista !== "3d";
    document.querySelectorAll("[data-vista]").forEach(b => b.setAttribute("aria-pressed", b.dataset.vista === vista));
    tamanoCampo();
  }
  document.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => aplicarVista(b.dataset.vista)));
  $("b-centrar").addEventListener("click", () => V3 && V3.recentrar());
  function tamanoCampo() { const r = $("campo").getBoundingClientRect(); if (V3 && r.width && r.height) V3.tamano(r.width, r.height); }
  new ResizeObserver(tamanoCampo).observe($("campo"));

  // ---------- Máquinas e inspector ----------
  function pintarMaquinas() {
    $("maquinas").innerHTML = mundo.maquinas.map(e => `<button type="button" class="maq-chip" data-id="${e.id}" aria-pressed="${seleccionadas.has(e.id)}" style="--rol:var(--rol-${funcionDe(e).principal})">${e.id}</button>`).join("")
      + `<span class="fila-bajo" style="align-self:center">En el campo: toca para elegir, mantén presionado para abrir la ficha. Doble toque en el suelo y arrastra para seleccionar en cuadro. Con dos dedos: acerca, desplaza y gira.</span>`;
  }
  $("maquinas").addEventListener("click", (ev) => { const b = ev.target.closest(".maq-chip"); if (b) seleccionar(b.dataset.id); });
  // El inspector tiene tres estados: cerrado (nada elegido), tira (nombre y signos vitales) y abierto (ficha completa).
  // Empieza cerrado y solo se abre al elegir una unidad en el campo, en sus chips o en un enlace; abrir un
  // programa o corregir la selección cambia de unidad sin abrirlo (opción inspeccionar: "conservar").
  let insEstado = "cerrado";
  const inspectorCompleto = () => $("app").dataset.forma === "movil" && $("app").dataset.inspectorMovil !== "tira";
  function seleccionar(id, opciones = {}) {
    const ids = (Array.isArray(id) ? id : id ? [id] : []).filter(id => unidadPorId(id));
    seleccionadas = new Set(ids);
    seleccion = ids[0] || null;
    if (V3) V3.anillosDe(seleccion);
    document.querySelectorAll(".maq-chip").forEach(b => b.setAttribute("aria-pressed", seleccionadas.has(b.dataset.id)));
    if (!seleccion || opciones.inspeccionar === false) insEstado = "cerrado";
    else if (opciones.inspeccionar === "conservar") { /* mismo estado, con la unidad nueva */ }
    else if (inspectorCompleto()) insEstado = "abierto";
    else if (insEstado === "cerrado") insEstado = "tira";
    const programables = ids.filter(id => Object.hasOwn(programas, id));
    configurarEdicion(programables.length ? programables : [progSel]);
    pintarInspector();
  }
  $("app").addEventListener("cmg:forma", () => {
    if (seleccion && inspectorCompleto() && insEstado !== "cerrado") ponerInspector("abierto");
  });
  function ponerInspector(estado) { insEstado = seleccion ? estado : "cerrado"; pintarInspector(); }
  const abrirInspector = () => ponerInspector("abierto");

  // Un token es algo que se puede insertar en el código: data-ins es el texto y data-fin el comentario de retorno.
  function tk(tipo, texto, ins, o = {}) {
    if (edicion.lenguaje === "python") { texto = aPython(String(texto)); ins = aPython(ins); if (o.fin) o = { ...o, fin: aPython(o.fin) }; }
    if (o.ajeno) return `<button type="button" class="tk tk-${tipo} ajeno" title="${esc(o.ajeno)}" data-ajeno="${esc(o.ajeno)}">${esc(texto)}</button>`;
    return `<button type="button" class="tk tk-${tipo}" draggable="true" data-ins="${esc(ins)}" data-clave="${esc(o.clave || ins)}"${o.fin ? ` data-fin="${esc(o.fin)}"` : ""}${o.vivo ? ` data-vivo="${esc(o.vivo)}"` : ""}>${esc(texto)}</button>`;
  }
  const fila = (...partes) => `<div class="fila-tk">${partes.join(" ")}</div>`;
  const nota = (t) => `<span class="nota">${t}</span>`;
  const grupo = (titulo, ...filas) => `<div class="grupo-tk">${titulo ? `<div class="g">${titulo}</div>` : ""}${filas.join("")}</div>`;
  const tkValor = (v, vivo) => typeof v === "number" ? tk("num", v, String(v), { vivo, clave: vivo }) : typeof v === "boolean" ? tk("kw", v, String(v), { vivo, clave: vivo }) : tk("str", JSON.stringify(v), JSON.stringify(v), { vivo, clave: vivo });

  function estadoDe(e) {
    if (e.clase === "robot") return [e.tarea ? "activo" : "", e.carga ? `carga: ${e.carga}` : e.tarea ? "trabajando" : "manos vacías"];
    if (e.clase === "bodega") return ["", "almacenando"];
    if (e.clase === "fundidora") return [e.procesando ? "activo" : "", e.procesando ? "procesando" : "en espera"];
    if (e.clase === "lanzador") {
      if (e.atascado) return ["mal", "atascado"];
      if (e.sinMisiles && e.modo !== "idle") return ["alerta", "sin misiles"];
      if (e.modo === "burst") return ["alerta", "ráfaga"];
      if (e.modo === "regular") return ["activo", "disparando"];
      return ["", "inactivo"];
    }
    if (e.clase === "reparador") return e.estado === "reparar" ? ["activo", "reparando"] : e.estado === "ir" ? ["activo", `va a ${e.objetivo}`] : e.estado === "volver" ? ["", "vuelve"] : ["", "en base"];
    if (e.clase === "vibracion") return [enRango(e).length ? "activo" : "", `${enRango(e).length} en rango`];
    if (e.clase === "deposito") return ["", "suministrando"];
    return ["mal", `vida ${e.hp}/${e.hpMax}`];
  }
  const metricasDe = (e) => {
    if (e.clase === "robot") return [["viajes", e.viajes], ["vacíos", mundo.vacios], ["rechazos", mundo.rechazos]];
    if (e.clase === "bodega") return Object.entries(e.stock).map(([mat, n]) => [mat, e.oculto && !mundo.revelado ? "?" : n]);
    if (e.clase === "fundidora") return [["entrada", `${e.entrada}/${e.cap}`], ["producido", e.producido], ["rechazos", e.rechazos]];
    if (e.clase === "lanzador") {
      const s = e.st;
      return [["lanzados", s.lanzados], ["impactos", s.impactos], ["precisión", s.lanzados ? `${Math.round(s.impactos / s.lanzados * 100)} %` : "—"], ["derribos", s.derribos], ["atascos", s.atascos], ["en ráfaga", `${s.tRafaga.toFixed(1)} s`], ["fallo máx", `${Math.round(s.fallaMax * 100)} %`], ["₵ gastado", s.consumidos * COSTE.misil]];
    }
    if (e.clase === "vibracion") return [["lecturas", e.st.lecturas]];
    if (e.clase === "reparador") return [["reparaciones", e.st.reparaciones], ["₵ gastado", e.st.reparaciones * COSTE.reparacion]];
    if (e.clase === "deposito") return [["misiles entregados", mundo.consumidos]];
    return null;
  };

  function pintarInspector() {
    const $i = $("inspector");
    const e = seleccion && (mundo.porId[seleccion] || mundo.enemigos.find(x => x.id === seleccion));
    if (!e) insEstado = "cerrado";
    $i.dataset.estado = insEstado;
    if (!e) { $("ins-tira").innerHTML = ""; $("ins-cuerpo").innerHTML = ""; return; }
    const propioProg = e.id === progSel, pre = propioProg ? "" : `${varDe(e.id)}.`;
    let clase, c1 = "", c2 = "", botones = "";
    if (["robot", "bodega", "fundidora"].includes(e.clase)) {
      clase = e.clase === "robot" ? "Robot de carga" : e.nombre;
      c1 = htmlFactoryAPI();
      c2 = grupo("Datos", ...metricasDe(e).map(([k, v]) => fila(nota(esc(k)), esc(v))));
    } else if (e.clase === "lanzador") {
      clase = "Lanzamisiles";
      const ajeno = propioProg ? null : `Solo desde el programa de ${e.id}`;
      c1 = grupo("Nombre", fila(tk("var", varDe(e.id), varDe(e.id)), nota(`en pantalla ${e.id}${propioProg ? " · en su programa no hace falta escribirlo" : ""}`)))
        + grupo("Contenido", fila(tk("prop", `${pre}missiles`, `${pre}missiles`), `<span class="sep">=</span>`, tkValor(e.misiles, `${e.id}:missiles`), nota(`/ ${def.cargador} misiles`)))
        + grupo("Funciones",
          fila(tk("fn", `${pre}autoTarget(tipo, sensor)`, `${pre}autoTarget(/* tipo de enemigo */, /* sensor */)`, { fin: "// → posición {x, y, z} o null" }), nota("→ posición")),
          fila(tk("fn", `${pre}regularShoot(lugar)`, `${pre}regularShoot(/* lugar */);`, { ajeno }), nota("1 disparo/s")),
          fila(tk("fn", `${pre}burstFire(lugar)`, `${pre}burstFire(/* lugar */);`, { ajeno }), nota("2,2 disparos/s · sube el fallo")),
          fila(tk("fn", `${pre}stopFire()`, `${pre}stopFire();`, { ajeno }), nota("deja de disparar")));
      c2 = grupo("Flujo", fila(nota("entrada:"), "misiles", nota("· salida:"), "lanzamientos"), fila(nota("suministro:"), `${def.suministro} misil/s`))
        + grupo("Propiedades",
          fila(tk("prop", `${pre}fireRate`, `${pre}fireRate`), `<span class="sep">=</span>`, tkValor(cadencia(e.modo), `${e.id}:fireRate`), nota("disparos/s")),
          fila(tk("prop", `${pre}failureRate`, `${pre}failureRate`), `<span class="sep">=</span>`, tkValor(r3(e.falla), `${e.id}:failureRate`), `<span class="barra"><i data-barra="${e.id}" style="width:${Math.round(e.falla * 100)}%"></i></span>`),
          fila(tk("prop", `${pre}mode`, `${pre}mode`), `<span class="sep">=</span>`, tkValor(e.modo, `${e.id}:mode`)),
          fila(tk("prop", `${pre}jammed`, `${pre}jammed`), `<span class="sep">=</span>`, tkValor(e.atascado, `${e.id}:jammed`)),
          fila(tk("prop", `${pre}target`, `${pre}target`), `<span class="sep">=</span>`, `<span class="nota" data-vivo="${e.id}:target">${esc(fmtLugar(e.lugar))}</span>`))
        + grupo("Sensores montados", fila(tk("prop", `${pre}sensors`, `${pre}sensors`), `<span class="sep">=</span>`, tk("str", '"visual"', '"visual"'), tk("str", '"thermal"', '"thermal"')),
          fila(nota(`alcance: cámara ${alcance("visual")} · térmico ${alcance("thermal")}${def.niebla ? " (niebla)" : ""}`)),
          fila(nota("tipos:"), ...Object.keys(TIPOS).map(t => tk("str", `"${t}"`, `"${t}"`))));
      botones = (propioProg ? "" : `<button type="button" class="btn chico" data-accion="programa">Editar el programa de ${esc(e.id)}</button>`);
    } else if (e.clase === "vibracion") {
      clase = "Sensor de vibración (red)";
      c1 = grupo("Nombre", fila(tk("var", varDe(e.id), varDe(e.id)), nota(`en pantalla ${e.id}`)))
        + grupo("Funciones", fila(tk("fn", `${varDe(e.id)}.detect(tipo)`, `${varDe(e.id)}.detect(/* tipo de enemigo */)`, { fin: "// → posición actual o null" }), nota("→ posición, sin predicción")))
        + grupo("Propiedades", fila(tk("prop", `${varDe(e.id)}.count`, `${varDe(e.id)}.count`), `<span class="sep">=</span>`, tkValor(enRango(e).length, `${e.id}:count`), nota("enemigos de suelo en rango")));
      c2 = grupo("", fila(nota("tipo:"), "vibración del suelo"), fila(nota("alcance:"), `${e.alcance} casillas`), fila(nota("ve:"), tk("str", '"crawler"', '"crawler"'), nota("· no ve drones")),
        fila(nota("Da dónde está el enemigo ahora, no dónde estará: el misil llega tarde a lo que se mueve rápido.")));
    } else if (e.clase === "deposito") {
      clase = "Depósito de misiles";
      c1 = grupo("", fila(nota("No tiene nombre en el código en este banco.")));
      c2 = grupo("", fila(nota("salida:"), `${def.suministro} misil/s a cada lanzador`), fila(nota("cargador de cada lanzador:"), `${def.cargador}`));
    } else if (e.clase === "reparador") {
      clase = "Robot reparador";
      c1 = grupo("", fila(nota("Trabaja solo: atiende los atascos en orden de llegada.")));
      c2 = grupo("", fila(nota("velocidad:"), `${REP.vel} casillas/s`), fila(nota("reparación:"), `${REP.tBase} s + ${REP.tPorFallo} s × failureRate del fallo`), fila(nota("cola:"), `<span class="nota" data-vivo="cola">${mundo.colaReparar.join(", ") || "vacía"}</span>`));
    } else {
      const tp = TIPOS[e.tipo];
      clase = `Enemigo · ${tp.nombre}`;
      const ven = [...(tp.frio ? [] : ["thermal"]), "visual"].sort();
      const vib = mundo.sensores[0];
      c1 = grupo("Tipo", fila(tk("str", `"${e.tipo}"`, `"${e.tipo}"`), nota(`autoTarget("${e.tipo}", …) lo apunta`)))
        + grupo("Lo ven", fila(...ven.map(s => tk("str", `"${s}"`, `"${s}"`))), tp.suelo && vib ? fila(tk("fn", `${varDe(vib.id)}.detect("${e.tipo}")`, `${varDe(vib.id)}.detect("${e.tipo}")`)) : "");
      c2 = grupo("", fila(nota("vida:"), `<span data-vivo="${e.id}:hp">${e.hp}/${e.hpMax}</span>`), fila(nota("velocidad:"), `${-e.vx} casillas/s`), fila(nota("altura:"), `${e.z} m${tp.suelo ? " (suelo)" : ""}`),
        fila(nota("posición:"), `<span class="nota" data-vivo="${e.id}:pos">x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}</span>`), tp.frio ? fila(nota("Motor frío: el térmico no lo ve.")) : "");
    }
    const [cls, txt] = estadoDe(e);
    const m = metricasDe(e);
    const abierto = insEstado === "abierto";
    const f = funcionDe(e);
    $i.style.setProperty("--rol", f ? `var(--rol-${f.principal})` : "var(--enemigo)");
    const rol = f ? `<span class="rol">${esc(FUNCIONES[f.principal])}${f.secundaria ? ` <small>+ ${esc(FUNCIONES[f.secundaria].toLowerCase())}</small>` : ""}</span>` : `<span class="rol">Enemigo</span>`;
    $("ins-tira").innerHTML = `
      <div class="ins-cab"><div class="nombre"><h2>${esc(e.id)}${seleccionadas.size > 1 ? ` · ${seleccionadas.size} seleccionadas` : ""}</h2><span class="estado ${cls}" data-estado>${esc(txt)}</span><span class="clase">${esc(clase)}</span>${rol}</div>
        <div class="ins-acc">${V3 && vista === "3d" ? `<button type="button" data-accion="centrar" aria-label="Centrar la cámara en ${esc(e.id)}" data-tip="Centrar la cámara">⌖</button>` : ""}<button type="button" data-accion="${abierto ? "plegar" : "abrir"}" aria-label="${abierto ? "Plegar la ficha" : "Abrir la ficha completa"}" data-tip="${abierto ? "Plegar la ficha" : "Ficha completa"}">${abierto ? "▴" : "▾"}</button><button type="button" data-accion="cerrar" aria-label="Cerrar el inspector" data-tip="Cerrar">×</button></div></div>
      ${abierto ? "" : `<div class="vitales" id="ins-vitales">${htmlVitales(e)}</div>`}
      <div class="ins-pista">Mantén presionada una unidad, o toca aquí, para ver su ficha completa.</div>`;
    $("ins-cuerpo").innerHTML = `
      <div class="regla"></div>
      <div class="ins-cols"><div class="ins-col"><h3><span class="placa">Para tu código</span></h3>${c1}</div><div class="ins-col"><h3><span class="placa">Datos</span></h3>${c2}</div></div>
      ${botones ? `<div class="fila-botones">${botones}</div>` : ""}
      ${m ? `<div class="regla"></div><div class="grupo-tk"><h3 class="metricas-tit"><span class="placa">Métricas de este intento</span></h3><div class="metricas" data-metricas>${htmlMetricas(m)}</div></div>` : ""}
      <div class="regla"></div>
      <div class="leyenda-tk"><span class="tk-var">máquina</span><span class="tk-fn">función</span><span class="tk-prop">propiedad</span><span class="tk-num">número</span><span class="tk-str">texto</span>
        <span style="font-family:var(--f-body);font-weight:400">· doble toque: lo inserta en el programa de <b>${esc(progSel)}</b> · también se puede arrastrar</span></div>
      <div class="pista-tk" id="pista-tk"></div>
      ${abierto ? `<div class="regla"></div><div class="grupo-tk ins-vitales-final"><h3><span class="placa">Signos vitales</span></h3><div class="vitales" id="ins-vitales">${htmlVitales(e)}</div></div>` : ""}`;
  }

  // Inspector del panel inferior (bajo el editor): sin nombre ni estado, solo lo que el programa
  // abierto puede usar: funciones, propiedades, sus variables y constantes, y la red de sensores.
  function variablesPrograma() {
    const toks = lexico($codigo.value).filter(t => !["esp", "nl", "com"].includes(t[0])), out = new Map();
    toks.forEach((t, i) => { if (["const", "let", "var"].includes(t[1]) && toks[i + 1] && toks[i + 1][0] === "id" && !out.has(toks[i + 1][1])) out.set(toks[i + 1][1], t[1]); });
    return [...out];
  }
  const varFactory = id => /^[A-Za-z_$][\w$]*$/.test(varDe(id)) && mundo.entidades.filter(e => varDe(e.id) === varDe(id)).length === 1 && !FN_PROPIAS.has(varDe(id)) && !KW.has(varDe(id)) && !(varDe(id) in window) ? varDe(id) : JSON.stringify(id);
  function htmlFactoryAPI() {
    return grupo("Encargos de R1", fila(tk("fn", "await pickUp(lugar, material)", "await pickUp(/* lugar */, /* material */);")),
      fila(tk("fn", "await deliver(lugar)", "await deliver(/* lugar */);")), fila(tk("fn", "await wait(segundos)", "await wait(1);")))
      + grupo("Lecturas", ...mundo.entidades.flatMap(e => window.FACTORY.MATERIALES.map(mat => fila(tk("fn", `count("${e.id}", "${mat}")`, `count(${varFactory(e.id)}, ${JSON.stringify(mat)})`)))))
      + grupo("Lugares", ...mundo.entidades.map(e => fila(tk("var", e.id, varFactory(e.id)))));
  }
  function pintarPieIns() {
    if (ES_FACTORY) { $("pie-ins").innerHTML = htmlFactoryAPI(); return; }
    const $p = $("pie-ins"), e = mundo && mundo.porId[progSel];
    if (!$p) return;
    if (!e) { $p.innerHTML = `<p class="nota">Elige un lanzador para ver lo que su programa puede usar.</p>`; return; }
    const vars = variablesPrograma(), red = mundo.sensores;
    $p.innerHTML = `<div class="pie-ins-cols">`
      + grupo("Funciones",
        fila(tk("fn", "autoTarget(tipo, sensor)", "autoTarget(/* tipo de enemigo */, /* sensor */)", { fin: "// → posición {x, y, z} o null" }), nota("→ posición")),
        fila(tk("fn", "regularShoot(lugar)", "regularShoot(/* lugar */);"), nota("1 disparo/s")),
        fila(tk("fn", "burstFire(lugar)", "burstFire(/* lugar */);"), nota("ráfaga")),
        fila(tk("fn", "stopFire()", "stopFire();")),
        fila(tk("fn", "await esperar(segundos)", "await esperar(0.5);"), nota("pausa")))
      + grupo("Propiedades",
        fila(tk("prop", "missiles", "missiles"), `<span class="sep">=</span>`, tkValor(e.misiles, `${e.id}:missiles`), nota(`/ ${def.cargador}`)),
        fila(tk("prop", "failureRate", "failureRate"), `<span class="sep">=</span>`, tkValor(r3(e.falla), `${e.id}:failureRate`)),
        fila(tk("prop", "fireRate", "fireRate"), `<span class="sep">=</span>`, tkValor(cadencia(e.modo), `${e.id}:fireRate`)),
        fila(tk("prop", "mode", "mode"), `<span class="sep">=</span>`, tkValor(e.modo, `${e.id}:mode`)),
        fila(tk("prop", "jammed", "jammed"), `<span class="sep">=</span>`, tkValor(e.atascado, `${e.id}:jammed`)),
        fila(tk("prop", "target", "target"), `<span class="sep">=</span>`, `<span class="nota" data-vivo="${e.id}:target">${esc(fmtLugar(e.lugar))}</span>`),
        fila(tk("prop", "sensors", "sensors"), `<span class="sep">=</span>`, tk("str", '"visual"', '"visual"'), tk("str", '"thermal"', '"thermal"')))
      + grupo("Variables y constantes", vars.length
        ? fila(...vars.map(([n, k]) => `<span class="var-prog">${tk("var", n, n)}${nota(k)}</span>`))
        : fila(nota("El programa todavía no declara ninguna (const o let).")))
      + (red.length ? grupo("Red de sensores", ...red.map(x => fila(tk("fn", `${varDe(x.id)}.detect(tipo)`, `${varDe(x.id)}.detect(/* tipo de enemigo */)`, { fin: "// → posición actual o null" }),
        tk("prop", `${varDe(x.id)}.count`, `${varDe(x.id)}.count`), `<span class="sep">=</span>`, tkValor(enRango(x).length, `${x.id}:count`)))) : "")
      + `</div>`;
  }
  let tPieIns = 0;

  // Signos vitales: gráficos propios que se leen de un vistazo (cargador, failureRate y su historia, vida).
  const historia = new Map();   // id de lanzador → [[t, failureRate], …] de los últimos 30 s de juego
  const VENTANA = 30;
  function muestrear() {
    for (const l of mundo.lanzadores) {
      const h = historia.get(l.id) || (historia.set(l.id, []), historia.get(l.id));
      if (!h.length || h[h.length - 1][0] !== mundo.t) h.push([mundo.t, l.falla]);
      while (h.length && h[0][0] < mundo.t - VENTANA) h.shift();
    }
  }
  const celdas = (n, total, extra = "") => `<div class="celdas ${extra}">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>`;
  const vital = (k, v, cuerpo = "") => `<div class="vital"><div class="k"><span>${k}</span>${v != null ? `<b>${v}</b>` : ""}</div>${cuerpo}</div>`;
  function traza(id) {
    const h = historia.get(id) || [];
    const max = Math.max(0.2, ...h.map(p => p[1])) * 1.1, t1 = mundo.t, t0 = t1 - VENTANA;
    const pts = h.map(([t, f]) => `${((t - t0) / VENTANA * 100).toFixed(2)},${(30 - f / max * 28).toFixed(2)}`);
    const linea = pts.length > 1 ? `<path class="area" d="M${pts[0].split(",")[0]},30L${pts.join("L")}L${pts[pts.length - 1].split(",")[0]},30Z"/><polyline class="linea" points="${pts.join(" ")}"/>` : "";
    return `<svg class="traza" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><line class="base" x1="0" y1="30" x2="100" y2="30"/>${linea}</svg>
      <div class="traza-pie"><span>−${VENTANA} s</span><span>escala 0–${r3(max)}</span><span>ahora</span></div>`;
  }
  function htmlVitales(e) {
    if (["robot", "bodega", "fundidora"].includes(e.clase)) return metricasDe(e).map(([k, v]) => vital(esc(k), esc(v))).join("");
    if (e.clase === "lanzador") {
      return vital("Misiles", `${e.misiles}/${def.cargador}`, celdas(e.misiles, def.cargador))
        + vital("failureRate", r3(e.falla), `<div class="medidor"><i style="width:${Math.min(100, Math.round(e.falla * 100))}%"></i></div>`)
        + `<div class="vital" style="grid-column:1/-1"><div class="k"><span>failureRate · últimos ${VENTANA} s</span><b>${esc(e.modo)}</b></div>${traza(e.id)}</div>`;
    }
    if (e.clase === "vibracion") return vital("En rango", enRango(e).length) + vital("Alcance", `${e.alcance} casillas`);
    if (e.clase === "reparador") return vital("Cola", esc(mundo.colaReparar.join(", ") || "vacía")) + vital("Reparaciones", e.st.reparaciones);
    if (e.clase === "deposito") return vital("Entregados", mundo.consumidos) + vital("Suministro", `${def.suministro} misil/s`);
    return vital("Vida", `${e.hp}/${e.hpMax}`, celdas(e.hp, e.hpMax, "vida")) + vital("Altura", `${e.z} m`) + vital("Posición", `x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}`);
  }
  const htmlMetricas = (m) => m.map(([k, v]) => `<span class="m">${esc(k)} <b>${esc(v)}</b></span>`).join("");
  $("inspector").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-accion]");
    if (!b) { if (insEstado === "tira" && ev.target.closest(".ins-tira")) abrirInspector(); return; }
    const a = b.dataset.accion;
    if (a === "programa") { verPanel("codigo"); abrirPestana("programa"); abrirPrograma(seleccion); }
    else if (a === "centrar") centrarEn(seleccion);
    else if (a === "abrir") abrirInspector();
    else if (a === "plegar") ponerInspector("tira");
    else if (a === "cerrar") ponerInspector("cerrado");
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (!$("hoja-reto").hidden) abrirHoja(false);
    else if (insEstado === "abierto") ponerInspector("tira");
  });
  function valorVivo(clave) {
    const [id, p] = clave.split(":");
    if (clave === "cola") return mundo.colaReparar.join(", ") || "vacía";
    const e = mundo.porId[id] || mundo.enemigos.find(x => x.id === id);
    if (!e) return null;
    switch (p) {
      case "missiles": return e.misiles;
      case "failureRate": return r3(e.falla);
      case "fireRate": return cadencia(e.modo);
      case "mode": return e.modo;
      case "jammed": return e.atascado;
      case "target": return fmtLugar(e.lugar);
      case "count": return enRango(e).length;
      case "hp": return `${e.hp}/${e.hpMax}`;
      case "pos": return `x ${e.x.toFixed(1)} · y ${e.y.toFixed(1)}`;
    }
    return null;
  }
  // Valores vivos del inspector; con un documento Python, True/False/None.
  const textoVivo = (el, v) => { const t = el.classList.contains("tk-str") ? JSON.stringify(v) : String(v); return edicion.lenguaje === "python" ? aPython(t) : t; };
  function actualizarVivos() {
    const $i = $("inspector");
    muestrear();
    for (const el of $("pie-ins").querySelectorAll("[data-vivo]")) {
      const v = valorVivo(el.dataset.vivo); if (v == null) continue;
      const txt = textoVivo(el, v);
      if (el.textContent !== txt) { el.textContent = txt; if (el.dataset.ins != null) el.dataset.ins = txt; }
    }
    const e = seleccion && (mundo.porId[seleccion] || mundo.enemigos.find(x => x.id === seleccion));
    if ([...seleccionadas].some(id => !unidadPorId(id))) { seleccionar([...seleccionadas].filter(id => unidadPorId(id)), { inspeccionar: "conservar" }); return; }
    if (!e) return;
    for (const el of $i.querySelectorAll("[data-vivo]")) {
      const v = valorVivo(el.dataset.vivo); if (v == null) continue;
      const txt = textoVivo(el, v);
      if (el.textContent !== txt) { el.textContent = txt; if (el.dataset.ins != null) el.dataset.ins = txt; }
    }
    const barra = $i.querySelector("[data-barra]"); if (barra) barra.style.width = `${Math.round(e.falla * 100)}%`;
    const est = $i.querySelector("[data-estado]"); if (est) { const [cls, txt] = estadoDe(e); est.className = `estado ${cls}`; est.textContent = txt; }
    const vit = $("ins-vitales"); if (vit) { const h = htmlVitales(e); if (vit.innerHTML !== h) vit.innerHTML = h; }
    const met = $i.querySelector("[data-metricas]"); if (met) { const h = htmlMetricas(metricasDe(e)); if (met.innerHTML !== h) met.innerHTML = h; }
  }

  // Doble clic (o doble toque) inserta; un clic solo arma el token y explica qué insertará.
  let armado = { clave: null, t: 0 };
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest(".tk"); if (!t) return;
    const $p = $("pista-tk");
    if (t.dataset.ajeno) { if ($p) $p.textContent = `${t.dataset.ajeno}. Desde aquí puedes leer sus propiedades.`; return; }
    const ahora = performance.now();
    document.querySelectorAll(".tk.armado").forEach(x => x.classList.remove("armado"));
    if (armado.clave === t.dataset.clave && ahora - armado.t < 550) {
      armado = { clave: null, t: 0 };
      insertarRef(t.dataset.ins, t.dataset.fin);
      insercion.dobleClic++;
      t.classList.add("hecho"); setTimeout(() => t.classList.remove("hecho"), 400);
      if ($p) $p.innerHTML = `Insertado <code>${esc(t.dataset.ins)}</code> en ${esc(progSel)}.`;
    } else {
      armado = { clave: t.dataset.clave, t: ahora };
      t.classList.add("armado");
      if ($p) $p.innerHTML = `Doble clic inserta <code>${esc(t.dataset.ins)}</code> donde está el cursor del programa.`;
    }
  });
  const { atajos: ATAJOS } = window.CMGPaleta.crear({
    serie: ES_FACTORY ? "factory" : "war",
    sensor: () => mundo && mundo.sensores[0] ? varDe(mundo.sensores[0].id) : null,
  });
  const preferenciasEditor = prefijo => ({
    leer(k, d) { try { const v = localStorage.getItem(prefijo + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    escribir(k, v) { try { localStorage.setItem(prefijo + k, JSON.stringify(v)); } catch { /* sesión */ } },
  });
  const preferenciasVistas = preferenciasEditor(`cmg-juego-${ES_FACTORY ? "factory-" : ""}`);
  if (ES_FACTORY) for (const [k, viejo] of [["modo", "modo"], ["idioma-seudo", "idioma"]]) {
    if (preferenciasVistas.leer(k, null) == null) try { const v = JSON.parse(localStorage.getItem(`cmg-banco02:${viejo}`)); if (v != null) preferenciasVistas.escribir(k, v); } catch { /* importación de solo lectura */ }
  }
  const editorPrograma = window.CMGEditor.crear({
    raiz: $("v-programa"), app: $("app"), ambito: document, elemento: $, adoptar: true, atajosGlobales: true,
    documento: { id: "inicio", lenguaje: "js", texto: "", revision: 0 },
    adaptadores: PYTHON ? { js: window.CMGAdaptadorJS, python: window.CMGAdaptadorPython } : { js: window.CMGAdaptadorJS }, serie: ES_FACTORY ? "factory" : "war", aplazarVistas: true,
    preferencias: preferenciasEditor("cmg-juego-"), preferenciasVistas,
    soloLectura: () => !!ejec, alEjecutar: () => ejec ? detener() : ejecutar(),
    alAtajo: () => insercion.atajo++, alArrastrar: () => insercion.arrastre++,
    proveedor: {
      funciones: () => proveedorEditor.funciones(), firma: f => FIRMAS[f] || null,
      sugerencias: c => edicion.lenguaje === "python" ? sugerenciasPython(c) : sugerencias(c),
      vocabulario: l => l === "python" ? vocabularioPython() : ({ objetos: ["console", "yo", ...nombresVar()], funciones: [...FN_PROPIAS], miembros: [...FN_MIEMBRO], propiedades: [...PROPS] }),
      atajos: l => l === "python" ? atajosPython() : ATAJOS,
    },
    datos: () => window.cmg.datos(), inicial: () => window.cmg.inicial(),
  });
  // La fachada se rehace al cambiar de lenguaje: se llama siempre a la vigente.
  const viva = nombre => (...args) => editorPrograma.fachada[nombre](...args);
  const insertar = viva("insertar"), envolver = viva("envolver"), alternarComentario = viva("alternarComentario"), medirEditor = viva("medirEditor"),
    pintarResaltado = viva("pintarResaltado"), seleccionarHueco = viva("seleccionarHueco"), avisoEditor = viva("aviso");
  const pintarPaleta = () => editorPrograma.fachada.atajos(edicion.lenguaje === "python" ? atajosPython() : ATAJOS);
  const $editor = $("editor");
  $("codigo").addEventListener("input", () => { clearTimeout(tPieIns); tPieIns = setTimeout(pintarPieIns, 350); });

  document.addEventListener("dragstart", (ev) => {
    const t = ev.target.closest && ev.target.closest(".tk[data-ins]"); if (!t) return;
    ev.dataTransfer.setData("text/plain", t.dataset.ins); ev.dataTransfer.effectAllowed = "copy";
    $editor.classList.add("soltar");
  });
  document.addEventListener("dragend", () => $editor.classList.remove("soltar"));

  // ---------- Pestañas ----------
  const TABS = ["programa", "registro", "ayuda", "escenario"];
  function abrirPestana(t) {
    $("zona-codigo").dataset.pestana = t;
    for (const x of TABS) { const on = x === t; $(`t-${x}`).setAttribute("aria-selected", on); $(`v-${x}`).hidden = !on; }
    if (t === "programa") medirEditor();
  }
  document.querySelector(".tabs").addEventListener("click", (ev) => { const b = ev.target.closest(".tab"); if (b) abrirPestana(b.id.slice(2)); });

  // Banner
  function mostrarBanner(tipo, titulo, html, stats, acciones) {
    const $b = $("banner");
    $b.className = `banner ${tipo}`;
    $b.innerHTML = `<h2>${esc(titulo)}</h2>${html ? (html.startsWith("<p") ? html : `<p>${html}</p>`) : ""}${stats ? `<p class="stats">${esc(stats)}</p>` : ""}<div class="acciones"></div>`;
    const $a = $b.querySelector(".acciones");
    for (const [txt, cls, fn] of acciones) {
      const b = document.createElement("button"); b.type = "button"; b.className = `btn chico ${cls}`; b.textContent = txt; b.addEventListener("click", fn); $a.appendChild(b);
    }
    $b.hidden = false;
  }
  function ocultarBanner() { $("banner").hidden = true; }

  // ---------- Programas ----------
  function pintarProgs() {
    const varios = programablesDe(def).length > 1;
    $("progs").innerHTML = programablesDe(def).map(l => {
      const p = ejec && ejec.progs.get(l.id);
      const est = lineaErr && lineaErr.id === l.id ? "error" : p ? (p.estado === "corre" ? "corre" : p.estado === "espera" ? "espera" : "") : "";
      return `<button type="button" class="prog-tab" data-id="${l.id}" aria-pressed="${edicion.ids.includes(l.id)}"><span class="punto ${est}"></span><span class="prog-pre">Programa de </span>${l.id}</button>`;
    }).join("");
    $("b-copiar-prog").hidden = !varios || edicion.ids.length > 1;
    $("b-restaurar").hidden = edicion.ids.length > 1;
  }
  $("progs").addEventListener("click", (ev) => { const b = ev.target.closest(".prog-tab"); if (b) abrirPrograma(b.dataset.id); });
  function abrirPrograma(id) {
    if (!Object.hasOwn(programas, id)) return;
    seleccionar(id, { inspeccionar: "conservar" });
    configurarEdicion([id], true);
  }
  function configurarEdicion(ids, forzar = false) {
    ids = [...new Set(ids)].filter(id => Object.hasOwn(programas, id));
    if (!ids.length) return;
    if (!forzar && ids.join("|") === edicion.ids.join("|")) return;
    const textos = ids.map(textoDe), langs = ids.map(lenguajeDe);
    const variosLenguajes = langs.some(l => l !== langs[0]);
    edicion = { ids, mixto: variosLenguajes || textos.some(src => src !== textos[0]), lenguaje: variosLenguajes ? "js" : langs[0], variosLenguajes };
    progSel = ids[0];
    $codigo.value = edicion.mixto ? (borradoresMulti.get(claveEdicion(ids) + ":" + edicion.lenguaje) || "") : textos[0];
    $codigo.placeholder = edicion.mixto ? "Escribe el código que quieres añadir o sustituir en las unidades seleccionadas." : "";
    $("acciones-multi").hidden = !edicion.mixto;
    $("multi-estado").textContent = variosLenguajes ? `${ids.length} unidades en lenguajes distintos. Para aplicar un borrador, elige unidades del mismo lenguaje.`
      : `${ids.length} unidades con programas distintos. Escribe el código y elige cómo aplicarlo.`;
    // Cambia el documento que se edita: el historial de deshacer de edicion.js va por documento.
    editorPrograma.abrir({ id: claveDocumento(), lenguaje: edicion.lenguaje, texto: $codigo.value, revision: 0 });
    const nombreL = edicion.lenguaje === "python" ? "Python" : "JavaScript";
    $codigo.setAttribute("aria-label", ids.length > 1 ? `Programa de ${ids.length} lanzadores en ${nombreL}` : `Programa de ${progSel} en ${nombreL}`);
    pintarProgs(); medirEditor(); pintarEdicion(); pintarPieIns(); pintarLenguaje(); marcasSucias = true;
  }
  const claveDocumento = () => `${retoIdx}:${claveEdicion(edicion.ids)}${edicion.mixto ? ":borrador" : ""}${edicion.lenguaje === "python" ? ":python" : ""}`;
  // Lenguaje de la unidad: el desplegable de la cabecera y Python en Ajustes. JavaScript, Seudo y
  // Bloques vuelven a JavaScript; el programa Python se conserva para cuando se vuelva a elegir.
  function pintarSelectorLenguaje() {
    const $selLenguaje = $("sel-lenguaje");
    if (!$selLenguaje) return;
    const varios = PYTHON && !!edicion.variosLenguajes, py = PYTHON && edicion.lenguaje === "python" && !varios;
    const modoVista = $("app").dataset.modo || "js";
    const opciones = [["js", "JavaScript"], ...(PYTHON ? [["python", "Python"]] : [])];
    const vistas = [["pseudo", "Seudocódigo"], ...(ES_FACTORY ? [["bloques", "Bloques"]] : [])];
    const html = (varios ? `<option value="varios" disabled>Varios lenguajes</option>` : "")
      + opciones.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")
      + `<optgroup label="Vistas de JavaScript">${vistas.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</optgroup>`;
    if ($selLenguaje.dataset.html !== html) { $selLenguaje.innerHTML = html; $selLenguaje.dataset.html = html; }
    $selLenguaje.value = varios ? "varios" : py ? "python" : (modoVista === "js" ? "js" : modoVista);
  }
  function pintarLenguaje() {
    pintarSelectorLenguaje();
    if (!PYTHON) return;
    const py = edicion.lenguaje === "python" && !edicion.variosLenguajes;
    for (const b of document.querySelectorAll("[data-lenguaje-programa]")) { b.hidden = false; b.disabled = false; b.setAttribute("aria-pressed", String(py)); }
    if (py) for (const b of document.querySelectorAll("[data-modo-codigo]")) b.setAttribute("aria-pressed", "false");
    $("app").dataset.lenguaje = py ? "python" : "js";
  }
  const $selLenguaje = $("sel-lenguaje");
  if ($selLenguaje) {
    $selLenguaje.addEventListener("change", () => {
      const v = $selLenguaje.value;
      if (v === "python") cambiarLenguaje("python");
      else if (PYTHON && edicion.lenguaje === "python") { if (cambiarLenguaje("js")) editorPrograma.fachada.seudo?.aplicarModo(v); }
      else editorPrograma.fachada.seudo?.aplicarModo(v);
      pintarSelectorLenguaje();
    });
    $("app").addEventListener("cmg:modo", pintarSelectorLenguaje);
  }
  function cambiarLenguaje(lenguaje) {
    if (!PYTHON || !def) return false;
    if (ejec) { avisoEditor("Detén el programa para cambiar de lenguaje."); return false; }
    if (!edicion.variosLenguajes && edicion.lenguaje === lenguaje) return false;
    const sinConvertir = [];
    for (const id of edicion.ids) {
      if (lenguaje === "python") {
        // Py recupera el último Python de la unidad; si no lo hay, convierte su JS (E7). Si no cabe, el JS se conserva.
        if (fuentes[id]) { fuentes[id] = { ...fuentes[id], enUso: true }; continue; }
        const js = programas[id] || "";
        let texto = textoInicialPython(def, id);
        if (js !== textoInicial(def, id) && js.trim()) {
          const r = convertirAPython(js);
          if (r.ok) texto = r.texto;
          else { sinConvertir.push(`<b>${esc(id)}</b>: ${esc(r.motivo)}${r.linea ? ` (línea ${r.linea} del JavaScript)` : ""}`); texto = `# Programa de ${id} en Python.\n# Tu programa JavaScript no se pudo convertir; sigue guardado: vuelve con JS para verlo.\n\n`; }
        }
        fuentes[id] = { lenguaje: "python", texto, enUso: true };
      } else if (fuentes[id]) fuentes[id].enUso = false;
    }
    guardarProgramas(); configurarEdicion(edicion.ids, true); pintarInspector();
    if (sinConvertir.length) avisoEditor(`No se pudo pasar a Python: ${sinConvertir.join(" · ")}`);
    return true;
  }
  if (PYTHON) document.addEventListener("click", (ev) => {
    const py = ev.target.closest && ev.target.closest("[data-lenguaje-programa]");
    if (py) { cambiarLenguaje(py.dataset.lenguajePrograma); return; }
    const vista = ev.target.closest && ev.target.closest("[data-modo-codigo]");
    // Con Python no hay vistas: elegir JS, Seudo o Bloques vuelve a JavaScript y aplica esa vista.
    if (vista && edicion.lenguaje === "python" && cambiarLenguaje("js")) editorPrograma.fachada.seudo?.aplicarModo(vista.dataset.modoCodigo);
  });
  const CLAVE_CONFIRMAR_REPLACE = "cmg-juego-confirmar-replace";
  let confirmarReplace = (() => { try { return localStorage.getItem(CLAVE_CONFIRMAR_REPLACE) !== "false"; } catch { return true; } })();
  function preferirConfirmacionReplace(valor) {
    confirmarReplace = !!valor;
    try { localStorage.setItem(CLAVE_CONFIRMAR_REPLACE, JSON.stringify(confirmarReplace)); } catch { /* preferencia de sesión */ }
  }
  function confirmarReemplazo(ids) {
    if (!confirmarReplace) return Promise.resolve(true);
    const dialogo = $("confirmar-replace"), omitir = $("replace-no-preguntar");
    omitir.checked = false;
    dialogo.returnValue = "cancelar";
    $("replace-texto").textContent = `Se sustituirá por completo el programa de ${ids.join(", ")}. Se perderá el código anterior de estas unidades.`;
    return new Promise(resolve => {
      dialogo.addEventListener("close", () => {
        const aceptado = dialogo.returnValue === "reemplazar";
        if (aceptado && omitir.checked) preferirConfirmacionReplace(false);
        resolve(aceptado);
      }, { once: true });
      dialogo.showModal();
    });
  }
  const aplicarMulti = window.CMGProgramas.crearAplicador({
    estado: () => ({ ejec, edicion, programas: edicion.lenguaje === "python" ? textosPython : programas, texto: $codigo.value }),
    confirmarReemplazo,
    alAplicar(ids) {
      borradoresMulti.delete(claveEdicion(ids) + ":" + edicion.lenguaje);
      guardarProgramas(); configurarEdicion(ids, true); pintarInspector();
    },
  });
  const aplicarSiSeMezcla = reemplazar => edicion.variosLenguajes ? avisoEditor("Las unidades elegidas están en lenguajes distintos: elige unidades del mismo lenguaje para aplicar un borrador.") : aplicarMulti(reemplazar);
  $("b-add").addEventListener("click", () => aplicarSiSeMezcla(false));
  $("b-replace").addEventListener("click", () => aplicarSiSeMezcla(true));
  $("b-coordenadas").addEventListener("click", () => { const texto = $("coordenadas").value.trim(); if (texto) insertar(texto); });
  let confirmarCopia = false;
  $("b-copiar-prog").addEventListener("click", (ev) => {
    if (ejec) return;
    if (!confirmarCopia) { confirmarCopia = true; ev.target.textContent = `¿Copiar el de ${progSel} encima de los demás? Toca otra vez`; setTimeout(() => { confirmarCopia = false; ev.target.textContent = "Copiar a los demás lanzadores"; }, 3000); return; }
    confirmarCopia = false; ev.target.textContent = "Copiar a los demás lanzadores";
    // Se copia el programa en su lenguaje: los demás pasan a ese lenguaje y conservan el otro.
    const py = lenguajeDe(progSel) === "python";
    for (const l of def.lanzadores) if (l.id !== progSel) {
      if (py) fuentes[l.id] = { lenguaje: "python", texto: fuentes[progSel].texto.split(progSel).join(l.id), enUso: true };
      else { programas[l.id] = programas[progSel].split(progSel).join(l.id); if (fuentes[l.id]) fuentes[l.id].enUso = false; }
    }
    guardarProgramas();
  });
  let confirmarRestaurar = false;
  $("b-restaurar").addEventListener("click", (ev) => {
    if (ejec) return;
    if (!confirmarRestaurar) { confirmarRestaurar = true; ev.target.textContent = "¿Seguro? Se pierde tu programa. Toca otra vez"; setTimeout(() => { confirmarRestaurar = false; ev.target.textContent = "Restaurar programa inicial"; }, 3000); return; }
    confirmarRestaurar = false; ev.target.textContent = "Restaurar programa inicial";
    ponerTexto(progSel, lenguajeDe(progSel) === "python" ? textoInicialPython(def, progSel) : textoInicial(def, progSel)); guardarProgramas(); abrirPrograma(progSel);
  });
  function pintarEdicion() {
    $codigo.readOnly = !!ejec;
    for (const id of ["b-add", "b-replace", "b-coordenadas", "coordenadas"]) $(id).disabled = !!ejec;
    marcasSucias = true;
    $codigo.dispatchEvent(new CustomEvent("cmg:estado"));
  }

  // ---------- Editor de texto ----------
  const $codigo = $("codigo"), $gutter = $("gutter"), $banda = $("banda"), $espejo = $("espejo"), $resaltado = $("resaltado"), $bloques = $("bloques");
  function pintarBanda() {
    const corre = !edicion.mixto && lineaCorre[progSel], err = !edicion.mixto && lineaErr && lineaErr.id === progSel ? lineaErr.linea : null;
    editorPrograma.marcas(editorPrograma.documento().revision, [{ linea: corre, clase: "corre" }, { linea: err, clase: "err" }]);
  }
  function pintarMarcasYa() { marcasSucias = false; pintarBanda(); pintarProgs(); }
  // En modo pantalla completa, layout.js pone a pantalla completa el panel pedido.
  const verPanel = (panel) => $("app").dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
  function irALinea(l) { verPanel("codigo"); abrirPestana("programa"); editorPrograma.irALinea(l); }
  $codigo.addEventListener("input", () => {
    if (!edicion.mixto) for (const id of edicion.ids) ponerTexto(id, $codigo.value);
    else borradoresMulti.set(claveEdicion(edicion.ids) + ":" + edicion.lenguaje, $codigo.value);
    if (lineaErr && lineaErr.id === progSel) { lineaErr = null; marcasSucias = true; }
    medirEditor();
    if (!edicion.mixto) guardarProgramas();
  });
  function insertarRef(ins, fin) {
    abrirPestana("programa");
    if (ejec) { avisoEditor("Detén el programa para editarlo."); return; }
    if ($("app").dataset.modo === "pseudo") { avisoEditor("En seudocódigo toca un valor del programa para cambiarlo, o usa los ladrillos."); return; }
    const v = $codigo.value, a = $codigo.selectionStart, b = $codigo.selectionEnd;
    const finLinea = v.indexOf("\n", b) < 0 ? v.length : v.indexOf("\n", b);
    const py = edicion.lenguaje === "python", RE = py ? window.CMGAdaptadorPython.hueco.re : RE_HUECO;
    let texto = py ? aPython(ins) : ins;
    if (/^".*"$/.test(texto) && v[a - 1] === '"' && v[b] === '"') texto = texto.slice(1, -1);
    if (fin && !v.slice(b, finLinea).trim()) texto += " " + (py ? aPython(fin) : fin);
    const h = texto.search(RE);
    if (h >= 0 && envolver(texto.slice(0, h), texto.slice(h + texto.slice(h).match(RE)[0].length))) return;
    if (h >= 0) { const m = texto.slice(h).match(RE)[0]; insertar(texto, h, h + m.length); }
    else { insertar(texto); seleccionarHueco(); }
  }
  // ---------- Sugerencias para huecos, argumentos y condiciones ----------
  // Salen de los datos de la máquina cuyo programa se edita, como los del inspector:
  // sus sensores, los enemigos del reto, sus propiedades y la red de sensores.
  const FIRMAS = {
    autoTarget: ["tipo de enemigo", "sensor"], detect: ["tipo de enemigo"], regularShoot: ["lugar"], burstFire: ["lugar"], stopFire: [],
    pickUp: ["lugar", "material"], deliver: ["lugar"], wait: ["segundos"], count: ["lugar", "material"],
    recoger: ["lugar", "material"], entregar: ["lugar"], cuantos: ["lugar", "material"],
    esperar: ["segundos"], log: ["mensaje"], info: ["mensaje"], warn: ["mensaje"], error: ["mensaje"],
  };
  // ---------- Python (E4b) ----------
  // Los fragmentos del juego (inspector, sugerencias, paleta) están escritos en JS y son cortos:
  // llamadas, valores, huecos y operadores. Con un documento Python se pasan, ficha a ficha, a su forma
  // Python (nombres del proveedor por D1, huecos __x__ por D4, sin «;»). Los bloques usan las plantillas Python.
  let nombresPython = null;
  const NOMBRES_LIT = { true: "True", false: "False", null: "None", undefined: "None" };
  function aPython(t) {
    if (t == null) return t;
    nombresPython ||= new Map(proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    const toks = lexico(String(t));
    let out = "";
    for (let i = 0; i < toks.length; i++) {
      const [k, v] = toks[i];
      if (k === "com") { const m = v.match(/^\/\*\s*([\s\S]*?)\s*\*\/$/); out += m ? window.CMGEditorPython.aHueco(m[1]) : v.startsWith("//") ? "#" + v.slice(2) : v; continue; }
      if (k === "id") {
        if (["const", "let", "var"].includes(v) && toks[i + 1] && toks[i + 1][0] === "esp") { i++; continue; }
        out += nombresPython.get(v) || NOMBRES_LIT[v] || v; continue;
      }
      if (k === "p") {
        const tres = toks.slice(i, i + 3).map(x => x[1]).join(""), dos = tres.slice(0, 2);
        if (tres === "===" || tres === "!==") { out += tres === "===" ? "==" : "!="; i += 2; continue; }
        if (dos === "&&" || dos === "||") { out += dos === "&&" ? "and" : "or"; i += 1; continue; }
        if (dos === "??") { out += "or"; i += 1; continue; }
        if (v === "!" && toks[i + 1]?.[1] !== "=") { out += "not "; continue; }
        if (v === ";") continue;
      }
      out += v;
    }
    return out;
  }
  // E5: lo que el traductor necesita del juego. Tabla de alias del proveedor (D1), objetos y propiedades.
  let opcionesPy = null, clavePy = "";
  function opcionesPython() {
    const objetos = ["yo", ...nombresVar()], clave = objetos.join("|");
    if (!opcionesPy || clavePy !== clave) { clavePy = clave; opcionesPy = { funciones: proveedorEditor.alias("python"), objetos, propiedades: [...PROPS] }; }
    return opcionesPy;
  }
  // Los mensajes del runtime nombran la API en JS; para una unidad en Python, con sus nombres y literales.
  function mensajePython(m) {
    nombresPython ||= new Map(proveedorEditor.funciones().filter(f => f.nombres && f.nombres.python).map(f => [f.nombre, f.nombres.python]));
    let r = String(m);
    for (const [js, py] of nombresPython) r = r.replace(new RegExp(`\\b${js}\\b`, "g"), py);
    return r.replace(/\bnull\b/g, "None").replace(/\bundefined\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/while \(true\)/g, "while True");
  }
  const jsDePython = n => { const f = proveedorEditor.funciones().find(x => x.nombres && x.nombres.python === n); return f ? f.nombre : n; };
  // Las sugerencias del juego, con el nombre JS de la función y el resultado en Python.
  function sugerenciasPython(c) {
    const r = sugerencias({ ...c, funcion: c.funcion ? jsDePython(c.funcion) : c.funcion });
    if (!r) return r;
    return { ...r, grupos: r.grupos.map(g => ({ ...g, items: g.items.map(x => ({ ...x, ins: aPython(x.ins), ver: x.ver && aPython(x.ver) })) })) };
  }
  function vocabularioPython() {
    const v = proveedorEditor.vocabulario("python"), py = proveedorEditor.funciones().map(f => (f.nombres && f.nombres.python) || f.nombre);
    return { objetos: ["yo", ...nombresVar()], funciones: v.funciones, miembros: [...new Set([...py, ...FN_MIEMBRO])], propiedades: [...PROPS] };
  }
  let atajosPy = null, atajosPySensor = undefined;
  function atajosPython() {
    const sensor = mundo && mundo.sensores[0] ? varDe(mundo.sensores[0].id) : null;
    if (atajosPy && atajosPySensor === sensor) return atajosPy;
    atajosPySensor = sensor;
    atajosPy = window.CMGPaleta.crearPython({ serie: ES_FACTORY ? "factory" : "war", sensor: () => sensor, aPython }).atajos;
    return atajosPy;
  }
  const OPERADORES_COND = [["&&", "y · se cumplen las dos", "condición"], ["||", "o · basta una", "condición"], ["!", "no · lo contrario", "condición"],
    ["===", "igual", "valor"], ["!==", "distinto", "valor"], [">", "mayor", "valor"], ["<", "menor", "valor"], [">=", "mayor o igual", "valor"], ["<=", "menor o igual", "valor"]];
  function sugerencias(c) {
    const clase = c.hueco ? (c.hueco === "tipo" ? "tipo de enemigo" : c.hueco)
      : c.tipo === "argumento" ? (FIRMAS[c.funcion] || [])[c.indice]
      : c.tipo === "condicion" ? "condición" : c.tipo === "valor" ? "valor" : null;
    if (!clase || !def) return null;
    if (ES_FACTORY && ["lugar", "material", "valor", "condición"].includes(clase)) {
      const items = clase === "lugar" ? mundo.entidades.map(e => ({ ins: varFactory(e.id), cls: "var", nota: e.nombre }))
        : clase === "material" ? window.FACTORY.MATERIALES.map(m => ({ ins: JSON.stringify(m), cls: "str" }))
        : mundo.entidades.flatMap(e => window.FACTORY.MATERIALES.map(mat => ({ ins: `count(${varFactory(e.id)}, ${JSON.stringify(mat)})${clase === "condición" ? " > 0" : ""}`, cls: "fn" })));
      return { titulo: clase, grupos: [{ items }, { titulo: "Del programa", items: (c.variables || []).map(v => ({ ins: v, cls: "var" })) }] };
    }
    const it = (ins, cls, nota, ver) => ({ ins, cls, nota, ver });
    const enReto = new Set(def.oleadas.map(o => o.tipo));
    const vars = (c.variables || []).map(v => it(v, "var", "variable del programa"));
    const red = mundo ? mundo.sensores : [];
    const donde = c.funcion ? `${c.objeto ? c.objeto + "." : ""}${c.funcion}(…) · ${c.indice + 1}.º valor` : "";
    switch (clase) {
      case "tipo de enemigo": {
        const oye = c.funcion === "detect";
        const tipos = Object.keys(TIPOS).sort((x, y) => enReto.has(y) - enReto.has(x));
        return { titulo: "Tipo de enemigo", donde, grupos: [{ items: tipos.map(t => it(`"${t}"`, "str", `${TIPOS[t].nombre}${enReto.has(t) ? " · en este reto" : ""}${oye && !TIPOS[t].suelo ? " · no se oye" : ""}`)) }] };
      }
      case "sensor":
        return { titulo: "Sensor", donde, grupos: [{ items: Object.keys(SENSOR).map(s => it(`"${s}"`, "str", `${SENSOR[s].nombre} · alcance ${def.niebla ? SENSOR[s].niebla : SENSOR[s].alcance}`)) }] };
      case "lugar": {
        const manual = $("coordenadas").value.trim();
        return { titulo: "Lugar", donde, grupos: [
          { titulo: "Del programa", items: vars },
          { titulo: "Apuntar ahora", items: [...enReto].map(t => it(`autoTarget("${t}", "visual")`, "fn", TIPOS[t].nombre)) },
          { titulo: "Red de sensores", items: red.map(s => it(`${varDe(s.id)}.detect("crawler")`, "fn", "posición actual")) },
          { titulo: "Otros", items: [it("target", "prop", "a donde apunta ahora"), it("null", "kw", "deja de disparar"), ...(manual ? [it(manual, "num", "lugar manual")] : [])] },
        ] };
      }
      case "condición":
        return { titulo: "Condición", donde, grupos: [
          { titulo: "Comprobar", items: [
            ...(c.variables || []).flatMap(v => [it(v, "var", "existe (no es null)"), it(`${v} === null`, "var", "no hay")]),
            it("!jammed", "prop", "no está atascado"), it("jammed", "prop", "está atascado"), it("missiles > 0", "prop", "quedan misiles"),
            it("failureRate < 0.25", "prop", "fallo bajo"), it("failureRate >= 0.35", "prop", "fallo alto"), it('mode === "burst"', "prop", "en ráfaga"),
            ...red.map(s => it(`${varDe(s.id)}.count > 0`, "fn", "oye enemigos")),
            it("true", "kw", "siempre"),
          ] },
          { titulo: "Combinar o comparar", items: OPERADORES_COND.map(([op, nota, h]) => it(op === "!" ? `!/* ${h} */` : `/* ${h} */ ${op} /* ${h} */`, "op", nota, op)) },
        ] };
      case "valor":
        return { titulo: "Valor", donde, grupos: [
          { titulo: "Propiedades", items: [it("failureRate", "prop", "0 a 1"), it("missiles", "prop", `0 a ${def.cargador}`), it("fireRate", "prop", "disparos/s"), it("mode", "prop", '"idle", "regular" o "burst"'), ...red.map(s => it(`${varDe(s.id)}.count`, "fn", "enemigos oídos"))] },
          { titulo: "Del programa", items: vars },
          { titulo: "Números y textos", items: [it("0", "num"), it("0.25", "num"), it("0.35", "num"), it("1", "num"), it('"idle"', "str"), it('"regular"', "str"), it('"burst"', "str"), it("null", "kw")] },
        ] };
      case "segundos":
        return { titulo: "Segundos de espera", donde, grupos: [{ items: [["0.1", "muy rápido"], ["0.25", ""], ["0.4", ""], ["0.5", "lo habitual"], ["1", ""], ["2", "lento"]].map(([n, nota]) => it(n, "num", nota)) }] };
      case "mensaje":
        return { titulo: "Mensaje", donde, grupos: [
          { titulo: "Datos de la máquina", items: [it("failureRate", "prop"), it("missiles", "prop"), it("mode", "prop"), it("target", "prop")] },
          { titulo: "Del programa", items: vars },
          { titulo: "Textos", items: [it('"Atascado"', "str"), it('"Sin misiles"', "str"), it('"Fallo alto"', "str")] },
        ] };
    }
    return null;
  }
  $("b-colores").setAttribute("aria-pressed", colores);
  $editor.classList.toggle("colores", colores);
  $("b-colores").addEventListener("click", () => {
    colores = !colores; guardado.escribir("colores", colores);
    $("b-colores").setAttribute("aria-pressed", colores);
    $editor.classList.toggle("colores", colores); pintarResaltado();
  });
  const TAMANOS = [12, 13, 14, 16, 18];
  function aplicarLetra() { document.querySelector(".app").style.setProperty("--code-size", `${tamLetra}px`); guardado.escribir("letra", tamLetra); medirEditor(); }
  $("b-menos").addEventListener("click", () => { const i = TAMANOS.indexOf(tamLetra); tamLetra = TAMANOS[Math.max(0, (i < 0 ? 2 : i) - 1)]; aplicarLetra(); });
  $("b-mas").addEventListener("click", () => { const i = TAMANOS.indexOf(tamLetra); tamLetra = TAMANOS[Math.min(TAMANOS.length - 1, (i < 0 ? 2 : i) + 1)]; aplicarLetra(); });

  // Cómo se muestra cada console
  const DESTINOS = [["globo", "Globo"], ["pantalla", "Pantalla"], ["consola", "Solo consola"]];
  function pintarRuteo() {
    $("ruteo").innerHTML = NIVELES.map(n => `<code class="tk-fn">console.${n}</code><span class="seg" role="group" aria-label="console.${n}">${DESTINOS.map(([v, t]) => `<button type="button" data-nivel="${n}" data-dest="${v}" aria-pressed="${ruteo[n] === v}">${t}</button>`).join("")}</span>`).join("");
  }
  $("ruteo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dest]"); if (!b) return;
    ruteo[b.dataset.nivel] = b.dataset.dest; guardado.escribir("ruteo", ruteo); pintarRuteo();
  });

  // ---------- Registro y telemetría ----------
  function pintarEventosYa() {
    eventosSucios = false;
    $("eventos").innerHTML = mundo.eventos.slice(-250).map(e => ES_FACTORY ? { ...e, maquina: "R1", que: e.orden, clase: e.sensor ? "sensor" : e.resultado === "ok" ? "ok" : "warn" } : e).map(e =>
      `<tr><td>${e.t.toFixed(2)}</td><td>${esc(e.maquina)}</td><td>${e.linea}</td><td>${esc(e.que)}</td><td class="${e.clase}">${esc(e.resultado)}</td></tr>`).join("")
      || `<tr><td colspan="5" style="color:var(--muted)">Todavía no hay eventos en este intento.</td></tr>`;
  }
  function pintarResumen() {
    const delReto = telemetria.filter(t => t.reto === retoIdx + 1);
    const victorias = delReto.filter(t => t.resultado === "victoria");
    const primera = delReto.findIndex(t => t.resultado === "victoria");
    const rec = ES_FACTORY && records[claveReto()]?.regla !== "comun-v1" ? null : records[claveReto()];
    const vistas = ["3d", "2d"].map(v => delReto.filter(t => t.vista === v).length).join(" / ");
    const dobles = delReto.reduce((a, t) => a + ((t.inserciones && t.inserciones.dobleClic) || 0), 0);
    const datos = [["Intentos", delReto.length], ["Cumplidos", victorias.length], [ES_FACTORY ? "Récord tiempo (s)" : "Récord ₵/derribo", rec != null ? (ES_FACTORY ? rec.valor : rec).toFixed(1) : "—"], ["Intentos hasta cumplir", primera >= 0 ? primera + 1 : "—"], ["3D / plano", vistas], ["Inserciones con doble clic", dobles]];
    $("resumen").innerHTML = datos.map(([k, v]) => `<div class="dato"><span>${k}</span><b>${v}</b></div>`).join("");
    $("json").value = JSON.stringify(telemetria, null, 2);
  }
  $("b-copiar").addEventListener("click", () => {
    const txt = JSON.stringify(telemetria, null, 2);
    const ok = () => { $("copiado").hidden = false; setTimeout(() => $("copiado").hidden = true, 1600); };
    const planB = () => { const d = $("json").closest("details"); d.open = true; $("json").focus(); $("json").select(); };
    try { navigator.clipboard.writeText(txt).then(ok, planB); } catch { planB(); }
  });
  let confirmarBorrado = false;
  $("b-borrar").addEventListener("click", (ev) => {
    if (!confirmarBorrado) { confirmarBorrado = true; ev.target.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { confirmarBorrado = false; ev.target.textContent = "Borrar telemetría"; }, 3000); return; }
    confirmarBorrado = false; ev.target.textContent = "Borrar telemetría";
    telemetria = []; guardado.escribir(ES_FACTORY ? "factory-telemetria" : "telemetria", telemetria); intento = 0; pintarResumen(); pintarControles();
  });

  // ---------- Órdenes (ayuda) ----------
  function pintarAyuda() {
    if (ES_FACTORY) {
      $("v-ayuda").innerHTML = `<h3>Robot de carga</h3><p><code>await pickUp(lugar, material)</code> lleva a R1 hasta una bodega y carga una pieza. <code>await deliver(lugar)</code> la lleva al destino. <code>await wait(segundos)</code> deja pasar tiempo mientras las máquinas trabajan.</p><p><code>count(lugar, material)</code> consulta las existencias sin avanzar el reloj.</p><p>Se gana al cumplir las metas, aunque el programa siga en un bucle. Usa await en los encargos: el robot tarda en viajar y operar; durante esa espera las máquinas siguen trabajando. Las lecturas no avanzan el reloj: 0 significa edificio vacío y null, edificio inexistente. Una entrega llena devuelve «lleno» y conserva la carga. Los nombres españoles y yo. siguen aceptados.</p>`;
      return;
    }
    const f = (firma, texto, cls = "") => `<div class="firma ${cls}"><code>${firma}</code><p>${texto}</p></div>`;
    const k = (tipo, t, ins) => tk(tipo, t, ins ?? t);
    $("v-ayuda").innerHTML = `
      <h3>Cómo leer el inspector</h3>
      <ul>
        <li><b>Para tu código</b> (izquierda): el nombre de la máquina, lo que contiene y sus funciones. Es lo que más vas a escribir.</li>
        <li><b>Datos</b> (derecha): entradas, salidas, ritmo y propiedades que puedes leer para decidir, como <span class="tk-prop">failureRate</span>.</li>
        <li><b>Métricas</b> (abajo): cómo le fue a la máquina en este intento. No se usan en el código.</li>
        <li>Doble clic sobre cualquier palabra de color la inserta en el programa abierto. Las funciones llegan con huecos <span class="r">/* tipo de enemigo */</span> ya seleccionados: el siguiente doble clic en un valor los rellena.</li>
      </ul>
      <div class="leyenda-tk"><span class="tk-var">máquina</span><span class="tk-fn">función</span><span class="tk-prop">propiedad</span><span class="tk-num">número</span><span class="tk-str">texto</span></div>
      <h3>Editar sin teclado</h3>
      <ul>
        <li>El botón del teclado (junto a la letra en PC, al principio de la barra de edición en el teléfono) cambia a edición por bloques. Tachado y en rojo, el teclado del teléfono no se abre.</li>
        <li>Un toque elige un elemento entero: textos con sus comillas, comentarios completos, nombres y números. Una palabra clave o un signo eligen su construcción: el if, la llamada, la operación.</li>
        <li>Doble toque amplía hasta el siguiente límite: <span class="r">"oro"</span> → <span class="r">entregar("oro")</span> → <span class="r">yo.entregar("oro")</span> → el if que lo contiene.</li>
        <li>Arrastra un valor sobre un hueco, un argumento o dentro de ( ) o [ ]: se copia y el original se queda. Una línea completa se mueve; con Alt o Ctrl, se copia. Con el dedo, mantén pulsada la palabra antes de arrastrarla.</li>
        <li>Las líneas se agarran por su número o por el borde derecho; se elige en Ajustes.</li>
        <li>Al elegir un hueco <span class="r">/* … */</span> o un argumento aparecen los valores posibles de la máquina; en las condiciones, comprobaciones y operadores.</li>
        <li>Mantén pulsado un ladrillo con la esquina marcada para ver sus variantes: while, for, do … while y break; if, if / else y else if; operadores; let; los niveles de console.</li>
        <li>Seudocódigo (botón «Seudo»): el mismo programa como frases. Toca un valor para cambiarlo, toca un renglón para poner ahí el siguiente ladrillo y arrástralo para moverlo; soltado sobre la paleta se borra. Se guarda y ejecuta como JavaScript.</li>
      </ul>
      <h3>Funciones del lanzador</h3>
      <p class="leccion" style="margin:0">En el programa de un lanzador, lo suyo se escribe sin prefijo. Lo de otra máquina lleva su nombre: <span class="r">LAU_02.failureRate</span>. En pantalla los nombres llevan guion (LAU-01); en el código, guion bajo.</p>
      ${f(`${k("fn", "autoTarget")}(tipo, sensor) → posición | null`, `Mira con ese sensor, elige el enemigo de ese tipo más cercano a la base y calcula dónde estará cuando llegue tu próximo misil. Devuelve <span class="r">{x, y, z, id, tipo}</span> o <span class="r">null</span>. No gasta tiempo. Ignora a los que ya tienen misiles suficientes en el aire.`)}
      ${f(`${k("fn", "regularShoot")}(lugar) → "ok" | "sin_objetivo" | "sin_misiles" | "atascado"`, `Dispara 1 misil por segundo a ese lugar hasta que le des otra orden. Con <span class="r">null</span> deja de disparar y devuelve "sin_objetivo".`)}
      ${f(`${k("fn", "burstFire")}(lugar)`, `Igual, pero 2,2 misiles por segundo. Al entrar en ráfaga la probabilidad de fallo sube al 15 % y sigue subiendo 5 puntos por segundo. Fuera de ráfaga baja 6 puntos por segundo hasta el 2 %.`)}
      ${f(`${k("fn", "stopFire")}()`, `Deja de disparar.`)}
      <h3>Propiedades (solo lectura)</h3>
      ${f(`${k("prop", "failureRate")} · ${k("prop", "missiles")} · ${k("prop", "mode")} · ${k("prop", "jammed")} · ${k("prop", "fireRate")} · ${k("prop", "target")} · ${k("prop", "sensors")}`, `Probabilidad de que el próximo disparo falle (0 a 1) · misiles en el cargador · "idle", "regular" o "burst" · si está atascado · disparos por segundo · a dónde apunta · sensores montados.`, "prop")}
      <h3>Red de sensores</h3>
      ${f(`VIB_01.${k("fn", "detect")}(tipo) → posición | null · VIB_01.${k("prop", "count")}`, `El sensor de vibración oye a los enemigos de suelo en su radio, aunque haya niebla. Da dónde están ahora, sin predicción. No oye drones.`, "red")}
      <h3>Del programa</h3>
      ${f(`await ${k("fn", "esperar")}(segundos)`, `Deja pasar tiempo de juego. Mientras tu programa no espera, el reloj está quieto: cada vuelta de un bucle necesita una espera.`)}
      ${f(`console.log · info · warn · error`, `Mensajes de la máquina. En «Cómo se muestra cada console» eliges si salen como globo sobre la máquina, como aviso a pantalla con enlace a ella o solo en la consola.`)}
      <h3>Enemigos</h3>
      <div class="tabla-wrap"><table><thead><tr><th>Tipo</th><th>Vida</th><th>Velocidad</th><th>Altura</th><th>Lo ven</th></tr></thead><tbody>
        ${Object.entries(TIPOS).map(([t, d]) => `<tr><td>${k("str", `"${t}"`)} ${esc(d.nombre)}</td><td>${d.hp}</td><td>${d.vel} c/s</td><td>${d.z} m</td><td>cámara${d.frio ? "" : ", térmico"}${d.suelo ? ", vibración" : ""}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>Reglas</h3>
      <ul>
        <li>El misil vuela a ${MISIL.vel} casillas/s y estalla en el lugar pedido, a su altura: daña lo que esté a ${MISIL.radio} m o menos. Una explosión en el suelo no alcanza a un dron a 2,5 m.</li>
        <li>Cada lanzador recibe ${LAU.suministro} misil/s del depósito hasta llenar su cargador.</li>
        <li>Un fallo atasca el lanzador y pierde el misil. El robot reparador va hasta él y tarda ${REP.tBase} s más ${REP.tPorFallo} s por cada punto de failureRate que tenía al fallar: con 0,04 son ${(REP.tBase + REP.tPorFallo * .04).toFixed(1)} s; con 0,35, ${(REP.tBase + REP.tPorFallo * .35).toFixed(1)} s.</li>
        <li>failureRate es la probabilidad media de fallo por disparo. En promedio falla 1 de cada 1/failureRate disparos, sin rachas extremas.</li>
        <li>Alcance: cámara ${SENSOR.visual.alcance} (niebla ${SENSOR.visual.niebla}), térmico ${SENSOR.thermal.alcance} (niebla ${SENSOR.thermal.niebla}).</li>
        <li>Coste: ₵ ${COSTE.misil} por misil y ₵ ${COSTE.reparacion} por reparación. El número a bajar es el coste por derribo.</li>
        <li>La semilla decide los fallos. Con la misma semilla, el mismo programa da el mismo resultado.</li>
      </ul>
      <h3>Ejemplo</h3>
<pre>while (true) {
  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");
  if (failureRate >= 0.25) {
    console.warn(failureRate);
  }
  if (failureRate >= 0.35) {
    regularShoot(pos);
  } else {
    burstFire(pos);
  }
  await esperar(0.4);
}</pre>`;
  }

  // ---------- Escenario propio ----------
  const filaOla = (o, i, dis) => `<div class="ola" data-i="${i}">
      <label class="campo-f">Tipo<select data-k="tipo" ${dis}>${Object.keys(TIPOS).map(t => `<option value="${t}"${o.tipo === t ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo-f">Cuántos<input data-k="n" type="number" min="0" max="40" value="${o.n}" ${dis}></label>
      <label class="campo-f">Desde (s)<input data-k="t" type="number" min="0" step="0.5" value="${o.t}" ${dis}></label>
      <label class="campo-f">Cada (s)<input data-k="cada" type="number" min="0.1" step="0.05" value="${o.cada}" ${dis}></label>
      <label class="campo-f">Carriles (filas 0–17)<input data-k="carriles" value="${o.carriles.join(", ")}" ${dis}></label>
      <label class="campo-f">Vida<input data-k="hp" type="number" min="1" max="9" placeholder="${TIPOS[o.tipo].hp}" value="${o.hp ?? ""}" ${dis}></label>
      <button type="button" class="btn chico quitar" data-quitar="${i}" ${dis}>Quitar</button>
    </div>`;
  // `d` es el escenario que se muestra: el del reto o un borrador que todavía no se guardó.
  function pintarEscenario(d = def) {
    if (ES_FACTORY) return formularioFactory.pintar(d);
    const propioSel = retoIdx === IDX_PROPIO, dis = propioSel ? "" : "disabled";
    const me = d.metas, num = (v) => v == null ? "" : v;
    $("esc-aviso").hidden = propioSel;
    $("esc-aviso").innerHTML = propioSel ? "" : `Este reto es fijo. Puedes copiarlo a «Tu escenario» y cambiar lo que quieras, también el enunciado. <button type="button" class="btn chico" id="esc-copiar-reto">Usar como base de Tu escenario</button>`;
    $("esc-form").innerHTML = `
      <fieldset ${dis}><legend>Enunciado</legend>
        <label class="campo-f">Título<input id="esc-titulo" maxlength="60" value="${esc(d.titulo)}"></label>
        <label class="campo-f">Lo que pides (aparece arriba como objetivo)<textarea id="esc-objetivo">${esc(d.objetivo)}</textarea></label>
        <label class="campo-f">Pista cuando falle<input id="esc-pista" value="${esc(d.pista)}"></label>
      </fieldset>
      <fieldset ${dis}><legend>Metas: lo que tiene que salir</legend>
        <div class="dos">
          <label class="campo-f">Brechas máximas<input id="esc-brechas" type="number" min="0" value="${num(me.brechasMax)}"></label>
          <label class="campo-f">Atascos máximos (vacío = sin límite)<input id="esc-atascos" type="number" min="0" value="${num(me.atascosMax)}"></label>
          <label class="campo-f">Derribos mínimos (vacío = todos los que haga)<input id="esc-derribos" type="number" min="0" value="${num(me.derribosMin)}"></label>
          <label class="campo-f">Tiempo máximo en s (vacío = sin límite)<input id="esc-tiempo" type="number" min="1" value="${num(me.tiempoMax)}"></label>
        </div>
      </fieldset>
      <fieldset ${dis}><legend>Defensa</legend>
        <div class="dos">
          <label class="campo-f">Lanzadores<select id="esc-lanzadores"><option value="1"${d.lanzadores.length === 1 ? " selected" : ""}>1 · LAU-01</option><option value="2"${d.lanzadores.length === 2 ? " selected" : ""}>2 · LAU-01 y LAU-02</option></select></label>
          <label class="campo-f">Robots reparadores<input id="esc-rep" type="number" min="0" max="3" value="${d.reparadores}"></label>
          <label class="campo-f">Cargador (misiles)<input id="esc-cargador" type="number" min="1" max="40" value="${d.cargador}"></label>
          <label class="campo-f">Suministro (misiles/s)<input id="esc-suministro" type="number" min="0" max="5" step="0.1" value="${d.suministro}"></label>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" id="esc-vib"${d.sensores.length ? " checked" : ""}> Sensor de vibración VIB-01</label>
          <label class="check"><input type="checkbox" id="esc-niebla"${d.niebla ? " checked" : ""}> Niebla</label>
        </div>
      </fieldset>
      <fieldset ${dis}><legend>Oleadas (entran por la derecha)</legend>
        <div class="oleadas" id="esc-oleadas">${d.oleadas.map((o, i) => filaOla(o, i, dis)).join("")}</div>
        <div><button type="button" class="btn chico" id="esc-mas" ${dis}>+ Oleada</button></div>
      </fieldset>
      ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primario" id="esc-guardar">Guardar y jugar</button>
        <button type="button" class="btn" id="esc-json-copiar">Copiar JSON</button>
      </div>
      <details class="caja"><summary>Pegar un escenario en JSON</summary><div class="dentro">
        <textarea class="json" id="esc-json" aria-label="Escenario en JSON" placeholder='{"titulo": "…", "oleadas": […]}'></textarea>
        <div><button type="button" class="btn chico" id="esc-json-aplicar">Aplicar</button> <span class="fila-bajo" id="esc-json-msg"></span></div>
      </div></details>` : ""}`;
  }
  function leerEscenario() {
    const v = (id) => $(id).value.trim();
    const n = (id) => v(id) === "" ? null : Number(v(id));
    const oleadas = [...document.querySelectorAll("#esc-oleadas .ola")].map(f => {
      const g = (k) => f.querySelector(`[data-k="${k}"]`).value;
      return { tipo: g("tipo"), n: Number(g("n")), t: Number(g("t")), cada: Number(g("cada")), carriles: g("carriles").split(/[,\s]+/).filter(Boolean).map(Number), ...(g("hp") ? { hp: Number(g("hp")) } : {}) };
    });
    return normalizar({
      titulo: v("esc-titulo") || "Tu escenario", objetivo: v("esc-objetivo"), pista: v("esc-pista"), leccion: "Escenario propio · se edita en la pestaña Escenario.",
      metas: { brechasMax: n("esc-brechas") ?? 0, atascosMax: n("esc-atascos"), derribosMin: n("esc-derribos"), tiempoMax: n("esc-tiempo") },
      lanzadores: POS_LANZADORES[v("esc-lanzadores")] || POS_LANZADORES[1],
      reparadores: n("esc-rep"), cargador: n("esc-cargador"), suministro: n("esc-suministro"), niebla: $("esc-niebla").checked,
      sensores: $("esc-vib").checked ? [{ id: "VIB-01", x: 17, y: 9, alcance: 8 }] : [],
      oleadas, inicial: propio.inicial,
    });
  }
  function guardarPropio(nuevo, jugar) {
    propio = nuevo; guardado.escribir(ES_FACTORY ? "factory-propio" : "propio", propio);
    if (jugar || retoIdx === IDX_PROPIO) { elegirReto(IDX_PROPIO); abrirPestana("escenario"); }
    pintarRetos();
  }
  $("v-escenario").addEventListener("click", (ev) => {
    if (ES_FACTORY) return;
    const id = ev.target.id;
    if (ev.target.dataset.quitar != null) { const d = leerEscenario(); d.oleadas.splice(+ev.target.dataset.quitar, 1); pintarEscenario(d); return; }
    if (id === "esc-mas") { const d = leerEscenario(); d.oleadas.push({ tipo: "drone", n: 4, t: 0, cada: 1, carriles: [9] }); pintarEscenario(d); return; }
    if (id === "esc-guardar") { guardarPropio(leerEscenario(), true); abrirPestana("programa"); return; }
    if (id === "esc-copiar-reto") {
      guardado.escribir("prog-propio", programas);
      guardarPropio(normalizar({ ...def, titulo: `${def.titulo} (mío)`, leccion: "Escenario propio · se edita en la pestaña Escenario." }), true);
      return;
    }
    if (id === "esc-json-copiar") {
      const txt = JSON.stringify(leerEscenario(), null, 2);
      try { navigator.clipboard.writeText(txt).then(() => { ev.target.textContent = "Copiado"; setTimeout(() => ev.target.textContent = "Copiar JSON", 1500); }, () => { $("esc-json").value = txt; $("esc-json").closest("details").open = true; $("esc-json").select(); }); }
      catch { $("esc-json").value = txt; }
      return;
    }
    if (id === "esc-json-aplicar") {
      try { guardarPropio(normalizar(JSON.parse($("esc-json").value)), true); }
      catch (e) { $("esc-json-msg").textContent = `No es un JSON válido: ${e.message}`; }
    }
  });

  // ---------- Bucle de juego ----------
  let ultimo = performance.now(), ultVivos = 0;
  function bucle(now) {
    const real = Math.min(0.25, (now - ultimo) / 1000);
    ultimo = now;
    if (mundo.activo && !mundo.fin && !pausa) { if (!algunoCorre()) acum += real * velocidad * turbo; avanzar(); }
    else if (!mundo.activo) acum = 0;
    vigia(now);
    const off = mundo.activo && !pausa && !algunoCorre() ? Math.min(acum, DT) : 0;
    if (vista === "3d" && V3) { V3.actualizar(off, now); V3.render(); } else dibujar2D(off);
    pintarCapa(off, now);
    caducarAvisos(now);
    pintarHud();
    if (now - ultVivos > 200) { ultVivos = now; actualizarVivos(); }
    if (marcasSucias) pintarMarcasYa();
    if (eventosSucios) pintarEventosYa();
    editorPrograma.iniciarVistas();
  requestAnimationFrame(bucle);
  }

  const proveedorEditor = window.CMGProveedor.crear({
    serie: ES_FACTORY ? "factory" : "war",
    sensores: () => mundo ? mundo.sensores.map(s => varDe(s.id)) : [],
    objetos: () => ["yo", ...(mundo ? (ES_FACTORY ? mundo.entidades : mundo.maquinas).map(e => varDe(e.id)) : [])],
    propiedades: () => [...PROPS],
  });

  // ---------- Arranque ----------
  leerColores();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { leerColores(); });
  new MutationObserver(() => leerColores()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.__banco = {
    get mundo() { return mundo; }, get def() { return def; }, get programas() { return programas; }, get fuentes() { return fuentes; }, RETOS, instrumentar, lexico, normalizar,
    turbo(n) { turbo = n; }, fijarSemilla(n) { semillaFija = true; semilla = n; }, usarEscenario(d) { guardarPropio(ES_FACTORY ? window.FACTORY_RETOS.normalizar(d) : normalizar(d), true); }, elegirReto, ejecutar, abrirPrograma, seleccionar, get seleccionadas() { return [...seleccionadas]; }, get telemetria() { return telemetria; },
  }; // para depurar y probar desde la consola
  window.cmg = { editor: editorPrograma, get edicion() { return editorPrograma.fachada.edicion; }, get seudo() { return editorPrograma.fachada.seudo; }, serie: ES_FACTORY ? "factory" : "war", insertar, envolver, alternarComentario, medirEditor, get codigo() { return $codigo; }, get ejecutando() { return !!ejec; }, get confirmarReplace() { return confirmarReplace; }, set confirmarReplace(v) { preferirConfirmacionReplace(v); },
    // Para edicion.js (modo sin teclado, barra de edición y sugerencias).
    lexico, clasificar, sugerencias, firma: (f) => FIRMAS[f] || null, reHueco: RE_HUECO, aviso: avisoEditor, alDesplazar: pintarBanda, alternarEjecucion: () => ejec ? detener() : ejecutar(),
    // Funciones disponibles para el menú de alternativas (clic derecho o mantener 2 s sin teclado).
    // Estado de la cámara 3D (clave de la postura, giro, inclinación, distancia y centro); lo usan las pruebas.
    camara: () => V3 && V3.camara(),
    // Retrato PNG (data URL) del modelo actual de un tipo de enemigo; sirve para regenerar img/enemigos/.
    retrato: (tipo) => V3 && TIPOS[tipo] ? V3.retrato(tipo) : null,
    proveedor: proveedorEditor,
    funciones: proveedorEditor.funciones,
    get claveDocumento() { return claveDocumento(); },
    // Para seudo.js: datos de la máquina, programa de partida y línea que se ejecuta.
    datos: () => ({
      lugares: ES_FACTORY ? mundo.entidades.map(e => ({ id: e.id, expresion: varFactory(e.id), tipo: e.tipo })) : [],
      materiales: window.FACTORY.MATERIALES, ladrillos: def.ladrillos,
      tipos: Object.entries(TIPOS).map(([id, t]) => ({ id, nombre: t.nombre, enReto: def.oleadas.some(o => o.tipo === id) })),
      sensores: Object.entries(SENSOR).map(([id, x]) => ({ id, nombre: x.nombre, alcance: def.niebla ? x.niebla : x.alcance })),
      red: mundo ? mundo.sensores.map(x => varDe(x.id)) : [],
      otras: programablesDe(def).map(l => l.id).filter(id => !edicion.ids.includes(id)).map(varDe),
    }),
    inicial: () => edicion.mixto ? null : { texto: textoInicial(def, progSel), codigo: (def.inicial[progSel] || []).join("\n") + ((def.inicial[progSel] || []).length ? "\n" : "") },
    get marcas() { return { corre: (!edicion.mixto && lineaCorre[progSel]) || null, err: !edicion.mixto && lineaErr && lineaErr.id === progSel ? lineaErr.linea : null }; } };
  if (ES_FACTORY) {
    document.title = "Code Battle Lite · Factory";
    document.documentElement.dataset.serie = "factory";
    document.querySelector(".fila-sem").hidden = true;
    document.querySelector(".coordenadas-manuales").hidden = true;
    $("t-escenario").textContent = "Tu reto";
    document.querySelectorAll('[data-modo-codigo="bloques"]').forEach(b => b.hidden = false);
    $("info-t-enemigos").hidden = true;
    // Por id y no por href: Netlify (Pretty URLs) reescribe «probar.html» como «probar» y el selector fallaba,
    // cortando el arranque de Factory (pantalla negra, sin inspector ni Ejecutar).
    const probar = $("b-probar"); if (probar) { const u = new URL(probar.href, location.href); u.searchParams.set("serie", "factory"); probar.href = u.pathname + u.search; }
    $("c2d").setAttribute("aria-label", "Plano de la fábrica");
    $("progs").setAttribute("aria-label", "Programas de las máquinas");
  }
  for (const enlace of document.querySelectorAll("[data-serie]")) {
    const url = new URL(location.href); url.searchParams.set("serie", enlace.dataset.serie);
    enlace.href = url.pathname + url.search + url.hash;
    enlace.setAttribute("aria-current", enlace.dataset.serie === (ES_FACTORY ? "factory" : "war") ? "page" : "false");
  }
  const formularioFactory = ES_FACTORY ? window.FACTORY_FORM.crear({
    retoActual: () => def, propioSel: () => retoIdx === IDX_PROPIO,
    guardar: d => guardarPropio(d, true), abrirPestana,
    copiarPrograma: () => guardado.escribir("prog-factory-propio", { ...programas }),
  }) : null;
  pintarRuteo();
  pintarAyuda();
  def = defActual();
  aplicarVista(vista);
  aplicarLetra();
  elegirReto(retoIdx);
  document.fonts && document.fonts.ready.then(() => { medirEditor(); });
  editorPrograma.iniciarVistas();
  requestAnimationFrame(bucle);
})();


