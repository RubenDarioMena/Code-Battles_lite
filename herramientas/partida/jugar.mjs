/* Composición sin pantalla compartida por herramientas y pruebas de frontera. */
import { crearPartida, DT } from '../../paquetes/nucleo/index.js';
import war, { retos } from '../../paquetes/reglas-war/index.js';
import factory, { retos as retosFactory, instantaneaHistorica as fotoFactory } from '../../paquetes/reglas-factory/index.js';
import { instantaneaHistorica as fotoCampaign } from '../../paquetes/reglas-campaign/index.js';
import { crearAnfitrion } from '../../paquetes/anfitrion/index.js';
import { jugarPartida } from '../../paquetes/app/index.js';
import { cargar } from './cargar.mjs';
import { crearInstrumentador } from './instrumentar.mjs';
import { crearPrograma as programaVM } from './programa.mjs';
import { crearHuella } from './huella.mjs';

/** Conserva los undefined que entraron en las huellas de la fase 0. */
export function instantaneaHuella(reglas, partida) {
  if (reglas.id === 'war') return partida.instantanea();
  const mundo = partida.mundo;
  return { t: mundo.t, maq: {}, auto: {}, vib: {},
    [reglas.id]: (reglas.id === 'factory' ? fotoFactory : fotoCampaign)(mundo) };
}

/** Valida opciones de la CLI y crea el escenario, sin cambiar sus formatos.
 * @param {any} opciones */
export function prepararEscenario({ reglas: serie, reto, semilla, intento = semilla, escenario, maxPasos = 10000 }) {
  const esFactory = serie === 'factory';
  if (esFactory) {
    if (!Number.isSafeInteger(intento) || intento < 1) throw new Error('--intento debe ser un entero seguro positivo.');
    if (semilla != null && semilla !== intento) throw new Error('--semilla y --intento deben coincidir en Factory.');
    semilla = intento;
  }
  if (!Number.isInteger(reto) || reto < 1 || reto > (esFactory ? 7 : 5)) throw new Error(`--reto debe estar entre 1 y ${esFactory ? 7 : 5}.`);
  if (!Number.isSafeInteger(semilla)) throw new Error('--semilla debe ser un entero seguro.');
  if (escenario && (!esFactory || reto !== 7)) throw new Error('Solo Factory --reto 7 admite escenario propio.');
  const def = esFactory ? (reto === 7 ? retosFactory.normalizar(escenario) : retosFactory.RETOS[reto - 1])
    : retos.normalizar(retos.RETOS[reto - 1]);
  return { reglas: esFactory ? factory : war, escenario: { reto: def, ...(esFactory ? { intento } : {}) }, semilla, maxPasos };
}

/** Un intento o tramo, sobre crearAnfitrion + jugarPartida. Devuelve también la partida para repetición.
 * @param {any} opciones */
export async function jugar({ reglas, escenario, semilla = 1, partida: existente, programas, maxPasos = 10000,
  vista, ordenes, detener, alPaso, alSucesos, alTurno, sesion = cargar(), crearPrograma = programaVM }) {
  if (!Number.isInteger(maxPasos) || maxPasos < 1) throw new Error('--max-pasos debe ser un entero positivo.');
  const partida = existente ?? crearPartida({ reglas, escenario, semilla });
  const mundo = partida.mundo, def = mundo.def;
  const { contexto: C, fuenteWorker } = sesion;
  const lenguaje = crearInstrumentador(C, mundo, reglas.id), idiomas = {};
  const mensajes = {}, recibidos = [], eventos = [];
  const anfitrion = crearAnfitrion({ reglas, maxOrdenes: 4000,
    crearTrabajador: (_fuente, unidad, recibir) => {
      const worker = crearPrograma(fuenteWorker, unidad, m => {
        if (anfitrion.fallo()) return;
        recibidos.push(m.type); recibir(m);
      }, 4000);
      return { ...worker,
        entregar() {
          let tareas = 0;
          // Vacía los timers locales del turno antes de otra foto del mundo, como el ciclo original.
          // Campaign emite «cede» con setTimeout(0), incluso después de avisar de un encargo/espera.
          while (!anfitrion.fallo() && worker.entregar()) {
            if (++tareas > 1000000) throw new Error('La cola virtual no cede tras un millón de tareas; no hay resultado comparable.');
          }
          return tareas > 0;
        },
      };
    },
    contexto: { nombres: (reglas.id === 'campaign' ? mundo.unidades : reglas.id === 'factory' ? mundo.maquinas
      : [...mundo.programables, ...mundo.sensores]).map(e => e.id),
      tipos: Object.keys(war.api.tipos), sensores: Object.keys(war.api.sensores), conf: war.api.conf } });
  if (programas) for (const id of Object.keys(programas)) {
    if (!mundo.programables.some(l => l.id === id)) throw new Error(`Unidad no programable en el reto ${def.titulo}: ${id}`);
  }
  try {
    for (const l of mundo.programables) {
      const fuente = programas ? programas[l.id] ?? '' : (def.inicial[l.id] || []).join('\n');
      const idioma = typeof fuente === 'string' ? 'js' : fuente?.lenguaje;
      const texto = typeof fuente === 'string' ? fuente : fuente?.codigo;
      if (!['js', 'python'].includes(idioma) || typeof texto !== 'string')
        throw new Error(`Programa inválido para ${l.id}: se espera código o { lenguaje, codigo }.`);
      idiomas[l.id] = idioma;
      let codigo = texto, err;
      if (idioma === 'python') {
        const traduccion = C.CMGPythonJS.traducirCache(texto, lenguaje.opcionesPython());
        if (traduccion.ok) codigo = traduccion.js;
        else err = traduccion.diagnosticos[0];
      } else if (reglas.id !== 'factory') err = lenguaje.revisar(texto);
      if (err) throw new Error(`${l.id}, línea ${err.linea}: ${err.mensaje}`);
      await anfitrion.cargar(l.id, lenguaje.instrumentar(codigo), { lenguaje: idioma });
    }
  } catch (error) { anfitrion.detener(); throw error; }
  const huella = crearHuella();
  let desde = 0, pasos = 0, r;
  const contar = () => { for (const tipo of recibidos.splice(0)) mensajes[tipo] = (mensajes[tipo] || 0) + 1; };
  try {
    r = await jugarPartida({ reglas, partida, escenario, semilla, anfitrion, maxPasos, vista, ordenes, detener: p => detener?.(p, anfitrion),
      alPaso(n, _snap, p) {
        pasos = n;
        const snap = instantaneaHuella(reglas, p);
        huella.paso(snap); alPaso?.(n, snap, p);
      },
      alSucesos(lista) {
        for (const s of lista) if (s.tipo === 'registro') eventos.push({ t: +(s.paso * DT).toFixed(2), ...s.datos, linea: s.datos.linea ?? '' });
        alSucesos?.(lista);
      },
      alTurno(turno) {
        // Incluye mensajes rechazados por el anfitrión (sensor 501, segundo encargo, error), como el ciclo original.
        contar();
        const nuevos = anfitrion.registro({ desde }).eventos;
        eventos.push(...nuevos); desde += nuevos.length;
        alTurno?.(turno);
      } });
  } catch (error) {
    if (error.code !== 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw error;
    r = { partida, pasos, limite: false, evaluacion: partida.evaluar(), instantanea: partida.instantanea(),
      error: { motivo: 'vm-timeout', mensaje: 'El programa no cedió dentro del límite de VM (1000 ms).', linea: null, unidad: null } };
  } finally { contar(); }
  const final = r.error ? { fin: r.error.motivo ? 'bloqueado' : 'error', motivo: r.error.motivo ?? 'error',
    mensaje: idiomas[r.error.unidad] === 'python' ? lenguaje.mensajePython(r.error.mensaje) : r.error.mensaje,
    linea: r.error.linea, unidad: r.error.motivo ? null : r.error.unidad }
    : r.limite ? { fin: 'límite', motivo: 'pasos', mensaje: `Límite de ${maxPasos} pasos.` } : r.evaluacion;
  return { ...r, final, anfitrion, registro: anfitrion.registro(), eventos, mensajes, huella: huella.terminar() };
}

