import { VERSION, crear, serializar, indexar, instantanea, metas, cuantos, enLotes,
  estadoMaquina, totalEntrada, esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS, ROBOT,
  BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO } from './estado.js';
import { conectar } from './mundo.js';
import { copiaPlana } from '../nucleo/index.js';
import { validar, modoEnSnap } from './validacion.js';
import { nivel } from './nivel.js';

export { VERSION, crear, serializar, indexar, instantanea as instantaneaHistorica, validar, modoEnSnap,
  metas, cuantos, enLotes, estadoMaquina, totalEntrada, esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS,
  ROBOT, BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO };
export { nivel };

/** Restaura un checkpoint con la misma validación y arranque inactivo originales.
 * @param {import('./index.js').Guardado} guardado
 * @param {import('./index.js').Nivel} [reto] */
export function restaurar(guardado, reto = nivel.NIVEL) { return crear(reto, guardado); }

/** @type {WeakMap<import('./index.js').Mundo, import('./index.js').Conexion>} */
const conexiones = new WeakMap();
/** @type {WeakMap<import('./index.js').Mundo, import('../nucleo/index.js').Respuesta[]>} */
const pendientes = new WeakMap();
/** @param {import('./index.js').Mundo} mundo */
function conexion(mundo) {
  if (!conexiones.has(mundo)) {
    const respuestas = [];
    pendientes.set(mundo, respuestas);
    conexiones.set(mundo, conectar(mundo, {
      terminarOrden(unidad, ref, resultado) {
        respuestas.push({ unidad, ref: String(ref), resultado,
          instantanea: structuredClone({ t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: instantanea(mundo) }) });
      },
    }));
  }
  return conexiones.get(mundo);
}

/** Fuera del contrato común: permite decidir el final de un tramo sin modificar el mundo.
 * @param {import('./index.js').Mundo} mundo */
export function quieto(mundo) { return conexion(mundo).quieto(); }

/** @type {import('./index.js').ReglamentoCampaign} */
const reglamento = {
  id: 'campaign', version: VERSION,
  crearMundo(escenario, _rng) {
    const mundo = crear(escenario.reto, escenario.guardado);
    mundo.activo = true;
    return mundo;
  },
  paso(mundo, dt) { conexion(mundo).paso(dt); },
  aplicarOrden(mundo, orden) {
    const c = conexion(mundo);
    if (orden.origen === 'sistema' && orden.verbo === 'fin-tramo') {
      c.cancelarTareas(); c.soltarLuces(); return;
    }
    if (['pickUp', 'deliver', 'goTo'].includes(orden.verbo))
      c.iniciarOrden(orden.unidad, { id: orden.ref ?? `${orden.origen}:${orden.paso}:${orden.unidad}`, verbo: orden.verbo, args: orden.args });
    else {
      const resultado = c.aplicarModo(orden.unidad, orden.verbo, orden.args);
      pendientes.get(mundo).push({ unidad: orden.unidad, ref: orden.ref, resultado, modo: true });
    }
  },
  respuestas(mundo) { conexion(mundo); return pendientes.get(mundo).splice(0); },
  instantanea(mundo) {
    return { t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: JSON.parse(JSON.stringify(instantanea(mundo))) };
  },
  // Lo que dibujan las vistas (fase 2): copia en datos planos, independiente del mundo.
  escena(mundo) {
    return copiaPlana({ t: mundo.t, activo: mundo.activo, hito: mundo.hito, maquinas: mundo.maquinas, robots: mundo.robots,
      tarimas: mundo.tarimas, misiles: mundo.misiles, explosiones: mundo.explosiones, bahia: mundo.bahia, porId: mundo.porId });
  },
  // El mundo continúa tras el último hito para ejecutar la salva y el suministro.
  evaluar(mundo) { return mundo.completado ? { fin: 'victoria', hito: mundo.hito, completado: true } : null; },
  api: {
    encargos: ['pickUp', 'deliver', 'goTo'], modos: ['start', 'stop', 'setRecipe', 'light', 'request'],
    lecturas: ['count'], espera: 'wait',
    piezas: structuredClone(PIEZAS), recetas: structuredClone(RECETAS),
    maquinas: structuredClone(MAQUINAS), robots: structuredClone(ROBOT), luces: [...LUCES],
  },
};

export default reglamento;
