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
function __L(linea) {
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
  for (const k of (ES_ROBOT ? ["recoger", "entregar", "esperar", "cuantos", "pickUp", "deliver", "wait", "count", "log", "console"] : ["autoTarget", "regularShoot", "burstFire", "stopFire", "esperar", "log", "console"])) self[k] = base[k];
  Object.defineProperty(self, "yo", { configurable: true, get: () => maquina(PROPIA, null) });
  for (const id of NOMBRES) Object.defineProperty(self, nombreVar(id), { configurable: true, get: () => maquina(id, null) });
  if (!ES_ROBOT) for (const p of PROPS_LAU) Object.defineProperty(self, p, { configurable: true, get: () => copia(SNAP.maq[PROPIA][p]) });
}
onmessage = async (ev) => {
  const m = ev.data;
  if (m.type === "despierta") {
    SNAP = m.snap;
    const e = espera;
    if (e && e.id === m.id) { espera = null; e.resolve(m.resultado === undefined ? "ok" : m.resultado); }
    return;
  }
  if (m.type !== "run") return;
  ES_ROBOT = m.serie === "factory"; LENGUAJE = m.lenguaje === "python" ? "python" : "js";
  SNAP = m.snap; PROPIA = m.propia; NOMBRES = m.nombres.filter(id => (!ES_ROBOT || !(nombreVar(id) in self)) && /^[A-Za-z_$][\\w$]*$/.test(nombreVar(id)) && m.nombres.filter(n => nombreVar(n) === nombreVar(id)).length === 1 && !["yo", "console", "log", "pickUp", "deliver", "wait", "count", "recoger", "entregar", "esperar", "cuantos"].includes(nombreVar(id))); TIPOS = m.tipos; SENSORES = m.sensores; CONF = m.conf;
  if (OFF === null) {
    try { await new AF("\\nthrow new Error('x')")(); } catch (e) { const n = lineaDe(e); OFF = n == null ? NaN : n - 2; }
  }
  instalarGlobales();
  let fn;
  try { fn = new AF("__L", m.codigo); }
  catch (e) { postMessage({ type: "error", mensaje: "Error de sintaxis: " + e.message, linea: null }); return; }
  try { await fn(__L); postMessage({ type: "done" }); }
  catch (e) {
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
  window.RUNTIME = { url: WORKER_URL, algunoCorre, despertar };
})();
