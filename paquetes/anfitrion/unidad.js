/* Ejecuta el arnés histórico completo en una unidad del intérprete, sin Worker. */
import { crearInterprete } from '../interprete/index.js';
import { crearCanal } from './canal.js';

/** @param {import('./index.js').OpcionesTrabajadorInterprete} opciones */
export function crearTrabajadorInterprete({ acorn, presupuesto = 600000, mensajePresupuesto }) {
  return function crearTrabajador(fuente, unidad, recibir, maxOrdenes = 4000) {
    const canal = crearCanal(recibir, maxOrdenes);
    const motor = crearInterprete({ acorn, presupuesto, globales: {
      postMessage: m => canal.emitir(m),
      setTimeout: (fn, ms, ...args) => canal.timer(fn, ms, ...args),
      clearTimeout: id => canal.cancelar(id),
    } });
    let ultima;
    const medir = () => ultima ?? motor.medir();
    function terminate() {
      canal.terminate(); motor.liberar();
      ultima ??= motor.medir();
    }
    // El arnés no es código del jugador; sus compilaciones dinámicas sí lo son.
    try { motor.ejecutar(fuente, { usuario: false }); motor.vaciarTrabajos(); }
    catch (error) { terminate(); throw error; }
    return {
      postMessage: m => canal.postMessage(m),
      entregar() {
        if (!canal.vivo) return false;
        const tarea = canal.tarea();
        if (!tarea) return false;
        motor.reiniciarPresupuesto();
        try {
          if ('mensaje' in tarea) motor.global.onmessage({ data: tarea.mensaje });
          else tarea.fn(...tarea.args);
          motor.vaciarTrabajos();
        } catch (error) {
          if (error.code !== 'CBL_PRESUPUESTO') { terminate(); throw error; }
          canal.salidas.push({ type: 'error', mensaje: mensajePresupuesto?.(unidad) ?? error.message, linea: error.__linea,
            code: error.code });
          try { canal.vaciar(); } finally { terminate(); }
          return true;
        }
        canal.vaciar(); return true;
      },
      medir, terminate,
    };
  };
}
