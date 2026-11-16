/** @typedef {import('./index.d.ts').Origen} Origen */
/** @typedef {import('./index.d.ts').DatoPlano} DatoPlano */
/** @typedef {import('./index.d.ts').Orden} Orden */
/** @typedef {import('./index.d.ts').Suceso} Suceso */
/** @typedef {import('./index.d.ts').Instantanea} Instantanea */

/** @type {readonly Origen[]} */
export const ORIGENES = Object.freeze(['programa', 'jugador', 'sistema']);

/** @param {unknown} valor @returns {valor is Record<string, unknown>} */
function esObjetoPlano(valor) {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === null || Object.getPrototypeOf(prototipo) === null;
}

/**
 * Solo los antecesores cuentan como ciclo: compartir un objeto es válido.
 * @param {unknown} valor
 * @param {string} ruta
 * @param {Set<object>} antecesores
 * @param {string[]} errores
 */
function revisarDato(valor, ruta, antecesores, errores) {
  if (valor === null || typeof valor === 'boolean' || typeof valor === 'string') return;
  if (typeof valor === 'number' && Number.isFinite(valor)) return;
  if ((!Array.isArray(valor) && !esObjetoPlano(valor)) || antecesores.has(valor)) {
    errores.push(`${ruta}: no es dato plano`);
    return;
  }
  antecesores.add(valor);
  if (Array.isArray(valor)) {
    for (let indice = 0; indice < valor.length; indice++) {
      if (!Object.hasOwn(valor, indice)) errores.push(`${ruta}[${indice}]: no es dato plano`);
    }
  }
  for (const clave of Reflect.ownKeys(valor)) {
    if (Array.isArray(valor) && clave === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(valor, clave);
    const campo = Array.isArray(valor) && typeof clave === 'string' && /^(0|[1-9]\d*)$/.test(clave)
      ? `${ruta}[${clave}]` : `${ruta}.${String(clave)}`;
    if (typeof clave === 'symbol' || !('value' in descriptor)) {
      errores.push(`${campo}: no es dato plano`);
    } else if (descriptor.value === undefined && !Array.isArray(valor)) {
      // Propiedad ausente a efectos de JSON: la instantánea real de Factory la tiene (`acepta` de bodegas).
    } else revisarDato(descriptor.value, campo, antecesores, errores);
  }
  antecesores.delete(valor);
}

/** @param {unknown} valor @returns {valor is DatoPlano} */
export function esDatoPlano(valor) {
  const errores = [];
  revisarDato(valor, 'dato', new Set(), errores);
  return errores.length === 0;
}

/** @param {Record<string, unknown>} objeto @param {string[]} permitidas
 * @param {string[]} obligatorias @param {string} ruta @param {string[]} errores */
function revisarClaves(objeto, permitidas, obligatorias, ruta, errores) {
  for (const clave of obligatorias) {
    if (!Object.hasOwn(objeto, clave)) errores.push(`${ruta}.${clave}: campo obligatorio`);
  }
  for (const clave of Reflect.ownKeys(objeto)) {
    if (typeof clave !== 'string' || !permitidas.includes(clave)) {
      errores.push(`${ruta}.${String(clave)}: campo no permitido`);
    }
  }
}

/** @param {unknown} valor @param {string} ruta @param {string[]} errores */
function revisarPaso(valor, ruta, errores) {
  if (!Number.isInteger(valor) || typeof valor !== 'number' || valor < 0) {
    errores.push(`${ruta}: debe ser entero mayor o igual que 0`);
  }
}

/** @param {unknown} valor @param {string} ruta @param {string[]} errores */
function revisarCadena(valor, ruta, errores) {
  if (typeof valor !== 'string' || valor.length === 0) errores.push(`${ruta}: debe ser cadena no vacía`);
}

/** @param {Record<string, unknown>} objeto @param {string} ruta @returns {string[]} */
function revisarAccesores(objeto, ruta) {
  return Reflect.ownKeys(objeto)
    .filter(clave => !('value' in Object.getOwnPropertyDescriptor(objeto, clave)))
    .map(clave => `${ruta}.${String(clave)}: no es dato plano`);
}

/** Valida la forma de una Orden sin modificarla.
 * @param {unknown} o @returns {string[]} */
export function validarOrden(o) {
  const errores = [];
  if (!esObjetoPlano(o)) return ['orden: debe ser objeto plano'];
  const accesores = revisarAccesores(o, 'orden');
  if (accesores.length) return accesores;
  revisarClaves(o, ['paso', 'origen', 'unidad', 'verbo', 'args'],
    ['paso', 'origen', 'unidad', 'verbo', 'args'], 'orden', errores);
  revisarPaso(o.paso, 'orden.paso', errores);
  if (!ORIGENES.includes(/** @type {Origen} */ (o.origen))) errores.push('orden.origen: origen no permitido');
  revisarCadena(o.unidad, 'orden.unidad', errores);
  revisarCadena(o.verbo, 'orden.verbo', errores);
  if (!Array.isArray(o.args)) errores.push('orden.args: debe ser arreglo');
  else revisarDato(o.args, 'orden.args', new Set(), errores);
  return errores;
}

/** Valida la forma de un Suceso sin modificarlo.
 * @param {unknown} s @returns {string[]} */
export function validarSuceso(s) {
  const errores = [];
  if (!esObjetoPlano(s)) return ['suceso: debe ser objeto plano'];
  const accesores = revisarAccesores(s, 'suceso');
  if (accesores.length) return accesores;
  revisarClaves(s, ['paso', 'tipo', 'unidad', 'datos'], ['paso', 'tipo'], 'suceso', errores);
  revisarPaso(s.paso, 'suceso.paso', errores);
  revisarCadena(s.tipo, 'suceso.tipo', errores);
  if (Object.hasOwn(s, 'unidad')) revisarCadena(s.unidad, 'suceso.unidad', errores);
  if (Object.hasOwn(s, 'datos')) {
    if (!esObjetoPlano(s.datos)) errores.push('suceso.datos: debe ser objeto plano');
    else revisarDato(s.datos, 'suceso.datos', new Set(), errores);
  }
  return errores;
}

/** Valida la forma de una Instantanea sin modificarla.
 * @param {unknown} i @returns {string[]} */
export function validarInstantanea(i) {
  const errores = [];
  if (!esObjetoPlano(i)) return ['instantanea: debe ser objeto plano'];
  const accesores = revisarAccesores(i, 'instantanea');
  if (accesores.length) return accesores;
  if (!Object.hasOwn(i, 't')) errores.push('instantanea.t: campo obligatorio');
  if (typeof i.t !== 'number' || !Number.isFinite(i.t) || i.t < 0) {
    errores.push('instantanea.t: debe ser número finito mayor o igual que 0');
  }
  revisarDato(i, 'instantanea', new Set(), errores);
  return errores;
}

/** JSON canónico de una instantánea: claves en orden lexicográfico, arreglos en orden y números sin
 * redondear (como JSON.stringify). Es la base de las huellas de partida. Autocontenida: el contraste
 * del navegador la copia por su texto. Antes vivía en herramientas/partida/huella.mjs.
 * @param {any} valor @returns {string} */
export function canonico(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(v => canonico(v)).join(',') + ']';
  if (valor !== null && typeof valor === 'object')
    return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + canonico(valor[k])).join(',') + '}';
  return JSON.stringify(valor);
}
