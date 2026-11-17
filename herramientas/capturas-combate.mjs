/* Configuración compartida por capturas-vista y su prueba Node: sin navegador al importar. */
export const COMBATE = Object.freeze({ reto: 2, semilla: 7, paso: 512, ahora: 123456 });

// Se serializa en page.evaluate: no captura variables del módulo ni consulta relojes.
export function prepararCombate(B, config) {
  B.elegirReto(config.reto); // índice 2: reto 3, Niebla (orugas blindadas, dron y frío)
  B.fijarSemilla(config.semilla);
  B.turbo(40);
  B.alPaso = () => {
    if (B.partida.pasoActual !== config.paso) return;
    B.congelarVista();
    B.capturaLista = true;
  };
  B.ejecutar();
}

// Carga solo visual: clona datos de la escena; ni órdenes, ni mundo, ni RNG.
export function escenaCarga(escena, cantidad) {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1) throw new Error('--enemigos requiere un entero positivo');
  if (!escena.enemigos.length) throw new Error('La escena base debe contener enemigos');
  return { ...escena, enemigos: Array.from({ length: cantidad }, (_, i) => ({
    ...escena.enemigos[i % escena.enemigos.length], id: `carga-${i}`,
    x: 5 + (i % 40) * .65, y: .5 + (Math.floor(i / 40) % 24) * .7,
    vx: 0, vy: 0, golpeT: i % 7 === 0 ? escena.t : -9,
  })) };
}
