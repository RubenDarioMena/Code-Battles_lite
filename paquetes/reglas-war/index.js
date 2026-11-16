import { copiaPlana } from '../nucleo/index.js';
import { crear, conectar, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia } from './mundo.js';
import { RETOS, PROPIO_BASE, POS_LANZADORES, normalizar } from './retos.js';

export { crear, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia };
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
