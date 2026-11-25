import { copiaPlana, anotarSuceso } from '../nucleo/index.js';
import { crear, conectar, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia } from './mundo.js';
import { RETOS, PROPIO_BASE, POS_LANZADORES, normalizar } from './retos.js';

export { crear, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia };
/** Fija la recarga de este lanzador. Los demás conservan el ritmo del reto. */
export function fijarSuministro(lanzador, ritmo) {
  lanzador.suministro = ritmo;
}

/** Ejecuta un paso con prioridad para un único intento por lanzador. El paso
 * normal consume el misil, resuelve el riesgo y fija el siguiente turno de fuego. */
export function pasoConIntentoPuntual(mundo, dt, pendientes, descartar) {
  const restaurar = [];
  for (const [id, lugar] of pendientes) {
    const l = mundo.porId[id];
    if (l.atascado || l.misiles < 1) {
      pendientes.delete(id);
      descartar(id, l.atascado ? 'atasco' : 'municion');
      continue;
    }
    if (l.cd - dt > 1e-9) continue;
    pendientes.delete(id);
    restaurar.push({ l, modo: l.modo, lugar: l.lugar });
    if (l.modo === 'idle') l.modo = 'regular';
    l.lugar = lugar;
  }
  try { reglamento.paso(mundo, dt); }
  finally { for (const { l, modo, lugar } of restaurar) { l.modo = modo; l.lugar = lugar; } }
}

/** Copia plana de los enemigos vivos, en casillas. Para las mecánicas de fuera (Campaign-V2, ticket 05). */
export function leerEnemigos(mundo) {
  return copiaPlana(mundo.enemigos);
}

/** Daño de fuera de War en un círculo del plano (casillas, sin altura). Cuenta los derribos como los
 * de un misil, así que las metas `derribosMin` los incluyen. Devuelve los ids alcanzados. */
export function danoEnArea(mundo, x, y, radio, dano, por = null) {
  const alcanzados = [];
  for (const e of mundo.enemigos) {
    if (Math.hypot(e.x - x, e.y - y) > radio) continue;
    e.hp -= dano; e.golpeT = mundo.t; alcanzados.push(e.id);
    anotarSuceso(mundo, 'golpe', e.id, { hp: e.hp, por });
    if (e.hp > 0) continue;
    e.muerto = true; mundo.derribos++;
    mundo.derribados.push({ x: e.x, y: e.y, z: e.z, t0: mundo.t, tipo: e.tipo });
    anotarSuceso(mundo, 'derribo', e.id, { tipo: e.tipo, por });
  }
  if (alcanzados.length) mundo.enemigos = mundo.enemigos.filter(e => !e.muerto);
  return alcanzados;
}

export const retos = { RETOS, PROPIO_BASE, POS_LANZADORES, normalizar };

/** @type {WeakMap<import('./index.js').Mundo, ReturnType<typeof conectar>>} */
const conexiones = new WeakMap();

/** @param {import('./index.js').Mundo} mundo */
function conexion(mundo) {
  if (!conexiones.has(mundo)) {
    conexiones.set(mundo, conectar(mundo, {
      registrar() {}, avisoSistema() {}, globo() {},
      terminar(fin, motivo, mensaje) {
        mundo.fin = fin;
        mundo.activo = false;
        mundo.final = { fin, motivo, mensaje };
      },
    }));
  }
  return conexiones.get(mundo);
}

/** @type {import('./index.js').ReglamentoWar} */
const reglamento = {
  id: 'war', version: 1,
  crearMundo(escenario, rng) {
    const mundo = crear(escenario.reto, null, rng);
    mundo.activo = true;
    return mundo;
  },
  paso(mundo, dt) { conexion(mundo).paso(dt); },
  aplicarOrden,
  instantanea(mundo) { return conexion(mundo).instantanea(); },
  // Lo que dibujan las vistas (fase 2): copia en datos planos, independiente del mundo.
  escena(mundo) {
    const e = copiaPlana({ t: mundo.t, def: { niebla: !!mundo.def.niebla }, lanzadores: mundo.lanzadores,
      sensores: mundo.sensores, deposito: mundo.deposito, reparadores: mundo.reparadores, maquinas: mundo.maquinas,
      enemigos: mundo.enemigos, misiles: mundo.misiles, explosiones: mundo.explosiones });
    return { ...e, porId: Object.fromEntries(e.maquinas.map(x => [x.id, x])) };
  },
  evaluar(mundo) { return mundo.final ?? null; },
  api: {
    ordenes: ['regularShoot', 'burstFire', 'stopFire'],
    tipos: Object.fromEntries(Object.entries(TIPOS).map(([tipo, datos]) => [tipo, { ...datos }])),
    sensores: Object.fromEntries(Object.entries(SENSOR).map(([sensor, datos]) => [sensor, { ...datos }])),
    // Lo que el Worker necesita para simular la orden en su instantánea (fase 2, anfitrión).
    conf: { fallaRafaga: LAU.fallaRafaga, cadencia: LAU.cadencia, cadenciaRafaga: LAU.cadenciaRafaga },
  },
};

export default reglamento;
