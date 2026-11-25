// La grabación incluye el escenario de salida (con su checkpoint, si lo hay).
// La repetición vuelve a ejecutar los programas, en un mundo y un anfitrión propios.
import { crearPartida } from '../../nucleo/index.js';
import { crearAnfitrion } from '../../anfitrion/index.js';
import { crearConductor } from '../conductor.js';

export async function repetirIntento(datos, reglas, opcionesAnfitrion, alPaso = undefined) {
  const { intento, escenario, semilla } = datos;
  const partida = crearPartida({ reglas, escenario: { ...escenario, semillaIntento: intento.semillaIntento }, semilla });
  const anfitrion = crearAnfitrion({ ...opcionesAnfitrion, pasoAPaso: false });
  const conductor = crearConductor({ reglas, partida, anfitrion, alPaso,
    detener: () => partida.mundo.hito !== escenario.hito,
    intento: { ...intento, repeticion: intento.entradas } });
  try {
    for (const [id, p] of Object.entries(intento.programas))
      await anfitrion.cargar(id, p.codigo, p);
    await conductor.avanzar(datos.paso);
    return partida;
  } finally { conductor.cerrar(); }
}
