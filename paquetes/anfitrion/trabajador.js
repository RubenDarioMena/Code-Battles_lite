/* La VM ejecuta esta misma fábrica dentro de su contexto independiente. */
import { crearAPI } from './api.js';
const piezasPorFuente = new Map();
const texto = (fn, defecto) => fn ? (typeof fn === 'string' ? fn : fn.toString()) : defecto;
/** @param {import('./index.js').PiezasTrabajador} [piezas] */
export function fuenteTrabajador(piezas = {}) {
  const capacidades = Object.entries(piezas.capacidades ?? {}).map(([id, p]) =>
    JSON.stringify(id) + ': { api: ' + texto(p.api, 'null') + ', ordenar: ' + texto(p.ordenar, 'null') + ' }');
  const fuente = `const API = (${crearAPI.toString()})({ self,
    AF: Object.getPrototypeOf(async function () {}).constructor, Promise,
    emitir: postMessage, programarTimer: setTimeout,
    validarFactory: ${texto(piezas.validarFactory, '() => null')},
    validarCampaign: ${texto(piezas.validarCampaign, '() => null')},
    modoCampaign: ${texto(piezas.modoCampaign, "() => 'ok'")},
    capacidades: { ${capacidades.join(', ')} },
    lugarDeObjetivo: ${texto(piezas.lugarDeObjetivo, "objetivo => objetivo")},
    preludioPython: ${texto(piezas.preludioPython, '() => null')}
  }); const __py = API.python; onmessage = API.onmessage;`;
  // La fuente es la clave del contrato Worker clásico; no se evalúa en el anfitrión.
  piezasPorFuente.set(fuente, piezas);
  if (piezasPorFuente.size > 32) piezasPorFuente.delete(piezasPorFuente.keys().next().value);
  return fuente;
}
export const piezasDeFuente = fuente => piezasPorFuente.get(fuente);
