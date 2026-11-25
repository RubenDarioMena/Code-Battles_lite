/* crearAnfitrion: carga los programas y cede el turno hasta que todos esperan.
 * Mensajes trasladados del «Ciclo de los programas» de juego.js (alMensaje).
 * El juego y la herramienta lo componen con el mismo conductor. */
import { pasoDe } from '../nucleo/index.js';
import { fuenteTrabajador } from './trabajador.js';
import { crearControlFactory } from './factory.js';
import { crearControlCampaign } from './campaign.js';
import { crearControlWar } from './war.js';
import { despertarCampaign } from './despertar.js';

const MAX_ORDENES = 4000;
const CUENTAN = new Set(['lee', 'cmd', 'consola']);

/** @param {import('./index.js').OpcionesAnfitrion} opciones
 * @returns {import('./index.js').Anfitrion} */
export function crearAnfitrion({ reglas, crearTrabajador, contexto = {}, piezas, maxOrdenes = MAX_ORDENES, ahora = () => 0, pasoAPaso = false, aislarErrores = false, eventos = [], erroresEvento }) {
  if (!reglas || !['war', 'factory', 'campaign'].includes(reglas.id)) throw new Error(`crearAnfitrion: solo War, Factory y Campaign (recibido ${reglas?.id}).`);
  if (typeof crearTrabajador !== 'function') throw new Error('crearAnfitrion necesita crearTrabajador(fuente, unidad, recibir).');
  const fuente = fuenteTrabajador(piezas);
  const api = reglas.api || {};
  const factory = reglas.id === 'factory' ? crearControlFactory() : null;
  const campaign = reglas.id === 'campaign' ? crearControlCampaign() : null;
  const war = reglas.id === 'war' ? crearControlWar() : null;
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

  const pausas = () => pasoAPaso && vivo && !error ? [...progs.values()].flatMap(p => {
    const pausa = p.worker.pausa?.();
    return pausa ? [{ unidad: p.id, linea: pausa.linea }] : [];
  }) : [];
  const corre = () => vivo && [...progs.values()].some(p => p.estado === 'corre');
  function fallar(p, mensaje, linea, motivo = undefined) {
    if (!vivo || error || progs.get(p.id) !== p || p.estado === 'error') return;
    const fallo = { unidad: p.id, mensaje, linea: linea ?? null, ...(motivo ? { motivo } : {}) };
    if (aislarErrores) {
      p.pend.clear();
      p.worker.terminate();
      recibidos.push({ unidad: p.id, mensaje: { type: 'errorUnidad', ...fallo }, n: ++llegada });
    } else error = fallo;
    p.estado = 'error';
  }
  /** Lo que decide el turno se anota al llegar; lo demás se entrega ordenado al ceder. */
  function recibir(p, m) {
    if (!vivo || error || p.estado === 'error' || progs.get(p.id) !== p) return;
    if (factory) {
      if (m.type === 'error') { fallar(p, m.mensaje, m.linea); alCambiar?.(); return; }
      // Como el ciclo: encargo sin await y 500 sensores fallan sin registrarse; la consola 4001 sí se registra.
      if (!factory.recibir(p, m, fallar)) { alCambiar?.(); return; }
    }
    recibidos.push({ unidad: p.id, mensaje: m, n: ++llegada });
    if (campaign) campaign.recibir(p, m, fallar, maxOrdenes);
    else if (CUENTAN.has(m.type) && ++p.mensajes > maxOrdenes)
      fallar(p, `El programa de ${p.id} dio ${maxOrdenes} órdenes y lecturas sin esperar. ¿Falta await esperar(...) dentro del bucle?`, m.linea);
    else if (eventos.length && m.type !== 'error') {
      if (m.type === 'oyente') p.oyentes.set(m.evento, (p.oyentes.get(m.evento) || 0) + 1);
      if (m.type === 'esperaEvento') p.pend.set(m.id, { evento: m.evento, campo: m.campo, valor: m.valor });
      if (m.type === 'espera') p.pend.set(m.id, { tipo: 'espera', despertar: p.t + m.s });
      if (m.type === 'done' || m.type === 'escuchando') p.acabado = true;
      if (m.type === 'reposo' && !--p.entregas) {
        if (p.pend.size) p.estado = 'espera';
        else if (p.oyentes.size) p.estado = 'escuchando';
        else if (p.acabado) p.estado = 'fin';
        else fallar(p, 'Programa sin espera del juego ni tarea virtual.', null, 'sin-cesion');
      }
    }
    else if (m.type === 'espera') { p.estado = 'espera'; p.espera = m.id; p.despertar = p.t + m.s; }
    else if (!factory && m.type === 'done') { p.estado = 'fin'; p.finT = p.t; }
    else if (m.type === 'error') fallar(p, m.mensaje, m.linea);
    alCambiar?.();
  }

  function entregarRespuestas(respuestas) {
    for (const r of respuestas) {
      factory?.responder(progs.get(r.unidad), r, ahora);
      campaign?.responder(progs, r, ahora);
    }
  }

  async function turno(instantanea, respuestas, despertar, emitidos = []) {
    if (!vivo) throw new Error('El anfitrión está detenido.');
    entregarRespuestas(respuestas);
    const t = instantanea.t, paso = pasoDe(t);
    tActual = t;
    war?.observar(instantanea);
    for (const [id, unidad] of Object.entries(instantanea.moviles ?? {})) {
      const p = progs.get(id);
      if (!p) continue;
      if (!unidad && p.estado !== 'ausente') {
        p.worker.terminate(); p.pend.clear(); p.oyentes.clear(); p.estado = 'ausente';
      } else if (unidad && p.estado === 'ausente') reemplazar(p, p.codigo, p);
    }
    if (despertar) for (const p of progs.values()) {
      p.t = t;
      if (p.estado === 'nuevo') {
        if (p.diagnostico) { fallar(p, p.diagnostico.mensaje, p.diagnostico.linea); continue; }
        p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
        if (eventos.length) p.entregas++;
        p.worker.postMessage({ ...(eventos.length ? { eventos, erroresEvento } : {}), type: 'run', serie: reglas.id, lenguaje: p.lenguaje, codigo: p.codigo, propia: p.id,
          nombres: ctx.nombres, tipos: ctx.tipos, sensores: ctx.sensores, conf: ctx.conf, snap: instantanea });
      } else if (eventos.length) {
        for (const [id, e] of p.pend) if (e.despertar <= t + 1e-9) {
          p.pend.delete(id);
          enviar(p, { type: 'despierta', id }, instantanea);
        }
      } else if (!campaign && p.estado === 'espera' && p.despertar <= t + 1e-9) {
        p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
        p.worker.postMessage({ type: 'despierta', id: p.espera, snap: instantanea });
      }
    }
    if (despertar && campaign) despertarCampaign({ progs }, { t }, () => instantanea, ahora);
    for (const { evento, unidad, datos } of emitidos) {
      const p = progs.get(unidad);
      if (!p || p.estado === 'error' || p.estado === 'ausente') continue;
      for (const [id, espera] of p.pend) if (espera.evento === evento && espera.valor === datos?.[espera.campo]) {
        p.pend.delete(id);
        enviar(p, { type: 'despierta', id, resultado: datos.resultado }, instantanea);
      }
      for (let indice = 0; indice < (p.oyentes.get(evento) ?? 0); indice++)
        enviar(p, { type: 'evento', evento, indice, datos }, instantanea);
    }
    await esperarTurno();
    // Orden fijo: unidad (orden de carga) y llegada. No depende del reloj real entre Workers.
    const lote = recibidos.sort((a, b) => progs.get(a.unidad).orden - progs.get(b.unidad).orden || a.n - b.n);
    recibidos = [];
    /** @type {import('../protocolo/index.js').Orden[]} */
    const ordenes = [];
    const avisos = [];
    for (const { unidad, mensaje: m } of lote) {
      if (factory) factory.registrar(progs.get(unidad), m, paso, t, ordenes);
      else if (campaign) campaign.registrar(progs.get(unidad), m, paso, t, ordenes);
      else war.registrar(progs.get(unidad), m, paso, t, ordenes);
      avisos.push({ ...m, unidad });
    }
    return { ordenes, avisos, error };
  }

  function enviar(p, mensaje, snap) {
    p.entregas++; p.t = snap.t; p.estado = 'corre'; p.desde = ahora(); p.mensajes = 0;
    p.worker.postMessage({ ...mensaje, snap });
  }

  async function esperarTurno() {
    for (;;) {
      if (!vivo || error || !corre()) return;
      let entregado = false;
      for (const p of progs.values()) {
        if (p.worker.entregar?.()) entregado = true;
        // Conserva la secuencia de entregas normal, incluso mensajes «done» de
        // programas vacíos: no arranca otra unidad mientras esta entrega pausa.
        if (pasoAPaso && p.worker.pausa?.()) break;
      }
      if (entregado) continue;
      if ((!pasoAPaso || !pausas().length) && [...progs.values()].some(p => p.estado === 'corre' && p.worker.entregar)) {
        // Imitación sin pantalla sin nada que entregar: el programa no cede (como «sin-cesion»).
        const p = [...progs.values()].find(x => x.estado === 'corre');
        fallar(p, 'Programa sin espera del juego ni tarea virtual.', null, 'sin-cesion');
        continue;
      }
      await new Promise(resolve => { alCambiar = () => { alCambiar = null; resolve(undefined); }; });
    }
  }

  function instalar(unidad, codigo, opciones, orden) {
    const p = { id: unidad, orden, diagnostico: opciones.diagnostico, codigo, lenguaje: opciones.lenguaje === 'python' ? 'python' : 'js', estado: 'nuevo',
      mensajes: 0, espera: null, despertar: 0, t: 0, finT: null, desde: 0, worker: null,
      entregas: 0, oyentes: new Map(), encargo: null, acabado: false, sensoresSeguidos: 0, pend: new Map() };
    p.worker = pasoAPaso
      ? crearTrabajador(fuente, unidad, m => recibir(p, m), maxOrdenes, { depurar: true })
      : crearTrabajador(fuente, unidad, m => recibir(p, m));
    if (pasoAPaso && (!p.worker.pausa || !p.worker.reanudar)) {
      p.worker.terminate(); throw new Error('El paso a paso necesita una unidad depurable.');
    }
    if (p.worker && 'onerror' in p.worker) p.worker.onerror = ev => { ev?.preventDefault?.(); fallar(p, ev?.message || 'Error en el programa.', null); alCambiar?.(); };
    progs.set(unidad, p);
  }

  function reemplazar(anterior, codigo, opciones) {
    instalar(anterior.id, codigo, opciones, anterior.orden);
    anterior.worker.terminate();
  }

  return {
    pausas,
    async avanzarLinea(unidad) {
      const pausa = unidad == null ? pausas()[0] : pausas().find(p => p.unidad === unidad);
      if (!pausa) return null;
      const p = progs.get(pausa.unidad);
      p.worker.reanudar();
      // Incluye los timers de cesión de Campaign antes de resolver el turno.
      while (vivo && !error && p.worker.entregar()) { /* tareas virtuales */ }
      alCambiar?.();
      await Promise.resolve();
      const siguiente = pausas().find(x => x.unidad === p.id);
      return siguiente ?? { unidad: p.id, finTurno: true };
    },
    async continuar() {
      while (pausas().length) await this.avanzarLinea();
    },
    async cargar(unidad, codigo, opciones = {}) {
      if (progs.has(unidad)) throw new Error(`La unidad ${unidad} ya tiene programa.`);
      instalar(unidad, codigo, opciones, progs.size);
    },
    async recargar(unidad, codigo, opciones = {}) {
      const anterior = progs.get(unidad);
      if (!vivo || !anterior) throw new Error(`No hay programa activo para ${unidad}.`);
      if (anterior.estado === 'ausente') {
        anterior.codigo = codigo; anterior.lenguaje = opciones.lenguaje; anterior.diagnostico = opciones.diagnostico;
      } else reemplazar(anterior, codigo, opciones);
    },
    escucha(unidad, evento) {
      const p = progs.get(unidad);
      return !!(vivo && p && p.estado !== 'error' && p.oyentes.has(evento));
    },
    entregarEventos(instantanea, emitidos) { return turno(instantanea, [], false, emitidos); },
    ceder(instantanea, respuestas = []) { return turno(instantanea, respuestas, true); },
    responder(respuestas) { return turno(respuestas.at(-1)?.instantanea ?? { t: tActual }, respuestas, false); },
    registro({ desde = 0 } = {}) { return (campaign ?? factory ?? war).registro(desde); },
    vigilar(ahora, ms, mensaje) {
      if (!vivo || error) return null;
      for (const p of progs.values()) if (p.estado === 'corre' && ahora - p.desde >= ms) {
        fallar(p, mensaje(p.id), null);
        alCambiar?.();
        return p.id;
      }
      return null;
    },
    algunoCorre: corre,
    // Fallo ya anotado aunque su turno haya terminado (con Workers reales, un mensaje que llega tras cerrar el turno).
    fallo() { return error; },
    estado(unidad) { return progs.get(unidad)?.estado ?? null; },
    proximaEspera() {
      let min = Infinity;
      for (const p of progs.values()) {
        if (campaign || eventos.length) for (const e of p.pend.values()) { if (e.tipo === 'espera') min = Math.min(min, e.despertar); }
        else if (p.estado === 'espera') min = Math.min(min, p.despertar);
      }
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
