import { Evaluador, medirCache } from './evaluador.mjs';
import { crearCanal } from '../canal.mjs';
export const PRESUPUESTO_P = 600000;
export function motorPropio(opciones = {}) {
  return function crearPrograma(fuente, id, recibir, maxOrdenes = 4000) {
    const canal = crearCanal(recibir, maxOrdenes), e = new Evaluador(opciones);
    Object.assign(e.global, { postMessage: m => canal.emitir(m),
      setTimeout: (fn, ms, ...args) => canal.timer(fn, ms, ...args), clearTimeout: n => canal.cancelar(n) });
    e.ejecutar(fuente); e.vaciar();
    return {
      postMessage: m => canal.postMessage(m),
      entregar() {
        if (!canal.vivo) return false;
        const t = canal.tarea(); if (!t) return false;
        e.reiniciar();
        try {
          if ('mensaje' in t) e.global.onmessage({ data: t.mensaje }); else t.fn(...t.args);
          e.vaciar();
        } catch (x) {
          if (x.code !== 'CBL_PRESUPUESTO') throw x;
          canal.salidas.push({ type: 'error', mensaje: x.message, linea: x.__linea });
          canal.vaciar(); this.terminate(); return true;
        }
        canal.vaciar(); return true;
      },
      paso() {
        const p = e.pausas.shift(); if (!p) return null;
        p.reanudar(); e.vaciar(); canal.vaciar();
        return { linea: p.linea, nodo: p.nodo };
      },
      pausas: () => e.pausas.map(({ linea, nodo }) => ({ linea, nodo })),
      medir: () => ({ nodos: e.cuenta, linea: e.linea, contador: e.global.__contador, trabajos: e.cola.length, cache: medirCache() }),
      terminate() { canal.terminate(); e.cola.length = e.pausas.length = 0; },
    };
  };
}
export const crearPrograma = motorPropio();
