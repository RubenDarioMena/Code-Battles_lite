/* crearAnfitrion: carga los programas y cede el turno hasta que todos esperan.
 * Mensajes trasladados del «Ciclo de los programas» de juego.js (alMensaje).
 * El juego y herramientas/partida conservan su ciclo antiguo. */
import { pasoDe } from '../nucleo/index.js';
import { fuenteTrabajador } from './trabajador.js';
import { crearControlFactory } from './factory.js';

const MAX_ORDENES = 4000;
const CUENTAN = new Set(['lee', 'cmd', 'consola']);

/** @param {import('./index.js').OpcionesAnfitrion} opciones
 * @returns {import('./index.js').Anfitrion} */
export function crearAnfitrion({ reglas, crearTrabajador, contexto = {}, piezas, maxOrdenes = MAX_ORDENES, ahora = () => 0 }) {
  if (!reglas || !['war', 'factory'].includes(reglas.id)) throw new Error(`crearAnfitrion: solo War y Factory (recibido ${reglas?.id}).`);
  if (typeof crearTrabajador !== 'function') throw new Error('crearAnfitrion necesita crearTrabajador(fuente, unidad, recibir).');
  const fuente = fuenteTrabajador(piezas);
  const api = reglas.api || {};
  const factory = reglas.id === 'factory' ? crearControlFactory() : null;
  const ctx = {
    nombres: contexto.nombres ?? [],
    tipos: contexto.tipos ?? Object.keys(api.tipos || {}),
    sensores: contexto.sensores ?? Object.keys(api.sensores || {}),
    conf: contexto.conf ?? api.conf ?? {},
  };
  /** @type {Map<string, any>} */
  const progs = new Map();
  /** @type {{ unidad: string, mensaje: any, n: number }[]} */
  let recibidos = [];
  let llegada = 0, error = null, vivo = true, tActual = 0;
  /** @type {null | (() => void)} */
  let alCambiar = null;

  const corre = () => [...progs.values()].some(p => p.estado === 'corre');
  function fallar(p, mensaje, linea) {
    if (error) return;
    error = { unidad: p.id, mensaje, linea: linea ?? null };
    p.estado = 'error';
  }
  /** Lo que decide el turno se anota al llegar; lo demás se entrega ordenado al ceder. */
  function recibir(p, m) {
    if (!vivo || error || progs.get(p.id) !== p) return;
    if (factory) {
      if (m.type === 'error') { fallar(p, m.mensaje, m.linea); alCambiar?.(); return; }
      // Como el ciclo: encargo sin await y 500 sensores fallan sin registrarse; la consola 4001 sí se registra.
      if (!factory.recibir(p, m, fallar)) { alCambiar?.(); return; }
    }
    recibidos.push({ unidad: p.id, mensaje: m, n: ++llegada });
    if (CUENTAN.has(m.type) && ++p.mensajes > maxOrdenes)
      fallar(p, `El programa de ${p.id} dio ${maxOrdenes} órdenes y lecturas sin esperar. ¿Falta await esperar(...) dentro del bucle?`, m.linea);
    else if (m.type === 'espera') { p.estado = 'espera'; p.espera = m.id; p.despertar = p.t + m.s; }
    else if (!factory && m.type === 'done') { p.estado = 'fin'; p.finT = p.t; }
    else if (m.type === 'error') fallar(p, m.mensaje, m.linea);
    alCambiar?.();
  }

  function entregarRespuestas(respuestas) {
    for (const r of respuestas) factory?.responder(progs.get(r.unidad), r, ahora);
  }

  async function turno(instantanea, respuestas, despertar) {
    if (!vivo) throw new Error('El anfitrión está detenido.');
    entregarRespuestas(respuestas);
    const t = instantanea.t, paso = pasoDe(t);
    tActual = t;
    if (despertar) for (const p of progs.values()) {
      p.t = t;
      if (p.estado === 'nuevo') {
        p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
        p.worker.postMessage({ type: 'run', serie: reglas.id, lenguaje: p.lenguaje, codigo: p.codigo, propia: p.id,
          nombres: ctx.nombres, tipos: ctx.tipos, sensores: ctx.sensores, conf: ctx.conf, snap: instantanea });
      } else if (p.estado === 'espera' && p.despertar <= t + 1e-9) {
        p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
        p.worker.postMessage({ type: 'despierta', id: p.espera, snap: instantanea });
      }
    }
    await esperarTurno();
    // Orden fijo: unidad (orden de carga) y llegada. No depende del reloj real entre Workers.
    const orden = [...progs.keys()];
    const lote = recibidos.sort((a, b) => orden.indexOf(a.unidad) - orden.indexOf(b.unidad) || a.n - b.n);
    recibidos = [];
    /** @type {import('../protocolo/index.js').Orden[]} */
    const ordenes = [];
    const avisos = [];
    for (const { unidad, mensaje: m } of lote) {
      if (factory) factory.registrar(progs.get(unidad), m, paso, t, ordenes);
      else if (m.type === 'cmd') ordenes.push({ paso, origen: 'programa', unidad, verbo: m.verbo, args: [m.lugar ?? null] });
      avisos.push({ unidad, ...m });
    }
    return { ordenes, avisos, error };
  }

  async function esperarTurno() {
    for (;;) {
      if (error || !corre()) return;
      let entregado = false;
      for (const p of progs.values()) if (p.worker.entregar?.()) entregado = true;
      if (entregado) continue;
      if ([...progs.values()].some(p => p.estado === 'corre' && p.worker.entregar)) {
        // Imitación sin pantalla sin nada que entregar: el programa no cede (como «sin-cesion»).
        const p = [...progs.values()].find(x => x.estado === 'corre');
        fallar(p, 'Programa sin espera del juego ni tarea virtual.', null);
        error.motivo = 'sin-cesion';
        return;
      }
      await new Promise(resolve => { alCambiar = () => { alCambiar = null; resolve(undefined); }; });
    }
  }

  return {
    async cargar(unidad, codigo, opciones = {}) {
      if (progs.has(unidad)) throw new Error(`La unidad ${unidad} ya tiene programa.`);
      const p = { id: unidad, codigo, lenguaje: opciones.lenguaje === 'python' ? 'python' : 'js', estado: 'nuevo',
        mensajes: 0, espera: null, despertar: 0, t: 0, finT: null, desde: 0, worker: null,
        encargo: null, acabado: false, sensoresSeguidos: 0 };
      p.worker = crearTrabajador(fuente, unidad, m => recibir(p, m));
      if (p.worker && 'onerror' in p.worker) p.worker.onerror = ev => { ev?.preventDefault?.(); fallar(p, ev?.message || 'Error en el programa.', null); alCambiar?.(); };
      progs.set(unidad, p);
    },
    ceder(instantanea, respuestas = []) { return turno(instantanea, respuestas, true); },
    responder(respuestas) { return turno(respuestas.at(-1)?.instantanea ?? { t: tActual }, respuestas, false); },
    registro() { return factory?.registro() ?? { eventos: [], verbos: {}, resultados: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 } }; },
    algunoCorre: corre,
    estado(unidad) { return progs.get(unidad)?.estado ?? null; },
    proximaEspera() {
      let min = Infinity;
      for (const p of progs.values()) if (p.estado === 'espera') min = Math.min(min, p.despertar);
      return Number.isFinite(min) ? min : null;
    },
    detener(respuestas = []) {
      // Conserva el último resultado antes de cerrar; no ejecuta continuaciones tras el fin.
      entregarRespuestas(respuestas);
      vivo = false;
      for (const p of progs.values()) p.worker.terminate();
      alCambiar?.();
    },
  };
}
