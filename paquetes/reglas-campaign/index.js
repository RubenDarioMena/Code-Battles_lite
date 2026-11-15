import { VERSION, crear, serializar, indexar, instantanea, metas, cuantos, enLotes,
  estadoMaquina, totalEntrada, esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS, ROBOT,
  BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO } from './estado.js';
import { conectar } from './mundo.js';
import { validar, modoEnSnap } from './validacion.js';
import { nivel } from './nivel.js';

// Puente temporal: mismas claves y orden que CAMPAIGN y CAMPAIGN_NIVEL.
export const legado = {
  VERSION, crear, conectar, serializar, indexar, instantanea, validar, modoEnSnap, metas, cuantos, enLotes, estadoMaquina, totalEntrada,
  esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS, ROBOT, BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO,
};
export { nivel, serializar };

/** Restaura un checkpoint con la misma validación y arranque inactivo del legado.
 * @param {import('./index.js').Guardado} guardado
 * @param {import('./index.js').Nivel} [reto] */
export function restaurar(guardado, reto = nivel.NIVEL) { return crear(reto, guardado); }

/** @type {WeakMap<import('./index.js').Mundo, import('./index.js').Conexion>} */
const conexiones = new WeakMap();
/** @param {import('./index.js').Mundo} mundo */
function conexion(mundo) {
  if (!conexiones.has(mundo)) conexiones.set(mundo, conectar(mundo));
  return conexiones.get(mundo);
}

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
    if (['pickUp', 'deliver', 'goTo'].includes(orden.verbo))
      c.iniciarOrden(orden.unidad, { id: `${orden.origen}:${orden.paso}:${orden.unidad}`, verbo: orden.verbo, args: orden.args });
    else c.aplicarModo(orden.unidad, orden.verbo, orden.args);
  },
  instantanea(mundo) {
    return { t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: JSON.parse(JSON.stringify(instantanea(mundo))) };
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
