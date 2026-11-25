/* Lockstep por llamadas, compartido por la aplicación en vivo y jugarPartida. */
import { crearVistaNula } from './vista-nula.js';
import { pasoDe } from '../nucleo/index.js';

// La unidad del intérprete entrega síncronamente. También se admiten adaptadores
// asíncronos: la aplicación recupera el control y jugarPartida espera su turno.
const esperas = new WeakMap();
export function esperarConductor(conductor) { return esperas.get(conductor)?.(); }

/** @param {import('./index.js').OpcionesConductor} opciones
 * @returns {import('./index.js').Conductor} */
export function crearConductor({ reglas, partida, anfitrion, vista = crearVistaNula(), alPaso, alSucesos, alTurno, detener, intento }) {
  let anterior, iniciado = false, cerrado = false, terminada = false, error = null, pasos = 0;
  let ultimoSuceso = -1, vistos = 0;
  /** @type {null | { promesa: Promise<void>, listo: boolean, turno?: import('../anfitrion/index.js').Turno, fallo?: any, falloRecibido?: boolean }} */
  let pendiente = null;
  // Tras cada paso: respuestas (incluidas sus continuaciones) antes de ceder.
  let fase = null, cederDespues = false;

  const cola = [];
  let siguienteEntrada = 0;
  // El anfitrión sella las órdenes con el paso del reloj del mundo (pasoDe(t)); la cola de la partida cuenta pasos
  // desde que se creó. Un mundo restaurado con t > 0 (la planta de Campaign al recargar o al volver de una Batalla)
  // los desfasa: sin convertirlos, cada orden esperaría ese tiempo entero antes de aplicarse.
  const desfase = pasoDe(partida.instantanea().t ?? 0) - partida.pasoActual;
  const enPartida = orden => (desfase ? { ...orden, paso: orden.paso - desfase } : orden);
  if (intento) partida.iniciarGrabacion(intento.semillaIntento, intento.programas);

  // Frontera entre el turno ordinario y el siguiente paso del mundo. Una recarga
  // ejecuta su primera entrega antes de procesar la siguiente entrada de la FIFO.
  async function aplicarEntradas() {
    const grabadas = intento.repeticion;
    while (grabadas && grabadas[siguienteEntrada]?.paso === partida.pasoActual)
      cola.push(grabadas[siguienteEntrada++]);
    while (cola.length && !cerrado && !intento.enPausa?.()) {
      const e = cola.shift();
      if (e.tipo === 'orden') {
        partida.ordenar({ unidad: e.unidad, verbo: e.verbo, args: e.args, paso: partida.pasoActual, origen: 'jugador' });
        partida.aplicarOrdenes();
        entregarEventos();
      } else {
        await anfitrion.recargar(e.unidad, e.codigo, e);
        if (cerrado) return false;
        recibirTurno(anfitrion.ceder(partida.instantanea()));
      }
      partida.registrarEntrada(e);
      intento.alAplicar?.(e, partida.pasoActual);
      if (pendiente && !await completarTurnos()) return false;
    }
    return !cerrado && !intento.enPausa?.();
  }

  function entregarEventos() {
    const eventos = reglas.eventos?.(partida.mundo);
    if (!eventos?.length || !anfitrion) return false;
    recibirTurno(anfitrion.entregarEventos(partida.instantanea(), eventos));
    return true;
  }

  function entregarSucesos() {
    const disponibles = partida.sucesos(ultimoSuceso);
    const lista = disponibles.slice(vistos);
    if (lista.length) {
      ultimoSuceso = lista.at(-1).paso;
      vistos = disponibles.filter(s => s.paso === ultimoSuceso).length;
    }
    for (const suceso of lista) vista.alSuceso(suceso);
    alSucesos?.(lista);
  }
  function comprobarFin() {
    terminada ||= cerrado || !!error || !!partida.evaluar() || !!detener?.(partida);
    return terminada;
  }
  /** @param {Promise<import('../anfitrion/index.js').Turno>} promesa */
  function recibirTurno(promesa) {
    const espera = { listo: false, promesa: null, turno: null, fallo: null, falloRecibido: false };
    espera.promesa = promesa.then(turno => { espera.turno = turno; espera.listo = true; },
      fallo => { espera.fallo = fallo; espera.falloRecibido = true; espera.listo = true; });
    pendiente = espera;
  }
  async function completarTurnos() {
    for (;;) {
      if (comprobarFin()) return true;
      if (pendiente) {
        // No avanza el reloj ni espera al Worker desde un fotograma en vivo.
        if (!pendiente.listo && anfitrion.algunoCorre?.()) return false;
        await pendiente.promesa;
        if (cerrado) return true;
        const recibido = pendiente;
        pendiente = null;
        if (recibido.falloRecibido) throw recibido.fallo;
        const turno = recibido.turno;
        for (const orden of turno.ordenes) partida.ordenar(enPartida(orden));
        error = turno.error ?? error;
        partida.aplicarOrdenes();
        alTurno?.(turno);
        fase = 'respuestas';
      }
      if (comprobarFin()) return true;
      if (fase === 'respuestas') {
        if (entregarEventos()) continue;
        const respuestas = reglas.respuestas?.(partida.mundo) ?? [];
        if (respuestas.length) {
          recibirTurno(anfitrion.responder(respuestas));
          continue;
        }
        fase = cederDespues ? 'ceder' : null;
        cederDespues = false;
      }
      if (fase === 'ceder') {
        fase = null;
        recibirTurno(anfitrion.ceder(partida.instantanea()));
        continue;
      }
      return true;
    }
  }

  const conductor = {
    encolar(entrada) {
      if (!intento || intento.repeticion || cerrado || terminada) return false;
      cola.push(structuredClone(entrada));
      return true;
    },
    async iniciar() {
      if (iniciado || cerrado) return;
      iniciado = true;
      anterior = partida.instantanea();
      entregarSucesos();
      vista.dibujar(anterior, anterior, 1);
      if (anfitrion && !partida.evaluar()) recibirTurno(anfitrion.ceder(anterior));
      await completarTurnos();
    },
    async avanzar(maxPasos) {
      if (!Number.isSafeInteger(maxPasos) || maxPasos < 0) throw new Error('maxPasos debe ser un entero seguro no negativo.');
      await conductor.iniciar();
      let dados = 0;
      if (terminada) return { pasos: dados, terminada, ...(anfitrion?.pausas?.().length ? { esperandoPausa: true } : {}) };
      partida.aplicarOrdenes();
      if (!await completarTurnos()) return { pasos: dados, terminada, ...(anfitrion?.pausas?.().length ? { esperandoPausa: true } : {}) };
      while (!comprobarFin() && !anfitrion?.algunoCorre?.()) {
        if (intento && !await aplicarEntradas()) break;
        if (dados >= maxPasos) break;
        // Con Workers reales un mensaje puede llegar tras cerrar su turno (dos encargos seguidos sin await):
        // el fallo ya anotado por el anfitrión corta antes de dar otro paso, como el ciclo antiguo.
        if (anfitrion?.fallo?.()) { error = anfitrion.fallo(); terminada = true; break; }
        partida.paso(); dados++; pasos++;
        const actual = partida.instantanea();
        entregarSucesos();
        vista.dibujar(anterior, actual, 1);
        alPaso?.(pasos, actual, partida);
        anterior = actual;
        if (anfitrion) { fase = 'respuestas'; cederDespues = true; }
        if (comprobarFin()) break;
        if (anfitrion) {
          if (!await completarTurnos()) break;
        }
      }
      return { pasos: dados, terminada, ...(anfitrion?.pausas?.().length ? { esperandoPausa: true } : {}) };
    },
    pausas() { return anfitrion?.pausas?.() ?? []; },
    async avanzarLinea(unidad) { return await anfitrion?.avanzarLinea(unidad) ?? null; },
    async continuar() { await anfitrion?.continuar(); },
    reanudar() {
      if (!cerrado && !error) terminada = false;
    },
    get error() { return error; },
    get terminada() { return terminada; },
    // La aplicación en vivo reanuda en cuanto llega el turno, sin esperar al siguiente fotograma (como el ciclo antiguo).
    turnoPendiente() { return pendiente && !pendiente.listo ? pendiente.promesa : null; },
    cerrar() {
      if (cerrado) return;
      cerrado = true; terminada = true;
      anfitrion?.detener(reglas.respuestas?.(partida.mundo) ?? []);
    },
  };
  esperas.set(conductor, () => pendiente?.promesa);
  return conductor;
}
