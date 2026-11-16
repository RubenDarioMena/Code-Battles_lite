import { preparar as prepararAcciones } from './edicion-acciones.js';
import { preparar as prepararVista } from './edicion-vista.js';
import { preparar as prepararGestos } from './edicion-gestos.js';
import { preparar as prepararSugerencias } from './edicion-sugerencias.js';
import { preparar as prepararBarra } from './edicion-barra.js';
import { preparar as prepararProtomouse } from './edicion-protomouse.js';
import { preparar as prepararControles } from './edicion-controles.js';

/** edicion: enlaza primero las funciones (antes eran declaraciones elevadas),
 * luego inicializa cada sección en el mismo orden que el módulo clásico.
 * @param {any} opciones */
function crear(opciones) {
  const ctx = { ...opciones, iconos: opciones.iconos === undefined ? {} : opciones.iconos, externos: opciones.historiales };
  const inicializadores = [prepararAcciones(ctx), prepararVista(ctx), prepararGestos(ctx), prepararSugerencias(ctx), prepararBarra(ctx), prepararProtomouse(ctx), prepararControles(ctx)];
  for (const iniciar of inicializadores) iniciar();
  return ctx.cmg.edicion;
}
export const CMGEdicion = { crear };
