import { createHash } from 'node:crypto';
import { canonico } from '../../paquetes/protocolo/index.js';

// JSON canónico: una sola fuente en el protocolo (fase 2). Se reexporta para el contraste.
export { canonico };

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
