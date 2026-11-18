/* Partida completa sobre el mismo conductor que la aplicación en vivo. */
import { crearPartida } from '../nucleo/index.js';
import { crearConductor, esperarConductor } from './conductor.js';

/** Juega hasta el fin, un error de programa o el límite de pasos.
 * @param {import('./index.js').OpcionesJugar} opciones */
export async function jugarPartida({ reglas, escenario, semilla, partida: existente, ordenes = [], maxPasos = 10000, alLinea, maxLineas = Infinity, ...opciones }) {
  if (maxLineas !== Infinity && (!Number.isSafeInteger(maxLineas) || maxLineas < 0)) throw new Error('maxLineas debe ser un entero no negativo.');
  const partida = existente ?? crearPartida({ reglas, escenario, semilla });
  for (const orden of ordenes) partida.ordenar(orden);
  const conductor = crearConductor({ ...opciones, reglas, partida });
  let pasos = 0, lineas = 0, limite = false, limiteLineas = false;
  try {
    await conductor.iniciar();
    while (!conductor.terminada) {
      const avance = await conductor.avanzar(maxPasos - pasos);
      pasos += avance.pasos;
      if (avance.terminada) break;
      if (avance.esperandoPausa) {
        if (lineas >= maxLineas) { limiteLineas = limite = true; break; }
        await alLinea?.({ ...conductor.pausas()[0], t: partida.instantanea().t });
        await conductor.avanzarLinea(); lineas++;
        continue;
      }
      const espera = esperarConductor(conductor);
      if (espera) { await espera; continue; }
      if (pasos >= maxPasos) { limite = true; break; }
    }
  } finally { conductor.cerrar(); }
  return { partida, pasos, lineas, limiteLineas, error: conductor.error, limite, evaluacion: partida.evaluar(), instantanea: partida.instantanea() };
}
