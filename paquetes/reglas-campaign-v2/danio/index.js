/* Daño por componentes y recuperación de material (P8; consolidado del 23-nov, 7.1–7.5, 8.2 y 13.B).
 * Versión mínima sin vóxeles: cada componente tiene masa, integridad y una caja aproximada. Un ataque abstracto
 * (explosivo, preciso o corrosivo) quita masa y función según la distancia a cada caja, y el resultado se lee en
 * cuatro categorías trazables: reutilizable, fragmento, chatarra y perdido.
 *
 * Contabilidad exacta: las masas van en gramos enteros, así que la suma de las cuatro categorías es siempre la masa
 * original, sin errores de redondeo (12.2, invariantes 1 y 6). Es determinista y no depende de la malla ni de los
 * efectos: la vista solo lee `historial` y los componentes (8.1, invariante 7). */

/** Integridad mínima para que un componente cuente como reutilizable y su función siga viva. */
export const UMBRAL_FUNCION = 0.5;
/** Por debajo de esta integridad, las uniones del componente se rompen. */
export const UMBRAL_UNION = 0.3;
/** Un resto menor que esta fracción de la masa original se pierde entero (no quedan astillas eternas). */
const ASTILLA = 0.02;

/** Perfiles abstractos (7.1), no bonos fijos: cuánta masa (`masa`) y cuánta función (`funcion`) quita cada unidad de
 * intensidad, qué parte de lo arrancado queda como chatarra, y el radio en metros. El preciso solo alcanza al
 * componente más cercano. */
export const PERFILES = {
  explosivo: { radio: 1.4, masa: 0.5, funcion: 1.0, chatarra: 0.6 },
  preciso: { radio: 0.3, masa: 0.06, funcion: 1.2, chatarra: 0, unico: true },
  corrosivo: { radio: 0.7, masa: 0.12, funcion: 0.2, chatarra: 0.5 },
};

export { VEHICULOS } from './vehiculos.js';

const gramos = kg => Math.round(kg * 1000);

/** Restos vivos de un vehículo: el estado mutable que reciben los ataques.
 * @param {import('./vehiculos.js').Vehiculo} def */
export function crearRestos(def) {
  const componentes = def.componentes.map(c => ({ id: c.id, tipo: c.tipo, material: c.material, caja: c.caja,
    dureza: c.dureza ?? 1, masa0: gramos(c.kg), masa: gramos(c.kg), integridad: 1, chatarra: 0, perdido: 0 }));
  return { clase: def.clase, componentes, porId: Object.fromEntries(componentes.map(c => [c.id, c])),
    uniones: def.uniones.map(([a, b]) => ({ a, b, rota: false })), funciones: def.funciones,
    masa0: componentes.reduce((s, c) => s + c.masa0, 0), historial: [], recogido: false };
}

/** Distancia (m) de un punto a la caja de un componente; 0 si cae dentro. */
export function distanciaACaja([x, y, z], [cx, cy, cz, l, a, h]) {
  const dx = Math.max(Math.abs(x - cx) - l / 2, 0), dy = Math.max(Math.abs(y - cy) - a / 2, 0);
  const dz = Math.max(Math.abs(z - cz) - h / 2, 0);
  return Math.hypot(dx, dy, dz);
}

/**
 * Aplica un ataque y devuelve sus efectos por componente. Un componente sin masa no genera nada: repetir el golpe
 * sobre algo ya destruido no crea botín (12.3).
 * @param {ReturnType<typeof crearRestos>} r
 * @param {{ perfil: keyof typeof PERFILES, punto: [number, number, number], energia?: number }} ataque
 */
export function golpear(r, { perfil, punto, energia = 1 }) {
  const P = PERFILES[perfil];
  if (!P) throw new Error(`Perfil de ataque desconocido: ${perfil}`);
  let alcanzados = r.componentes.filter(c => c.masa > 0).map(c => ({ c, d: distanciaACaja(punto, c.caja) }))
    .filter(({ d }) => d <= P.radio);
  if (P.unico && alcanzados.length) {
    const cerca = Math.min(...alcanzados.map(x => x.d));
    alcanzados = [alcanzados.find(x => x.d === cerca)];
  }
  const efectos = [];
  for (const { c, d } of alcanzados) {
    const intensidad = energia * (1 - d / P.radio) / c.dureza;
    const fraccion = Math.min(1, P.masa * intensidad);
    let quitar = fraccion >= 1 ? c.masa : Math.floor(c.masa * fraccion);
    if (c.masa - quitar < c.masa0 * ASTILLA) quitar = c.masa;
    const chatarra = Math.floor(quitar * P.chatarra), perdido = quitar - chatarra;
    c.masa -= quitar; c.chatarra += chatarra; c.perdido += perdido;
    // La función nunca supera la fracción de masa que queda: medio motor no rinde como uno entero.
    c.integridad = c.masa === 0 ? 0 : Math.min(Math.max(0, c.integridad - P.funcion * intensidad), c.masa / c.masa0);
    efectos.push({ id: c.id, quitar, chatarra, perdido, integridad: c.integridad });
  }
  for (const u of r.uniones) if (!u.rota && [u.a, u.b].some(id => r.porId[id].integridad < UMBRAL_UNION)) u.rota = true;
  const suceso = { perfil, punto: [...punto], energia, efectos };
  r.historial.push(suceso);
  return suceso;
}

/** Grupos de componentes con masa que siguen unidos, del más pesado al más ligero. */
export function fragmentos(r) {
  const vivos = r.componentes.filter(c => c.masa > 0), visto = new Set(), grupos = [];
  for (const inicio of vivos) {
    if (visto.has(inicio.id)) continue;
    const grupo = [], cola = [inicio.id];
    visto.add(inicio.id);
    while (cola.length) {
      const id = cola.shift();
      grupo.push(r.porId[id]);
      for (const u of r.uniones) {
        if (u.rota || (u.a !== id && u.b !== id)) continue;
        const otro = u.a === id ? u.b : u.a;
        if (r.porId[otro].masa > 0 && !visto.has(otro)) { visto.add(otro); cola.push(otro); }
      }
    }
    grupos.push({ componentes: grupo.map(c => c.id), masa: grupo.reduce((s, c) => s + c.masa, 0),
      reutilizable: grupo.filter(esReutilizable).reduce((s, c) => s + c.masa, 0) });
  }
  return grupos.sort((a, b) => b.masa - a.masa || a.componentes[0].localeCompare(b.componentes[0]));
}

const esReutilizable = c => c.masa > 0 && c.integridad >= UMBRAL_FUNCION;

/** Las cuatro categorías de 7.4, en gramos. `total` siempre es igual a `original`. */
export function balance(r) {
  const b = { reutilizable: 0, fragmento: 0, chatarra: 0, perdido: 0 };
  for (const c of r.componentes) {
    b[esReutilizable(c) ? 'reutilizable' : 'fragmento'] += c.masa;
    b.chatarra += c.chatarra; b.perdido += c.perdido;
  }
  return { ...b, total: b.reutilizable + b.fragmento + b.chatarra + b.perdido, original: r.masa0 };
}

/** Estado funcional por regla (7.3): una función vive si todos sus componentes conservan función y comparten fragmento.
 * El vehículo queda fuera de combate cuando no le queda ninguna. */
export function estado(r) {
  const fragmentoDe = new Map();
  fragmentos(r).forEach((f, i) => f.componentes.forEach(id => fragmentoDe.set(id, i)));
  const funciones = Object.fromEntries(Object.entries(r.funciones).map(([k, ids]) => [k,
    ids.every(id => esReutilizable(r.porId[id])) && new Set(ids.map(id => fragmentoDe.get(id))).size === 1]));
  return { funciones, fueraDeCombate: Object.values(funciones).every(v => !v) };
}

/**
 * Recogida tras el combate (7.5): los fragmentos (y los reutilizables, si se funden) y la parte recogible de la chatarra
 * se agrupan en lotes de recortes para la fundidora, con la masa del catálogo de la fábrica. Lo que no llega a un lote
 * queda en el campo (`sobra`); la chatarra que no se recoge se pierde. Solo se recoge una vez.
 * @param {ReturnType<typeof crearRestos>} r
 * @param {{ masaLote: number, recogidaChatarra?: number, fundirReutilizables?: boolean }} op masaLote en kg
 */
export function recuperar(r, { masaLote, recogidaChatarra = 0.75, fundirReutilizables = true }) {
  const b = balance(r), lote = gramos(masaLote);
  if (r.recogido) return { lotes: 0, sobra: 0, perdidoRecogida: 0, reutilizables: [], repetida: true };
  r.recogido = true;
  const chatarraRecogida = Math.floor(b.chatarra * recogidaChatarra);
  const reutilizables = fundirReutilizables ? [] : r.componentes.filter(esReutilizable).map(c => ({ id: c.id, masa: c.masa }));
  const materia = b.fragmento + chatarraRecogida + (fundirReutilizables ? b.reutilizable : 0);
  const lotes = Math.floor(materia / lote);
  return { lotes, sobra: materia - lotes * lote, perdidoRecogida: b.chatarra - chatarraRecogida, reutilizables };
}
