/* Partida compuesta: núcleo + reglamento + anfitrión + una vista. Sin pantalla con la vista nula. */
import { crearPartida } from '../nucleo/index.js';
import { crearVistaNula } from './vista-nula.js';

/** Juega hasta el fin del reglamento, un error de programa o el límite de pasos.
 * Lockstep: tras cada paso el anfitrión despierta a los programas vencidos y cede hasta que todos
 * esperan; aplica sus órdenes sin avanzar y entrega las respuestas inmediatas.
 * @param {import('./index.js').OpcionesJugar} opciones */
export async function jugarPartida({ reglas, escenario, semilla, anfitrion, vista = crearVistaNula(), ordenes = [], maxPasos = 10000, alPaso }) {
  const partida = crearPartida({ reglas, escenario, semilla });
  for (const orden of ordenes) partida.ordenar(orden);
  let anterior = partida.instantanea(), ultimoSuceso = -1, error = null, pasos = 0, limite = false;
  const entregarSucesos = () => {
    for (const s of partida.sucesos(ultimoSuceso + 1)) { vista.alSuceso(s); ultimoSuceso = Math.max(ultimoSuceso, s.paso); }
  };
  /** @param {any} turno */
  const aplicar = async turno => {
    for (const orden of turno.ordenes) partida.ordenar(orden);
    if (turno.error) error = turno.error;
    partida.aplicarOrdenes();
    while (!error && !partida.evaluar()) {
      const respuestas = reglas.respuestas?.(partida.mundo) ?? [];
      if (!respuestas.length) break;
      const siguiente = await anfitrion.responder(respuestas);
      for (const orden of siguiente.ordenes) partida.ordenar(orden);
      if (siguiente.error) error = siguiente.error;
      partida.aplicarOrdenes();
    }
  };
  entregarSucesos();
  vista.dibujar(anterior, anterior, 1);
  if (anfitrion && !partida.evaluar()) await aplicar(await anfitrion.ceder(anterior));
  for (;;) {
    // Las órdenes del paso actual se aplican al llegar, antes de evaluar (también sin anfitrión).
    partida.aplicarOrdenes();
    if (error || partida.evaluar()) break;
    if (pasos >= maxPasos) { limite = true; break; }
    partida.paso(); pasos++;
    const actual = partida.instantanea();
    entregarSucesos();
    vista.dibujar(anterior, actual, 1);
    alPaso?.(pasos, actual, partida);
    anterior = actual;
    if (partida.evaluar()) break;
    if (anfitrion) await aplicar(await anfitrion.ceder(actual, reglas.respuestas?.(partida.mundo) ?? []));
  }
  anfitrion?.detener(reglas.respuestas?.(partida.mundo) ?? []);
  return { partida, pasos, error, limite, evaluacion: partida.evaluar(), instantanea: partida.instantanea() };
}
