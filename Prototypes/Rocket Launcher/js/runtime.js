/* Runtime común: Web Worker por máquina, instantáneas y esperas/encargos. */
(() => {
  "use strict";
  const WORKER_SRC = `
const AF = Object.getPrototypeOf(async function () {}).constructor;
let SNAP = null, PROPIA = null, NOMBRES = [], TIPOS = [], SENSORES = [], CONF = {}, OFF = null, seq = 0, espera = null;
let ES_ROBOT = false;
const MATERIALES = ["cobre", "silicio"];
const validarFactory = ${window.FACTORY.validar.toString()};
// Auxiliares de Python (E5): el traductor genera JS que llama a __py con las mismas líneas del programa.
const __py = (${window.CMGPythonJS ? window.CMGPythonJS.preludio.toString() : "() => null"})();
let LENGUAJE = "js";
// Campaign: muchas unidades con encargos, modos y lecturas. La validación y el resultado de los modos
// son las mismas funciones puras del mundo (campaign.js), para que el programa y la planta coincidan.
let ES_CAMPAIGN = false, acabado = false;
const validarCampaign = ${window.CAMPAIGN ? window.CAMPAIGN.validar.toString() : "() => null"};
const modoCampaign = ${window.CAMPAIGN ? window.CAMPAIGN.modoEnSnap.toString() : "() => 'ok'"};
const pend = new Map();  // encargos y esperas que el programa tiene en marcha: id → { resolve, linea, texto, unidad }
const ORDENES_C = { pickUp: "encargo", deliver: "encargo", goTo: "encargo", start: "modo", stop: "modo", light: "modo", setRecipe: "modo", request: "modo" };
const DE_C = { robot: ["pickUp", "deliver", "goTo"], carretilla: ["pickUp", "deliver", "goTo"], maquina: ["start", "stop", "light", "setRecipe"], banda: ["start", "stop"], bahia: ["request"] };
const PROPS_C = { robot: ["cargo", "busy"], carretilla: ["cargo", "busy"], maquina: ["input", "output", "outputFull", "state", "recipe", "made", "running"],
  lugar: ["pallet", "items", "free"], bahia: ["pallet", "items", "free", "pending"], pad: ["free", "machine"], pila: [], banda: ["items", "running", "state"],
  arsenal: ["missiles", "received"], torreta: ["missiles"], control: ["power", "budget", "milestone"] };
const ALIAS_C = { recoger: "pickUp", entregar: "deliver", irA: "goTo" };
const idDe = (a) => a && typeof a === "object" && typeof a.id === "string" ? a.id : a;
function ordenC(linea, unidad, verbo, args) {
  args = args.map(idDe);
  const C = SNAP.campaign, error = validarCampaign(C, PROPIA, unidad, verbo, args);
  if (error) throw fallo(linea, error);
  const texto = (unidad === PROPIA ? "" : nombreVar(unidad) + ".") + verbo + "(" + args.map(a => a === undefined ? "" : typeof a === "string" && C.u[a] ? nombreVar(a) : JSON.stringify(a)).join(", ") + ")";
  if (ORDENES_C[verbo] === "modo") {
    const res = modoCampaign(C, unidad, verbo, args);
    postMessage({ type: "modo", linea, unidad, verbo, args, texto, res });
    return res;
  }
  for (const p of pend.values()) if (p.unidad === unidad) throw fallo(p.linea, "Falta await en la línea " + p.linea + ": " + unidad + " seguía con " + p.texto + " cuando llegó la orden de la línea " + linea + ".");
  const id = ++seq;
  postMessage({ type: "encargo", id, linea, unidad, verbo, args, texto });
  return new Promise(resolve => pend.set(id, { resolve, linea, texto, unidad }));
}
function esperaC(linea, s) {
  if (typeof s !== "number" || !(s >= 0.05) || s > 60) throw fallo(linea, "wait necesita segundos entre 0.05 y 60, por ejemplo await wait(0.5). Recibió " + q(s) + ".");
  for (const p of pend.values()) if (p.unidad === null) throw fallo(p.linea, "Falta await en la línea " + p.linea + ": el programa seguía esperando cuando llegó otra espera en la línea " + linea + ".");
  const id = ++seq;
  postMessage({ type: "espera", id, linea, s });
  return new Promise(resolve => pend.set(id, { resolve, linea, texto: "wait(" + s + ")", unidad: null }));
}
function contarC(linea, lugar, pieza) {
  lugar = idDe(lugar);
  const C = SNAP.campaign, error = validarCampaign(C, PROPIA, PROPIA, "count", [lugar, pieza]);
  if (error) throw fallo(linea, error);
  const d = C.u[lugar], n = (a) => a.filter(x => x === pieza).length;
  // null: ese lugar no existe; 0: existe y no tiene esa pieza.
  const valor = !d ? null : d.k === "lugar" || d.k === "bahia" ? n(d.tiene) : d.k === "maquina" ? n(d.sale) + (d.tiene[pieza] || 0)
    : d.k === "banda" ? (pieza === "missile" ? d.items : 0) : d.k === "arsenal" || d.k === "torreta" ? (pieza === "missile" ? d.missiles : 0)
    : d.k === "robot" ? (d.cargo === pieza ? 1 : 0) : 0;
  postMessage({ type: "lectura", linea, texto: "count(" + nombreVar(String(lugar)) + ", " + q(pieza) + ")", valor });
  return valor;
}
function unidadC(id, linea) {
  const d = SNAP.campaign.u[id], k = d ? d.k : "pila", o = {};
  for (const verbo of Object.keys(ORDENES_C)) o[verbo] = (...a) => ordenC(linea, id, verbo, a);
  for (const [alias, verbo] of Object.entries(ALIAS_C)) o[alias] = o[verbo];
  for (const p of PROPS_C[k] || []) Object.defineProperty(o, p, { enumerable: true, get: () => copia(SNAP.campaign.u[id][p]) });
  Object.defineProperty(o, "id", { enumerable: true, value: id });
  return new Proxy(o, { get(t, p) {
    if (typeof p === "symbol" || p in t || p === "then" || p === "toJSON") return t[p];
    throw fallo(linea, nombreVar(id) + "." + String(p) + " no existe. " + nombreVar(id) + " tiene: " + [...(DE_C[k] || []), ...(PROPS_C[k] || [])].join(", ") + ".");
  } });
}
// Tras despertar, el programa corre hasta su siguiente await. Si sigue esperando encargos que ya había dado
// (por ejemplo dentro de un Promise.all), avisa de que cede el turno para que el reloj pueda avanzar.
function cederLuego() { setTimeout(() => { if (pend.size && !acabado) postMessage({ type: "cede" }); }, 0); }
function robotAPI(linea) {
  const api = {};
  for (const verbo of ["recoger", "entregar", "esperar", "cuantos"]) api[verbo] = (...args) => {
    if (args[0] && typeof args[0] === "object" && typeof args[0].id === "string") args[0] = args[0].id;
    const texto = verbo + "(" + args.map(a => a === undefined ? "" : JSON.stringify(a)).join(", ") + ")";
    if (espera) throw fallo(espera.linea, "Falta await en la línea " + espera.linea + ": R1 seguía con " + espera.texto + " cuando llegó la orden de la línea " + linea + ".");
    const error = validarFactory(SNAP.factory, verbo, args);
    if (error) throw fallo(linea, error);
    if (verbo === "cuantos") {
      const e = SNAP.factory.porId[args[0]], valor = !e ? null : e.tipo === "bodega" ? e.stock[args[1]] || 0 : e.acepta === args[1] ? e.entrada : 0;
      postMessage({ type: "lecturaFactory", linea, texto, valor });
      return valor;
    }
    const id = ++seq;
    postMessage({ type: "encargo", id, linea, verbo, args, texto });
    return new Promise(resolve => { espera = { id, linea, texto, resolve }; });
  };
  for (const [nombre, original] of Object.entries({ pickUp: "recoger", deliver: "entregar", wait: "esperar", count: "cuantos" })) api[nombre] = api[original];
  return new Proxy(api, { get(t, p) {
    if (typeof p === "symbol" || p === "then") return undefined;
    if (p in t) return t[p];
    throw fallo(linea, "yo." + String(p) + " no existe. Las órdenes son yo.recoger, yo.entregar, yo.esperar y yo.cuantos.");
  } });
}
const PROPS_LAU = ["failureRate", "missiles", "mode", "jammed", "fireRate", "sensors", "target"];
const nombreVar = (id) => id.replace(/-/g, "_");
function lineaDe(e) {
  const s = String((e && e.stack) || "");
  const m = s.match(/<anonymous>:(\\d+):\\d+/) || s.match(/> Function:(\\d+):\\d+/) || s.match(/(?:eval code|anonymous)[^\\n]*?:(\\d+):\\d+/);
  return m ? +m[1] : null;
}
const redondo = (x) => typeof x === "number" ? Math.round(x * 1000) / 1000 : x;
function fmt(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(redondo(v));
  if (v === undefined) return "undefined";
  try { return JSON.stringify(v, (k, x) => redondo(x)); } catch (_) { return String(v); }
}
const q = (v) => typeof v === "string" ? JSON.stringify(v) : fmt(v);
const copia = (v) => v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
function fallo(linea, msg) { const e = new Error(msg); e.__linea = linea; return e; }
const lista = (a) => a.map(x => '"' + x + '"').join(", ");
function apuntarAPI(linea, id, tipo, sensor) {
  if (!TIPOS.includes(tipo)) throw fallo(linea, "autoTarget necesita el tipo de enemigo como primer argumento: " + lista(TIPOS) + ". Recibió " + q(tipo) + ".");
  if (sensor === "vibration" || sensor === "vibracion") {
    const vib = NOMBRES.find(n => n.startsWith("VIB"));
    throw fallo(linea, "El sensor de vibración no va montado en el lanzador: es de la red de sensores. " + (vib ? "Usa " + nombreVar(vib) + '.detect("crawler").' : "En este mapa no hay ninguno."));
  }
  if (!SENSORES.includes(sensor)) throw fallo(linea, "autoTarget necesita el sensor como segundo argumento: " + lista(SENSORES) + ". Recibió " + q(sensor) + ".");
  const v = SNAP.auto[id][sensor][tipo];
  postMessage({ type: "lee", linea, maquina: id, que: (id === PROPIA ? "" : nombreVar(id) + ".") + "autoTarget(" + q(tipo) + ", " + q(sensor) + ")", valor: v, fn: "autoTarget" });
  return copia(v);
}
function detectarAPI(linea, id, tipo) {
  if (tipo !== undefined && !TIPOS.includes(tipo)) throw fallo(linea, nombreVar(id) + ".detect acepta un tipo de enemigo (" + lista(TIPOS) + ") o nada. Recibió " + q(tipo) + ".");
  const v = SNAP.vib[id][tipo || "*"];
  postMessage({ type: "lee", linea, maquina: id, que: nombreVar(id) + ".detect(" + (tipo === undefined ? "" : q(tipo)) + ")", valor: v, fn: "detect" });
  return copia(v);
}
function lugarDe(linea, fn, lugar) {
  if (lugar == null) return null;
  if (typeof lugar !== "object" || !Number.isFinite(+lugar.x) || !Number.isFinite(+lugar.y))
    throw fallo(linea, fn + " necesita un lugar con x e y, como el que devuelve autoTarget(). Recibió " + q(lugar) + ".");
  return { x: +lugar.x, y: +lugar.y, z: Number.isFinite(+lugar.z) ? +lugar.z : 0, id: typeof lugar.id === "string" ? lugar.id : null };
}
function orden(linea, id, verbo, args) {
  if (id !== PROPIA) throw fallo(linea, "Las órdenes de " + id + " van en su propio programa. Desde aquí puedes leer " + nombreVar(id) + ".failureRate, " + nombreVar(id) + ".jammed…");
  const d = SNAP.maq[id];
  let res = "ok", lugar = null;
  if (verbo === "stopFire") { d.mode = "idle"; d.target = null; d.fireRate = 0; }
  else {
    lugar = lugarDe(linea, verbo, args[0]);
    if (!lugar) { d.mode = "idle"; d.target = null; d.fireRate = 0; res = "sin_objetivo"; }
    else {
      const modo = verbo === "burstFire" ? "burst" : "regular";
      if (modo === "burst" && d.mode !== "burst") d.failureRate = Math.max(d.failureRate, CONF.fallaRafaga);
      d.mode = modo; d.target = lugar; d.fireRate = modo === "burst" ? CONF.cadenciaRafaga : CONF.cadencia;
      res = d.jammed ? "atascado" : d.missiles < 1 ? "sin_misiles" : "ok";
    }
  }
  postMessage({ type: "cmd", linea, verbo, lugar, res });
  return res;
}
function esperarAPI(linea, s) {
  if (typeof s !== "number" || !(s >= 0.05) || s > 30) throw fallo(linea, "esperar necesita segundos entre 0.05 y 30, por ejemplo await esperar(0.5). Recibió " + q(s) + ".");
  if (espera) throw fallo(linea, "Falta await en la línea " + espera.linea + ": el programa seguía esperando cuando llegó otra espera en la línea " + linea + ".");
  const id = ++seq;
  postMessage({ type: "espera", id, linea, s });
  return new Promise((resolve) => { espera = { id, resolve, linea }; });
}
function consola(linea, nivel, a) { postMessage({ type: "consola", linea, nivel, texto: a.map(fmt).join(" ") }); }
function maquina(id, linea) {
  if (ES_CAMPAIGN) return unidadC(id, linea);
  if (ES_ROBOT && id === PROPIA) return robotAPI(linea);
  const o = {};
  if (id.startsWith("LAU")) {
    o.autoTarget = (t, s) => apuntarAPI(linea, id, t, s);
    o.regularShoot = (...a) => orden(linea, id, "regularShoot", a);
    o.burstFire = (...a) => orden(linea, id, "burstFire", a);
    o.stopFire = (...a) => orden(linea, id, "stopFire", a);
    for (const p of PROPS_LAU) Object.defineProperty(o, p, { enumerable: true, get: () => copia(SNAP.maq[id][p]) });
  } else if (id.startsWith("VIB")) {
    o.detect = (t) => detectarAPI(linea, id, t);
    Object.defineProperty(o, "count", { enumerable: true, get: () => SNAP.maq[id].count });
  }
  Object.defineProperty(o, "id", { enumerable: true, value: id });
  return new Proxy(o, { get(t, p) {
    if (typeof p === "symbol" || p in t || p === "then" || p === "toJSON") return t[p];
    throw fallo(linea, nombreVar(id) + "." + String(p) + " no existe. " + nombreVar(id) + " tiene: " + Object.keys(t).join(", ") + ".");
  } });
}
function LCampaign(linea) {
  const o = {
    wait: (s) => esperaC(linea, s), esperar: (s) => esperaC(linea, s),
    count: (l, p) => contarC(linea, l, p), cuantos: (l, p) => contarC(linea, l, p),
    log: (...a) => consola(linea, "log", a),
    console: { log: (...a) => consola(linea, "log", a), info: (...a) => consola(linea, "info", a), warn: (...a) => consola(linea, "warn", a), error: (...a) => consola(linea, "error", a) },
  };
  for (const verbo of Object.keys(ORDENES_C)) o[verbo] = (...a) => ordenC(linea, PROPIA, verbo, a);
  for (const [alias, verbo] of Object.entries(ALIAS_C)) o[alias] = o[verbo];
  Object.defineProperty(o, "yo", { get: () => unidadC(PROPIA, linea) });
  for (const id of NOMBRES) Object.defineProperty(o, nombreVar(id), { get: () => unidadC(id, linea) });
  return o;
}
const GLOBALES_C = ["wait", "esperar", "count", "cuantos", "log", "console", ...Object.keys(ORDENES_C), ...Object.keys(ALIAS_C)];
function __L(linea) {
  if (ES_CAMPAIGN) return LCampaign(linea);
  const o = {
    autoTarget: (t, s) => apuntarAPI(linea, PROPIA, t, s),
    regularShoot: (...a) => orden(linea, PROPIA, "regularShoot", a),
    burstFire: (...a) => orden(linea, PROPIA, "burstFire", a),
    stopFire: (...a) => orden(linea, PROPIA, "stopFire", a),
    esperar: (s) => esperarAPI(linea, s),
    log: (...a) => consola(linea, "log", a),
    console: { log: (...a) => consola(linea, "log", a), info: (...a) => consola(linea, "info", a), warn: (...a) => consola(linea, "warn", a), error: (...a) => consola(linea, "error", a) },
  };
  if (ES_ROBOT) for (const k of ["recoger", "entregar", "esperar", "cuantos", "pickUp", "deliver", "wait", "count"]) o[k] = robotAPI(linea)[k];
  Object.defineProperty(o, "yo", { get: () => maquina(PROPIA, linea) });
  for (const id of NOMBRES) Object.defineProperty(o, nombreVar(id), { get: () => maquina(id, linea) });
  return o;
}
// Sin instrumentar (dentro de plantillas de texto, por ejemplo) también funcionan, solo que sin línea.
function instalarGlobales() {
  const base = __L(null);
  if (ES_CAMPAIGN) {
    for (const k of GLOBALES_C) self[k] = base[k];
    Object.defineProperty(self, "yo", { configurable: true, get: () => unidadC(PROPIA, null) });
    for (const id of NOMBRES) Object.defineProperty(self, nombreVar(id), { configurable: true, get: () => unidadC(id, null) });
    // Lo propio se escribe sin prefijo: outputFull, cargo, power…
    const k = (SNAP.campaign.u[PROPIA] || {}).k;
    for (const p of PROPS_C[k] || []) Object.defineProperty(self, p, { configurable: true, get: () => copia(SNAP.campaign.u[PROPIA][p]) });
    return;
  }
  for (const k of (ES_ROBOT ? ["recoger", "entregar", "esperar", "cuantos", "pickUp", "deliver", "wait", "count", "log", "console"] : ["autoTarget", "regularShoot", "burstFire", "stopFire", "esperar", "log", "console"])) self[k] = base[k];
  Object.defineProperty(self, "yo", { configurable: true, get: () => maquina(PROPIA, null) });
  for (const id of NOMBRES) Object.defineProperty(self, nombreVar(id), { configurable: true, get: () => maquina(id, null) });
  if (!ES_ROBOT) for (const p of PROPS_LAU) Object.defineProperty(self, p, { configurable: true, get: () => copia(SNAP.maq[PROPIA][p]) });
}
onmessage = async (ev) => {
  const m = ev.data;
  if (m.type === "despierta") {
    SNAP = m.snap;
    if (ES_CAMPAIGN) {
      const p = pend.get(m.id);
      if (p) { pend.delete(m.id); p.resolve(m.resultado === undefined ? "ok" : m.resultado); }
      cederLuego();
      return;
    }
    const e = espera;
    if (e && e.id === m.id) { espera = null; e.resolve(m.resultado === undefined ? "ok" : m.resultado); }
    return;
  }
  if (m.type !== "run") return;
  ES_ROBOT = m.serie === "factory"; ES_CAMPAIGN = m.serie === "campaign"; LENGUAJE = m.lenguaje === "python" ? "python" : "js";
  SNAP = m.snap; PROPIA = m.propia; NOMBRES = m.nombres.filter(id => (!(ES_ROBOT || ES_CAMPAIGN) || !(nombreVar(id) in self)) && /^[A-Za-z_$][\\w$]*$/.test(nombreVar(id)) && m.nombres.filter(n => nombreVar(n) === nombreVar(id)).length === 1 && !["yo", "console", "log", "pickUp", "deliver", "wait", "count", "recoger", "entregar", "esperar", "cuantos"].includes(nombreVar(id))); TIPOS = m.tipos; SENSORES = m.sensores; CONF = m.conf;
  if (OFF === null) {
    try { await new AF("\\nthrow new Error('x')")(); } catch (e) { const n = lineaDe(e); OFF = n == null ? NaN : n - 2; }
  }
  instalarGlobales();
  let fn;
  try { fn = new AF("__L", m.codigo); }
  catch (e) { postMessage({ type: "error", mensaje: "Error de sintaxis: " + e.message, linea: null }); return; }
  try { await fn(__L); acabado = true; postMessage({ type: "done" }); }
  catch (e) {
    acabado = true;
    let linea = e && e.__linea;
    if (linea == null) { const n = lineaDe(e); if (n != null && !isNaN(OFF)) linea = n - OFF; }
    const msg = String(LENGUAJE === "python" && __py ? __py.mensaje(e) : (e && e.message) || e).replace(/__L\\((?:\\d+|null)\\)\\./g, "");
    postMessage({ type: "error", mensaje: msg, linea: linea == null ? null : linea });
  }
};
`;
  const WORKER_URL = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));


  const algunoCorre = ejec => !!ejec && [...ejec.progs.values()].some(p => p.estado === "corre");
  function despertar(ejec, mundo, instantanea) {
    if (!ejec) return false;
    const listos = [...ejec.progs.values()].filter(p => p.estado === "espera" && p.despertar <= mundo.t + 1e-9);
    if (!listos.length) return false;
    const snap = instantanea();
    for (const p of listos) { p.estado = "corre"; p.desde = performance.now(); p.mensajes = 0; p.worker.postMessage({ type: "despierta", id: p.espera, snap }); }
    return true;
  }
  // Campaign: cada programa puede tener varias esperas y encargos a la vez (p.pend).
  function despertarCampaign(ejec, mundo, instantanea) {
    if (!ejec) return false;
    let snap = null, alguno = false;
    for (const p of ejec.progs.values()) for (const [id, e] of p.pend) {
      if (e.tipo !== "espera" || e.despertar > mundo.t + 1e-9) continue;
      p.pend.delete(id); snap ||= instantanea();
      p.estado = "corre"; p.desde = performance.now(); p.mensajes = 0; alguno = true;
      p.worker.postMessage({ type: "despierta", id, snap });
    }
    return alguno;
  }
  window.RUNTIME = { url: WORKER_URL, algunoCorre, despertar, despertarCampaign };
})();
