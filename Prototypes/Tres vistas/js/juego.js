/* Code Battle Lite · Tres vistas. Reglas y formatos del banco 02. */
(() => {
  "use strict";

  // ---------- Constantes del mundo ----------
  const COLS = 9, ROWS = 7;
  const VEL = 4;          // casillas por segundo
  const OP = 0.5;         // segundos por recoger/entregar
  const DT = 0.05;        // paso fijo de simulación (tiempo de juego)
  const VIGIA_MS = 2500;  // bucle sin await
  const MAX_SENSORES = 500;  // consultas seguidas sin que R1 haga nada
  const T_LIMITE = 300;   // tiempo de juego máximo de un intento
  const MATERIALES = ["cobre", "silicio"];
  const CLAVE = "cmg-banco02";

  // ---------- Retos ----------
  // `inicial` es el programa de partida como árbol; las tres vistas salen de él.
  const R = (o, m) => ({ t: "recoger", origen: o, mat: m });
  const E = (d) => ({ t: "entregar", destino: d });
  const REP = (n, cuerpo) => ({ t: "repetir", n, cuerpo });
  const MIENTRAS = (cond, cuerpo) => ({ t: "mientras", cond, cuerpo });
  const BASICOS = ["recoger", "entregar", "repetir"];

  const RETOS = [
    {
      titulo: "Primer viaje",
      objetivo: "Lleva 3 de cobre de la bodega ENT-1 a la fundidora FUN.",
      leccion: "Secuencia y bucle for.",
      pista: "Cada par de bloques es un viaje. Repítelo o mételo en un «repeat».",
      ladrillos: BASICOS,
      robot: { x: 4, y: 5 },
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 3 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 3, tProceso: 3 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 3 }],
      inicial: [R("ENT-1", "cobre"), E("FUN")],
    },
    {
      titulo: "Dos materiales",
      objetivo: "ENT-1 guarda cobre y silicio. FUN necesita 3 de cobre y la ensambladora ENS, 3 de silicio.",
      leccion: "Argumentos: el segundo valor de recoger elige el material.",
      pista: "ENS solo acepta silicio. Si entregas algo que no acepta, R1 se queda con la carga.",
      ladrillos: BASICOS,
      robot: { x: 4, y: 3 },
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 3, silicio: 3 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 1, puerta: { x: 6, y: 1 }, acepta: "cobre", cap: 3, tProceso: 3 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 7, y: 5, puerta: { x: 6, y: 5 }, acepta: "silicio", cap: 3, tProceso: 3 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 3 }, { id: "ENS", mat: "silicio", n: 3 }],
      inicial: [REP(3, [R("ENT-1", "cobre"), E("FUN")])],
    },
    {
      titulo: "Sin derrames",
      objetivo: "Lleva 4 de cobre a FUN y 4 de silicio a ENS sin derramar nada. Cada máquina tarda 9 s por pieza y su entrada tiene un solo hueco.",
      leccion: "Orden de las instrucciones.",
      pista: "Mientras una máquina trabaja, R1 puede hacer otro viaje. También existe «wait».",
      ladrillos: [...BASICOS, "esperar"],
      robot: { x: 4, y: 3 },
      maxDerrames: 0,
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 4, silicio: 4 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 1, puerta: { x: 6, y: 1 }, acepta: "cobre", cap: 1, tProceso: 9 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 7, y: 5, puerta: { x: 6, y: 5 }, acepta: "silicio", cap: 1, tProceso: 9 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 4 }, { id: "ENS", mat: "silicio", n: 4 }],
      inicial: [REP(4, [R("ENT-1", "cobre"), E("FUN")]), REP(4, [R("ENT-1", "silicio"), E("ENS")])],
    },
    {
      titulo: "Contra reloj",
      objetivo: "Lleva 4 de cobre a FUN y 2 de silicio a ENS en 18 s de juego o menos. ENT-1 está cerca pero tiene poco cobre; ENT-2 está lejos y tiene mucho.",
      leccion: "Planificar el recorrido.",
      pista: "R1 sale desde donde terminó la orden anterior, así que el orden de los viajes importa.",
      ladrillos: [...BASICOS, "esperar"],
      robot: { x: 4, y: 4 },
      tiempoMax: 18,
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 5, y: 1, puerta: { x: 5, y: 2 }, stock: { cobre: 2, silicio: 2 } },
        { id: "ENT-2", tipo: "bodega", nombre: "Bodega", x: 1, y: 5, puerta: { x: 2, y: 5 }, stock: { cobre: 6 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 6, tProceso: 2 },
        { id: "ENS", tipo: "maquina", nombre: "Ensambladora", x: 2, y: 1, puerta: { x: 2, y: 2 }, acepta: "silicio", cap: 4, tProceso: 2 },
      ],
      metas: [{ id: "FUN", mat: "cobre", n: 4 }, { id: "ENS", mat: "silicio", n: 2 }],
      inicial: [REP(4, [R("ENT-2", "cobre"), E("FUN")]), REP(2, [R("ENT-1", "silicio"), E("ENS")])],
    },
    {
      titulo: "Hasta vaciar",
      nuevo: true,
      objetivo: "Llegó un camión con una cantidad de cobre que cambia en cada intento, y ENT-1 está tapada. Vacíala en FUN sin hacer ni un viaje vacío.",
      leccion: "aprendejavascript.dev · Bucles con while + Operadores de comparación.",
      pista: "Un «repeat» necesita saber cuántas veces. El sensor «cobre in ENT-1» lo mide antes de cada vuelta: prueba «while» con «> 0».",
      ladrillos: [...BASICOS, "mientras"],
      robot: { x: 4, y: 5 },
      maxVacios: 0,
      stockPorIntento: [7, 3, 6, 4, 5],
      entidades: [
        { id: "ENT-1", tipo: "bodega", nombre: "Bodega", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 5 }, oculto: true },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 3, puerta: { x: 6, y: 3 }, acepta: "cobre", cap: 8, tProceso: 1 },
      ],
      metas: [{ tipo: "vaciar", id: "ENT-1", mat: "cobre" }],
      inicial: [REP(5, [R("ENT-1", "cobre"), E("FUN")])],
    },
    {
      titulo: "Plan B",
      nuevo: true,
      objetivo: "Vacía el MUELLE en 24 s sin derrames. FUN tarda 6 s por pieza y solo tiene un hueco; BOD es una bodega de respaldo que acepta todo. FUN debe recibir al menos 3.",
      leccion: "aprendejavascript.dev · Condicional if/else + Operadores de comparación.",
      pista: "Antes de entregar, mira cuánto cobre espera en la entrada de FUN: si es menos de 1, entrega en FUN; si no, en BOD.",
      ladrillos: [...BASICOS, "esperar", "mientras", "si"],
      robot: { x: 4, y: 3 },
      maxDerrames: 0,
      tiempoMax: 24,
      entidades: [
        { id: "MUELLE", tipo: "bodega", nombre: "Muelle", x: 1, y: 3, puerta: { x: 2, y: 3 }, stock: { cobre: 6 } },
        { id: "FUN", tipo: "maquina", nombre: "Fundidora", x: 7, y: 2, puerta: { x: 6, y: 2 }, acepta: "cobre", cap: 1, tProceso: 6 },
        { id: "BOD", tipo: "bodega", nombre: "Respaldo", x: 7, y: 5, puerta: { x: 6, y: 5 }, stock: { cobre: 0 } },
      ],
      metas: [{ tipo: "vaciar", id: "MUELLE", mat: "cobre" }, { id: "FUN", mat: "cobre", n: 3 }],
      inicial: [MIENTRAS({ lugar: "MUELLE", mat: "cobre", op: ">", n: 0 }, [R("MUELLE", "cobre"), E("FUN")])],
    },
  ];

  // Reto propio: se edita en la pestaña Reto. Parte del mapa de «Plan B».
  const PROPIO_BASE = {
    titulo: "Tu reto",
    objetivo: "Escribe aquí tu enunciado: qué tiene que lograr el programa.",
    leccion: "Reto propio · se edita en la pestaña Reto.",
    pista: "Revisa el registro y la consola.",
    ladrillos: [...BASICOS, "esperar", "mientras", "si"],
    robot: { ...RETOS[5].robot },
    entidades: JSON.parse(JSON.stringify(RETOS[5].entidades)),
    metas: JSON.parse(JSON.stringify(RETOS[5].metas)),
    maxDerrames: 0, tiempoMax: 24, maxVacios: null,
    inicial: [],
  };
  const IDX_PROPIO = RETOS.length;
  // Valida lo que venga del formulario o de un JSON pegado.
  function normalizarReto(d) {
    const num = (v, def, min, max) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? def : Math.min(max, Math.max(min, n)); };
    const base = d && Array.isArray(d.entidades) && d.entidades.length ? d : PROPIO_BASE;
    const entidades = base.entidades.slice(0, 6).map((e, i) => {
      const c = { id: String(e.id || `E-${i + 1}`).slice(0, 8), tipo: e.tipo === "maquina" ? "maquina" : "bodega", nombre: e.nombre || (e.tipo === "maquina" ? "Máquina" : "Bodega"),
        x: num(e.x, 1, 0, 8), y: num(e.y, 1, 0, 6), puerta: { x: num(e.puerta && e.puerta.x, 2, 0, 8), y: num(e.puerta && e.puerta.y, 1, 0, 6) } };
      if (c.tipo === "bodega") {
        c.stock = {}; for (const m of MATERIALES) if (e.stock && m in e.stock) c.stock[m] = Math.round(num(e.stock[m], 0, 0, 30));
        if (!Object.keys(c.stock).length) c.stock.cobre = 0;
        if (e.oculto) c.oculto = true;
      } else Object.assign(c, { acepta: MATERIALES.includes(e.acepta) ? e.acepta : "cobre", cap: Math.round(num(e.cap, 1, 1, 8)), tProceso: num(e.tProceso, 3, 0.5, 30) });
      return c;
    });
    const ids = entidades.map(e => e.id);
    const metas = (Array.isArray(d && d.metas) ? d.metas : []).filter(m => ids.includes(m.id) && MATERIALES.includes(m.mat)).slice(0, 6)
      .map(m => m.tipo === "vaciar" ? { tipo: "vaciar", id: m.id, mat: m.mat } : { id: m.id, mat: m.mat, n: Math.round(num(m.n, 1, 1, 30)) });
    const ladrillos = ["recoger", "entregar", "repetir", "esperar", "mientras", "si"].filter(t => !d || !Array.isArray(d.ladrillos) || d.ladrillos.includes(t));
    const lim = (v) => v === "" || v == null ? null : num(v, null, 0, 300);
    return {
      titulo: String((d && d.titulo) || "Tu reto").slice(0, 50), objetivo: String((d && d.objetivo) || ""), pista: String((d && d.pista) || ""),
      leccion: "Reto propio · se edita en la pestaña Reto.",
      ladrillos: ladrillos.length ? ladrillos : BASICOS,
      robot: { x: num(base.robot && base.robot.x, 4, 0, 8), y: num(base.robot && base.robot.y, 3, 0, 6) },
      entidades, metas: metas.length ? metas : [{ id: entidades.find(e => e.tipo === "maquina")?.id || ids[0], mat: "cobre", n: 1 }],
      maxDerrames: lim(d && d.maxDerrames), tiempoMax: lim(d && d.tiempoMax), maxVacios: lim(d && d.maxVacios),
      ...(Array.isArray(d && d.stockPorIntento) && entidades.some(e => e.oculto) ? { stockPorIntento: d.stockPorIntento.slice(0, 10).map(n => Math.round(num(n, 1, 0, 30))) } : {}),
      inicial: [],
    };
  }

  // ---------- Textos de bloques y pseudocódigo ----------
  // kw = acción, kc = control, tx = texto, slot = valor editable, cond = condición
  const TXT = {
    en: {
      recoger: [["kw", "pick up"], ["slot", "mat"], ["tx", "from"], ["slot", "origen"]],
      entregar: [["kw", "deliver to"], ["slot", "destino"]],
      esperar: [["kw", "wait"], ["slot", "s"], ["tx", "s"]],
      repetir: [["kc", "repeat"], ["slot", "n"], ["tx", "times"]],
      mientras: [["kc", "while"], ["cond"]],
      si: [["kc", "if"], ["cond"]],
      cond: [["slot", "cond.mat"], ["tx", "in"], ["slot", "cond.lugar"], ["slot", "cond.op"], ["slot", "cond.n"]],
      sino: "else",
      fin: { repetir: "end repeat", mientras: "end while", si: "end if" },
      inicio: "when ▶ Run is pressed", inicioPseudo: "program",
      vacio: "empty · tap here, then a brick", cursor: "next brick",
      paleta: { recoger: "pick up", entregar: "deliver", esperar: "wait", repetir: "repeat", mientras: "while", si: "if / else" },
    },
    es: {
      recoger: [["kw", "recoge"], ["slot", "mat"], ["tx", "de"], ["slot", "origen"]],
      entregar: [["kw", "entrega en"], ["slot", "destino"]],
      esperar: [["kw", "espera"], ["slot", "s"], ["tx", "s"]],
      repetir: [["kc", "repite"], ["slot", "n"], ["tx", "veces"]],
      mientras: [["kc", "mientras"], ["cond"]],
      si: [["kc", "si"], ["cond"]],
      cond: [["slot", "cond.mat"], ["tx", "en"], ["slot", "cond.lugar"], ["slot", "cond.op"], ["slot", "cond.n"]],
      sino: "si no",
      fin: { repetir: "fin repite", mientras: "fin mientras", si: "fin si" },
      inicio: "al pulsar ▶ Ejecutar", inicioPseudo: "programa",
      vacio: "vacío · toca aquí y luego un ladrillo", cursor: "siguiente",
      paleta: { recoger: "recoge", entregar: "entrega", esperar: "espera", repetir: "repite", mientras: "mientras", si: "si / si no" },
    },
  };
  const OPS = [">", ">=", "<", "<=", "==", "!="];
  const OP_JS = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "==": "===", "!=": "!==" };
  const OP_VER = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "==": "=", "!=": "≠" };
  const CATEGORIA = { recoger: "accion", entregar: "accion", esperar: "espera", repetir: "control", mientras: "control", si: "control" };

  // ---------- Almacenamiento local (comodidad del jugador) ----------
  const guardado = {
    leer(k, def) { try { const v = localStorage.getItem(`${CLAVE}:${k}`); return v == null ? def : JSON.parse(v); } catch { return def; } },
    escribir(k, v) { try { localStorage.setItem(`${CLAVE}:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  // ---------- Runtime del jugador (Web Worker) ----------
  const WORKER_SRC = `
const AF = Object.getPrototypeOf(async function () {}).constructor;
let seq = 0;
const pend = new Map();
let OFF = null;
const VERBOS = ["recoger", "entregar", "esperar", "cuantos"];
function lineaDe(e) {
  const s = String((e && e.stack) || "");
  const m = s.match(/<anonymous>:(\\d+):\\d+/) || s.match(/> Function:(\\d+):\\d+/) || s.match(/(?:eval code|anonymous)[^\\n]*?:(\\d+):\\d+/);
  return m ? +m[1] : null;
}
function llamar(linea, verbo, args) {
  const id = ++seq;
  postMessage({ type: "call", id, linea, verbo, args });
  return new Promise((resolve, reject) => pend.set(id, { resolve, reject, linea }));
}
function __yo(linea) {
  return new Proxy({}, {
    get(_, p) {
      if (VERBOS.includes(p)) return (...a) => llamar(linea, p, a);
      if (typeof p === "symbol" || p === "then") return undefined;
      const e = new Error("yo." + String(p) + " no existe. Las órdenes son yo.recoger, yo.entregar, yo.esperar y yo.cuantos.");
      e.__linea = linea;
      throw e;
    },
  });
}
function fmt(v) { if (typeof v === "string") return v; try { return JSON.stringify(v); } catch (_) { return String(v); } }
function __log(linea) { return (...a) => postMessage({ type: "log", linea, nivel: "log", texto: a.map(fmt).join(" ") }); }
function __con(linea) {
  const f = (nivel) => (...a) => postMessage({ type: "log", linea, nivel, texto: a.map(fmt).join(" ") });
  return { log: f("log"), info: f("info"), warn: f("warn"), error: f("error") };
}
onmessage = async (ev) => {
  const m = ev.data;
  if (m.type === "res") {
    const p = pend.get(m.id);
    if (!p) return;
    pend.delete(m.id);
    if (m.error) { const e = new Error(m.error); e.__linea = p.linea; p.reject(e); }
    else p.resolve(m.valor);
    return;
  }
  if (m.type !== "run") return;
  if (OFF === null) {
    try { await new AF("\\nthrow new Error('x')")(); } catch (e) { const n = lineaDe(e); OFF = n == null ? NaN : n - 2; }
  }
  let fn;
  try { fn = new AF("__yo", "__log", "__con", m.codigo); }
  catch (e) { postMessage({ type: "error", mensaje: "Error de sintaxis: " + e.message, linea: null }); return; }
  try { await fn(__yo, __log, __con); postMessage({ type: "done" }); }
  catch (e) {
    let linea = e && e.__linea;
    if (linea == null) { const n = lineaDe(e); if (n != null && !isNaN(OFF)) linea = n - OFF; }
    const msg = String((e && e.message) || e).replace(/__yo\\(\\d+\\)\\./g, "yo.").replace(/__log\\(\\d+\\)/g, "log").replace(/__con\\(\\d+\\)\\./g, "console.");
    postMessage({ type: "error", mensaje: msg, linea: linea == null ? null : linea });
  }
};
`;
  const WORKER_URL = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));

  // Cada `yo.` y `log(` lleva su número de línea, para iluminarla mientras corre.
  function instrumentar(src) {
    return src.split("\n").map((l, i) => l
      .replace(/(?<![\w.$])yo\s*\./g, `__yo(${i + 1}).`)
      .replace(/(?<![\w.$])log\s*\(/g, `__log(${i + 1})(`)
      .replace(/(?<![\w.$])console\s*\./g, `__con(${i + 1}).`)
    ).join("\n");
  }

  // ---------- Modelo del programa ----------
  let sigId = 1;
  const nuevoId = () => `n${sigId++}`;
  function conIds(lista) {
    return lista.map(n => {
      const c = { ...n, id: nuevoId() };
      if (c.cond) c.cond = { ...c.cond };
      if (c.cuerpo) c.cuerpo = conIds(c.cuerpo);
      if (c.t === "si") c.sino = conIds(c.sino || []);
      return c;
    });
  }
  const raizDe = (lista) => ({ t: "programa", id: "raiz", cuerpo: conIds(lista) });
  function recorrer(lista, fn, padre = "raiz", rama = "cuerpo") {
    lista.forEach((n, i) => {
      fn(n, padre, rama, i, lista);
      if (n.cuerpo) recorrer(n.cuerpo, fn, n.id, "cuerpo");
      if (n.sino) recorrer(n.sino, fn, n.id, "sino");
    });
  }
  function buscar(prog, id) {
    if (id === "raiz") return { nodo: prog };
    let res = null;
    recorrer(prog.cuerpo, (n, padre, rama, idx, lista) => { if (n.id === id) res = { nodo: n, padre, rama, idx, lista }; });
    return res;
  }
  function listaDe(prog, padre, rama) { const n = buscar(prog, padre).nodo; return n[rama]; }
  function contarNodos(lista) { let c = 0; recorrer(lista, () => c++); return c; }
  const esContenedor = (n) => !!n.cuerpo;

  // Árbol → JavaScript, con el nodo de cada línea para iluminar bloques.
  function generar(prog) {
    const lineas = [], mapa = [];
    const emit = (txt, id, nivel) => { lineas.push("  ".repeat(nivel) + txt); mapa.push(id); };
    const vars = ["i", "j", "k", "m", "n"];
    const q = (s) => JSON.stringify(s);
    const cond = (c) => `await yo.cuantos(${q(c.lugar)}, ${q(c.mat)}) ${OP_JS[c.op]} ${c.n}`;
    (function bloque(lista, nivel, prof) {
      for (const n of lista) {
        if (n.t === "recoger") emit(`await yo.recoger(${q(n.origen)}, ${q(n.mat)});`, n.id, nivel);
        else if (n.t === "entregar") emit(`await yo.entregar(${q(n.destino)});`, n.id, nivel);
        else if (n.t === "esperar") emit(`await yo.esperar(${n.s});`, n.id, nivel);
        else if (n.t === "repetir") {
          const v = vars[prof] || `i${prof}`;
          emit(`for (let ${v} = 0; ${v} < ${n.n}; ${v}++) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof + 1);
          emit("}", n.id, nivel);
        } else if (n.t === "mientras") {
          emit(`while (${cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          emit("}", n.id, nivel);
        } else if (n.t === "si") {
          emit(`if (${cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          if (n.sino.length) { emit("} else {", n.id, nivel); bloque(n.sino, nivel + 1, prof); }
          emit("}", n.id, nivel);
        }
      }
    })(prog.cuerpo, 0, 0);
    return { codigo: lineas.join("\n") + "\n", mapa };
  }

  // JavaScript → árbol, solo para lo que los bloques saben representar.
  class NoTraducible extends Error {}
  function parsear(src) {
    if (typeof acorn === "undefined") throw new NoTraducible("No se pudo cargar el traductor (sin conexión). El programa se queda en texto.");
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, locations: true }); }
    catch (e) { throw new NoTraducible(`El texto tiene un error de sintaxis (${e.message}).`); }
    const linea = (n) => n.loc.start.line;
    const no = (n, que) => { throw new NoTraducible(`Línea ${linea(n)}: ${que} todavía no tiene bloque.`); };
    const str = (a) => a && a.type === "Literal" && typeof a.value === "string";
    const num = (a) => a && a.type === "Literal" && typeof a.value === "number";
    const llamadaYo = (e) => {
      if (!e || e.type !== "AwaitExpression") return null;
      const c = e.argument;
      if (c.type !== "CallExpression" || c.callee.type !== "MemberExpression" || c.callee.object.name !== "yo" || c.callee.computed) return null;
      return { verbo: c.callee.property.name, args: c.arguments };
    };
    const OPS_AST = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "===": "==", "==": "==", "!==": "!=", "!=": "!=" };
    function cond(e) {
      if (e.type === "LogicalExpression") no(e, `«${e.operator}»`);
      if (e.type !== "BinaryExpression" || !OPS_AST[e.operator]) no(e, "esta condición");
      const l = llamadaYo(e.left);
      if (!l || l.verbo !== "cuantos" || !str(l.args[0]) || !str(l.args[1]) || !num(e.right)) no(e, "una condición distinta de «await yo.cuantos(lugar, material) > número»");
      return { lugar: l.args[0].value, mat: l.args[1].value, op: OPS_AST[e.operator], n: e.right.value };
    }
    const cuerpo = (s) => s.type === "BlockStatement" ? lista(s.body) : lista([s]);
    function lista(stmts) {
      const out = [];
      for (const s of stmts) {
        if (s.type === "EmptyStatement") continue;
        if (s.type === "BlockStatement") { out.push(...lista(s.body)); continue; }
        if (s.type === "ExpressionStatement") {
          const l = llamadaYo(s.expression);
          if (!l) {
            const ex = s.expression;
            if (ex.type === "CallExpression" && ex.callee.type === "MemberExpression" && ex.callee.object.name === "yo") no(s, "una orden sin await");
            if (ex.type === "CallExpression" && ex.callee.name === "log") no(s, "log()");
            if (ex.type === "CallExpression" && ex.callee.type === "MemberExpression" && ex.callee.object.name === "console") no(s, `console.${ex.callee.property.name}()`);
            no(s, "esta instrucción");
          }
          if (l.verbo === "recoger" && str(l.args[0]) && str(l.args[1]) && l.args.length === 2) out.push({ t: "recoger", origen: l.args[0].value, mat: l.args[1].value });
          else if (l.verbo === "entregar" && str(l.args[0]) && l.args.length === 1) out.push({ t: "entregar", destino: l.args[0].value });
          else if (l.verbo === "esperar" && num(l.args[0]) && l.args.length === 1) out.push({ t: "esperar", s: l.args[0].value });
          else no(s, `yo.${l.verbo} con estos argumentos`);
          continue;
        }
        if (s.type === "ForStatement") {
          const d = s.init && s.init.type === "VariableDeclaration" && s.init.declarations.length === 1 ? s.init.declarations[0] : null;
          const v = d && d.id.name;
          const okInit = d && num(d.init) && d.init.value === 0;
          const okTest = s.test && s.test.type === "BinaryExpression" && s.test.operator === "<" && s.test.left.name === v && num(s.test.right);
          const u = s.update;
          const okUpd = u && ((u.type === "UpdateExpression" && u.operator === "++" && u.argument.name === v) ||
            (u.type === "AssignmentExpression" && u.operator === "+=" && u.left.name === v && num(u.right) && u.right.value === 1));
          if (!(okInit && okTest && okUpd)) no(s, "un for distinto de «for (let i = 0; i < N; i++)»");
          out.push({ t: "repetir", n: s.test.right.value, cuerpo: cuerpo(s.body) });
          continue;
        }
        if (s.type === "WhileStatement") { out.push({ t: "mientras", cond: cond(s.test), cuerpo: cuerpo(s.body) }); continue; }
        if (s.type === "IfStatement") {
          const sino = !s.alternate ? [] : s.alternate.type === "IfStatement" ? lista([s.alternate]) : cuerpo(s.alternate);
          out.push({ t: "si", cond: cond(s.test), cuerpo: cuerpo(s.consequent), sino });
          continue;
        }
        if (s.type === "VariableDeclaration") no(s, "una variable");
        if (s.type === "DoWhileStatement") no(s, "do…while");
        if (s.type === "SwitchStatement") no(s, "switch");
        if (s.type === "FunctionDeclaration") no(s, "una función");
        no(s, "esta instrucción");
      }
      return out;
    }
    return raizDe(lista(ast.body));
  }

  // ---------- Estado ----------
  let retoIdx = Math.min(IDX_PROPIO, Math.max(0, guardado.leer("reto", 0)));
  let propio = normalizarReto(guardado.leer("propio", null) || PROPIO_BASE);
  let records = guardado.leer("records", {});
  const retoDe = (i) => i === IDX_PROPIO ? propio : RETOS[i];
  const retoActual = () => retoDe(retoIdx);
  let modo = guardado.leer("modo", "bloques");
  let idioma = guardado.leer("idioma", "en");
  let tamLetra = guardado.leer("letra", 14);
  let hechos = guardado.leer("hechos", []);
  let telemetria = guardado.leer("telemetria", []);
  let programa = null;   // { modelo, texto, fuente: "modelo" | "texto" }
  let cursor = { padre: "raiz", rama: "cuerpo", idx: 0 };
  let seleccionBloque = null;
  let slotAbierto = null; // { id, campo }
  let mundo = null;
  let ejec = null;
  let llamada = null;
  let esperandoPrograma = false;
  let pausa = false;
  let velocidad = 1;
  let intento = 0;
  let seleccionMapa = null;
  let lineaCorre = null, lineaErr = null;
  let mapaLineas = null;  // línea JS → id de nodo, del programa en curso
  let globoR1 = null;     // último console.* o log(), dibujado sobre R1
  let telemetriaUi = { dobleClic: 0, arrastre: 0, arrastreBloques: 0 };

  // ---------- Mundo ----------
  // Qué sale de cada máquina según lo que acepta: nombre del producto y cuántos por cada unidad que entra.
  const PRODUCTO = { cobre: ["placas de cobre", 2], silicio: ["obleas de silicio", 1] };
  const r2 = (v) => Math.round(v * 100) / 100;
  const coma = (v, d = 1) => v.toFixed(d).replace(".", ",");
  function crearMundo(reto, nIntento) {
    const entidades = reto.entidades.map(e => {
      const c = JSON.parse(JSON.stringify(e));
      if (c.tipo === "maquina") Object.assign(c, {
        entrada: 0, procesando: false, progreso: 0, recibido: {}, producido: 0, ciclos: 0, derrames: 0, suelo: [],
        produce: PRODUCTO[c.acepta][0], ratio: PRODUCTO[c.acepta][1], cola: [], actual: null, fichas: [], tOcupada: 0,
      });
      if (c.tipo === "bodega") { c.stock = c.stock || {}; c.recibido = {}; c.entregado = {}; }
      return c;
    });
    let stockOculto = null;
    if (reto.stockPorIntento) {
      stockOculto = reto.stockPorIntento[(Math.max(1, nIntento) - 1) % reto.stockPorIntento.length];
      const e = entidades.find(x => x.oculto);
      e.stock[Object.keys(e.stock)[0]] = stockOculto;
    }
    return {
      t: 0, activo: false, fin: null, derrames: 0, vacios: 0, ultimoVacio: null, revelado: false, stockOculto,
      entidades, porId: Object.fromEntries(entidades.map(e => [e.id, e])),
      robot: { x: reto.robot.x, y: reto.robot.y, carga: null, tarea: null, cargaDesde: null, cargaOrigen: null, tCaminando: 0, viajes: 0 },
      eventos: [], verbos: {}, resultados: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 },
    };
  }

  function ruta(dest) {
    const r = mundo.robot, wps = [];
    if (Math.abs(r.x - dest.x) > 1e-6) wps.push({ x: dest.x, y: r.y });
    if (Math.abs(r.y - dest.y) > 1e-6) wps.push({ x: dest.x, y: dest.y });
    return wps;
  }

  function paso(dt) {
    mundo.t += dt;
    for (const e of mundo.entidades) {
      if (e.tipo !== "maquina") continue;
      if (e.procesando) {
        e.progreso += dt; e.tOcupada += dt;
        if (e.progreso >= e.tProceso - 1e-9) {
          e.procesando = false; e.ciclos++; e.producido += e.ratio;
          // Ficha del producto: cuánto tardó cada tramo de la cadena que lo hizo.
          const a = e.actual;
          if (a) e.fichas.push({ n: e.ciclos, origen: a.origen, viaje: r2(a.tEntrega - a.tRecogida), espera: r2(a.tInicio - a.tEntrega), proceso: e.tProceso, total: r2(mundo.t - a.tRecogida) });
          e.actual = null;
        }
      }
      if (!e.procesando && e.entrada > 0) { e.entrada--; e.procesando = true; e.progreso = 0; e.actual = e.cola.shift() || null; if (e.actual) e.actual.tInicio = mundo.t; }
    }
    const r = mundo.robot, tarea = r.tarea;
    if (tarea) {
      let mov = VEL * dt;
      if (tarea.wps.length) r.tCaminando += dt;
      while (mov > 0 && tarea.wps.length) {
        const w = tarea.wps[0], dx = w.x - r.x, dy = w.y - r.y, d = Math.hypot(dx, dy);
        if (d <= mov) { r.x = w.x; r.y = w.y; mov -= d; tarea.wps.shift(); }
        else { r.x += dx / d * mov; r.y += dy / d * mov; mov = 0; }
      }
      if (!tarea.wps.length) {
        tarea.op -= dt;
        if (tarea.op <= 1e-9) { r.tarea = null; terminarOrden(tarea.fin()); }
      }
    }
    evaluar();
  }

  function iniciarOrden(verbo, args) {
    const r = mundo.robot;
    if (verbo === "recoger") {
      const [origen, mat] = args, e = mundo.porId[origen];
      if (r.carga) return terminarOrden("manos_llenas");
      r.tarea = { wps: ruta(e.puerta), op: OP, fin: () => {
        if ((e.stock[mat] || 0) > 0) { e.stock[mat]--; e.entregado[mat] = (e.entregado[mat] || 0) + 1; r.carga = mat; r.cargaDesde = mundo.t; r.cargaOrigen = e.id; r.viajes++; return "ok"; }
        mundo.vacios++; mundo.ultimoVacio = { id: e.id, mat };
        return "viaje_vacio";
      } };
    } else if (verbo === "entregar") {
      const e = mundo.porId[args[0]];
      if (!r.carga) return terminarOrden("manos_vacias");
      r.tarea = { wps: ruta(e.puerta), op: OP, fin: () => {
        const mat = r.carga;
        if (e.tipo === "bodega") { e.stock[mat] = (e.stock[mat] || 0) + 1; e.recibido[mat] = (e.recibido[mat] || 0) + 1; r.carga = null; return "ok"; }
        if (e.acepta !== mat) return "rechazado";
        if (e.entrada >= e.cap) { e.derrames++; e.suelo.push(mat); mundo.derrames++; r.carga = null; return "derrame"; }
        e.entrada++; e.recibido[mat] = (e.recibido[mat] || 0) + 1; e.cola.push({ tRecogida: r.cargaDesde ?? mundo.t, tEntrega: mundo.t, origen: r.cargaOrigen }); r.carga = null; return "ok";
      } };
    } else if (verbo === "esperar") {
      r.tarea = { wps: [], op: args[0], fin: () => "ok" };
    }
    if (r.tarea) r.tarea.op0 = r.tarea.op;
  }

  function sensor(lugar, mat) {
    const e = mundo.porId[lugar];
    if (e.tipo === "bodega") return e.stock[mat] || 0;
    return e.acepta === mat ? e.entrada : 0;
  }

  function validar(verbo, args) {
    const ids = mundo.entidades.map(e => `"${e.id}"`).join(", ");
    const matOk = (m, ej) => m === undefined ? `Falta el material. Por ejemplo ${ej}.` : !MATERIALES.includes(m) ? `No existe el material ${JSON.stringify(m)}. Hay ${MATERIALES.map(x => `"${x}"`).join(" y ")}.` : null;
    if (verbo === "recoger") {
      const [origen, mat] = args;
      if (typeof origen !== "string") return `recoger necesita el ID de una bodega entre comillas, por ejemplo yo.recoger("ENT-1", "cobre").`;
      const e = mundo.porId[origen];
      if (!e) return `No hay ningún edificio "${origen}". En este mapa hay ${ids}.`;
      if (e.tipo !== "bodega") return `"${origen}" es una máquina: solo se recoge en bodegas.`;
      return matOk(mat, `yo.recoger("${origen}", "cobre")`);
    } else if (verbo === "entregar") {
      const [destino] = args;
      if (typeof destino !== "string") return `entregar necesita el ID del destino entre comillas, por ejemplo yo.entregar("FUN").`;
      if (!mundo.porId[destino]) return `No hay ningún edificio "${destino}". En este mapa hay ${ids}.`;
    } else if (verbo === "esperar") {
      const [s] = args;
      if (typeof s !== "number" || !(s > 0) || s > 60) return `esperar necesita un número de segundos entre 0 y 60, por ejemplo yo.esperar(2).`;
    } else if (verbo === "cuantos") {
      const [lugar, mat] = args;
      if (typeof lugar !== "string") return `cuantos necesita el ID de un edificio entre comillas, por ejemplo yo.cuantos("ENT-1", "cobre").`;
      if (!mundo.porId[lugar]) return `No hay ningún edificio "${lugar}". En este mapa hay ${ids}.`;
      return matOk(mat, `yo.cuantos("${lugar}", "cobre")`);
    }
    return null;
  }

  function metaCumplida(m) {
    const e = mundo.porId[m.id];
    if (m.tipo === "vaciar") return (e.stock[m.mat] || 0) === 0 && mundo.robot.carga !== m.mat;
    return ((e.recibido && e.recibido[m.mat]) || 0) >= m.n;
  }
  function faltantes() {
    return retoActual().metas.filter(m => !metaCumplida(m)).map(m => {
      const e = mundo.porId[m.id];
      if (m.tipo === "vaciar") return `${m.id} aún tiene ${e.stock[m.mat]} de ${m.mat}`;
      return `${m.id} ${m.n - ((e.recibido[m.mat]) || 0)} de ${m.mat}`;
    });
  }

  function evaluar() {
    if (!mundo.activo || mundo.fin) return;
    const reto = retoActual();
    if (reto.maxDerrames != null && mundo.derrames > reto.maxDerrames) {
      const e = mundo.entidades.find(x => x.derrames > 0);
      return terminar("fallo", "derrame", `Se derramó ${e.suelo[e.suelo.length - 1]} en ${e.id}: su entrada estaba llena. Este reto no admite derrames.`);
    }
    if (reto.maxVacios != null && mundo.vacios > reto.maxVacios) {
      const v = mundo.ultimoVacio;
      return terminar("fallo", "vacio", `R1 hizo un viaje vacío a ${v.id}: ya no quedaba ${v.mat}. Este reto no admite viajes vacíos.`);
    }
    if (reto.tiempoMax != null && mundo.t > reto.tiempoMax + 1e-9) {
      return terminar("fallo", "tiempo", `Se acabaron los ${reto.tiempoMax} s. Faltó: ${faltantes().join(", ")}.`);
    }
    if (mundo.t > T_LIMITE) return terminar("fallo", "limite", `El programa sigue después de ${T_LIMITE} s de juego. ¿Hay un bucle que nunca termina?`);
    // El reto se cumple cuando el programa termina: así un for demasiado largo
    // todavía tiene que hacer sus viajes de más.
    if (ejec && ejec.acabado && !mundo.robot.tarea && !llamada) {
      if (!faltantes().length) return terminar("victoria", null, null);
      return terminar("fallo", "incompleto", `El programa terminó y falta: ${faltantes().join(", ")}.`);
    }
  }

  // ---------- Ciclo del programa ----------
  function codigoAEjecutar() {
    if (modo !== "js" || programa.fuente === "modelo") {
      const g = generar(programa.modelo);
      return { codigo: g.codigo, mapa: g.mapa };
    }
    return { codigo: $codigo.value, mapa: null };
  }

  function ejecutar() {
    cerrarPrograma();
    cerrarHoja();
    intento++;
    mundo = crearMundo(retoActual(), intento);
    mundo.activo = true;
    lineaCorre = lineaErr = null;
    limpiarConsola();
    ocultarBanner();
    const { codigo, mapa } = codigoAEjecutar();
    mapaLineas = mapa;
    const w = new Worker(WORKER_URL);
    ejec = { worker: w, acabado: false, ultimoMsg: performance.now(), codigo, inicio: new Date().toISOString(), sensoresSeguidos: 0, modo };
    w.onmessage = (ev) => alMensaje(w, ev.data);
    w.onerror = (ev) => { ev.preventDefault(); errorPrograma(ev.message || "Error en el programa.", null); };
    w.postMessage({ type: "run", codigo: instrumentar(codigo) });
    pausa = false;
    esperandoPrograma = true;
    pintarControles();
    pintarEdicion();
  }

  const fmtArgs = (args) => args.map(a => a === undefined ? "" : JSON.stringify(a)).join(", ");

  function alMensaje(w, m) {
    if (!ejec || ejec.worker !== w) return;
    ejec.ultimoMsg = performance.now();
    if (m.type !== "log") esperandoPrograma = false;
    if (m.type === "call") {
      const texto = `${m.verbo}(${fmtArgs(m.args)})`;
      if (llamada) return errorPrograma(`Falta await en la línea ${llamada.linea}: R1 seguía con ${llamada.texto} cuando llegó la orden de la línea ${m.linea}.`, llamada.linea);
      marcarLinea(m.linea);
      mundo.verbos[m.verbo] = (mundo.verbos[m.verbo] || 0) + 1;
      const err = validar(m.verbo, m.args);
      if (err) { esperandoPrograma = true; w.postMessage({ type: "res", id: m.id, error: err }); return; }
      if (m.verbo === "cuantos") {
        // Sensor: responde al instante y el reloj no avanza.
        if (++ejec.sensoresSeguidos > MAX_SENSORES) return errorPrograma(`R1 consultó el sensor ${MAX_SENSORES} veces sin hacer nada más: el bucle no avanza. ¿Falta una orden dentro del «while»?`, m.linea);
        const v = sensor(m.args[0], m.args[1]);
        mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: m.linea, orden: texto, resultado: String(v), sensor: true });
        consola("sensor", m.linea, `${escapar(texto)} → <b>${v}</b>`);
        pintarEventos();
        esperandoPrograma = true;
        w.postMessage({ type: "res", id: m.id, valor: v });
        return;
      }
      ejec.sensoresSeguidos = 0;
      llamada = { id: m.id, linea: m.linea, texto };
      iniciarOrden(m.verbo, m.args);
    } else if (m.type === "log") {
      const nivel = m.nivel || "log";
      mundo.consolas[nivel] = (mundo.consolas[nivel] || 0) + 1;
      consola(nivel === "warn" ? "warn" : nivel === "error" ? "bad" : "log", m.linea, nivel === "log" ? m.texto : escapar(`${nivel}: ${m.texto}`));
      globoR1 = { nivel, texto: m.texto.slice(0, 80), hasta: performance.now() + 2600 };
    } else if (m.type === "done") {
      ejec.acabado = true;
      evaluar();
    } else if (m.type === "error") {
      errorPrograma(m.mensaje, m.linea);
    }
  }

  function terminarOrden(res) {
    if (!llamada) return;
    const l = llamada;
    llamada = null;
    mundo.resultados[res] = (mundo.resultados[res] || 0) + 1;
    mundo.eventos.push({ t: +mundo.t.toFixed(2), linea: l.linea, orden: l.texto, resultado: res });
    consola(claseRes(res), l.linea, `${escapar(l.texto)} → <b>"${res}"</b>`);
    pintarEventos();
    if (ejec) { ejec.ultimoMsg = performance.now(); esperandoPrograma = true; ejec.worker.postMessage({ type: "res", id: l.id, valor: res }); }
  }

  function errorPrograma(mensaje, linea) {
    if (!ejec) return;
    lineaErr = linea; lineaCorre = null; pintarMarcas();
    consola("bad", linea, escapar(mensaje));
    terminar("error", "error", mensaje, linea);
  }

  function cerrarPrograma() {
    if (ejec) ejec.worker.terminate();
    ejec = null;
    llamada = null;
    esperandoPrograma = false;
    pausa = false;
    if (mundo) { mundo.robot.tarea = null; mundo.activo = false; }
  }

  function terminar(resultado, motivo, texto, linea) {
    if (!mundo || mundo.fin) return;
    const codigo = ejec ? ejec.codigo : "";
    const inicio = ejec ? ejec.inicio : new Date().toISOString();
    const modoIntento = ejec ? ejec.modo : modo;
    mundo.fin = resultado;
    mundo.revelado = true;
    cerrarPrograma();
    if (resultado !== "error") { lineaCorre = null; pintarMarcas(); }
    const reto = retoActual();
    const lineas = codigo.split("\n").filter(l => l.trim() && !l.trim().startsWith("//")).length;
    telemetria.push({
      sandbox: "02_tres_vistas", reto: retoIdx + 1, intento, inicio, modo: modoIntento, idioma,
      resultado, motivo, mensaje: texto, linea: linea ?? null,
      tiempoJuego: +mundo.t.toFixed(2), lineas, bloques: modoIntento === "js" && programa.fuente === "texto" ? null : contarNodos(programa.modelo.cuerpo),
      derrames: mundo.derrames, viajesVacios: mundo.vacios, stockOculto: mundo.stockOculto,
      verbos: mundo.verbos, resultados: mundo.resultados, consolas: mundo.consolas, inserciones: { ...telemetriaUi }, codigo,
      escenario: retoIdx === IDX_PROPIO ? propio : undefined,
    });
    telemetriaUi = { dobleClic: 0, arrastre: 0, arrastreBloques: 0 };
    guardado.escribir("telemetria", telemetria);
    const revela = mundo.stockOculto != null ? ` Esta vez llegaron ${mundo.stockOculto} de cobre; en el próximo intento llegará otra cantidad.` : "";
    if (resultado === "victoria") {
      if (!hechos.includes(retoIdx)) { hechos.push(retoIdx); guardado.escribir("hechos", hechos); }
      const sig = retoIdx + 1 < RETOS.length;
      const base = reto.maxDerrames === 0 && reto.tiempoMax ? "Sin derrames y dentro del tiempo." : reto.maxDerrames === 0 ? "Sin derrames." : reto.maxVacios === 0 ? "Sin viajes vacíos." : reto.tiempoMax ? `Dentro del tiempo (${reto.tiempoMax} s).` : "Todo entregado.";
      // El número a optimizar: el tiempo de juego, contra el récord de este reto.
      const ant = records[retoIdx];
      let rec;
      if (ant == null || mundo.t < ant - 1e-9) { records[retoIdx] = r2(mundo.t); guardado.escribir("records", records); rec = ant == null ? `Primer récord: ${coma(mundo.t)} s` : `Nuevo récord: ${coma(mundo.t)} s (antes ${coma(ant)} s)`; }
      else rec = `Récord ${coma(ant)} s · esta vez +${coma(mundo.t - ant)} s`;
      mostrarBanner("victoria", "Reto cumplido", escapar(base + revela) + `<br><b class="record">${escapar(rec)}</b>`,
        `${mundo.t.toFixed(1)} s de juego · ${lineas} líneas de JS · intento ${intento}`,
        sig ? [["Siguiente reto", "primario", () => elegirReto(retoIdx + 1)], ["Otra vez", "", ocultarBanner]] : [["Otra vez", "primario", ocultarBanner]]);
      pintarRetos();
    } else if (resultado === "fallo") {
      mostrarBanner("fallo", "Aún no", escapar(texto + revela), `Pista: ${reto.pista}`, [["Editar programa", "primario", ocultarBanner]]);
    } else if (resultado === "error") {
      mostrarBanner("fallo", linea ? `Error en la línea ${linea}` : "Error en el programa", escapar(texto), null, [["Editar programa", "primario", () => { ocultarBanner(); if (modo === "js") irALinea(linea); }]]);
    }
    pintarControles();
    pintarResumen();
    pintarEdicion();
    metasClave = "";
  }

  function detener() {
    if (!ejec) return;
    consola("warn", null, "Programa detenido.");
    terminar("detenido", "detenido", null);
  }

  // ---------- Bucle de juego ----------
  let ultimo = performance.now(), acum = 0, ultVivos = 0;
  function bucle(now) {
    const real = Math.min(0.25, (now - ultimo) / 1000);
    ultimo = now;
    if (mundo.activo && !pausa && !esperandoPrograma) {
      acum += real * velocidad;
      while (acum >= DT && mundo.activo && !esperandoPrograma) { paso(DT); acum -= DT; }
    } else acum = 0;
    if (ejec && !ejec.acabado && !llamada && now - ejec.ultimoMsg > VIGIA_MS) {
      errorPrograma(`Un bucle giró ${VIGIA_MS / 1000} s sin ningún await, así que R1 nunca recibió órdenes. Cada vuelta necesita al menos un await yo.….`, lineaCorre);
    }
    dibujar();
    pintarHud();
    if (now - ultVivos > 200) { ultVivos = now; actualizarVivos(); }
    if (marcasSucias) pintarMarcasYa();
    if (eventosSucios) pintarEventosYa();
    requestAnimationFrame(bucle);
  }

  // ---------- Dibujo ----------
  const $lienzo = document.getElementById("lienzo");
  const ctx = $lienzo.getContext("2d");
  let colores = {};
  function leerColores() {
    const s = getComputedStyle(document.documentElement);
    for (const k of ["bg", "surface", "ink", "muted", "line", "grid", "building", "building-top", "edge", "accent", "accent-soft", "cobre", "silicio", "ok", "warn", "bad", "bad-soft"])
      colores[k] = s.getPropertyValue(`--${k}`).trim();
  }
  leerColores();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", leerColores);
  new MutationObserver(leerColores).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function dibujar() {
    const dpr = window.devicePixelRatio || 1;
    const campo = $("campo");
    const W = Math.max(0, Math.min(campo.clientWidth - 16, (campo.clientHeight - 82) * COLS / ROWS));
    if (W < 1) return;
    const T = W / COLS, H = T * ROWS;
    if ($lienzo.width !== Math.round(W * dpr) || $lienzo.height !== Math.round(H * dpr)) {
      $lienzo.width = Math.round(W * dpr); $lienzo.height = Math.round(H * dpr); $lienzo.style.width = `${W}px`; $lienzo.style.height = `${H}px`;
    }
    const c = colores;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) { ctx.moveTo(Math.round(i * T) + .5, 0); ctx.lineTo(Math.round(i * T) + .5, H); }
    for (let j = 1; j < ROWS; j++) { ctx.moveTo(0, Math.round(j * T) + .5); ctx.lineTo(W, Math.round(j * T) + .5); }
    ctx.stroke();

    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
    for (const e of mundo.entidades) { rr(e.puerta.x * T + T * .3, e.puerta.y * T + T * .3, T * .4, T * .4, 3); ctx.stroke(); }
    ctx.setLineDash([]);

    for (const e of mundo.entidades) dibujarEntidad(e, T);

    for (const e of mundo.entidades) {
      if (!e.suelo || !e.suelo.length) continue;
      const cx = (e.puerta.x + .5) * T, cy = (e.puerta.y + .5) * T + T * .32;
      ctx.fillStyle = c["bad-soft"]; ctx.beginPath(); ctx.ellipse(cx, cy, T * .34, T * .14, 0, 0, Math.PI * 2); ctx.fill();
      e.suelo.slice(0, 6).forEach((m, i) => {
        ctx.fillStyle = c[m]; ctx.beginPath(); ctx.arc(cx - T * .22 + (i % 3) * T * .22, cy - T * .03 + Math.floor(i / 3) * T * .08, T * .06, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = c.bad; ctx.font = `700 ${Math.max(T * .17, 9)}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(`derrame ×${e.suelo.length}`, cx, cy + T * .1);
    }

    const r = mundo.robot;
    if (r.tarea && r.tarea.wps.length) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo((r.x + .5) * T, (r.y + .5) * T);
      for (const w of r.tarea.wps) ctx.lineTo((w.x + .5) * T, (w.y + .5) * T);
      ctx.stroke(); ctx.setLineDash([]);
    }

    const px = (r.x + .5) * T, py = (r.y + .5) * T;
    if (r.tarea && !r.tarea.wps.length) {
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, T * .38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - Math.max(0, r.tarea.op) / (r.tarea.op0 || OP)), false); ctx.stroke();
    }
    if (seleccionMapa === "R1") { ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, T * .36, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(px, py, T * .28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.surface; ctx.font = `700 ${Math.max(T * .2, 10)}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("R1", px, py + 1);
    if (r.carga) {
      ctx.fillStyle = c[r.carga]; ctx.strokeStyle = c.surface; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px + T * .24, py - T * .24, T * .13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (globoR1 && performance.now() < globoR1.hasta) dibujarGlobo(globoR1, px, py - T * .42, W);
  }
  function dibujarGlobo(g, x, y, W) {
    const c = colores;
    ctx.font = `600 12px "JetBrains Mono", monospace`;
    let txt = g.texto;
    while (txt.length > 4 && ctx.measureText(txt).width > W * .6) txt = txt.slice(0, -2);
    if (txt !== g.texto) txt += "…";
    const w = ctx.measureText(txt).width + 16, h = 24, bx = Math.min(W - w - 4, Math.max(4, x - w / 2)), by = Math.max(4, y - h - 8);
    ctx.fillStyle = c.surface; ctx.strokeStyle = g.nivel === "warn" ? c.warn : g.nivel === "error" ? c.bad : g.nivel === "info" ? c.accent : c.edge; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, bx + 8, by + h / 2 + 1);
  }

  function dibujarEntidad(e, T) {
    const c = colores, x = e.x * T + T * .07, y = e.y * T + T * .07, s = T * .86;
    ctx.fillStyle = c.edge; rr(x, y + T * .05, s, s, T * .1); ctx.fill();
    ctx.fillStyle = c.building; rr(x, y, s, s, T * .1); ctx.fill();
    ctx.fillStyle = c["building-top"]; rr(x + T * .05, y + T * .05, s - T * .1, T * .2, T * .05); ctx.fill();
    const marcado = seleccionMapa === e.id || (slotAbierto && esCampoLugar(slotAbierto.campo) && opcionesCampo(slotAbierto.campo).includes(e.id));
    if (marcado) {
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5;
      if (slotAbierto && seleccionMapa !== e.id) ctx.setLineDash([4, 3]);
      rr(x - 2, y - 2, s + 4, s + T * .05 + 4, T * .12); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = c.ink; ctx.font = `700 ${Math.max(T * .17, 9.5)}px Archivo, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(e.id, x + T * .09, y + T * .15);

    if (e.tipo === "bodega") {
      if (e.oculto && !mundo.revelado) {
        // Lona: el contenido no se ve, hay que medirlo con el sensor.
        ctx.save(); rr(x + T * .08, y + T * .3, s - T * .16, s - T * .4, T * .06); ctx.clip();
        ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
        for (let k = -s; k < s * 2; k += T * .12) { ctx.beginPath(); ctx.moveTo(x + k, y + T * .3); ctx.lineTo(x + k - s, y + s); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = c.ink; ctx.font = `800 ${Math.max(T * .32, 13)}px Archivo, sans-serif`; ctx.textAlign = "center";
        ctx.fillText("?", x + s / 2, y + s * .62);
        return;
      }
      const mats = MATERIALES.filter(m => m in e.stock);
      mats.forEach((m, i) => {
        const yy = y + T * .44 + i * T * .22;
        ctx.fillStyle = c[m]; ctx.beginPath(); ctx.arc(x + T * .2, yy, T * .075, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.stock[m] ? c.ink : c.muted; ctx.font = `600 ${Math.max(T * .17, 9)}px "JetBrains Mono", monospace`;
        ctx.textAlign = "left";
        ctx.fillText(`${m.slice(0, 2)} ${e.stock[m]}`, x + T * .33, yy + 1);
      });
    } else {
      const cx = x + s / 2, cy = y + T * .45, Rr = T * .14;
      ctx.strokeStyle = c[e.acepta]; ctx.lineWidth = T * .05;
      ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, Math.PI * 2); ctx.stroke();
      if (e.procesando) {
        ctx.fillStyle = c[e.acepta]; ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, Rr * .8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.progreso / e.tProceso)); ctx.closePath(); ctx.fill();
      }
      const sy = y + T * .7, n = e.cap;
      if (n <= 4) {
        const sw = T * .13, gap = T * .05, tot = n * sw + (n - 1) * gap;
        for (let i = 0; i < n; i++) {
          const sx = cx - tot / 2 + i * (sw + gap);
          ctx.lineWidth = 1.5; ctx.strokeStyle = c.edge; rr(sx, sy - sw / 2, sw, sw, 2); ctx.stroke();
          if (i < e.entrada) { ctx.fillStyle = c[e.acepta]; rr(sx + 2, sy - sw / 2 + 2, sw - 4, sw - 4, 1); ctx.fill(); }
        }
      } else {
        ctx.fillStyle = c.muted; ctx.font = `600 ${Math.max(T * .15, 9)}px "JetBrains Mono", monospace`; ctx.textAlign = "center";
        ctx.fillText(`${e.entrada}/${n}`, cx, sy);
      }
    }
  }

  $lienzo.addEventListener("click", (ev) => {
    const rect = $lienzo.getBoundingClientRect(), T = rect.width / COLS;
    if (!T) return;
    const gx = Math.floor((ev.clientX - rect.left) / T), gy = Math.floor((ev.clientY - rect.top) / T);
    const e = mundo.entidades.find(x => x.x === gx && x.y === gy);
    // Con un lugar del bloque abierto, tocar el mapa lo elige.
    if (e && slotAbierto && esCampoLugar(slotAbierto.campo) && opcionesCampo(slotAbierto.campo).includes(e.id)) {
      fijarCampo(slotAbierto.id, slotAbierto.campo, e.id);
      cerrarHoja();
      return;
    }
    const fx = (ev.clientX - rect.left) / T, fy = (ev.clientY - rect.top) / T, r = mundo.robot;
    seleccionMapa = e ? e.id : Math.hypot(fx - (r.x + .5), fy - (r.y + .5)) < .5 ? "R1" : null;
    pintarInfo();
  });

  // ---------- Interfaz ----------
  const $ = (id) => document.getElementById(id);
  const $codigo = $("codigo"), $gutter = $("gutter"), $banda = $("banda"), $consola = $("consola"), $prog = $("prog"), $espejo = $("espejo");
  const escapar = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const claseRes = (r) => r === "ok" ? "ok" : r === "derrame" ? "bad" : "warn";

  function pintarRetos() {
    $("retos").innerHTML = [...RETOS, propio].map((r, i) =>
      `<button type="button" class="reto-btn${hechos.includes(i) ? " hecho" : ""}" aria-pressed="${i === retoIdx}" data-i="${i}"><span class="n">${hechos.includes(i) ? "✓" : i === IDX_PROPIO ? "+" : i + 1}</span>${escapar(i === IDX_PROPIO ? `✎ ${r.titulo}` : r.titulo)}${r.nuevo ? ` <span class="nuevo">nuevo</span>` : ""}</button>`).join("");
  }
  $("retos").addEventListener("click", (ev) => { const b = ev.target.closest(".reto-btn"); if (b) elegirReto(+b.dataset.i); });

  function programaInicial(i) {
    const modelo = raizDe(retoDe(i).inicial);
    return { modelo, texto: generar(modelo).codigo, fuente: "modelo" };
  }
  function cargarPrograma(i) {
    const p = guardado.leer(`prog-${i}`, null);
    if (!p || !p.modelo) return programaInicial(i);
    // Renumera ids para que no choquen entre retos.
    const modelo = raizDe(p.modelo.cuerpo);
    return { modelo, texto: p.texto ?? generar(modelo).codigo, fuente: p.fuente || "modelo", comentado: p.comentado ?? null };
  }
  const esInicial = (modelo) => generar(modelo).codigo === generar(raizDe(retoActual().inicial)).codigo;
  // En JavaScript el programa de partida llega comentado: así es fácil quedarse con una parte o escribir otro.
  function comentarInicial(codigo) {
    if (!codigo.trim()) return "/* Programa de R1. Escribe aquí o haz doble clic en el inspector para insertar. */\n";
    return "/* Programa de partida, comentado. Quita las // (Ctrl+/ o el botón «//»)\n * o escribe el tuyo. En bloques sigue activo. */\n"
      + codigo.replace(/\n$/, "").split("\n").map(l => "// " + l).join("\n") + "\n";
  }
  function guardarPrograma() { clearTimeout(tGuardar); tGuardar = 0; guardado.escribir(`prog-${retoIdx}`, programa); }

  function elegirReto(i) {
    if (programa) guardarPrograma();
    cerrarPrograma();
    cerrarHoja();
    retoIdx = i; guardado.escribir("reto", i);
    intento = telemetria.filter(t => t.reto === i + 1).length;
    const reto = retoDe(i);
    mundo = crearMundo(reto, intento + 1);
    programa = cargarPrograma(i);
    cursor = { padre: "raiz", rama: "cuerpo", idx: programa.modelo.cuerpo.length };
    seleccionBloque = null; seleccionMapa = null; lineaCorre = lineaErr = null; mapaLineas = null;
    $("titulo").textContent = reto.titulo;
    $("objetivo-txt").textContent = reto.objetivo;
    $("objetivo-corto").textContent = reto.objetivo;
    $("reto-n").textContent = i === IDX_PROPIO ? "+" : i + 1;
    $("hoja-reto").hidden = true;
    $("b-reto").setAttribute("aria-expanded", "false");
    $("leccion").textContent = reto.leccion;
    ocultarBanner(); limpiarConsola(); pintarRetos(); pintarInfo(); pintarEventos(); pintarResumen(); pintarControles();
    metasClave = "";
    aplicarModo(modo, true);
    pintarFormReto();
    $codigo.dispatchEvent(new CustomEvent("cmg:documento", { detail: { clave: `reto-${retoIdx}` } }));
  }

  let metasClave = "";
  function pintarHud() {
    const reto = retoActual();
    const $r = $("reloj");
    $r.textContent = reto.tiempoMax ? `t ${mundo.t.toFixed(1)} / ${reto.tiempoMax} s` : `t ${mundo.t.toFixed(1)} s`;
    $r.classList.toggle("tarde", !!reto.tiempoMax && mundo.t > reto.tiempoMax);
    const est = reto.metas.map(m => metaCumplida(m) ? 1 : 0).join("") + reto.metas.map(m => { const e = mundo.porId[m.id]; return m.tipo === "vaciar" ? e.stock[m.mat] : (e.recibido[m.mat] || 0); }).join(",");
    const clave = est + "|" + mundo.derrames + "|" + mundo.vacios + "|" + (mundo.t > (reto.tiempoMax || Infinity)) + "|" + mundo.revelado;
    if (clave === metasClave) return;
    metasClave = clave;
    let html = reto.metas.map(m => {
      const e = mundo.porId[m.id], ok = metaCumplida(m);
      if (m.tipo === "vaciar") {
        const quedan = e.oculto && !mundo.revelado ? "?" : e.stock[m.mat];
        return `<span class="meta${ok ? " cumplida" : ""}"><i class="pt" style="background:var(--${m.mat})"></i>${m.id} vacía · quedan ${quedan}</span>`;
      }
      const v = Math.min(m.n, e.recibido[m.mat] || 0);
      return `<span class="meta${ok ? " cumplida" : ""}"><i class="pt" style="background:var(--${m.mat})"></i>${m.id} ← ${m.mat} ${v}/${m.n}</span>`;
    }).join("");
    if (reto.maxDerrames != null) html += `<span class="meta${mundo.derrames > reto.maxDerrames ? " rota" : ""}">derrames ${mundo.derrames}/${reto.maxDerrames}</span>`;
    if (reto.maxVacios != null) html += `<span class="meta${mundo.vacios > reto.maxVacios ? " rota" : ""}">viajes vacíos ${mundo.vacios}/${reto.maxVacios}</span>`;
    if (reto.tiempoMax != null) html += `<span class="meta${mundo.t > reto.tiempoMax ? " rota" : ""}">≤ ${reto.tiempoMax} s</span>`;
    if (records[retoIdx] != null) html += `<span class="meta" style="border-style:dashed" title="El número a optimizar">récord ${coma(records[retoIdx])} s</span>`;
    $("metas").innerHTML = html;
  }

  // ---------- Inspector: código a la izquierda, datos a la derecha, métricas aparte ----------
  // data-ins es el texto para JavaScript; data-bloque, el bloque que añade en bloques; data-val, el valor que rellena un hueco abierto.
  function tk(tipo, texto, ins, o = {}) {
    const attr = (k, v) => v === undefined ? "" : ` data-${k}="${escapar(typeof v === "string" ? v : JSON.stringify(v))}"`;
    return `<button type="button" class="tk tk-${tipo}" draggable="true" data-ins="${escapar(ins)}" data-clave="${escapar(o.clave || ins)}"${attr("fin", o.fin)}${o.bloque ? attr("bloque", JSON.stringify(o.bloque)) : ""}${o.val !== undefined ? attr("val", JSON.stringify(o.val)) : ""}${o.vivo ? attr("vivo", o.vivo) : ""}>${escapar(texto)}</button>`;
  }
  const fila = (...p) => `<div class="fila-tk">${p.join(" ")}</div>`;
  const nota = (t) => `<span class="nota">${t}</span>`;
  const grupo = (titulo, ...filas) => `<div class="grupo-tk">${titulo ? `<div class="g">${titulo}</div>` : ""}${filas.join("")}</div>`;
  const punto = (m) => `<i class="mat" style="background:var(--${m})"></i>`;
  const q = (s) => JSON.stringify(s);
  const htmlMetricas = (m) => m.map(([k, v]) => `<span class="m">${escapar(k)} <b>${escapar(v)}</b></span>`).join("");
  function htmlFicha(f) {
    return `<div class="ficha"><span class="nota">Última pieza (#${f.n}, de ${escapar(f.origen || "?")}):</span>
      <span class="tramo">viaje R1 <b>${coma(f.viaje)} s</b></span><span class="flecha">→</span>
      <span class="tramo">espera <b>${coma(f.espera)} s</b></span><span class="flecha">→</span>
      <span class="tramo">proceso <b>${coma(f.proceso)} s</b></span><span class="flecha">=</span>
      <span class="tramo"><b>${coma(f.total)} s</b></span></div>`;
  }
  function estadoMaquina(e) { return e.procesando ? `procesando ${Math.round(e.progreso / e.tProceso * 100)} %` : e.entrada ? "por empezar" : "libre"; }
  function metricasDe(id) {
    if (id === "R1") { const r = mundo.robot; return [["viajes", r.viajes], ["caminando", `${coma(r.tCaminando)} s`], ["viajes vacíos", mundo.vacios], ["derrames", mundo.derrames]]; }
    const e = mundo.porId[id];
    if (e.tipo === "bodega") return [...MATERIALES.filter(m => e.entregado[m]).map(m => [`salió ${m}`, e.entregado[m]]), ...MATERIALES.filter(m => e.recibido[m]).map(m => [`entró ${m}`, e.recibido[m]])];
    const medias = e.fichas.length ? coma(e.fichas.reduce((a, f) => a + f.total, 0) / e.fichas.length) + " s" : "—";
    return [[e.produce, e.producido], ["ciclos", e.ciclos], ["ocupación", mundo.t ? `${Math.round(e.tOcupada / mundo.t * 100)} %` : "—"], ["tiempo medio por pieza", medias], ["derrames", e.derrames]];
  }
  function valorVivo(clave) {
    const [id, p, x] = clave.split(":");
    if (id === "R1") { const r = mundo.robot; return p === "carga" ? (r.carga ? q(r.carga) : "null") : `x ${coma(r.x)} · y ${coma(r.y)}`; }
    const e = mundo.porId[id]; if (!e) return null;
    if (p === "stock") return e.oculto && !mundo.revelado ? "?" : String(e.stock[x] || 0);
    if (p === "entrada") return String(e.entrada);
    if (p === "estado") return estadoMaquina(e);
    return null;
  }

  function pintarInfo() {
    const $i = $("inspector"), id = seleccionMapa;
    if (!id || (id !== "R1" && !mundo.porId[id])) { $i.dataset.estado = "cerrado"; $i.innerHTML = ""; return; }
    $i.dataset.estado = "abierto";
    let titulo, clase, c1, c2, extra = "";
    if (id === "R1") {
      titulo = "R1"; clase = "Robot";
      c1 = grupo("Nombre", fila(tk("var", "yo", "yo"), nota("así se llama R1 en su propio programa")))
        + grupo("Funciones",
          fila(tk("fn", "yo.recoger(origen, material)", "await yo.recoger(/* origen */, /* material */);", { bloque: { t: "recoger" }, fin: '// → "ok" | "viaje_vacio" | "manos_llenas"' })),
          fila(tk("fn", "yo.entregar(destino)", "await yo.entregar(/* destino */);", { bloque: { t: "entregar" }, fin: '// → "ok" | "rechazado" | "derrame" | "manos_vacias"' })),
          fila(tk("fn", "yo.esperar(segundos)", "await yo.esperar(/* segundos */);", { bloque: { t: "esperar" } })),
          fila(tk("fn", "yo.cuantos(lugar, material)", "await yo.cuantos(/* lugar */, /* material */)", { bloque: { t: "cond" } }), nota("→ número · sensor")));
      c2 = grupo("", fila(nota("velocidad:"), `${VEL} casillas/s, en L`), fila(nota("recoger o entregar:"), `${coma(OP)} s`), fila(nota("lleva:"), `<span data-vivo="R1:carga">${mundo.robot.carga ? q(mundo.robot.carga) : "null"}</span>`, nota("(1 unidad como máximo)")),
        fila(nota("posición:"), `<span class="nota" data-vivo="R1:pos">x ${coma(mundo.robot.x)} · y ${coma(mundo.robot.y)}</span>`));
    } else {
      const e = mundo.porId[id];
      titulo = e.id; clase = e.nombre;
      if (e.tipo === "bodega") {
        const oculto = e.oculto && !mundo.revelado, mats = MATERIALES.filter(m => m in e.stock);
        c1 = grupo("Nombre", fila(tk("str", q(e.id), q(e.id), { val: e.id, bloque: { t: "recoger", origen: e.id, mat: mats[0] || "cobre" } }), nota("los lugares se escriben como texto")))
          + grupo(oculto ? "Contenido (tapado: cambia en cada intento)" : "Contenido", ...mats.map(m => fila(punto(m), tk("str", q(m), q(m), { val: m, bloque: { t: "recoger", origen: e.id, mat: m } }), `<span class="sep">=</span>`,
            `<span class="tk-num" data-vivo="${e.id}:stock:${m}">${oculto ? "?" : e.stock[m]}</span>`)))
          + grupo("Funciones",
            fila(tk("fn", `yo.recoger(${q(e.id)}, material)`, `await yo.recoger(${q(e.id)}, /* material */);`, { bloque: { t: "recoger", origen: e.id, mat: mats[0] || "cobre" }, fin: '// → "ok" | "viaje_vacio" | "manos_llenas"' })),
            fila(tk("fn", `yo.cuantos(${q(e.id)}, material)`, `await yo.cuantos(${q(e.id)}, /* material */)`, { bloque: { t: "cond", lugar: e.id, mat: mats[0] || "cobre", op: ">", n: 0 } }), nota("→ número · sensor")));
        c2 = grupo("", fila(nota("tipo:"), "bodega"), fila(nota("acepta:"), "todo lo que le entregues"), fila(nota("guarda:"), mats.join(", ") || "nada"));
      } else {
        const unidad = e.produce.split(" ")[0];
        c1 = grupo("Nombre", fila(tk("str", q(e.id), q(e.id), { val: e.id, bloque: { t: "entregar", destino: e.id } }), nota("los lugares se escriben como texto")))
          + grupo("Entrada", fila(punto(e.acepta), tk("str", q(e.acepta), q(e.acepta), { val: e.acepta }), `<span class="sep">=</span>`, `<span class="tk-num" data-vivo="${e.id}:entrada">${e.entrada}</span>`, nota(`en espera, de ${e.cap} ${e.cap === 1 ? "hueco" : "huecos"}`)))
          + grupo("Funciones",
            fila(tk("fn", `yo.entregar(${q(e.id)})`, `await yo.entregar(${q(e.id)});`, { bloque: { t: "entregar", destino: e.id }, fin: '// → "ok" | "rechazado" | "derrame" | "manos_vacias"' })),
            fila(tk("fn", `yo.cuantos(${q(e.id)}, ${q(e.acepta)})`, `await yo.cuantos(${q(e.id)}, ${q(e.acepta)})`, { bloque: { t: "cond", lugar: e.id, mat: e.acepta, op: "<", n: 1 } }), nota("→ cuántos esperan")));
        c2 = grupo("", fila(nota("input:"), e.acepta), fila(nota("output:"), e.produce),
          fila(nota("ratio:"), `${e.ratio} ${unidad} por cada 1 ${e.acepta}`), fila(nota("velocidad:"), `${coma(e.tProceso)} s por ciclo`),
          fila(nota("estado:"), `<span data-vivo="${e.id}:estado">${estadoMaquina(e)}</span>`));
        if (e.fichas.length) extra = htmlFicha(e.fichas[e.fichas.length - 1]);
      }
    }
    const m = metricasDe(id);
    const dondeVa = modo === "js" ? "lo inserta donde está el cursor (también se puede arrastrar)" : "rellena el valor abierto o añade el bloque";
    $i.innerHTML = `<div class="ins-acc ins-cierre"><button type="button" data-cerrar-inspector aria-label="Cerrar el inspector">×</button></div><div class="ins-contenido"><div class="ins-cab"><h2>${escapar(titulo)}</h2><span class="clase">${escapar(clase)}</span></div>
      <div class="ins-cols"><div class="ins-col"><h3>Para tu código</h3>${c1}</div><div class="ins-col"><h3>Datos</h3>${c2}</div></div>
      ${m.length || extra ? `<div class="grupo-tk"><div class="metricas-tit">Métricas de este intento</div><div class="metricas" data-metricas>${htmlMetricas(m)}</div><div data-ficha>${extra}</div></div>` : ""}
      <div class="leyenda-tk"><span class="tk-var">variable</span><span class="tk-fn">función</span><span class="tk-num">número</span><span class="tk-str">texto</span><span style="font-family:var(--f-body);font-weight:400">· doble clic: ${dondeVa}</span></div>
      <div class="pista-tk" id="pista-tk"></div></div>`;
    fichaVista = id !== "R1" && mundo.porId[id].fichas ? mundo.porId[id].fichas.length : 0;
  }
  let fichaVista = 0;
  function actualizarVivos() {
    const $i = $("inspector"), id = seleccionMapa;
    if (!id || (id !== "R1" && !mundo.porId[id])) return;
    for (const el of $i.querySelectorAll("[data-vivo]")) { const v = valorVivo(el.dataset.vivo); if (v != null && el.textContent !== v) el.textContent = v; }
    const met = $i.querySelector("[data-metricas]"); if (met) { const h = htmlMetricas(metricasDe(id)); if (met.innerHTML !== h) met.innerHTML = h; }
    const e = mundo.porId[id];
    if (e && e.fichas && e.fichas.length !== fichaVista) { fichaVista = e.fichas.length; const f = $i.querySelector("[data-ficha]"); if (f) f.innerHTML = e.fichas.length ? htmlFicha(e.fichas[e.fichas.length - 1]) : ""; }
  }

  // Doble clic (o doble toque) usa el token; un clic solo lo arma y explica qué hará.
  let armado = { clave: null, t: 0 };
  $("inspector").addEventListener("click", (ev) => {
    if (ev.target.closest("[data-cerrar-inspector]")) { $("inspector").dataset.estado = "cerrado"; return; }
    const t = ev.target.closest(".tk"); if (!t) return;
    const $p = $("pista-tk"), ahora = performance.now();
    document.querySelectorAll(".tk.armado").forEach(x => x.classList.remove("armado"));
    if (armado.clave === t.dataset.clave && ahora - armado.t < 550) {
      armado = { clave: null, t: 0 };
      const msg = usarToken(t);
      telemetriaUi.dobleClic++;
      t.classList.add("hecho"); setTimeout(() => t.classList.remove("hecho"), 400);
      if ($p) $p.innerHTML = msg;
    } else {
      armado = { clave: t.dataset.clave, t: ahora };
      t.classList.add("armado");
      if ($p) $p.innerHTML = modo === "js" ? `Doble clic inserta <code>${escapar(t.dataset.ins)}</code> donde está el cursor.`
        : t.dataset.bloque ? "Doble clic añade el bloque que corresponde, o rellena el valor que tengas abierto." : "Toca un valor de un bloque y luego haz doble clic aquí para ponerlo.";
    }
  });
  function usarToken(t) {
    const val = t.dataset.val ? JSON.parse(t.dataset.val) : undefined, bloque = t.dataset.bloque ? JSON.parse(t.dataset.bloque) : null;
    if (ejec) return "Detén el programa para editarlo.";
    if (modo === "js") { insertarRef(t.dataset.ins, t.dataset.fin); return `Insertado <code>${escapar(t.dataset.ins)}</code>.`; }
    if (slotAbierto && val !== undefined && opcionesCampo(slotAbierto.campo).includes(val)) {
      fijarCampo(slotAbierto.id, slotAbierto.campo, val); cerrarHoja(); return `Puesto <code>${escapar(String(val))}</code> en el bloque.`;
    }
    if (bloque) return agregarDesdeToken(bloque);
    return "Toca un valor de un bloque y luego haz doble clic aquí para ponerlo.";
  }
  function agregarDesdeToken(b) {
    const lad = retoActual().ladrillos;
    let t = b.t, extra = { ...b };
    delete extra.t;
    if (t === "cond") {
      t = lad.includes("si") ? "si" : lad.includes("mientras") ? "mientras" : null;
      if (!t) return "Este reto no tiene bloques con condición.";
      const n0 = nuevoLadrillo(t);
      extra = Object.keys(b).length > 1 ? { cond: { lugar: b.lugar, mat: b.mat, op: b.op, n: b.n } } : { cond: n0.cond };
    }
    if (!lad.includes(t)) return "Ese bloque no está en este reto.";
    const n = nuevoLadrillo(t);
    Object.assign(n, extra);
    agregarNodo(n);
    return "Bloque añadido donde está la línea azul.";
  }
  document.addEventListener("dragstart", (ev) => {
    const t = ev.target.closest && ev.target.closest(".tk[data-ins]"); if (!t) return;
    if (modo !== "js") { ev.preventDefault(); return; }
    ev.dataTransfer.setData("text/plain", t.dataset.ins); ev.dataTransfer.effectAllowed = "copy";
    $("editor").classList.add("soltar");
  });
  document.addEventListener("dragend", () => $("editor").classList.remove("soltar"));

  function pintarControles() {
    const corriendo = !!ejec;
    const $e = $("b-ejecutar");
    $e.textContent = corriendo ? "■ Detener" : "▶ Ejecutar";
    $e.classList.toggle("primario", !corriendo); $e.classList.toggle("peligro", corriendo);
    const $p = $("b-pausa");
    $p.disabled = !corriendo; $p.textContent = pausa ? "Seguir" : "Pausa";
    $("b-vel").textContent = `${velocidad}×`;
    $("intento-txt").textContent = `Intento ${intento + (corriendo ? 0 : 1)} · reto ${retoIdx + 1}`;
  }

  $("b-ejecutar").addEventListener("click", () => ejec ? detener() : ejecutar());
  $("b-pausa").addEventListener("click", () => { pausa = !pausa; pintarControles(); });
  $("b-vel").addEventListener("click", () => { velocidad = velocidad === 1 ? 2 : velocidad === 2 ? 4 : 1; pintarControles(); });
  $("b-reiniciar").addEventListener("click", () => {
    if (ejec) terminar("detenido", "reinicio", null);
    mundo = crearMundo(retoActual(), intento + 1); lineaCorre = lineaErr = null; pintarMarcas(); ocultarBanner(); metasClave = ""; pintarInfo();
  });
  let confirmarRestaurar = false;
  $("b-restaurar").addEventListener("click", (ev) => {
    if (!confirmarRestaurar) { confirmarRestaurar = true; ev.target.textContent = "¿Seguro? Se pierde tu programa. Toca otra vez"; setTimeout(() => { confirmarRestaurar = false; ev.target.textContent = "Restaurar programa inicial"; }, 3000); return; }
    confirmarRestaurar = false; ev.target.textContent = "Restaurar programa inicial";
    programa = programaInicial(retoIdx); guardarPrograma();
    cursor = { padre: "raiz", rama: "cuerpo", idx: programa.modelo.cuerpo.length }; seleccionBloque = null;
    aplicarModo(modo, true);
  });

  // Pestañas
  const TABS = ["programa", "registro", "ayuda", "reto"];
  function abrirPestana(t) {
    $("zona-codigo").dataset.pestana = t;
    if (t !== "programa") $codigo.blur();
    for (const x of TABS) { const on = x === t; $(`t-${x}`).setAttribute("aria-selected", on); $(`v-${x}`).hidden = !on; }
    if (t === "programa" && modo === "js") medirEditor();
  }
  document.querySelector(".tabs").addEventListener("click", (ev) => { const b = ev.target.closest(".tab"); if (b) abrirPestana(b.id.slice(2)); });

  // Banner
  function mostrarBanner(tipo, titulo, html, stats, acciones) {
    const $b = $("banner");
    $b.className = `banner ${tipo}`;
    $b.innerHTML = `<h2>${titulo}</h2>${html ? `<p>${html}</p>` : ""}${stats ? `<p class="stats">${escapar(stats)}</p>` : ""}<div class="acciones"></div>`;
    const $a = $b.querySelector(".acciones");
    for (const [txt, cls, fn] of acciones) {
      const b = document.createElement("button"); b.type = "button"; b.className = `btn chico ${cls}`; b.textContent = txt; b.addEventListener("click", fn); $a.appendChild(b);
    }
    $b.hidden = false;
  }
  function ocultarBanner() { $("banner").hidden = true; }

  // Consola
  function limpiarConsola() { $consola.innerHTML = `<div class="vacia">Aquí verás cada orden y lo que devuelve.</div>`; }
  function consola(cls, linea, html) {
    const v = $consola.querySelector(".vacia"); if (v) v.remove();
    const d = document.createElement("div");
    d.className = `c ${cls}`;
    d.innerHTML = `<span class="l">${linea ? `L${linea}` : ""}</span><span>${cls === "log" ? escapar(html) : html}</span>`;
    $consola.appendChild(d);
    while ($consola.children.length > 120) $consola.firstChild.remove();
    $consola.scrollTop = $consola.scrollHeight;
  }

  // Registro y telemetría
  function pintarEventos() { eventosSucios = true; }
  function pintarEventosYa() {
    eventosSucios = false;
    $("eventos").innerHTML = mundo.eventos.slice(-200).map(e =>
      `<tr><td>${e.t.toFixed(2)}</td><td>${e.linea}</td><td>${escapar(e.orden)}</td><td class="${e.sensor ? "sensor" : claseRes(e.resultado)}">${escapar(e.resultado)}</td></tr>`).join("")
      || `<tr><td colspan="4" style="color:var(--muted)">Todavía no hay órdenes en este intento.</td></tr>`;
  }
  function pintarResumen() {
    const delReto = telemetria.filter(t => t.reto === retoIdx + 1);
    const victorias = delReto.filter(t => t.resultado === "victoria");
    const mejor = victorias.length ? Math.min(...victorias.map(v => v.tiempoJuego)).toFixed(1) + " s" : "—";
    const primera = delReto.findIndex(t => t.resultado === "victoria");
    const porModo = ["bloques", "pseudo", "js"].map(m => delReto.filter(t => t.modo === m).length).join(" / ");
    const datos = [["Intentos", delReto.length], ["Cumplidos", victorias.length], ["Mejor tiempo", mejor], ["Intentos hasta cumplir", primera >= 0 ? primera + 1 : "—"], ["Bloques / pseudo / JS", porModo]];
    $("resumen").innerHTML = datos.map(([k, v]) => `<div class="dato"><span>${k}</span><b>${v}</b></div>`).join("");
    $("json").value = JSON.stringify(telemetria, null, 2);
  }
  $("b-copiar").addEventListener("click", () => {
    const txt = JSON.stringify(telemetria, null, 2);
    const ok = () => { $("copiado").hidden = false; setTimeout(() => $("copiado").hidden = true, 1600); };
    const planB = () => { const d = document.querySelector("details.json"); d.open = true; $("json").focus(); $("json").select(); };
    try { navigator.clipboard.writeText(txt).then(ok, planB); } catch { planB(); }
  });
  let confirmarBorrado = false;
  $("b-borrar").addEventListener("click", (ev) => {
    if (!confirmarBorrado) { confirmarBorrado = true; ev.target.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { confirmarBorrado = false; ev.target.textContent = "Borrar telemetría"; }, 3000); return; }
    confirmarBorrado = false; ev.target.textContent = "Borrar telemetría";
    telemetria = []; guardado.escribir("telemetria", telemetria); intento = 0; pintarResumen(); pintarControles();
  });

  // ---------- Modos ----------
  function aviso(html, acciones = []) {
    const $a = $("aviso");
    if (!html) { $a.hidden = true; return; }
    $a.innerHTML = `<div>${html}</div>`;
    if (acciones.length) {
      const fila = document.createElement("div"); fila.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
      for (const [txt, fn] of acciones) { const b = document.createElement("button"); b.type = "button"; b.className = "btn chico"; b.textContent = txt; b.addEventListener("click", ev => fn(ev)); fila.appendChild(b); }
      $a.appendChild(fila);
    }
    $a.hidden = false;
  }

  function aplicarModo(nuevo, forzar) {
    if (ejec && !forzar) return;
    // Si el texto sigue siendo el programa de partida comentado, los bloques siguen siendo los de partida.
    if (nuevo !== "js" && programa.fuente === "texto" && programa.comentado != null && programa.texto === programa.comentado) programa.fuente = "modelo";
    if (nuevo !== "js" && programa.fuente === "texto") {
      try {
        programa.modelo = parsear(programa.texto);
        programa.fuente = "modelo";
        cursor = { padre: "raiz", rama: "cuerpo", idx: programa.modelo.cuerpo.length };
        seleccionBloque = null;
        guardarPrograma();
      } catch (e) {
        if (!(e instanceof NoTraducible)) throw e;
        if (forzar) {
          // Al cargar: el programa guardado solo existe como texto, así que se abre en JavaScript.
          aplicarModo("js", true);
          aviso(`Este programa se quedó en JavaScript: ${escapar(e.message)}`);
          return;
        }
        let confirmar = false;
        aviso(`No puedo pasar este texto a bloques. ${escapar(e.message)}`, [["Seguir en JavaScript", () => aviso(null)], ["Descartar el texto y volver a bloques", (ev) => {
          if (!confirmar) { confirmar = true; ev.target.textContent = "¿Seguro? Toca otra vez"; return; }
          programa.fuente = "modelo"; programa.texto = generar(programa.modelo).codigo; guardarPrograma(); aviso(null); aplicarModo(nuevo);
        }]]);
        return;
      }
    }
    if (nuevo === "js" && programa.fuente === "modelo") {
      const g = generar(programa.modelo).codigo;
      if (esInicial(programa.modelo)) { programa.texto = comentarInicial(g); programa.fuente = "texto"; programa.comentado = programa.texto; }
      else { programa.texto = g; programa.comentado = null; }
    }
    if (nuevo !== "js") $codigo.blur();
    modo = nuevo; guardado.escribir("modo", modo);
    $("app").dataset.modo = modo;
    $("b-colores").hidden = modo !== "js";
    document.querySelectorAll("[data-ajuste-modo]").forEach(b => b.setAttribute("aria-pressed", b.dataset.ajusteModo === modo));
    aviso(null);
    for (const b of document.querySelectorAll(".modo")) b.setAttribute("aria-checked", b.dataset.modo === modo);
    $("g-idioma").hidden = modo === "js";
    $prog.hidden = modo === "js";
    $("editor").hidden = modo !== "js";
    $("vista-js").hidden = modo === "js";
    $("seleccion").hidden = modo === "js";
    if (modo === "js") { $codigo.value = programa.texto; }
    cerrarHoja();
    pintarPaleta();
    pintarEdicion();
    pintarInfo();
    if (modo === "js") medirEditor();
    $("app").dispatchEvent(new Event("cmg:modo"));
    $codigo.dispatchEvent(new Event("cmg:sincronizado"));
  }
  $("modos").addEventListener("click", (ev) => { const b = ev.target.closest(".modo"); if (b && b.dataset.modo !== modo) aplicarModo(b.dataset.modo); });
  document.querySelectorAll("[data-ajuste-modo]").forEach(b => b.addEventListener("click", () => {
    aplicarModo(b.dataset.ajusteModo);
    $("ajustes").close();
    abrirPestana("programa");
  }));
  document.querySelectorAll("[data-idioma]").forEach(b => b.addEventListener("click", () => {
    idioma = b.dataset.idioma; guardado.escribir("idioma", idioma);
    document.querySelectorAll("[data-idioma]").forEach(x => x.setAttribute("aria-pressed", x.dataset.idioma === idioma));
    pintarPaleta(); pintarEdicion();
  }));
  document.querySelectorAll("[data-idioma]").forEach(x => x.setAttribute("aria-pressed", x.dataset.idioma === idioma));
  const TAMANOS = [12, 13, 14, 16, 18];
  function aplicarLetra() {
    document.querySelector(".app").style.setProperty("--code-size", `${tamLetra}px`);
    $("ajustes-letra").textContent = `${tamLetra} px`;
    guardado.escribir("letra", tamLetra);
    if (modo === "js") medirEditor();
  }
  function cambiarLetra(delta) {
    const i = TAMANOS.indexOf(tamLetra);
    tamLetra = TAMANOS[Math.max(0, Math.min(TAMANOS.length - 1, (i < 0 ? 2 : i) + delta))];
    aplicarLetra();
  }
  $("b-menos").addEventListener("click", () => cambiarLetra(-1));
  $("b-mas").addEventListener("click", () => cambiarLetra(1));
  document.querySelectorAll("[data-tamano]").forEach(b => b.addEventListener("click", () => cambiarLetra(+b.dataset.tamano)));

  // ---------- Paleta ----------
  const ICO_BLOQUE = { recoger: "recoger", entregar: "entregar", repetir: "repetir", mientras: "mientras", si: "siNo", esperar: "esperar" };
  const ATAJOS_JS = [
    { ico: "comentar", t: "Comentar", comentar: true },
    { ico: "recoger", t: "Recoger", b: 'await yo.recoger(/* origen */, /* material */);' },
    { ico: "entregar", t: "Entregar", b: 'await yo.entregar(/* destino */);' },
    { ico: "repetir", t: "For", b: "for (let i = 0; i < 3; i++) {\n  \n}", envolvente: ["for (let i = 0; i < 3; i++) {\n", "\n}"] },
    { ico: "mientras", t: "While", b: "while (/* condición */) {\n  \n}", envolvente: ["while (/* condición */) {\n", "\n}"] },
    { ico: "siNo", t: "If / else", b: "if (/* condición */) {\n  \n} else {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n} else {\n  \n}"] },
    { ico: "sensor", t: "Cuántos", b: "await yo.cuantos(/* lugar */, /* material */)", enLinea: true },
    { ico: "esperar", t: "Esperar", b: "await yo.esperar(/* segundos */);" },
    { ico: "aviso", t: "Console.warn", b: 'console.warn(/* mensaje */);' },
  ];
  ATAJOS_JS[3].variantes = [
    { ico: "whileTrue", t: "While true", b: "while (true) {\n  \n}", envolvente: ["while (true) {\n", "\n}"] },
    { ico: "hacer", t: "Do … while", b: "do {\n  \n} while (/* condición */);", envolvente: ["do {\n", "\n} while (/* condición */);"] },
    { ico: "salir", t: "Salir del bucle", b: "break;" },
  ];
  ATAJOS_JS[5].variantes = [
    { ico: "si", t: "If", b: "if (/* condición */) {\n  \n}", envolvente: ["if (/* condición */) {\n", "\n}"] },
    { ico: "siSino", t: "If / else if", b: "if (/* condición */) {\n  \n} else if (/* condición */) {\n  \n} else {\n  \n}" },
  ];
  ATAJOS_JS[8].variantes = ["log", "info", "error"].map(n => ({ ico: "aviso", t: `Console.${n}`, b: `console.${n}(/* mensaje */);` }));
  ATAJOS_JS.push(
    { ico: "plan", t: "Si no hay (??)", operador: "??", variantes: ["&&", "||", "!", "===", "!==", ">", "<"].map(op => ({ ico: "plan", t: op, operador: op, prefijo: op === "!", hueco: ["&&", "||", "!"].includes(op) ? "condición" : "valor" })) },
    { ico: "variable", t: "Variable", enLinea: "let nombre = ", variantes: [{ ico: "asignar", t: "Asignar", enLinea: "nombre = " }] },
  );
  function iconoPaleta(nombre) {
    const ico = window.ICONOS[nombre];
    return { svg: ico.svg, estilo: `--c1:${ico.c1};--c2:${ico.c2 || ico.c1};--c3:${ico.c3 || ico.c1}` };
  }
  function pintarPaleta() {
    const $p = $("paleta");
    $p.className = `paleta${modo === "pseudo" ? " v-pseudo-paleta" : ""}`;
    $p.setAttribute("aria-label", modo === "js" ? "Insertar en JavaScript" : `Ladrillos de ${modo === "pseudo" ? "pseudocódigo" : "bloques"} en ${idioma === "es" ? "español" : "inglés"}`);
    cerrarVariantes();
    if (modo === "js") {
      $p.innerHTML = ATAJOS_JS.map((a, i) => {
        const ico = iconoPaleta(a.ico);
        return `<button type="button" class="atajo${a.variantes ? " con-variantes" : ""}" data-js="${i}"${a.variantes ? ` aria-haspopup="menu"` : ""} aria-label="${a.t}" data-tip="${a.t}" data-tip-cod="${escapar(codAtajo(a))}" style="${ico.estilo}">${ico.svg}</button>`;
      }).join("") + MATERIALES.map(m => `<button type="button" class="atajo mat" data-m="${m}" aria-label="Insertar ${m}" style="--c1:var(--${m})"><i style="background:var(--${m})"></i>"${m}"</button>`).join("");
      return;
    }
    const tx = TXT[idioma].paleta;
    $p.innerHTML = retoActual().ladrillos.map(t => {
      const ico = iconoPaleta(ICO_BLOQUE[t]);
      return `<button type="button" class="atajo ladrillo ${CATEGORIA[t]}" data-ladrillo="${t}" aria-label="${escapar(tx[t])}" style="${ico.estilo}">${ico.svg}<span>${escapar(tx[t])}</span></button>`;
    }).join("");
  }
  const $paleta = $("paleta");
  $paleta.addEventListener("pointerdown", (ev) => { if (modo === "js" && ev.target.closest(".atajo")) ev.preventDefault(); });
  function usarAtajo(a) {
    if (ejec) return aviso("Detén el programa para editarlo.");
    if (a.comentar) alternarComentario();
    else if (a.operador) {
      const ini = $codigo.selectionStart, fin = $codigo.selectionEnd, txt = $codigo.value.slice(ini, fin);
      if (!txt) return insertar(a.prefijo ? a.operador : ` ${a.operador} `);
      if (a.prefijo) return insertar(`!(${txt})`);
      const h = `/* ${a.hueco || "valor"} */`, t = `${txt} ${a.operador} ${h}`;
      insertar(t, t.length - h.length, t.length);
    } else if (typeof a.enLinea === "string") {
      if ($codigo.selectionStart !== $codigo.selectionEnd) envolver(a.enLinea, ""); else insertar(a.enLinea);
    } else if (a.enLinea) {
      const hueco = a.b.match(RE_HUECO);
      if (!hueco || !envolver(a.b.slice(0, hueco.index), a.b.slice(hueco.index + hueco[0].length))) insertar(a.b, hueco?.index, hueco ? hueco.index + hueco[0].length : undefined);
    } else insertarBloque(a.b, a.envolvente);
  }
  // Variantes: mantener pulsado ~0,45 s (o clic derecho) abre un menú encima del atajo.
  // Se puede soltar el dedo directamente sobre una variante o tocarla después.
  const estiloIcono = ico => `--c1:${ico.c1};--c2:${ico.c2 || ico.c1};--c3:${ico.c3 || ico.c1}`;
  const codAtajo = a => a.b || a.enLinea || a.operador || "// …";
  const $variantes = document.createElement("div");
  $variantes.className = "variantes"; $variantes.hidden = true; $variantes.setAttribute("role", "menu");
  document.body.append($variantes);
  let pulsado = null, variantesDe = -1, suprimirClic = false;
  function abrirVariantes(b, porPulsacion) {
    const i = +b.dataset.js, a = ATAJOS_JS[i], I = window.ICONOS || {};
    if (variantesDe === i && !$variantes.hidden) return;
    variantesDe = i;
    $variantes.innerHTML = [a, ...a.variantes].map((v, j) => {
      const ico = I[v.ico] || { svg: "", c1: "#7FA3FF" };
      return `<button type="button" class="variante${j ? "" : " principal"}" role="menuitem" data-v="${j}" data-tip="${escapar(v.t)}" data-tip-cod="${escapar(codAtajo(v))}" style="${estiloIcono(ico)}">${ico.svg}<span>${escapar(v.t)}</span></button>`;
    }).join("");
    $variantes.hidden = false;
    const r = b.getBoundingClientRect(), m = $variantes.getBoundingClientRect();
    let x = r.left + r.width / 2 - m.width / 2, y = r.top - m.height - 8;
    if (y < 6) y = r.bottom + 8;
    x = Math.max(6, Math.min(innerWidth - m.width - 6, x));
    $variantes.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    b.classList.add("abierto");
    if (porPulsacion && navigator.vibrate) navigator.vibrate(12);
  }
  function cerrarVariantes() {
    if ($variantes.hidden) return;
    $variantes.hidden = true; variantesDe = -1;
    document.querySelectorAll(".atajo.abierto").forEach(x => x.classList.remove("abierto"));
  }
  const varianteEn = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest && el.closest(".variante"); };
  function elegirVariante(boton) {
    const a = ATAJOS_JS[variantesDe], j = +boton.dataset.v;
    cerrarVariantes();
    if (a) usarAtajo(j ? a.variantes[j - 1] : a);
  }
  // pointerdown sin foco: en el teléfono el textarea conserva el foco y el teclado no se cierra.
  $("paleta").addEventListener("pointerdown", (ev) => {
    if (modo !== "js") return;
    suprimirClic = false;
    const b = ev.target.closest(".atajo[data-js]"); if (!b) return;
    ev.preventDefault();
    const a = ATAJOS_JS[+b.dataset.js];
    if (!a.variantes || ev.button > 0) return;
    pulsado = { b, id: ev.pointerId, x: ev.clientX, y: ev.clientY, abierto: false };
    pulsado.t = setTimeout(() => { if (pulsado) { pulsado.abierto = true; abrirVariantes(b, true); } }, 450);
  });
  document.addEventListener("pointermove", (ev) => {
    if (!pulsado || ev.pointerId !== pulsado.id) return;
    if (!pulsado.abierto) { if (Math.hypot(ev.clientX - pulsado.x, ev.clientY - pulsado.y) > 12) { clearTimeout(pulsado.t); pulsado = null; } return; }
    const v = varianteEn(ev.clientX, ev.clientY);
    $variantes.querySelectorAll(".variante").forEach(x => x.classList.toggle("activa", x === v));
  });
  const soltarPulsado = (ev) => {
    if (!pulsado || ev.pointerId !== pulsado.id) return;
    clearTimeout(pulsado.t);
    if (pulsado.abierto) {
      suprimirClic = true;
      const v = ev.type === "pointerup" && varianteEn(ev.clientX, ev.clientY);
      if (v) elegirVariante(v);
    }
    pulsado = null;
  };
  document.addEventListener("pointerup", soltarPulsado);
  document.addEventListener("pointercancel", soltarPulsado);
  $("paleta").addEventListener("contextmenu", (ev) => {
    const b = ev.target.closest(".atajo.con-variantes[data-js]"); if (!b) return;
    ev.preventDefault();
    if (pulsado) { clearTimeout(pulsado.t); pulsado.abierto = true; }
    abrirVariantes(b, false);
  });
  $variantes.addEventListener("pointerdown", (ev) => ev.preventDefault());
  $variantes.addEventListener("click", (ev) => { const v = ev.target.closest(".variante"); if (v) elegirVariante(v); });
  document.addEventListener("pointerdown", (ev) => { if (!$variantes.hidden && !ev.target.closest(".variantes, .atajo.abierto")) cerrarVariantes(); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") cerrarVariantes(); });
  $("paleta").addEventListener("scroll", cerrarVariantes, { passive: true });
  $("paleta").addEventListener("click", (ev) => {
    if (ejec) return aviso("Detén el programa para editarlo.");
    const lad = ev.target.closest("[data-ladrillo]");
    if (lad) return agregarLadrillo(lad.dataset.ladrillo);
    const b = ev.target.closest(".atajo"); if (!b) return;
    if (b.dataset.m) return insertarId(b.dataset.m);
    if (suprimirClic) { suprimirClic = false; return; }
    cerrarVariantes();
    usarAtajo(ATAJOS_JS[+b.dataset.js]);
  });

  // ---------- Edición de bloques ----------
  const bodegas = () => mundo.entidades.filter(e => e.tipo === "bodega").map(e => e.id);
  const maquinas = () => mundo.entidades.filter(e => e.tipo === "maquina").map(e => e.id);
  function nuevoLadrillo(t) {
    const b0 = bodegas()[0], m0 = maquinas()[0] || mundo.entidades[0].id;
    const acepta = (mundo.porId[m0] && mundo.porId[m0].acepta) || "cobre";
    const base = {
      recoger: { t, origen: b0, mat: (mundo.porId[b0] && Object.keys(mundo.porId[b0].stock)[0]) || "cobre" },
      entregar: { t, destino: m0 },
      esperar: { t, s: 2 },
      repetir: { t, n: 3, cuerpo: [] },
      mientras: { t, cond: { lugar: b0, mat: "cobre", op: ">", n: 0 }, cuerpo: [] },
      si: { t, cond: { lugar: m0, mat: acepta, op: "<", n: 1 }, cuerpo: [], sino: [] },
    }[t];
    return conIds([base])[0];
  }
  function cambiado() {
    lineaErr = lineaCorre = null; mapaLineas = null;
    programa.fuente = "modelo";
    programa.texto = generar(programa.modelo).codigo;
    guardarPrograma();
    $codigo.value = programa.texto;
    cambioModelo = true;
    try { $codigo.dispatchEvent(new Event("input")); } finally { cambioModelo = false; }
    pintarEdicion();
  }
  function agregarLadrillo(t) { agregarNodo(nuevoLadrillo(t)); }
  function agregarNodo(n) {
    const lista = listaDe(programa.modelo, cursor.padre, cursor.rama);
    const idx = Math.min(cursor.idx, lista.length);
    lista.splice(idx, 0, n);
    seleccionBloque = n.id;
    cursor = esContenedor(n) ? { padre: n.id, rama: "cuerpo", idx: 0 } : { padre: cursor.padre, rama: cursor.rama, idx: idx + 1 };
    cambiado();
  }
  function quitar(id) { const l = buscar(programa.modelo, id); l.lista.splice(l.idx, 1); return l; }
  function mover(id, dir) {
    const l = buscar(programa.modelo, id);
    const n = l.nodo;
    if (dir < 0) {
      if (l.idx > 0) {
        const prev = l.lista[l.idx - 1];
        l.lista.splice(l.idx, 1);
        if (esContenedor(prev)) (prev.t === "si" ? prev.sino : prev.cuerpo).push(n);
        else l.lista.splice(l.idx - 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = buscar(programa.modelo, l.padre);
        l.lista.splice(0, 1);
        if (l.rama === "sino") p.nodo.cuerpo.push(n);
        else p.lista.splice(p.idx, 0, n);
      } else return;
    } else {
      if (l.idx < l.lista.length - 1) {
        const next = l.lista[l.idx + 1];
        l.lista.splice(l.idx, 1);
        if (esContenedor(next)) next.cuerpo.unshift(n);
        else l.lista.splice(l.idx + 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = buscar(programa.modelo, l.padre);
        l.lista.splice(l.idx, 1);
        if (l.rama === "cuerpo" && p.nodo.t === "si") p.nodo.sino.unshift(n);
        else p.lista.splice(p.idx + 1, 0, n);
      } else return;
    }
    const d = buscar(programa.modelo, id);
    cursor = { padre: d.padre, rama: d.rama, idx: d.idx + 1 };
    cambiado();
  }
  function duplicar(id) {
    const l = buscar(programa.modelo, id);
    const copia = conIds([JSON.parse(JSON.stringify(l.nodo))])[0];
    l.lista.splice(l.idx + 1, 0, copia);
    seleccionBloque = copia.id;
    cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 2 };
    cambiado();
  }
  function borrar(id) {
    const l = quitar(id);
    seleccionBloque = null;
    cursor = { padre: l.padre, rama: l.rama, idx: l.idx };
    cambiado();
  }

  // Campos editables
  const esCampoLugar = (campo) => ["origen", "destino", "cond.lugar"].includes(campo);
  function opcionesCampo(campo) {
    if (campo === "origen") return bodegas();
    if (campo === "destino" || campo === "cond.lugar") return mundo.entidades.map(e => e.id);
    if (campo === "mat" || campo === "cond.mat") return MATERIALES;
    if (campo === "cond.op") return OPS;
    if (campo === "cond.n") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (campo === "n" || campo === "s") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    return [];
  }
  function leerCampo(n, campo) { return campo.startsWith("cond.") ? n.cond[campo.slice(5)] : n[campo]; }
  function fijarCampo(id, campo, v) {
    const n = buscar(programa.modelo, id).nodo;
    if (campo.startsWith("cond.")) n.cond[campo.slice(5)] = v; else n[campo] = v;
    cambiado();
  }
  const TITULO_CAMPO = { origen: "¿De qué bodega?", destino: "¿A dónde?", "cond.lugar": "¿Qué edificio mide el sensor?", mat: "¿Qué material?", "cond.mat": "¿Qué material?", "cond.op": "¿Cómo se compara?", "cond.n": "¿Con qué número?", n: "¿Cuántas veces?", s: "¿Cuántos segundos?" };
  function abrirHoja(id, campo) {
    slotAbierto = { id, campo };
    const n = buscar(programa.modelo, id).nodo;
    const actual = leerCampo(n, campo);
    $("hoja-titulo").textContent = TITULO_CAMPO[campo] || "Elige";
    $("hoja-opciones").innerHTML = opcionesCampo(campo).map(v => {
      const mat = MATERIALES.includes(v) ? `<i style="background:var(--${v})"></i>` : "";
      const txt = campo === "cond.op" ? OP_VER[v] : v;
      return `<button type="button" class="opcion" data-v="${escapar(JSON.stringify(v))}" aria-pressed="${v === actual}">${mat}${escapar(txt)}</button>`;
    }).join("");
    $("hoja-pista").textContent = esCampoLugar(campo) ? "También puedes tocar el edificio en el mapa." : "";
    $("hoja").hidden = false;
    pintarEdicion();
  }
  function cerrarHoja() { if (!slotAbierto && $("hoja").hidden) return; slotAbierto = null; $("hoja").hidden = true; if (programa) pintarEdicion(); }
  $("hoja-cerrar").addEventListener("click", cerrarHoja);
  $("hoja-opciones").addEventListener("click", (ev) => {
    const b = ev.target.closest(".opcion"); if (!b || !slotAbierto) return;
    fijarCampo(slotAbierto.id, slotAbierto.campo, JSON.parse(b.dataset.v));
    cerrarHoja();
  });

  // Dibujo del programa (bloques y pseudocódigo comparten estructura)
  function valorSlot(n, campo) {
    const v = leerCampo(n, campo);
    if (campo === "mat" || campo === "cond.mat") return `<i style="background:var(--${v})"></i>${escapar(v)}`;
    if (campo === "cond.op") return escapar(OP_VER[v]);
    return escapar(v);
  }
  function piezas(n, plantilla) {
    return plantilla.map(([k, v]) => {
      if (k === "slot") return `<button type="button" class="slot${slotAbierto && slotAbierto.id === n.id && slotAbierto.campo === v ? " abierto" : ""}" data-accion="slot" data-id="${n.id}" data-campo="${v}">${valorSlot(n, v)}</button>`;
      if (k === "cond") return `<span class="cond">${piezas(n, TXT[idioma].cond)}</span>`;
      return `<span class="${k}">${escapar(v)}</span>`;
    }).join(" ");
  }
  function htmlCursor() { return `<div class="cursor" aria-hidden="true"><span>${escapar(TXT[idioma].cursor)}</span></div>`; }
  function htmlLista(lista, padre, rama) {
    const conCursor = (i) => !ejec && cursor.padre === padre && cursor.rama === rama && cursor.idx === i ? htmlCursor() : "";
    let html = `<div class="lista" data-padre="${padre}" data-rama="${rama}">`;
    if (!lista.length && padre !== "raiz") html += `<div class="vacio" data-accion="vacio" data-padre="${padre}" data-rama="${rama}">${escapar(TXT[idioma].vacio)}</div>`;
    lista.forEach((n, i) => { html += conCursor(i) + htmlNodo(n); });
    html += conCursor(lista.length) + `</div>`;
    return html;
  }
  function htmlNodo(n) {
    const tx = TXT[idioma], cat = CATEGORIA[n.t], sel = seleccionBloque === n.id ? " sel" : "";
    if (!esContenedor(n)) return `<div class="fila simple ${cat}${sel}" data-accion="fila" data-parte="simple" data-id="${n.id}" data-nodo="${n.id}" data-item="${n.id}">${piezas(n, tx[n.t])}</div>`;
    let html = `<div class="nodo contenedor${sel}" data-nodo-cont="${n.id}" data-item="${n.id}">`;
    html += `<div class="fila cabeza ${cat} ${n.t}" data-accion="fila" data-parte="cabeza" data-id="${n.id}" data-nodo="${n.id}">${piezas(n, tx[n.t])}</div>`;
    html += `<div class="cuerpo">${htmlLista(n.cuerpo, n.id, "cuerpo")}</div>`;
    if (n.t === "si") {
      html += `<div class="fila sino ${cat}" data-accion="fila" data-parte="sino" data-id="${n.id}"><span class="kc">${escapar(tx.sino)}</span></div>`;
      html += `<div class="cuerpo">${htmlLista(n.sino, n.id, "sino")}</div>`;
    }
    html += `<div class="fila pie ${cat}" data-accion="fila" data-parte="pie" data-id="${n.id}">${modo === "pseudo" ? escapar(tx.fin[n.t]) : ""}</div>`;
    return html + `</div>`;
  }
  function pintarEdicion() {
    if (!programa) return;
    $codigo.readOnly = !!ejec;
    $codigo.dispatchEvent(new Event("cmg:estado"));
    if (modo === "js") { pintarMarcas(); return; }
    const scroll = $prog.scrollTop;
    $prog.className = `prog ${modo === "pseudo" ? "v-pseudo" : "v-bloques"}`;
    const tx = TXT[idioma];
    $prog.innerHTML = `<div class="inicio" data-accion="inicio">${escapar(modo === "pseudo" ? tx.inicioPseudo : tx.inicio)}</div>` + htmlLista(programa.modelo.cuerpo, "raiz", "cuerpo");
    $prog.scrollTop = scroll;
    pintarSeleccion();
    pintarMarcas();
  }
  function pintarSeleccion() {
    const $s = $("seleccion");
    if (modo === "js") { $s.hidden = true; return; }
    $s.hidden = false;
    if (!seleccionBloque || !buscar(programa.modelo, seleccionBloque) || ejec) {
      $s.innerHTML = ejec ? `<span>Detén el programa para editarlo.</span>` : `<span>Toca un bloque para moverlo, duplicarlo o borrarlo.</span>`;
      return;
    }
    $s.innerHTML = `<span>Bloque elegido:</span>
      <button class="mini" type="button" data-sel="arriba" aria-label="Subir">↑</button>
      <button class="mini" type="button" data-sel="abajo" aria-label="Bajar">↓</button>
      <button class="mini" type="button" data-sel="duplicar">Duplicar</button>
      <button class="mini" type="button" data-sel="borrar">Borrar</button>`;
  }
  $("seleccion").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-sel]"); if (!b || !seleccionBloque || ejec) return;
    const a = b.dataset.sel;
    if (a === "arriba") mover(seleccionBloque, -1);
    else if (a === "abajo") mover(seleccionBloque, 1);
    else if (a === "duplicar") duplicar(seleccionBloque);
    else if (a === "borrar") borrar(seleccionBloque);
  });
  $prog.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-accion]"); if (!t) return;
    if (ejec) return;
    const a = t.dataset.accion;
    if (a === "slot") { seleccionBloque = t.dataset.id; abrirHoja(t.dataset.id, t.dataset.campo); return; }
    cerrarHoja();
    if (a === "inicio") { seleccionBloque = null; cursor = { padre: "raiz", rama: "cuerpo", idx: 0 }; }
    else if (a === "vacio") { cursor = { padre: t.dataset.padre, rama: t.dataset.rama, idx: 0 }; seleccionBloque = t.dataset.padre; }
    else if (a === "fila") {
      const id = t.dataset.id, l = buscar(programa.modelo, id), parte = t.dataset.parte;
      seleccionBloque = id;
      if (parte === "simple" || parte === "pie") cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 1 };
      else if (parte === "cabeza") cursor = { padre: id, rama: "cuerpo", idx: 0 };
      else if (parte === "sino") cursor = { padre: id, rama: "sino", idx: 0 };
    }
    pintarEdicion();
  });

  // ---------- Arrastrar y soltar (bloques y pseudocódigo) ----------
  // Ratón: arrastrar más de 6 px. Táctil: mantener pulsado un bloque 0,28 s; los ladrillos de la paleta, arrastrar hacia arriba o abajo.
  let arrastre = null, suprimirClicHasta = 0;
  const $linea = document.createElement("div"); $linea.className = "soltar-linea"; $linea.hidden = true;
  function posibleArrastre(ev, fuente, el) {
    if (ejec || modo === "js" || ev.button > 0) return;
    arrastre = { fuente, el, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, activo: false, tactil: ev.pointerType !== "mouse", id: ev.pointerId };
    if (arrastre.tactil && fuente.id) arrastre.temporizador = setTimeout(() => { if (arrastre && !arrastre.activo) activarArrastre(); }, 280);
  }
  $prog.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".slot")) return;
    const f = ev.target.closest(".fila[data-id]"); if (!f) return;
    const item = $prog.querySelector(`[data-item="${f.dataset.id}"]`);
    posibleArrastre(ev, { id: f.dataset.id }, item || f);
  });
  $paleta.addEventListener("pointerdown", (ev) => {
    const l = ev.target.closest("[data-ladrillo]"); if (l) posibleArrastre(ev, { nuevo: l.dataset.ladrillo }, l);
  });
  document.addEventListener("pointermove", (ev) => {
    const a = arrastre; if (!a || ev.pointerId !== a.id) return;
    a.x = ev.clientX; a.y = ev.clientY;
    const dx = a.x - a.x0, dy = a.y - a.y0, d = Math.hypot(dx, dy);
    if (!a.activo) {
      if (!a.tactil) { if (d > 6) activarArrastre(); }
      else if (a.fuente.nuevo && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) activarArrastre();
      else if (d > 10) cancelarArrastre();
      return;
    }
    moverArrastre();
  });
  document.addEventListener("pointerup", (ev) => { if (arrastre && ev.pointerId === arrastre.id) soltarArrastre(); });
  document.addEventListener("pointercancel", (ev) => { if (arrastre && ev.pointerId === arrastre.id) cancelarArrastre(); });
  // Mientras se arrastra, el dedo no desplaza la página.
  document.addEventListener("touchmove", (ev) => {
    const a = arrastre; if (!a) return;
    if (a.activo) { ev.preventDefault(); return; }
    if (a.fuente.nuevo && ev.touches[0]) { const dx = ev.touches[0].clientX - a.x0, dy = ev.touches[0].clientY - a.y0; if (Math.abs(dy) > Math.abs(dx)) ev.preventDefault(); }
  }, { passive: false });
  document.addEventListener("click", (ev) => { if (performance.now() < suprimirClicHasta) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  function activarArrastre() {
    const a = arrastre;
    clearTimeout(a.temporizador);
    a.activo = true;
    cerrarHoja();
    const f = document.createElement("div");
    f.className = `fantasma ${a.fuente.nuevo ? $paleta.className : modo === "pseudo" ? "v-pseudo" : "v-bloques"}`;
    const muestra = a.fuente.nuevo ? a.el : (a.el.querySelector(":scope > .fila.cabeza") || a.el);
    f.appendChild(muestra.cloneNode(true));
    f.style.width = `${Math.min(muestra.getBoundingClientRect().width, 340)}px`;
    document.body.appendChild(f);
    a.fantasma = f;
    if (a.fuente.id) a.el.classList.add("arrastrando");
    $prog.appendChild($linea);
    moverArrastre();
  }
  function destinoEn(x, y) {
    const r = $prog.getBoundingClientRect();
    if (x < r.left - 40 || x > r.right + 40 || y < r.top - 30 || y > r.bottom + 30) return null;
    const excl = arrastre.fuente.id ? $prog.querySelector(`[data-item="${arrastre.fuente.id}"]`) : null;
    let mejor = null, dm = Infinity;
    for (const lista of $prog.querySelectorAll(".lista[data-padre]")) {
      if (excl && excl.contains(lista)) continue;
      const lr = lista.getBoundingClientRect(), items = [...lista.children].filter(c => c.dataset.item);
      const ys = items.length ? items.map(it => it.getBoundingClientRect().top - 2).concat(items[items.length - 1].getBoundingClientRect().bottom + 2) : [(lista.querySelector(".vacio") || lista).getBoundingClientRect().top + 14];
      ys.forEach((yy, i) => {
        const d = Math.abs(yy - y) + (x < lr.left - 6 ? 300 : 0) - lr.left * .01;
        if (d < dm) { dm = d; mejor = { padre: lista.dataset.padre, rama: lista.dataset.rama, idx: i, y: yy, x: lr.left, w: lr.width }; }
      });
    }
    return mejor;
  }
  function moverArrastre() {
    const a = arrastre;
    a.fantasma.style.transform = `translate(${a.x + 12}px, ${a.y + 10}px)`;
    const pr = $paleta.getBoundingClientRect();
    a.borrar = !!a.fuente.id && a.y >= pr.top - 8 && a.y <= pr.bottom + 8;
    $paleta.classList.toggle("borrar", a.borrar);
    a.destino = a.borrar ? null : destinoEn(a.x, a.y);
    const r = $prog.getBoundingClientRect();
    if (a.destino) {
      $linea.hidden = false;
      $linea.style.top = `${a.destino.y - r.top + $prog.scrollTop}px`;
      $linea.style.left = `${a.destino.x - r.left + $prog.scrollLeft}px`;
      $linea.style.width = `${a.destino.w}px`;
    } else $linea.hidden = true;
    if (a.y < r.top + 28 && a.y > r.top - 30) $prog.scrollTop -= 10; else if (a.y > r.bottom - 28 && a.y < r.bottom + 30) $prog.scrollTop += 10;
  }
  function limpiarArrastre(a) {
    clearTimeout(a.temporizador);
    if (a.fantasma) a.fantasma.remove();
    a.el.classList.remove("arrastrando");
    $paleta.classList.remove("borrar");
    $linea.hidden = true; $linea.remove();
  }
  function cancelarArrastre() { const a = arrastre; arrastre = null; if (a) limpiarArrastre(a); }
  function soltarArrastre() {
    const a = arrastre; arrastre = null;
    limpiarArrastre(a);
    if (!a.activo) return;  // fue un toque: lo atiende el click de siempre
    suprimirClicHasta = performance.now() + 80;
    if (a.borrar) { borrar(a.fuente.id); telemetriaUi.arrastreBloques++; return; }
    if (!a.destino) { pintarEdicion(); return; }
    const { padre, rama, idx } = a.destino;
    if (a.fuente.nuevo) insertarEn(nuevoLadrillo(a.fuente.nuevo), padre, rama, idx);
    else moverA(a.fuente.id, padre, rama, idx);
    telemetriaUi.arrastreBloques++;
  }
  function insertarEn(n, padre, rama, idx) {
    listaDe(programa.modelo, padre, rama).splice(idx, 0, n);
    seleccionBloque = n.id;
    cursor = esContenedor(n) ? { padre: n.id, rama: "cuerpo", idx: 0 } : { padre, rama, idx: idx + 1 };
    cambiado();
  }
  function moverA(id, padre, rama, idx) {
    const l = buscar(programa.modelo, id), destino = listaDe(programa.modelo, padre, rama);
    l.lista.splice(l.idx, 1);
    if (l.lista === destino && l.idx < idx) idx--;
    destino.splice(idx, 0, l.nodo);
    seleccionBloque = id;
    cursor = { padre, rama, idx: idx + 1 };
    cambiado();
  }

  // Línea en curso y errores, en la vista que toque.
  function marcarLinea(l) { lineaCorre = l; lineaErr = null; pintarMarcas(); }
  // Un bucle de sensores manda miles de mensajes: se repinta una vez por cuadro.
  let marcasSucias = false, eventosSucios = false;
  function pintarMarcas() { marcasSucias = true; }
  function pintarMarcasYa() {
    marcasSucias = false;
    if (!programa) return;
    // Vista JavaScript paralela
    const g = generar(programa.modelo);
    const lc = mapaLineas ? lineaCorre : null, le = mapaLineas ? lineaErr : null;
    $("js-pre").innerHTML = g.codigo.replace(/\n$/, "").split("\n").map((t, i) =>
      `<div class="${i + 1 === lc ? "corre" : i + 1 === le ? "err" : ""}"><span class="ln">${i + 1}</span>${escapar(t)}</div>`).join("");
    // Bloques
    $prog.querySelectorAll(".corre, .err").forEach(x => x.classList.remove("corre", "err"));
    if (modo !== "js" && mapaLineas) {
      const marca = (l, cls) => {
        const id = l && mapaLineas[l - 1]; const el = id && $prog.querySelector(`[data-nodo="${id}"]`);
        if (!el) return;
        el.classList.add(cls);
        // Desplaza solo el panel del programa, nunca la página.
        const pr = $prog.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (er.top < pr.top) $prog.scrollTop -= pr.top - er.top + 8;
        else if (er.bottom > pr.bottom) $prog.scrollTop += er.bottom - pr.bottom + 8;
      };
      marca(lineaCorre, "corre"); marca(lineaErr, "err");
    }
    if (modo === "js") pintarBanda();
  }

  // ---------- Editor de texto ----------
  const RE_ID = /[A-Za-z_$][\w$]*/y, RE_NUM = /0x[0-9a-f]+|\d*\.?\d+(?:e[+-]?\d+)?/iy;
  function lexico(src) {
    const out = []; const n = src.length; let i = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === "/" && d === "/") { let j = src.indexOf("\n", i); if (j < 0) j = n; out.push(["com", src.slice(i, j)]); i = j; continue; }
      if (c === "/" && d === "*") { let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; out.push(["com", src.slice(i, j)]); i = j; continue; }
      if (c === '"' || c === "'" || c === "`") {
        let j = i + 1;
        while (j < n) { const e = src[j]; if (e === "\\") { j += 2; continue; } if (e === c) { j++; break; } if (e === "\n" && c !== "`") break; j++; }
        j = Math.min(n, j); out.push(["str", src.slice(i, j)]); i = j; continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(d || ""))) { RE_NUM.lastIndex = i; const m = RE_NUM.exec(src); out.push(["num", m[0]]); i += m[0].length; continue; }
      if (/[A-Za-z_$]/.test(c)) { RE_ID.lastIndex = i; const m = RE_ID.exec(src); out.push(["id", m[0]]); i += m[0].length; continue; }
      if (c === "\n") { out.push(["nl", c]); i++; continue; }
      if (c === " " || c === "\t" || c === "\r") { let j = i; while (j < n && (src[j] === " " || src[j] === "\t" || src[j] === "\r")) j++; out.push(["esp", src.slice(i, j)]); i = j; continue; }
      out.push(["p", c]); i++;
    }
    return out;
  }
  let coloresCodigo = guardado.leer("colores", true) !== false;
  const PALABRAS = new Set("await async break const continue else false for if let null return true while".split(" "));
  const FUNCIONES = new Set("recoger entregar esperar cuantos log info warn error".split(" "));
  function clasificar(toks, i) {
    const [tipo, texto] = toks[i];
    if (tipo === "com" && RE_HUECO.test(texto)) return "hueco";
    return tipo === "id" ? (PALABRAS.has(texto) ? "kw" : FUNCIONES.has(texto) ? "fn" : texto === "yo" || texto === "console" ? "maq" : "") : ["str", "com", "num"].includes(tipo) ? tipo : "";
  }
  function pintarResaltado() {
    const r = $("resaltado");
    r.innerHTML = lexico($codigo.value).map(([tipo, texto], i, toks) => {
      const clase = clasificar(toks, i);
      return clase ? `<span class="${clase}">${escapar(texto)}</span>` : escapar(texto);
    }).join("") + "\n";
    r.style.width = `${$codigo.clientWidth}px`;
    r.style.transform = `translate(${- $codigo.scrollLeft}px, ${- $codigo.scrollTop}px)`;
  }
  $("editor").classList.toggle("colores", coloresCodigo);
  $("b-colores").setAttribute("aria-pressed", coloresCodigo);
  $("b-colores").addEventListener("click", () => {
    coloresCodigo = !coloresCodigo; guardado.escribir("colores", coloresCodigo);
    $("editor").classList.toggle("colores", coloresCodigo);
    $("b-colores").setAttribute("aria-pressed", coloresCodigo);
    pintarResaltado();
  });

  let alturas = [];
  function medirEditor() {
    if (modo !== "js") return;
    const lineas = $codigo.value.split("\n");
    $espejo.style.width = `${$codigo.clientWidth}px`;
    $espejo.innerHTML = lineas.map(l => `<div>${escapar(l) || " "}</div>`).join("");
    alturas = [...$espejo.children].map(d => d.getBoundingClientRect().height);
    pintarResaltado();
    $gutter.innerHTML = alturas.map((h, i) => `<div style="height:${h}px" class="${i + 1 === lineaCorre ? "corre" : i + 1 === lineaErr ? "err" : ""}">${i + 1}</div>`).join("");
    pintarBanda();
    $codigo.dispatchEvent(new Event("cmg:medido"));
  }
  function pad() { return parseFloat(getComputedStyle($codigo).paddingTop) || 10; }
  function pintarBanda() {
    if (modo !== "js") return;
    const l = lineaErr || lineaCorre;
    $banda.className = `banda ${l ? (lineaErr ? "err" : "corre") : ""}`;
    if (l && alturas.length >= l) {
      const top = alturas.slice(0, l - 1).reduce((a, b) => a + b, 0);
      $banda.style.top = `${pad() + top - $codigo.scrollTop}px`;
      $banda.style.height = `${alturas[l - 1]}px`;
    }
    [...$gutter.children].forEach((d, i) => d.className = i + 1 === lineaCorre ? "corre" : i + 1 === lineaErr ? "err" : "");
    $gutter.style.transform = `translateY(${-$codigo.scrollTop}px)`;
  }
  function irALinea(l) {
    if (!window.cmg?.edicion?.activo) $codigo.focus();
    if (!l) return;
    const lineas = $codigo.value.split("\n");
    let pos = 0; for (let i = 0; i < l - 1 && i < lineas.length; i++) pos += lineas[i].length + 1;
    $codigo.setSelectionRange(pos, pos + (lineas[l - 1] || "").length);
  }
  let tGuardar = 0, cambioModelo = false;
  $codigo.addEventListener("input", () => {
    if (cambioModelo) return;
    programa.texto = $codigo.value;
    programa.fuente = "texto";
    mapaLineas = null;
    if (lineaErr) lineaErr = null;
    medirEditor();
    clearTimeout(tGuardar); tGuardar = setTimeout(guardarPrograma, 400);
  });
  $codigo.addEventListener("scroll", () => { pintarBanda(); pintarResaltado(); });
  addEventListener("pagehide", () => { if (tGuardar) guardarPrograma(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && tGuardar) guardarPrograma(); });
  // Localiza el carácter bajo el puntero con las mismas métricas y ajuste de línea del textarea.
  // Así las comillas y los delimitadores contiguos no dependen de dónde deje el caret el navegador.
  // Se copian las propiedades sueltas: con font-variant-ligatures: none el atajo «font» calculado
  // queda vacío y el espejo heredaba la letra proporcional del body (un clic caía en otro argumento).
  const METRICAS_TEXTO = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariantLigatures", "fontFeatureSettings", "fontVariationSettings", "fontKerning",
    "lineHeight", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxSizing", "whiteSpace", "overflowWrap", "wordBreak", "tabSize", "letterSpacing", "wordSpacing", "textIndent", "textTransform"];
  function caracterCodigo(ev) {
    const r = $codigo.getBoundingClientRect(), cs = getComputedStyle($codigo), espejo = document.createElement("div");
    for (const k of METRICAS_TEXTO) espejo.style[k] = cs[k];
    Object.assign(espejo.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${$codigo.clientWidth}px`, height: `${$codigo.clientHeight}px`, overflow: "hidden", opacity: "0", pointerEvents: "none" });
    const texto = document.createTextNode($codigo.value);
    espejo.append(texto); document.body.append(espejo);
    espejo.scrollTop = $codigo.scrollTop; espejo.scrollLeft = $codigo.scrollLeft;
    const rango = document.createRange();
    let pos = $codigo.selectionStart;
    for (let i = 0; i < texto.length; i++) {
      rango.setStart(texto, i); rango.setEnd(texto, i + 1);
      if ([...rango.getClientRects()].some(c => ev.clientX >= c.left && ev.clientX < c.right && ev.clientY >= c.top && ev.clientY < c.bottom)) { pos = i; break; }
    }
    espejo.remove();
    return pos;
  }
  function rangoCodigo(pos, triple) {
    const src = $codigo.value, pila = [], pares = [];
    let offset = 0;
    for (const [tipo, txt] of lexico(src)) {
      const desde = offset; offset += txt.length;
      if (!triple && (tipo === "str" || (tipo === "com" && txt.startsWith("/*"))) && pos >= desde && pos < offset) return [desde, offset];
      if (tipo !== "p") continue;
      if ("([{".includes(txt)) pila.push({ c: txt, pos: desde });
      else if (")]}".includes(txt)) {
        const abre = pila.pop();
        if (abre && "([{".indexOf(abre.c) === ")]}".indexOf(txt)) pares.push([abre.pos, desde]);
        else pila.length = 0;
      }
    }
    if (triple) {
      // El delimitador pulsado tiene prioridad sobre cualquier par anidado que contenga.
      const par = pares.find(([a, b]) => a === pos || b === pos);
      if (par) return [par[0] + 1, par[1]];
    }
    return null;
  }
  $codigo.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0 || ev.detail < 2) return;
    const rango = rangoCodigo(caracterCodigo(ev), ev.detail >= 3);
    if (!rango) return;
    ev.preventDefault(); $codigo.setSelectionRange(...rango);
  });
  $codigo.addEventListener("dblclick", (ev) => {
    const rango = rangoCodigo(caracterCodigo(ev), false);
    if (rango) { ev.preventDefault(); $codigo.setSelectionRange(...rango); }
  });

  $codigo.addEventListener("drop", () => { telemetriaUi.arrastre++; $("editor").classList.remove("soltar"); setTimeout(seleccionarHueco, 0); });
  new ResizeObserver(() => medirEditor()).observe($codigo);
  $codigo.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab") { ev.preventDefault(); insertar("  "); }
    else if (ev.key === "/" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); alternarComentario(); }
    else if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ejec ? detener() : ejecutar(); }
    else if (ev.key === "Enter") {
      ev.preventDefault();
      const antes = $codigo.value.slice(0, $codigo.selectionStart);
      const linea = antes.slice(antes.lastIndexOf("\n") + 1);
      const sangria = linea.match(/^\s*/)[0] + (/\{\s*$/.test(linea) ? "  " : "");
      insertar("\n" + sangria);
    }
  });
  // Inserta con execCommand para que Ctrl+Z lo deshaga; si el navegador no lo permite, cambia el valor a mano.
  function insertar(texto, selDesde, selHasta) {
    if ($codigo.readOnly) return;
    const sinTeclado = window.cmg?.edicion?.activo;
    if (!sinTeclado) $codigo.focus();
    const a = $codigo.selectionStart;
    let ok = false;
    if (!sinTeclado) { try { ok = document.execCommand("insertText", false, texto); } catch { ok = false; } }
    if (!ok) {
      const v = $codigo.value, b = $codigo.selectionEnd;
      $codigo.value = v.slice(0, a) + texto + v.slice(b);
      $codigo.dispatchEvent(new Event("input"));
    }
    const p = a + (selDesde == null ? texto.length : selDesde);
    $codigo.setSelectionRange(p, selHasta == null ? p : a + selHasta);
    $codigo.dispatchEvent(new Event("cmg:seleccion"));
    return true;
  }
  // Las funciones llegan con huecos /* … */ seleccionados: el siguiente doble clic en un valor los rellena.
  const RE_HUECO = /\/\*\s*(?:material|origen|destino|lugar|segundos|condición|mensaje|valor|nombre)\s*\*\//;
  function seleccionarHueco() {
    const v = $codigo.value, p = $codigo.selectionEnd;
    const finLinea = v.indexOf("\n", p) < 0 ? v.length : v.indexOf("\n", p);
    const re = new RegExp(RE_HUECO.source, "g"); re.lastIndex = p;
    const m = re.exec(v);
    if (m && m.index < finLinea) $codigo.setSelectionRange(m.index, m.index + m[0].length);
  }
  function insertarRef(ins, fin) {
    abrirPestana("programa");
    const v = $codigo.value, a = $codigo.selectionStart, b = $codigo.selectionEnd;
    const finLinea = v.indexOf("\n", b) < 0 ? v.length : v.indexOf("\n", b);
    let texto = ins;
    if (/^".*"$/.test(texto) && v[a - 1] === '"' && v[b] === '"') texto = texto.slice(1, -1);
    if (fin && !v.slice(b, finLinea).trim()) texto += " " + fin;
    const h = texto.search(RE_HUECO);
    if (h >= 0) insertar(texto, h, h + texto.slice(h).match(RE_HUECO)[0].length);
    else { insertar(texto); seleccionarHueco(); }
  }
  // Comenta o descomenta con // las líneas elegidas; los bloques /* … */ no se tocan.
  function alternarComentario() {
    if ($codigo.readOnly) return;
    const v = $codigo.value, a = $codigo.selectionStart;
    let b = $codigo.selectionEnd;
    if (b > a && v[b - 1] === "\n") b--;
    const ini = v.lastIndexOf("\n", a - 1) + 1;
    let fin = v.indexOf("\n", b); if (fin < 0) fin = v.length;
    const lineas = v.slice(ini, fin).split("\n");
    const bloque = (l) => /^\s*(\/\*|\*)/.test(l);
    const utiles = lineas.filter(l => l.trim() && !bloque(l));
    if (!utiles.length) return;
    let nuevas;
    if (utiles.every(l => /^\s*\/\//.test(l))) nuevas = lineas.map(l => bloque(l) ? l : l.replace(/^(\s*)\/\/ ?/, "$1"));
    else {
      const min = Math.min(...utiles.map(l => l.match(/^\s*/)[0].length));
      nuevas = lineas.map(l => !l.trim() || bloque(l) ? l : l.slice(0, min) + "// " + l.slice(min));
    }
    const texto = nuevas.join("\n");
    if (!window.cmg?.edicion?.activo) $codigo.focus();
    $codigo.setSelectionRange(ini, fin);
    insertar(texto, 0, texto.length);
  }
  // Elementos envolventes: conservan la selección dentro de sus delimitadores.
  // Los bloques añaden un nivel de sangría; las expresiones mantienen el texto literal.
  function envolver(antes, despues, bloque = false) {
    const a = $codigo.selectionStart, b = $codigo.selectionEnd;
    if (a === b || $codigo.readOnly) return false;
    const v = $codigo.value, elegido = v.slice(a, b);
    let contenido = elegido, cierre = despues;
    if (bloque) {
      const ini = v.lastIndexOf("\n", a - 1) + 1;
      const prefijo = v.slice(ini, a);
      const sangria = (prefijo.trim() ? prefijo : prefijo + elegido).match(/^[ \t]*/)[0];
      if (!prefijo.trim()) antes = sangria.slice(prefijo.length) + antes;
      const saltoFinal = elegido.endsWith("\n");
      const lineas = (saltoFinal ? elegido.slice(0, -1) : elegido).split("\n");
      if (!prefijo.trim()) lineas[0] = prefijo + lineas[0];
      const utiles = lineas.filter(l => l.trim());
      const margen = utiles.length ? Math.min(...utiles.map(l => l.match(/^[ \t]*/)[0].length)) : 0;
      contenido = lineas.map(l => l.trim() ? sangria + "  " + l.slice(margen) : "").join("\n");
      cierre = despues.split("\n").map((l, i) => i ? sangria + l : l).join("\n") + (saltoFinal ? "\n" : "");
    }
    return insertar(antes + contenido + cierre, antes.length, antes.length + contenido.length);
  }
  function insertarBloque(bloque, envolvente) {
    if (envolvente && envolver(envolvente[0], envolvente[1], true)) return;
    const hSeleccion = bloque.search(RE_HUECO);
    if (hSeleccion >= 0 && envolver(bloque.slice(0, hSeleccion), bloque.slice(hSeleccion + bloque.slice(hSeleccion).match(RE_HUECO)[0].length))) return;
    const a = $codigo.selectionStart, v = $codigo.value;
    const ini = v.lastIndexOf("\n", a - 1) + 1;
    const fin = v.indexOf("\n", a) === -1 ? v.length : v.indexOf("\n", a);
    const linea = v.slice(ini, fin);
    const guia = linea.trim() ? linea : v.slice(0, ini).split("\n").slice(0, -1).reverse().find(l => l.trim()) ?? linea;
    const sangria = guia.match(/^\s*/)[0] + (/\{\s*$/.test(guia) ? "  " : "");
    const texto = bloque.split("\n").map((l, i) => (i ? sangria : "") + l).join("\n");
    const h = texto.search(RE_HUECO), hueco = texto.indexOf("\n" + sangria + "  \n");
    const pos = h >= 0 ? h : hueco === -1 ? texto.length : hueco + 1 + sangria.length + 2;
    const largo = h >= 0 ? texto.slice(h).match(RE_HUECO)[0].length : 0;
    if (!linea.trim()) { $codigo.setSelectionRange(ini, fin); insertar(sangria + texto, sangria.length + pos, sangria.length + pos + largo); }
    else { $codigo.setSelectionRange(fin, fin); insertar("\n" + sangria + texto, 1 + sangria.length + pos, 1 + sangria.length + pos + largo); }
  }
  function insertarId(id) {
    const a = $codigo.selectionStart, v = $codigo.value;
    if (v[a - 1] === '"' && v[a] === '"') insertar(id); else insertar(`"${id}"`);
  }

  // ---------- Tu reto: el enunciado y las metas los pone el jugador ----------
  const LIM = [["tiempoMax", "Tiempo máximo (s)"], ["maxDerrames", "Derrames máximos"], ["maxVacios", "Viajes vacíos máximos"]];
  let borrador = null;  // reto que se ve en el formulario, todavía sin guardar
  function pintarFormReto(d = retoActual()) {
    borrador = JSON.parse(JSON.stringify(d));
    const propioSel = retoIdx === IDX_PROPIO, dis = propioSel ? "" : "disabled";
    const ids = d.entidades.map(e => e.id);
    const sel = (k, opciones, actual, extra = "") => `<select data-k="${k}" ${extra}>${opciones.map(([v, t]) => `<option value="${escapar(v)}"${v === actual ? " selected" : ""}>${escapar(t)}</option>`).join("")}</select>`;
    $("reto-aviso").hidden = propioSel;
    $("reto-aviso").innerHTML = propioSel ? "" : `Este reto es fijo. Puedes copiarlo a «Tu reto» y cambiar el enunciado, las metas y el mapa. <button type="button" class="btn chico" id="reto-copiar">Usar como base de Tu reto</button>`;
    $("reto-form").innerHTML = `
      <fieldset ${dis}><legend>Enunciado</legend>
        <label class="campo-f">Título<input id="rf-titulo" maxlength="50" value="${escapar(d.titulo)}"></label>
        <label class="campo-f">Lo que pides (aparece arriba como objetivo)<textarea id="rf-objetivo">${escapar(d.objetivo)}</textarea></label>
        <label class="campo-f">Pista cuando falle<input id="rf-pista" value="${escapar(d.pista || "")}"></label>
      </fieldset>
      <fieldset ${dis}><legend>Metas: lo que tiene que salir</legend>
        <div class="filas-f">${d.metas.map((m, i) => `<div class="fila-f" data-meta="${i}">
          <label class="campo-f">Tipo${sel("tipo", [["entregar", "llegar a"], ["vaciar", "vaciar"]], m.tipo === "vaciar" ? "vaciar" : "entregar")}</label>
          <label class="campo-f">Edificio${sel("id", ids.map(x => [x, x]), m.id)}</label>
          <label class="campo-f">Material${sel("mat", MATERIALES.map(x => [x, x]), m.mat)}</label>
          <label class="campo-f">Cantidad<input data-k="n" type="number" min="1" max="30" value="${m.n ?? ""}" ${m.tipo === "vaciar" ? "disabled" : ""}></label>
          <button type="button" class="btn chico" data-quitar-meta="${i}">Quitar</button></div>`).join("")}</div>
        <div><button type="button" class="btn chico" id="rf-mas-meta">+ Meta</button></div>
        <div class="dos">${LIM.map(([k, t]) => `<label class="campo-f">${t} (vacío = sin límite)<input id="rf-${k}" type="number" min="0" value="${d[k] ?? ""}"></label>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>Mapa</legend>
        ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label class="campo-f">Partir del mapa de${sel("base", RETOS.map((r, i) => [String(i), `${i + 1} · ${r.titulo}`]), "", 'id="rf-base"')}</label><button type="button" class="btn chico" id="rf-cambiar-mapa">Cambiar mapa</button></div>` : ""}
        <div class="filas-f">${d.entidades.map((e, i) => `<div class="fila-f" data-ent="${i}">
          <label class="campo-f">${e.tipo === "bodega" ? "Bodega" : "Máquina"}<input data-k="id" maxlength="8" value="${escapar(e.id)}"></label>
          ${e.tipo === "bodega"
            ? MATERIALES.map(m => `<label class="campo-f">${m}<input data-k="stock-${m}" type="number" min="0" max="30" value="${e.stock[m] ?? ""}" placeholder="—"></label>`).join("") + `<label class="check"><input type="checkbox" data-k="oculto"${e.oculto ? " checked" : ""}> tapada</label>`
            : `<label class="campo-f">Acepta${sel("acepta", MATERIALES.map(x => [x, x]), e.acepta)}</label><label class="campo-f">Huecos<input data-k="cap" type="number" min="1" max="8" value="${e.cap}"></label><label class="campo-f">s por pieza<input data-k="tProceso" type="number" min="0.5" max="30" step="0.5" value="${e.tProceso}"></label>`}
        </div>`).join("")}</div>
      </fieldset>
      <fieldset ${dis}><legend>Bloques disponibles</legend>
        <div style="display:flex;gap:4px 14px;flex-wrap:wrap">${["recoger", "entregar", "repetir", "esperar", "mientras", "si"].map(t => `<label class="check"><input type="checkbox" data-ladrillo-f="${t}"${d.ladrillos.includes(t) ? " checked" : ""}> ${escapar(TXT.es.paleta[t])}</label>`).join("")}</div>
      </fieldset>
      ${propioSel ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn primario" id="rf-guardar">Guardar y jugar</button>
        <button type="button" class="btn" id="rf-json-copiar">Copiar JSON</button>
      </div>
      <details class="json"><summary>Pegar un reto en JSON</summary>
        <textarea class="json" id="rf-json" aria-label="Reto en JSON"></textarea>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn chico" id="rf-json-aplicar">Aplicar</button><span class="fila-bajo" id="rf-json-msg"></span></div>
      </details>` : ""}`;
  }
  function leerFormReto() {
    const d = borrador, v = (id) => $(id).value;
    d.titulo = v("rf-titulo").trim() || "Tu reto"; d.objetivo = v("rf-objetivo").trim(); d.pista = v("rf-pista").trim();
    for (const [k] of LIM) d[k] = v(`rf-${k}`) === "" ? null : Number(v(`rf-${k}`));
    d.metas = [...document.querySelectorAll("#reto-form [data-meta]")].map(f => {
      const g = (k) => f.querySelector(`[data-k="${k}"]`).value;
      return g("tipo") === "vaciar" ? { tipo: "vaciar", id: g("id"), mat: g("mat") } : { id: g("id"), mat: g("mat"), n: Number(g("n")) || 1 };
    });
    document.querySelectorAll("#reto-form [data-ent]").forEach(f => {
      const e = d.entidades[+f.dataset.ent], g = (k) => f.querySelector(`[data-k="${k}"]`);
      const viejo = e.id, nuevo = g("id").value.trim().toUpperCase() || viejo;
      e.id = nuevo;
      for (const m of d.metas) if (m.id === viejo) m.id = nuevo;
      if (e.tipo === "bodega") {
        e.stock = {}; for (const m of MATERIALES) { const x = g(`stock-${m}`).value; if (x !== "") e.stock[m] = Number(x); }
        e.oculto = g("oculto").checked || undefined;
      } else { e.acepta = g("acepta").value; e.cap = Number(g("cap").value); e.tProceso = Number(g("tProceso").value); }
    });
    d.ladrillos = [...document.querySelectorAll("#reto-form [data-ladrillo-f]")].filter(x => x.checked).map(x => x.dataset.ladrilloF);
    return normalizarReto(d);
  }
  function guardarPropio(d) {
    propio = d; guardado.escribir("propio", propio);
    elegirReto(IDX_PROPIO); abrirPestana("reto");
  }
  $("v-reto").addEventListener("click", (ev) => {
    const t = ev.target, id = t.id;
    if (t.dataset.quitarMeta != null) { const d = leerFormReto(); d.metas.splice(+t.dataset.quitarMeta, 1); pintarFormReto(d); return; }
    if (id === "rf-mas-meta") { const d = leerFormReto(); d.metas.push({ id: d.entidades.find(e => e.tipo === "maquina")?.id || d.entidades[0].id, mat: "cobre", n: 2 }); pintarFormReto(d); return; }
    if (id === "rf-cambiar-mapa") {
      const r = RETOS[+$("rf-base").value], d = leerFormReto();
      pintarFormReto(normalizarReto({ ...d, entidades: JSON.parse(JSON.stringify(r.entidades)), robot: r.robot, metas: JSON.parse(JSON.stringify(r.metas)) }));
      return;
    }
    if (id === "rf-guardar") { guardarPropio(leerFormReto()); abrirPestana("programa"); return; }
    if (id === "reto-copiar") {
      const r = retoActual();
      guardado.escribir(`prog-${IDX_PROPIO}`, programa);
      guardarPropio(normalizarReto({ ...JSON.parse(JSON.stringify(r)), titulo: `${r.titulo} (mío)` }));
      return;
    }
    if (id === "rf-json-copiar") {
      const txt = JSON.stringify(leerFormReto(), null, 2);
      const plan = () => { $("rf-json").value = txt; $("rf-json").closest("details").open = true; $("rf-json").select(); };
      try { navigator.clipboard.writeText(txt).then(() => { t.textContent = "Copiado"; setTimeout(() => t.textContent = "Copiar JSON", 1500); }, plan); } catch { plan(); }
      return;
    }
    if (id === "rf-json-aplicar") {
      try { guardarPropio(normalizarReto(JSON.parse($("rf-json").value))); }
      catch (e) { $("rf-json-msg").textContent = `No es un JSON válido: ${e.message}`; }
    }
  });
  $("v-reto").addEventListener("change", (ev) => {
    // «Vaciar» no lleva cantidad.
    if (ev.target.dataset.k === "tipo") { const n = ev.target.closest("[data-meta]").querySelector('[data-k="n"]'); n.disabled = ev.target.value === "vaciar"; }
  });

  // ---------- Adaptador de Factory para las herramientas compartidas ----------
  const FIRMAS = { recoger: ["origen", "material"], entregar: ["destino"], cuantos: ["lugar", "material"], esperar: ["segundos"], log: ["mensaje"], info: ["mensaje"], warn: ["mensaje"], error: ["mensaje"] };
  function sugerencias(c) {
    const clase = c.hueco || (c.tipo === "argumento" ? FIRMAS[c.funcion]?.[c.indice] : c.tipo === "condicion" ? "condición" : c.tipo === "valor" ? "valor" : null);
    if (!clase) return null;
    const it = (ins, cls = "str", nota = "") => ({ ins, cls, nota });
    const vars = (c.variables || []).map(v => it(v, "var", "variable del programa"));
    const lugares = mundo.entidades.filter(e => clase !== "origen" || e.tipo === "bodega");
    const sensores = mundo.entidades.map(e => it(`await yo.cuantos(${JSON.stringify(e.id)}, "cobre")`, "fn", e.id));
    let grupos;
    if (["origen", "destino", "lugar"].includes(clase)) grupos = [{ items: lugares.map(e => it(JSON.stringify(e.id), "str", e.tipo === "bodega" ? "bodega" : `acepta ${e.acepta}`)) }];
    else if (clase === "material") grupos = [{ items: MATERIALES.map(m => it(JSON.stringify(m))) }];
    else if (clase === "segundos") grupos = [{ items: [0.1, 0.5, 1, 2, 3, 5].map(n => it(String(n), "num", "segundos de juego")) }];
    else if (clase === "condición") grupos = [
      { titulo: "Stock e inventario", items: mundo.entidades.map(e => it(`await yo.cuantos(${JSON.stringify(e.id)}, "cobre") > 0`, "fn", e.id)) },
      { titulo: "Combinar", items: [it("true", "kw"), ...["&&", "||", "===", "!==", ">", "<"].map(op => it(`/* valor */ ${op} /* valor */`, "op", op))] },
    ];
    else if (clase === "mensaje") grupos = [{ titulo: "Textos", items: [it('"Viaje terminado"'), it('"Sin material"')] }, { titulo: "Sensores", items: sensores }];
    else if (clase === "valor") grupos = [{ titulo: "Sensores", items: sensores }, { titulo: "Valores", items: [0, 1, 2, 3, 5].map(n => it(String(n), "num")) }];
    else if (clase === "nombre") grupos = [{ items: [it("cantidad", "var"), it("resultado", "var")] }];
    else return null;
    return { titulo: clase, grupos: [...grupos, { titulo: "Del programa", items: vars }] };
  }
  function restaurarDocumento(texto) {
    programa = JSON.parse(texto);
    programa.modelo = raizDe(programa.modelo.cuerpo);
    cursor = { padre: "raiz", rama: "cuerpo", idx: programa.modelo.cuerpo.length };
    seleccionBloque = null;
    $codigo.value = programa.texto;
    aplicarModo(modo, true);
    guardarPrograma();
  }
  let copiaModelo = null, seleccionHija = null;
  function accionModelo(id) {
    // El historial compartido guarda modelo y texto juntos; también sirve tras cambiar de vista.
    if (["deshacer", "rehacer"].includes(id)) return false;
    if (ejec) return "Detén el programa para editarlo.";
    const l = seleccionBloque && buscar(programa.modelo, seleccionBloque);
    if (id === "pegar") {
      if (!copiaModelo) return "Copia primero un bloque de Factory.";
      agregarNodo(conIds([JSON.parse(copiaModelo)])[0]); return true;
    }
    if (!l) return "Elige primero un bloque del programa.";
    if (id === "copiar" || id === "cortar") {
      copiaModelo = JSON.stringify(l.nodo);
      if (id === "cortar") borrar(l.nodo.id);
    } else if (id === "borrar") borrar(l.nodo.id);
    else if (id === "duplicar") duplicar(l.nodo.id);
    else if (id === "subir" || id === "bajar") mover(l.nodo.id, id === "subir" ? -1 : 1);
    else if (id === "ampliar" && l.padre !== "raiz") { seleccionHija = seleccionBloque; seleccionBloque = l.padre; pintarEdicion(); }
    else if (id === "reducir" && seleccionHija && buscar(programa.modelo, seleccionHija)) { seleccionBloque = seleccionHija; seleccionHija = null; pintarEdicion(); }
    return true;
  }

  // ---------- Arranque ----------
  window.cmg = {
    codigo: $codigo, insertar, envolver, alternarComentario, medirEditor, abrirPestana,
    prefijoUI: "cmg-banco02-ui-", lexico, clasificar, sugerencias, firma: f => FIRMAS[f] || null, reHueco: RE_HUECO,
    aviso, alDesplazar: pintarBanda, alternarEjecucion: () => ejec ? detener() : ejecutar(),
    get claveDocumento() { return `reto-${retoIdx}`; },
    // Los ids de pantalla se regeneran al cargar un reto; no forman parte del documento.
    capturarDocumento: () => JSON.stringify(programa, (k, v) => k === "id" ? undefined : v), restaurarDocumento,
    seudo: { get activo() { return modo !== "js"; }, accion: accionModelo },
    get modo() { return modo; }, get ejecutando() { return !!ejec; },
  };
  window.__banco = { elegirReto, aplicarModo, abrirPestana, get seleccionMapa() { return seleccionMapa; }, get mundo() { return mundo; }, get programa() { return programa; }, generar, parsear, RETOS }; // para depurar desde la consola
  aplicarLetra();
  elegirReto(retoIdx);
  document.fonts && document.fonts.ready.then(() => { metasClave = ""; medirEditor(); });
  requestAnimationFrame(bucle);
})();
