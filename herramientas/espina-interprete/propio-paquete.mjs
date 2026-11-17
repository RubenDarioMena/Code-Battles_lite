import { createRequire } from 'node:module';
import { crearInterprete } from '../../paquetes/interprete/index.js';
import { crearCanal } from './canal.mjs';
const acorn = createRequire(import.meta.url)('../../shared/vendor/acorn-8.11.3.js');
export const PRESUPUESTO_P = 600000;
export function motorPropio(opciones = {}) {
  return function crearPrograma(fuente, id, recibir, maxOrdenes = 4000) {
    const canal = crearCanal(recibir, maxOrdenes);
    const e = crearInterprete({ acorn, ...opciones, depurar: opciones.depurar ? { parametro: '__L' } : false, globales: { postMessage: m => canal.emitir(m),
      setTimeout: (fn, ms, ...args) => canal.timer(fn, ms, ...args), clearTimeout: n => canal.cancelar(n) } });
    e.ejecutar(fuente, { usuario: false }); e.vaciarTrabajos();
    let ultima;
    const medir = () => ({ ...e.medir(), contador: e.global.__contador });
    return {
      postMessage: m => canal.postMessage(m),
      entregar() {
        if (!canal.vivo) return false;
        const t = canal.tarea(); if (!t) return false;
        e.reiniciarPresupuesto();
        try {
          if ('mensaje' in t) e.global.onmessage({ data: t.mensaje }); else t.fn(...t.args);
          e.vaciarTrabajos();
        } catch (x) {
          if (x.code !== 'CBL_PRESUPUESTO') throw x;
          canal.salidas.push({ type: 'error', mensaje: x.message, linea: x.__linea });
          canal.vaciar(); this.terminate(); return true;
        }
        canal.vaciar(); return true;
      },
      paso() { const p = e.reanudar(); if (!p) return null; e.vaciarTrabajos(); canal.vaciar(); return p; },
      pausas: () => e.pausasPendientes(),
      medir: () => ultima || medir(),
      terminate() { if (!ultima) ultima = { ...medir(), liberado: true }; canal.terminate(); e.liberar(); },
    };
  };
}
export const crearPrograma = motorPropio();
