import { copiaPlana } from '../nucleo/index.js';
import { crear, conectar, validar, instantanea, MATERIALES } from './mundo.js';
import { retos } from './retos.js';

// Puente temporal: mismas claves que el catálogo anterior.
export const legado = { crear, conectar, validar, instantanea, MATERIALES };
export { retos };

/** @type {WeakMap<import('./index.js').Mundo, import('./index.js').Conexion>} */
const conexiones = new WeakMap();

/** @param {import('./index.js').Mundo} mundo */
function conexion(mundo) {
  if (!conexiones.has(mundo)) {
    conexiones.set(mundo, conectar(mundo, {
      terminarOrden() {}, programaAcabado: () => false, llamadaPendiente: () => false,
      terminar(fin, motivo, mensaje) {
        mundo.fin = fin;
        mundo.activo = false;
        mundo.robot.tarea = null;
        mundo.revelado = true;
        mundo.final = { fin, motivo, mensaje };
      },
    }));
  }
  return conexiones.get(mundo);
}

/** @type {import('./index.js').ReglamentoFactory} */
const reglamento = {
  id: 'factory', version: 1,
  crearMundo(escenario, _rng) {
    // Factory siempre ha usado el intento, no una muestra del RNG.
    const mundo = crear(escenario.reto, escenario.intento ?? 1);
    mundo.activo = true;
    return mundo;
  },
  paso(mundo, dt) { conexion(mundo).paso(dt); },
  aplicarOrden(mundo, orden) { conexion(mundo).iniciarOrden(orden.verbo, orden.args); },
  instantanea(mundo) {
    // El legado conserva referencias y campos undefined para los Workers.
    // La entrada de reglamento devuelve datos planos independientes.
    return { t: mundo.t, maq: {}, auto: {}, vib: {}, factory: JSON.parse(JSON.stringify(instantanea(mundo))) };
  },
  // Lo que dibujan las vistas (fase 2): copia en datos planos, independiente del mundo.
  escena(mundo) {
    return copiaPlana({ t: mundo.t, revelado: mundo.revelado, entidades: mundo.entidades, robot: mundo.robot, porId: mundo.porId });
  },
  evaluar(mundo) { return mundo.final ?? null; },
  api: {
    ordenes: ['recoger', 'entregar', 'esperar'], lecturas: ['cuantos'],
    nombres: { recoger: 'pickUp', entregar: 'deliver', esperar: 'wait', cuantos: 'count' },
    materiales: [...MATERIALES],
  },
};

export default reglamento;
