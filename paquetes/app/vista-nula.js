/* Vista nula: cumple el contrato de una vista sin dibujar. Sirve para pruebas y partidas sin pantalla. */

/** @returns {import('./index.js').VistaNula} */
export function crearVistaNula() {
  let fotogramas = 0, sucesos = 0, ultima = null, viva = true;
  return {
    dibujar(anterior, actual, fraccion) {
      if (!viva) throw new Error('La vista nula está destruida.');
      if (!(fraccion >= 0 && fraccion <= 1)) throw new Error('La fracción debe estar entre 0 y 1.');
      fotogramas++; ultima = actual;
    },
    alSuceso() { sucesos++; },
    elegir() { return null; },
    proyectar() { return { x: 0, y: 0, visible: false }; },
    redimensionar() {},
    destruir() { viva = false; },
    resumen() { return { fotogramas, sucesos, t: ultima ? ultima.t : null }; },
  };
}
