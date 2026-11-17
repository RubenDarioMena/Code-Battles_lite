/* Un reino por creador/partida; un ámbito y una API nativa por unidad. */
import { crearInterprete } from '../interprete/index.js';
import { crearCanal } from './canal.js';
import { crearAPI } from './api.js';
import { piezasDeFuente } from './trabajador.js';

/* Holgado a propósito: el corpus necesita 44 024 y el vigía antiguo dejaba 2,5 s de cálculo.
 * Con 10^6, un bucle vacío se corta en ~60 ms y el peor medido (getter que copia) en ~0,3 s en un M1. */
export const PRESUPUESTO = 1000000;

/** @param {import('./index.js').OpcionesTrabajadorInterprete} opciones */
export function crearTrabajadorInterprete({ acorn, presupuesto = PRESUPUESTO, mensajePresupuesto, piezas: piezasInyectadas }) {
  let motor, unidades = 0;
  return function crearTrabajador(fuente, unidad, recibir, maxOrdenes = 4000) {
    motor ??= crearInterprete({ acorn, presupuesto });
    const reino = motor;
    const piezas = piezasInyectadas ?? piezasDeFuente(fuente);
    if (!piezas && fuente.startsWith('const API = ')) throw new Error('Faltan las piezas nativas de esta fuente; inyéctalas al crear el trabajador.');
    const canal = crearCanal(recibir, maxOrdenes, Boolean(piezas));
    let ambito = reino.crearAmbito({
      postMessage: m => canal.emitir(m),
      setTimeout: (fn, ms, ...args) => canal.timer(fn, ms, ...args),
      clearTimeout: id => canal.cancelar(id),
    });
    ambito.activar(); unidades++;
    let ultima, api, medida = { ...reino.medir(), contador: undefined };
    const medir = () => ultima ?? medida;
    const registrarMedida = () => { medida = { ...reino.medir(), contador: Object.getOwnPropertyDescriptor(ambito.global, '__contador')?.value }; };
    function terminate() {
      if (ultima) return;
      canal.terminate(); ambito.liberar(); ambito = null;
      ultima = { ...medida, trabajos: 0, pausas: 0, liberado: true };
      if (!--unidades) { reino.liberar(); motor = null; }
      api = null;
    }
    try {
      if (piezas) {
        api = crearAPI({ ...piezas, self: ambito.global, AF: reino.AF, Promise: reino.Promise,
          emitir: m => canal.emitir(m), programarTimer: (fn, ms) => canal.timer(fn, ms) });
        Object.defineProperty(ambito.global, '__py', { value: api.python, configurable: true });
      } else {
        // Arnés genérico de pruebas del canal; nunca se usa para el Worker del juego.
        reino.ejecutar(fuente, { usuario: false }); reino.vaciarTrabajos();
      }
    } catch (error) { terminate(); throw error; }
    return {
      postMessage: m => canal.postMessage(m),
      entregar() {
        if (!canal.vivo) return false;
        const tarea = canal.tarea();
        if (!tarea) return false;
        ambito.activar(); reino.reiniciarPresupuesto();
        try {
          if ('mensaje' in tarea) (api?.onmessage ?? ambito.global.onmessage)({ data: tarea.mensaje });
          else tarea.fn(...tarea.args);
          reino.vaciarTrabajos();
        } catch (error) {
          if (error.code !== 'CBL_PRESUPUESTO') { terminate(); throw error; }
          registrarMedida();
          canal.salidas.push({ type: 'error', mensaje: mensajePresupuesto?.(unidad) ?? error.message, linea: error.__linea,
            code: error.code });
          try { canal.vaciar(); } finally { terminate(); }
          return true;
        }
        registrarMedida(); canal.vaciar(); return true;
      },
      medir, terminate,
    };
  };
}
