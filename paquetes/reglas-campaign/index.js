import { VERSION, crear, serializar, indexar, instantanea, metas, cuantos, enLotes,
  estadoMaquina, totalEntrada, esMaquina, esRobot, PIEZAS, RECETAS, MAQUINAS, ROBOT,
  BANDA, COSTE, PEDIDO, ARSENAL, TORRETA, LUCES, TARIMA_CAP, HITO_MAESTRO, motor } from './estado.js';
import { crearReglamentoFabrica } from '../fabrica/index.js';
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

const fabrica = crearReglamentoFabrica(motor, { id: 'campaign', catalogo: { PIEZAS, RECETAS, MAQUINAS, ROBOT, LUCES } });

/** Fuera del contrato común: permite decidir el final de un tramo sin modificar el mundo.
 * @param {import('./index.js').Mundo} mundo */
export function quieto(mundo) { return fabrica.quieto(mundo); }

/** @type {import('./index.js').ReglamentoCampaign} */
const reglamento = fabrica.reglamento;

export default reglamento;
