const formas = ['brillo', 'disco', 'humo'];
const direcciones = ['esfera', 'hemisferio', 'cono', 'anillo', 'arriba'];
const campos = new Set(['forma', 'mezcla', 'n', 'retraso', 'vida', 'dir', 'vel',
  'arrastre', 'grav', 'deriva', 'suelo', 'alto', 'adelante', 'tam', 'alfa', 'color',
  'estela', 'ciclo', 'radioFinal', 'destello']);
const finito = x => typeof x === 'number' && Number.isFinite(x);
export const maximo = v => Array.isArray(v) ? v[1] : v;

/** Devuelve todos los errores con la ruta de la capa; no lanza ni modifica datos.
 * @param {unknown} receta @returns {string[]} */
export function validarReceta(receta) {
  const errores = [];
  const r = /** @type {import('./index.js').Receta} */ (receta);
  if (!r || !Array.isArray(r.capas) || !r.capas.length) return ['receta.capas: se espera un array no vacío'];
  for (const [i, c] of r.capas.entries()) {
    const error = (campo, texto) => errores.push(`capas[${i}].${campo}: ${texto}`);
    if (!c || typeof c !== 'object' || Array.isArray(c)) { error('', 'se espera un objeto'); continue; }
    for (const k of Object.keys(c)) if (!campos.has(k)) error(k, 'campo desconocido');
    if (c.destello !== undefined && typeof c.destello !== 'boolean') error('destello', 'booleano requerido');
    if (!formas.includes(c.forma)) error('forma', 'usa brillo, disco o humo');
    if (!['normal', 'suma'].includes(c.mezcla)) error('mezcla', 'usa normal o suma');
    if (c.dir !== undefined && !direcciones.includes(c.dir)) error('dir', 'dirección desconocida');
    for (const campo of ['n', 'vida', 'retraso', 'vel']) {
      const v = c[campo];
      if (v === undefined && !['n', 'vida'].includes(campo)) continue;
      const lista = Array.isArray(v) ? v : [v];
      if ((Array.isArray(v) && v.length !== 2) || !lista.every(finito)
        || lista.some(x => x < 0 || (campo === 'vida' && x === 0))
        || (lista.length === 2 && lista[0] > lista[1])
        || (campo === 'n' && lista.some(x => !Number.isInteger(x)))) {
        error(campo, 'se espera un número o intervalo [mín, máx] válido, no negativo (vida > 0; n entero)');
      }
    }
    for (const campo of ['arrastre', 'grav', 'alto', 'adelante', 'radioFinal', 'estela', 'ciclo']) {
      const v = c[campo];
      if (v !== undefined && (!finito(v)
        || (['arrastre', 'radioFinal', 'estela', 'ciclo'].includes(campo) && v < 0)
        || (campo === 'estela' && !Number.isInteger(v)))) error(campo, 'número finito válido requerido');
    }
    if (c.suelo !== undefined && typeof c.suelo !== 'boolean') error('suelo', 'se espera booleano');
    if (c.deriva !== undefined && (!Array.isArray(c.deriva) || c.deriva.length !== 3 || !c.deriva.every(finito))) error('deriva', 'se espera [x, y, z] finito');
    for (const campo of ['tam', 'alfa']) {
      const v = c[campo];
      if (!Array.isArray(v) || !v.length || !v.every(x => finito(x) && x >= 0 && (campo !== 'alfa' || x <= 1))) error(campo, 'claves numéricas no negativas (alfa entre 0 y 1)');
    }
    if (!Array.isArray(c.color) || !c.color.length || !c.color.every(x => typeof x === 'string'
      && (/^#[\da-f]{3}([\da-f]{3})?$/i.test(x) || /^[a-z][a-z0-9-]*$/.test(x)))) error('color', 'claves de tokens o hex #RGB/#RRGGBB requeridas');
  }
  return errores;
}
