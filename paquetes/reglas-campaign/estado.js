import { adjuntarSucesos } from '../nucleo/index.js';

/* Campaign · reglas del nivel: una fábrica continua que avanza por hitos.
 * Sin DOM ni reloj real: paso fijo y estado en datos planos (se guarda tal cual en los checkpoints).
 * Lo cargan el juego y las pruebas de node (pruebas/campaign-reglas.cjs).
 *
 * Tres clases de órdenes, como en el resto del juego:
 *   encargos (tardan y se esperan): pickUp, deliver, goTo · modos (al instante): start, stop,
 *   setRecipe, light, request · lecturas (no avanzan el reloj): count y las propiedades. */
export const VERSION = 1;
export const TARIMA_CAP = 12;
export const ROBOT = { obrero: { vel: 4, op: 0.5 }, montacargas: { vel: 3, op: 1.2, cargaMax: 2 } };
// Tamaño de cada pieza: las ranuras de la ensambladora van por clase (S, M, L).
export const PIEZAS = {
  steel: { nombre: "acero", clase: "M", crudo: true },
  polymer: { nombre: "polímero", clase: "M", crudo: true },
  nose: { nombre: "ojiva", clase: "M" },
  base: { nombre: "base con aletas", clase: "L" },
  charge: { nombre: "carga química", clase: "S" },
  motor: { nombre: "motor", clase: "L" },
  missile: { nombre: "misil", clase: "L" },
};
export const RECETAS = {
  nose: { entra: { steel: 1 }, sale: "nose", t: 2 },
  base: { entra: { polymer: 1 }, sale: "base", t: 6 },
  charge: { entra: { polymer: 1 }, sale: "charge", t: 4.5 },
  motor: { entra: { base: 1, charge: 1 }, sale: "motor", t: 4 },
  missile: { entra: { nose: 1, motor: 1 }, sale: "missile", t: 5 },
};
// Máquinas especializadas: entrada por cantidad. Ensambladora: ranuras por clase de tamaño.
export const MAQUINAS = {
  prensa: { nombre: "Prensa", recetas: ["nose"], entrada: 4, salida: 3, kw: 2, peso: 1.6 },
  moldeadora: { nombre: "Moldeadora", recetas: ["base"], entrada: 3, salida: 3, kw: 3, peso: 1.8 },
  mezcladora: { nombre: "Mezcladora", recetas: ["charge"], entrada: 3, salida: 3, kw: 3, peso: 1.2 },
  ensambladora: { nombre: "Ensambladora", recetas: ["motor", "missile"], ranuras: { S: 4, M: 2, L: 2 }, salida: 2, kw: 5, peso: 4.5, cambio: 6 },
};
export const BANDA = { vel: 1.2, paso: 1, kw: 1 };
export const COSTE = { steel: 40, polymer: 60 };
export const PEDIDO = { n: TARIMA_CAP, espera: 8, programada: 3, cola: 2 };
export const ARSENAL = { cap: 40, pago: 35, suministro: 1.5 };
export const TORRETA = { cap: 4, cadencia: 0.7, vel: 14, alto: 1.7 };
export const LUCES = ["green", "amber", "red", "off"];
export const HITO_MAESTRO = 4;
export const r2 = v => Math.round(v * 100) / 100;
export const esMaquina = e => !!e && Object.hasOwn(MAQUINAS, e.clase);
export const esRobot = e => !!e && Object.hasOwn(ROBOT, e.clase);

// ---------- Estado ----------
function estadoInicial(def) {
  const unidades = def.unidades.map(d => {
    const u = JSON.parse(JSON.stringify(d));
    if (esRobot(u)) Object.assign(u, { carga: null, tarea: null, rumbo: 0, st: { encargos: 0, metros: 0 } });
    if (esMaquina(u)) Object.assign(u, {
      receta: MAQUINAS[u.clase].recetas[0], marcha: true, entrada: {}, salida: [], proceso: null, cambio: null, enVilo: false,
      luz: null, hechos: 0, st: { ciclos: 0, tTrabajo: 0, tBloqueo: 0, tSinMaterial: 0 },
    });
    if (u.clase === "banda") Object.assign(u, { cx: (u.x0 + u.x1) / 2, cy: (u.y0 + u.y1) / 2, largo: Math.hypot(u.x1 - u.x0, u.y1 - u.y0), marcha: false, piezas: [], st: { movidos: 0 } });
    if (u.clase === "lugar" || u.clase === "bahia") u.tarima = null;
    if (u.clase === "bahia") u.pedidos = [];
    if (u.clase === "pad") u.maquina = null;
    if (u.clase === "arsenal") Object.assign(u, { misiles: 0, porBanda: 0, aMano: 0 });
    if (u.clase === "torreta") Object.assign(u, { misiles: 0, yaw: 0, lanzados: 0 });
    return u;
  });
  const e = {
    version: VERSION, nivel: def.clave, rev: def.revision, t: 0, hito: 0, completado: false, hitosT: [],
    presupuesto: def.presupuesto, gastado: 0, ingresado: 0,
    unidades, tarimas: [], sigTarima: 1, sigMisil: 1, tSuministro: 0, salva: null,
    misiles: [], explosiones: [], producidos: {}, pedidos: 0,
  };
  const porId = Object.fromEntries(unidades.map(u => [u.id, u]));
  for (const u of unidades) {
    if (esMaquina(u) && u.pad) { const p = porId[u.pad]; p.maquina = u.id; u.cx = p.cx; u.cy = p.cy; }
    if (u.tarimaInicial) { const t = { id: `T${e.sigTarima++}`, piezas: [], en: u.id }; e.tarimas.push(t); u.tarima = t.id; }
  }
  for (const g of (def.hitos[0].alEmpezar || {}).entregas || []) {
    const l = porId[g.lugar], t = { id: `T${e.sigTarima++}`, piezas: Array(g.n).fill(g.pieza), en: l.id };
    e.tarimas.push(t); l.tarima = t.id;
  }
  return e;
}
// Lo que se guarda: el estado tal cual, sin tareas a medias (al volver no hay programas esperándolas).
const CAMPOS = ["version", "nivel", "rev", "t", "hito", "completado", "hitosT", "presupuesto", "gastado", "ingresado", "unidades", "tarimas", "sigTarima", "sigMisil", "tSuministro", "producidos", "pedidos"];
export function serializar(m) {
  const e = JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS.map(k => [k, m[k]]))));
  for (const u of e.unidades) if (esRobot(u)) u.tarea = null;
  return e;
}

export function crear(def, guardado) {
  const valido = !!guardado && guardado.version === VERSION && guardado.nivel === def.clave && guardado.rev === def.revision && Array.isArray(guardado.unidades);
  const m = valido ? { ...serializar(guardado), salva: null, misiles: [], explosiones: [] } : estadoInicial(def);
  Object.assign(m, {
    serie: "campaign", def, activo: false, fin: null, energia: { max: def.energia, uso: 0, factor: 1 },
    // Colecciones que la aplicación común espera de cualquier mundo.
    lanzadores: [], sensores: [], reparadores: [], enemigos: [], pendientes: [], colaReparar: [], derribados: [],
    eventos: [], uso: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 },
  });
  indexar(m);
  adjuntarSucesos(m);
  return m;
}
// Presencia y encendido salen del hito: las estaciones existen apagadas y se encienden al llegar su hito.
export function indexar(m) {
  const def = m.def, con = new Set(Object.keys(def.inicial));
  m.porId = {};
  for (const u of m.unidades) {
    const desde = u.desde ?? 0;
    u.presente = !(u.clase === "obrero" || u.clase === "banda") || m.hito >= desde;
    u.encendida = m.hito >= desde;
    m.porId[u.id] = u;
  }
  m.maquinas = m.unidades.filter(u => u.presente);
  m.programables = m.maquinas.filter(u => con.has(u.id) && u.encendida);
  m.robots = m.maquinas.filter(esRobot);
  m.estaciones = m.maquinas.filter(esMaquina);
  m.lotes = m.unidades.filter(u => u.clase === "lugar" && u.tipo === "lot");
  m.banda = m.unidades.find(u => u.clase === "banda");
  m.bahia = m.unidades.find(u => u.clase === "bahia");
  m.arsenal = m.unidades.find(u => u.clase === "arsenal");
  m.torretas = m.unidades.filter(u => u.clase === "torreta");
  m.tarimaPorId = Object.fromEntries(m.tarimas.map(t => [t.id, t]));
}

// ---------- Lecturas comunes ----------
const contar = (lista, pieza) => { let n = 0; for (const p of lista) if (p === pieza) n++; return n; };
export const tarimaDe = (m, l) => l && l.tarima ? m.tarimaPorId[l.tarima] : null;
/** @param {import('./index.js').Unidad} q */
export const totalEntrada = q => Object.values(q.entrada).reduce((a, n) => a + n, 0);
export function capSalida(q) { return MAQUINAS[q.clase].salida; }
export function estadoMaquina(q) {
  if (!q.encendida) return "off";
  if (q.enVilo) return "moving";
  if (q.cambio) return "changeover";
  if (q.proceso) return "working";
  if (!q.marcha) return "stopped";
  if (q.salida.length >= capSalida(q)) return "blocked";
  return "idle";
}
// Cuántas piezas de ese tipo hay en un lugar. null: el lugar no existe (0: existe y no tiene).
export function cuantos(m, id, pieza) {
  const e = m.porId[id];
  if (!e || !e.presente) return null;
  if (e.clase === "lugar" || e.clase === "bahia") { const t = tarimaDe(m, e); return t ? contar(t.piezas, pieza) : 0; }
  if (esMaquina(e)) return contar(e.salida, pieza) + (e.entrada[pieza] || 0);
  if (e.clase === "banda") return contar(e.piezas.map(x => x.pieza), pieza);
  if (e.clase === "arsenal" || e.clase === "torreta") return pieza === "missile" ? e.misiles : 0;
  if (esRobot(e)) return e.carga === pieza ? 1 : 0;
  return 0;
}
export const enLotes = (m, pieza) => m.lotes.reduce((a, l) => a + (cuantos(m, l.id, pieza) || 0), 0);
function valorMeta(m, meta) {
  if (meta.tipo === "en") return cuantos(m, meta.lugar, meta.pieza) || 0;
  if (meta.tipo === "lotes") return enLotes(m, meta.pieza);
  if (meta.tipo === "banda") return m.arsenal.porBanda;
  return 0;
}
// Las metas del hito en curso (o del último, ya cumplido, al terminar el nivel).
export function metas(m) {
  const h = m.def.hitos[m.hito];
  return h.metas.map(meta => { const valor = valorMeta(m, meta); return { ...meta, valor, cumplida: m.completado || valor >= meta.n }; });
}

// Lo que ven los programas al despertar. Datos planos: viaja a los workers.
export function instantanea(m) {
  const u = {};
  for (const e of m.maquinas) {
    /** @type {import('./index.js').Lectura} */
    let d;
    if (e.clase === "obrero") d = { k: "robot", cargo: e.carga, busy: !!e.tarea };
    else if (e.clase === "montacargas") d = { k: "carretilla", cargo: e.carga ? (e.carga.tipo === "tarima" ? "pallet" : e.carga.id) : null, busy: !!e.tarea };
    else if (esMaquina(e)) {
      const c = MAQUINAS[e.clase];
      d = { k: "maquina", on: e.encendida, input: totalEntrada(e), output: e.salida.length, outputFull: e.salida.length >= c.salida, state: estadoMaquina(e),
        recipe: e.cambio ? e.cambio.a : e.receta, made: e.hechos, running: e.marcha, recetas: c.recetas, tiene: { ...e.entrada }, sale: [...e.salida] };
    } else if (e.clase === "lugar" || e.clase === "bahia") {
      const t = tarimaDe(m, e);
      d = { k: e.clase, pallet: !!t, items: t ? t.piezas.length : 0, free: t ? TARIMA_CAP - t.piezas.length : 0, tiene: t ? [...t.piezas] : [] };
      if (e.clase === "bahia") d.pending = e.pedidos.length;
    } else if (e.clase === "pad") d = { k: "pad", free: !e.maquina, machine: e.maquina };
    else if (e.clase === "pila") d = { k: "pila" };
    else if (e.clase === "banda") d = { k: "banda", on: e.encendida, items: e.piezas.length, running: e.marcha, state: !e.encendida ? "off" : e.marcha ? "running" : "stopped" };
    else if (e.clase === "arsenal") d = { k: "arsenal", missiles: e.misiles, received: e.porBanda + e.aMano };
    else if (e.clase === "torreta") d = { k: "torreta", missiles: e.misiles };
    else if (e.clase === "control") d = { k: "control", on: e.encendida, power: { used: m.energia.uso, max: m.energia.max }, budget: m.presupuesto, milestone: m.def.hitos[m.hito].clave };
    if (d) { if (Object.hasOwn(m.def.inicial, e.id)) d.prog = true; u[e.id] = d; }
  }
  return { t: r2(m.t), u, maestro: m.hito >= HITO_MAESTRO ? "CTL-01" : null, presupuesto: m.presupuesto, coste: COSTE, piezas: Object.keys(PIEZAS), luces: LUCES };
}

