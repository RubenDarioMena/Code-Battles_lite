// Decoradores del banco: reloj exterior, sin alterar reglamentos ni sus resultados.
// total incluye respuestas, órdenes, sucesos y callbacks del conductor. ceder y responder
// son columnas separadas; no hay que sumarlas a total. paso incluye crear las respuestas Campaign.
/** @param {any} partida @param {any} anfitrion @param {() => number} ahora
 * @param {(fila: any, foto: any) => void} [alPaso] */
export function instrumentarMedida(partida, anfitrion, ahora, alPaso = () => {}) {
  const muestras = [];
  let actual = null, inicio = 0, foto;
  function cerrar() {
    if (!actual) return;
    actual.total = ahora() - inicio;
    const fila = actual; actual = null;
    muestras.push(fila); alPaso(fila, foto);
  }
  for (const [metodo, columna] of [['paso', 'simulacion'], ['instantanea', 'instantanea']]) {
    const original = partida[metodo].bind(partida);
    partida[metodo] = (...args) => {
      if (metodo === 'paso') {
        cerrar(); inicio = ahora();
        actual = { paso: partida.pasoActual + 1, simulacion: 0, instantanea: 0, ceder: 0, responder: 0, total: 0 };
      }
      const t = ahora();
      try { const r = original(...args); if (metodo === 'instantanea') foto = r; return r; }
      finally { if (actual) actual[columna] += ahora() - t; }
    };
  }
  for (const metodo of ['ceder', 'responder']) {
    const original = anfitrion[metodo].bind(anfitrion);
    anfitrion[metodo] = async (...args) => {
      const t = ahora();
      try { return await original(...args); }
      finally { if (actual) actual[metodo] += ahora() - t; }
    };
  }
  return { muestras, envolverConductor(conductor) {
    const avanzar = conductor.avanzar.bind(conductor);
    conductor.avanzar = async (...args) => {
      try { return await avanzar(...args); } finally { cerrar(); }
    };
    return conductor;
  } };
}
