import { performance } from 'node:perf_hooks';
import { legado, retos } from '../../paquetes/reglas-war/index.js';
import { legado as factoryLegado, retos as factoryRetos } from '../../paquetes/reglas-factory/index.js';
import { DT, avanzar } from '../../paquetes/nucleo/index.js';
import { cargar } from './cargar.mjs';
import { crearInstrumentador } from './instrumentar.mjs';
import { crearPrograma } from './programa.mjs';
import { crearHuella } from './huella.mjs';


/** Ciclo común de carga, revisión, mensajes, Workers virtuales y paso fijo.
 * @param {any} opciones */
export function ejecutarCiclo({ reglas, reto, semilla, intento = semilla, escenario, programas, maxPasos = 10000, alPaso, capturarResultado, conectarReglas, sesion }) {
  const factory = reglas === 'factory', campaign = reglas === 'campaign';
  if (factory) {
    if (!Number.isSafeInteger(intento) || intento < 1) throw new Error('--intento debe ser un entero seguro positivo.');
    if (semilla != null && semilla !== intento) throw new Error('--semilla y --intento deben coincidir en Factory.');
    semilla = intento;
  }
  if (!campaign && (!Number.isInteger(reto) || reto < 1 || reto > (factory ? 7 : 5))) throw new Error(`--reto debe estar entre 1 y ${factory ? 7 : 5}.`);
  if (!campaign && !Number.isSafeInteger(semilla)) throw new Error('--semilla debe ser un entero seguro.');
  if (!Number.isInteger(maxPasos) || maxPasos < 1) throw new Error('--max-pasos debe ser un entero positivo.');
  const inicio = performance.now();
  const { contexto: C, fuenteWorker } = sesion ?? cargar();
  const { RUNTIME } = C;
  const def = campaign ? C.CAMPAIGN_NIVEL.NIVEL : factory ? (reto === 7 ? factoryRetos.normalizar(escenario) : factoryRetos.RETOS[reto - 1])
    : retos.normalizar(retos.RETOS[reto - 1]);
  if (escenario && (!factory || reto !== 7)) throw new Error('Solo Factory --reto 7 admite escenario propio.');
  const mundo = sesion?.mundo ?? (factory ? factoryLegado : legado).crear(def, semilla);
  const lenguaje = crearInstrumentador(C, mundo, reglas);
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
    resultado = capturarResultado(mundo, fin, motivo, texto, linea, id);
    if (!campaign) mundo.fin = fin;
    mundo.activo = false;
    if (factory) { mundo.robot.tarea = null; mundo.revelado = true; }
    for (const p of ejec.progs.values()) p.worker.terminate();
  };
  let extension;
  const combate = (factory || campaign) ? (extension = conectarReglas(C, mundo, ejec, terminar)).reglas : legado.conectar(mundo, {
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
    if ((factory || campaign) && extension.mensaje(p, m, errorPrograma)) return;
    if (m.type === 'lee') {
      contarUso(p.id, m.fn);
      const sensor = mundo.porId[m.maquina];
      if (sensor?.st?.lecturas != null) sensor.st.lecturas++;
      registrar(p.id, m.linea, m.que, fmtValor(m.valor), 'sensor');
    } else if (m.type === 'cmd') {
      contarUso(p.id, m.verbo);
      legado.aplicarOrden(mundo, { paso: Math.round(mundo.t / DT), origen: "programa", unidad: p.id, verbo: m.verbo, args: [m.lugar ?? null] });
      registrar(p.id, m.linea, `${m.verbo}(${m.verbo === 'stopFire' ? '' : fmtLugar(m.lugar)})`, m.res, m.res === 'ok' ? 'ok' : 'warn');
    } else if (m.type === 'consola') {
      mundo.consolas[m.nivel] = (mundo.consolas[m.nivel] || 0) + 1;
      registrar(p.id, m.linea, ejec.lenguajes[p.id] === 'python' ? (m.nivel === 'log' ? 'print' : m.nivel) : `console.${m.nivel}`,
        m.texto, m.nivel === 'error' ? 'bad' : m.nivel === 'warn' ? 'warn' : 'sensor');
    } else if (m.type === 'espera') {
      contarUso(p.id, 'esperar'); p.estado = 'espera'; p.espera = m.id; p.despertar = mundo.t + m.s;
    } else if (m.type === 'done') {
      p.acabado = true; p.estado = p.encargo ? 'encargo' : 'fin'; p.finT = mundo.t;
    } else if (m.type === 'error') return errorPrograma(p, m.mensaje, m.linea);
    if (factory && m.type === 'done') { combate.evaluar(); return; }
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
    } else if (!factory) err = lenguaje.revisar(texto);
    if (err) throw new Error(`${l.id}, línea ${err.linea}: ${err.mensaje}`);
    codigos[l.id] = lenguaje.instrumentar(codigo);
  }

  if (campaign) { mundo.fin = null; mundo.eventos = []; }
  mundo.activo = true;
  const instantanea = campaign ? () => ({ t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: combate.instantanea() }) : factory ? () => ({ t: mundo.t, maq: {}, auto: {}, vib: {}, factory: factoryLegado.instantanea(mundo) })
    : () => combate.instantanea();
  const snap = instantanea();
  for (const l of mundo.programables) {
    const p = { id: l.id, estado: 'corre', desde: 0, mensajes: 0, espera: null, despertar: 0,
      worker: null, acabado: false, finT: null, pend: new Map() };
    p.worker = crearPrograma(fuenteWorker, l.id, m => alMensaje(p, m), MAX_ORDENES);
    ejec.progs.set(l.id, p);
    p.worker.postMessage({ type: 'run', serie: def.serie, lenguaje: ejec.lenguajes[l.id], codigo: codigos[l.id],
      propia: l.id, nombres: (campaign ? mundo.unidades : factory ? mundo.maquinas : [...mundo.programables, ...mundo.sensores]).map(e => e.id),
      tipos: Object.keys(legado.TIPOS), sensores: Object.keys(legado.SENSOR),
      conf: { fallaRafaga: legado.LAU.fallaRafaga, cadencia: legado.LAU.cadencia, cadenciaRafaga: legado.LAU.cadenciaRafaga }, snap });
  }
  if (factory) combate.evaluar();
  // El acumulador real de bucle(now) solo dosifica pasos. Aquí se ofrece un DT
  // cada vez; el núcleo y RUNTIME reales conservan el punto exacto de despertar.
  let acum = 0, tareas = 0;
  const algunoCorre = () => RUNTIME.algunoCorre(ejec);
  try {
    while (mundo.activo && !mundo.fin && !extension?.detenido?.()) {
      let entregado = false;
      for (const p of ejec.progs.values()) if (p.worker.entregar()) entregado = true;
      if (entregado) {
        if (++tareas > 1000000) throw new Error('La cola virtual no cede tras un millón de tareas; no hay resultado comparable.');
        continue;
      }
      if (campaign && [...ejec.progs.values()].every(p => p.estado === 'fin') && combate.quieto()) {
        terminar('detenido', 'quieto', null); break;
      }
      if (algunoCorre()) { terminar('bloqueado', 'sin-cesion', 'Programa sin espera del juego ni tarea virtual.'); break; }
      if (pasos >= maxPasos) { terminar('límite', 'pasos', `Límite de ${maxPasos} pasos.`); break; }
      acum = avanzar(Math.max(acum, DT), mundo, {
        algunoCorre,
        despertarProgramas: () => (campaign ? RUNTIME.despertarCampaign : RUNTIME.despertar)(ejec, mundo, instantanea),
        paso(dt) {
          combate.paso(dt);
          const actual = instantanea();
          huella.paso(actual); pasos++;
          if (sesion) { sesion.huella.paso(actual); sesion.pasos++; }
          alPaso?.(sesion?.pasos ?? pasos, actual);
        },
      });
    }
  } catch (error) {
    if (error.code !== 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw error;
    terminar('bloqueado', 'vm-timeout', 'El programa no cedió dentro del límite de VM (1000 ms).');
  } finally { for (const p of ejec.progs.values()) p.worker.terminate(); }
  if (campaign) {
    resultado ||= capturarResultado(mundo, 'detenido', 'detenido', null);
    mundo.activo = false; combate.cancelarTareas(); combate.soltarLuces(); mundo.uso = {};
  }
  const h = huella.terminar();
  return { reglas, reto, semilla, ...(factory ? { intento } : {}), resultado,
    metricas: { pasos: h.pasos, t: mundo.t, mensajes, ms: performance.now() - inicio },
    hash: h.hash, instantanea: h.instantanea };
}
