import { performance } from 'node:perf_hooks';
import { cargar } from './cargar.mjs';
import { crearInstrumentador } from './instrumentar.mjs';
import { crearPrograma } from './programa.mjs';
import { crearHuella } from './huella.mjs';

/** @typedef {string | { lenguaje: 'js' | 'python', codigo: string }} Fuente */
/** @typedef {{ reto: number, semilla: number, programas?: Record<string, Fuente>, maxPasos?: number,
 * alPaso?: (paso: number, instantanea: any) => void }} OpcionesWar */

/** Normaliza solo los argumentos del hook terminar y el estado final, sin tiempo real.
 * Es autocontenida para poder usarla también en el contraste del navegador.
 * @param {any} mundo @param {string} fin @param {string|null} motivo
 * @param {string|null} texto @param {number|null} [linea] @param {string|null} [idProg] */
export function resultadoWar(mundo, fin, motivo, texto, linea, idProg) {
  return { fin, motivo, t: mundo.t, texto: texto ?? null, linea: linea ?? null, idProg: idProg ?? null };
}

/** Ejecuta únicamente War sobre las reglas, instrumentador y Worker actuales del juego.
 * @param {OpcionesWar} opciones */
export function ejecutarWar({ reto, semilla, programas, maxPasos = 10000, alPaso }) {
  if (!Number.isInteger(reto) || reto < 1 || reto > 5) throw new Error('--reto debe estar entre 1 y 5.');
  if (!Number.isSafeInteger(semilla)) throw new Error('--semilla debe ser un entero seguro.');
  if (!Number.isInteger(maxPasos) || maxPasos < 1) throw new Error('--max-pasos debe ser un entero positivo.');
  const inicio = performance.now();
  const { contexto: C, fuenteWorker } = cargar();
  const { WAR, WAR_RETOS, RUNTIME, NUCLEO } = C;
  const def = WAR_RETOS.normalizar(WAR_RETOS.RETOS[reto - 1]);
  const mundo = WAR.crear(def, semilla);
  const lenguaje = crearInstrumentador(C, mundo);
  const huella = crearHuella();
  const mensajes = {};
  const ejec = { progs: new Map(), lenguajes: {} };
  const MAX_ORDENES = 4000;
  let resultado = null, pasos = 0;

  const registrar = (maquina, linea, que, res, clase) => {
    mundo.eventos.push({ t: +mundo.t.toFixed(2), maquina, linea: linea ?? '', que, resultado: res, clase });
  };
  const terminar = (fin, motivo, texto, linea = null, id = null) => {
    if (mundo.fin) return;
    resultado = resultadoWar(mundo, fin, motivo, texto, linea, id);
    mundo.fin = fin; mundo.activo = false;
    for (const p of ejec.progs.values()) p.worker.terminate();
  };
  const combate = WAR.conectar(mundo, {
    registrar, terminar,
    // Ambos hooks son exclusivamente presentación; no escriben en las reglas.
    avisoSistema() {}, globo() {},
  });
  const errorPrograma = (p, mensaje, linea) => terminar('error', 'error',
    ejec.lenguajes[p.id] === 'python' ? lenguaje.mensajePython(mensaje) : mensaje, linea, p.id);
  const { fmtLugar, fmtValor } = lenguaje;
  const contarUso = (id, fn) => {
    const u = mundo.uso[id] || (mundo.uso[id] = {}); u[fn] = (u[fn] || 0) + 1;
  };
  function alMensaje(p, m) {
    if (!mundo.activo || ejec.progs.get(p.id) !== p) return;
    mensajes[m.type] = (mensajes[m.type] || 0) + 1;
    if (m.type === 'traza') return;
    if (m.type === 'lee') {
      contarUso(p.id, m.fn);
      const sensor = mundo.porId[m.maquina];
      if (sensor?.st?.lecturas != null) sensor.st.lecturas++;
      registrar(p.id, m.linea, m.que, fmtValor(m.valor), 'sensor');
    } else if (m.type === 'cmd') {
      contarUso(p.id, m.verbo);
      const l = mundo.porId[p.id];
      if (m.verbo === 'stopFire' || !m.lugar) { l.modo = 'idle'; l.lugar = null; }
      else {
        const modo = m.verbo === 'burstFire' ? 'burst' : 'regular';
        if (modo === 'burst' && l.modo !== 'burst') l.falla = Math.max(l.falla, WAR.LAU.fallaRafaga);
        l.modo = modo; l.lugar = m.lugar;
      }
      registrar(p.id, m.linea, `${m.verbo}(${m.verbo === 'stopFire' ? '' : fmtLugar(m.lugar)})`, m.res, m.res === 'ok' ? 'ok' : 'warn');
    } else if (m.type === 'consola') {
      mundo.consolas[m.nivel] = (mundo.consolas[m.nivel] || 0) + 1;
      registrar(p.id, m.linea, ejec.lenguajes[p.id] === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
        m.texto, m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor');
    } else if (m.type === 'espera') {
      contarUso(p.id, 'esperar'); p.estado = 'espera'; p.espera = m.id; p.despertar = mundo.t + m.s;
    } else if (m.type === 'done') {
      p.acabado = true; p.estado = 'fin'; p.finT = mundo.t;
    } else if (m.type === 'error') return errorPrograma(p, m.mensaje, m.linea);
    if (['lee', 'cmd', 'consola'].includes(m.type) && ++p.mensajes > MAX_ORDENES)
      errorPrograma(p, `El programa de ${p.id} dio ${MAX_ORDENES} órdenes y lecturas sin esperar. ¿Falta await esperar(...) dentro del bucle?`, m.linea);
  }

  // Revisar/traducir TODO antes de arrancar, igual que ejecutar() en juego.js.
  const codigos = {};
  if (programas) for (const id of Object.keys(programas)) {
    if (!mundo.programables.some(l => l.id === id)) throw new Error(`Unidad no programable en el reto ${reto}: ${id}`);
  }
  for (const l of mundo.programables) {
    const fuente = programas ? programas[l.id] ?? '' : (def.inicial[l.id] || []).join('\n');
    const idioma = typeof fuente === 'string' ? 'js' : fuente?.lenguaje;
    const texto = typeof fuente === 'string' ? fuente : fuente?.codigo;
    if (!['js', 'python'].includes(idioma) || typeof texto !== 'string')
      throw new Error(`Programa inválido para ${l.id}: se espera código o { lenguaje, codigo }.`);
    ejec.lenguajes[l.id] = idioma;
    let codigo = texto, err;
    if (idioma === 'python') {
      const traduccion = C.CMGPythonJS.traducirCache(texto, lenguaje.opcionesPython());
      if (traduccion.ok) codigo = traduccion.js;
      else err = traduccion.diagnosticos[0];
    } else err = lenguaje.revisar(texto);
    if (err) throw new Error(`${l.id}, línea ${err.linea}: ${err.mensaje}`);
    codigos[l.id] = lenguaje.instrumentar(codigo);
  }

  mundo.activo = true;
  const snap = combate.instantanea();
  for (const l of mundo.programables) {
    const p = { id: l.id, estado: 'corre', desde: 0, mensajes: 0, espera: null, despertar: 0,
      worker: null, acabado: false, finT: null };
    p.worker = crearPrograma(fuenteWorker, l.id, m => alMensaje(p, m), MAX_ORDENES);
    ejec.progs.set(l.id, p);
    p.worker.postMessage({ type: 'run', serie: def.serie, lenguaje: ejec.lenguajes[l.id], codigo: codigos[l.id],
      propia: l.id, nombres: [...mundo.programables, ...mundo.sensores].map(e => e.id),
      tipos: Object.keys(WAR.TIPOS), sensores: Object.keys(WAR.SENSOR),
      conf: { fallaRafaga: WAR.LAU.fallaRafaga, cadencia: WAR.LAU.cadencia, cadenciaRafaga: WAR.LAU.cadenciaRafaga }, snap });
  }
  // El acumulador real de bucle(now) solo dosifica pasos. Aquí se ofrece un DT
  // cada vez; NUCLEO y RUNTIME reales conservan el punto exacto de despertar.
  let acum = 0, tareas = 0;
  const algunoCorre = () => RUNTIME.algunoCorre(ejec);
  try {
    while (mundo.activo && !mundo.fin) {
      let entregado = false;
      for (const p of ejec.progs.values()) if (p.worker.entregar()) entregado = true;
      if (entregado) {
        if (++tareas > 1000000) throw new Error('La cola virtual no cede tras un millón de tareas; no hay resultado comparable.');
        continue;
      }
      if (algunoCorre()) throw new Error('Programa bloqueado sin espera del juego ni tarea virtual; no hay resultado comparable.');
      if (pasos >= maxPasos) { terminar('límite', 'pasos', `Límite de ${maxPasos} pasos.`); break; }
      acum = NUCLEO.avanzar(Math.max(acum, NUCLEO.DT), mundo, {
        algunoCorre,
        despertarProgramas: () => RUNTIME.despertar(ejec, mundo, () => combate.instantanea()),
        paso(dt) {
          combate.paso(dt);
          const actual = combate.instantanea();
          huella.paso(actual); pasos++; alPaso?.(pasos, actual);
        },
      });
    }
  } finally { for (const p of ejec.progs.values()) p.worker.terminate(); }
  const h = huella.terminar();
  return { reglas: 'war', reto, semilla, resultado,
    metricas: { pasos: h.pasos, t: mundo.t, mensajes, ms: performance.now() - inicio },
    hash: h.hash, instantanea: h.instantanea };
}
