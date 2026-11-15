import { createHash } from 'node:crypto';

/** JSON canónico de datos JSON: orden lexicográfico de claves, arrays en orden,
 * números sin redondear (representación JSON.stringify). Es autocontenida para addInitScript.
 * @param {any} valor @returns {string} */
export function canonico(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(v => canonico(v)).join(',') + ']';
  if (valor !== null && typeof valor === 'object')
    return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + canonico(valor[k])).join(',') + '}';
  return JSON.stringify(valor);
}

/** Registra cada paso desde 1; el prefijo y salto delimitan registros sin ambigüedad.
 * @param {number} paso @param {any} instantanea */
export function registro(paso, instantanea) {
  return paso + ':' + canonico(instantanea) + '\n';
}

/** Construye un SHA-256 incremental de las instantáneas entregables a los programas. */
export function crearHuella() {
  const hash = createHash('sha256');
  let pasos = 0, final = null;
  return {
    /** @param {any} instantanea */
    paso(instantanea) {
      // La instantánea final tampoco debe quedar ligada a un objeto mutable del mundo.
      final = structuredClone(instantanea);
      hash.update(registro(++pasos, instantanea), 'utf8');
    },
    terminar() { return { hash: hash.digest('hex'), pasos, instantanea: final }; },
  };
}
