import { preparar as prepararModelo } from './seudo-modelo.js';
import { preparar as prepararEdicion } from './seudo-edicion.js';
import { preparar as prepararVista } from './seudo-vista.js';
import { preparar as prepararGestos } from './seudo-gestos.js';

/** seudo: enlaza primero las funciones (antes eran declaraciones elevadas),
 * luego inicializa cada sección en el mismo orden que el módulo clásico.
 * @param {any} opciones */
function crear(opciones) {
  const ctx = { ...opciones, iconos: opciones.iconos === undefined ? {} : opciones.iconos };
  const inicializadores = [prepararModelo(ctx), prepararEdicion(ctx), prepararVista(ctx), prepararGestos(ctx)];
  for (const iniciar of inicializadores) iniciar();
  return ctx.cmg.seudo;
}
export const CMGSeudo = { crear };
