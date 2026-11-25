import { anotarSuceso, adjuntarSucesos } from '../../nucleo/index.js';

// Producción local de H0. Los checkpoints conservan los campos de la primera versión.
const VERSION = 1;
/** @type {Record<string, { entra: Record<string, number>, sale: string, t: number }>} */
export const RECETAS = { nose: { entra: { steel: 1 }, sale: "nose", t: 2 } };
export const MAQUINAS = { prensa: { recetas: ["nose"], entrada: 4, salida: 3, kw: 2 } };
export const ARSENAL = { cap: 40 };
const esMaquina = e => Object.hasOwn(MAQUINAS, e.clase);
const esRobot = e => e.clase === "obrero" || e.clase === "montacargas";

// ---------- Estado ----------
function estadoInicial(def) {
  const unidades = def.unidades.map(d => {
    const u = JSON.parse(JSON.stringify(d));
    if (esRobot(u)) Object.assign(u, { carga: null, tarea: null, rumbo: 0, st: { encargos: 0, metros: 0 } });
    if (esMaquina(u)) Object.assign(u, {
      receta: MAQUINAS[u.clase].recetas[0], marcha: true, entrada: {}, salida: [], proceso: null, cambio: null, enVilo: false,
      luz: null, hechos: 0, st: { ciclos: 0, tTrabajo: 0, tBloqueo: 0, tSinMaterial: 0 },
    });
    if (u.clase === "arsenal") Object.assign(u, { misiles: 0, porBanda: 0, aMano: 0 });
    return u;
  });
  return {
    version: VERSION, nivel: def.clave, rev: def.revision, t: 0, hito: 0, completado: false, hitosT: [],
    presupuesto: def.presupuesto, gastado: 0, ingresado: 0,
    unidades, tarimas: [], sigTarima: 1, sigMisil: 1, tSuministro: 0, salva: null,
    misiles: [], explosiones: [], producidos: {}, pedidos: 0,
  };
}
// Lo que se guarda: el estado tal cual, sin tareas a medias (al volver no hay programas esperándolas).
const CAMPOS = ["version", "nivel", "rev", "t", "hito", "completado", "hitosT", "presupuesto", "gastado", "ingresado", "unidades", "tarimas", "sigTarima", "sigMisil", "tSuministro", "producidos", "pedidos"];
export function serializar(m) {
  const e = JSON.parse(JSON.stringify(Object.fromEntries(CAMPOS.map(k => [k, m[k]]))));
  for (const u of e.unidades) if (esRobot(u)) u.tarea = null;
  return e;
}

export function restaurar(guardado, def) {
  const valido = !!guardado && guardado.version === VERSION && guardado.nivel === def.clave && guardado.rev === def.revision && Array.isArray(guardado.unidades);
  const m = valido ? { ...serializar(guardado), salva: null, misiles: [], explosiones: [] } : estadoInicial(def);
  Object.assign(m, {
    serie: "campaign-v2", def, activo: false,
    porId: Object.fromEntries(m.unidades.map(u => [u.id, u])),
    estaciones: m.unidades.filter(esMaquina),
    maquinas: m.unidades, robots: m.unidades.filter(esRobot),
    arsenal: m.unidades.find(u => u.clase === "arsenal"),
  });
  for (const u of m.unidades) { u.presente = true; u.encendida = true; }
  adjuntarSucesos(m);
  return m;
}
export function metas(m) {
  return m.def.hitos[0].metas.map(meta => {
    const valor = m.porId[meta.lugar].misiles;
    return { ...meta, valor, cumplida: valor >= meta.n };
  });
}

function tiene(q, R) { for (const [p, n] of Object.entries(R.entra)) if ((q.entrada[p] || 0) < n) return false; return true; }
export function pasoMaquina(m, q, dt, factor, recetas = RECETAS) {
  if (!q.encendida || q.enVilo) return;
  if (q.cambio) {
    q.cambio.falta -= dt;
    if (q.cambio.falta <= 1e-9) { q.receta = q.cambio.a; q.cambio = null; }
    return;
  }
  if (q.proceso) {
    q.proceso.prog += dt * factor; q.st.tTrabajo += dt;
    const R = recetas[q.proceso.receta];
    if (q.proceso.prog >= R.t - 1e-9) {
      q.salida.push(R.sale); q.hechos++; q.st.ciclos++; q.proceso = null;
      m.producidos[R.sale] = (m.producidos[R.sale] || 0) + 1;
      anotarSuceso(m, "produccion", q.id, { pieza: R.sale, hechos: q.hechos });
    }
  }
  if (!q.proceso && q.marcha) {
    const R = recetas[q.receta];
    if (q.salida.length >= MAQUINAS[q.clase].salida) q.st.tBloqueo += dt;
    else if (!tiene(q, R)) q.st.tSinMaterial += dt;
    else {
      for (const [p, n] of Object.entries(R.entra)) q.entrada[p] -= n;
      q.proceso = { receta: q.receta, prog: 0 };
    }
  }
}
