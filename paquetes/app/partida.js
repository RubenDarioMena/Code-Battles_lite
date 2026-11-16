/* Partida compuesta: núcleo + reglamento + anfitrión + una vista. Sin pantalla con la vista nula. */
import { crearPartida } from '../nucleo/index.js';
import { crearVistaNula } from './vista-nula.js';

/** Juega hasta el fin del reglamento, un error de programa o el límite de pasos.
 * Lockstep: tras cada paso el anfitrión despierta a los programas vencidos y cede hasta que todos
 * esperan; sus órdenes se aplican al principio del paso siguiente, como en el juego.
 * @param {import('./index.js').OpcionesJugar} opciones */
export async function jugarPartida({ reglas, escenario, semilla, anfitrion, vista = crearVistaNula(), ordenes = [], maxPasos = 10000, alPaso }) {
  const partida = crearPartida({ reglas, escenario, semilla });
  for (const orden of ordenes) partida.ordenar(orden);
  let anterior = partida.instantanea(), ultimoSuceso = -1, error = null, pasos = 0, limite = false;
  const entregarSucesos = () => {
    for (const s of partida.sucesos(ultimoSuceso + 1)) { vista.alSuceso(s); ultimoSuceso = Math.max(ultimoSuceso, s.paso); }
  };
  /** @param {any} turno */
  const aplicar = turno => {
    for (const orden of turno.ordenes) partida.ordenar(orden);
    if (turno.error) error = turno.error;
  };
  entregarSucesos();
  vista.dibujar(anterior, anterior, 1);
  if (anfitrion) aplicar(await anfitrion.ceder(anterior));
  while (!error && !partida.evaluar()) {
    if (pasos >= maxPasos) { limite = true; break; }
    partida.paso(); pasos++;
    const actual = partida.instantanea();
    entregarSucesos();
    vista.dibujar(anterior, actual, 1);
    alPaso?.(pasos, actual);
    anterior = actual;
    if (partida.evaluar()) break;
    if (anfitrion) aplicar(await anfitrion.ceder(actual));
  }
  anfitrion?.detener();
  return { partida, pasos, error, limite, evaluacion: partida.evaluar(), instantanea: anterior };
}
