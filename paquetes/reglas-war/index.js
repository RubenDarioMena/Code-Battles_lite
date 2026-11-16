import { crear, conectar, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia } from './mundo.js';
import { RETOS, PROPIO_BASE, POS_LANZADORES, normalizar } from './retos.js';

// Puente temporal para el juego y la herramienta; se retira en la fase 2.
export const legado = { crear, conectar, aplicarOrden, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia };
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
