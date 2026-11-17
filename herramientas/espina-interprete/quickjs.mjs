// QuickJS se carga exclusivamente desde la instalación externa, nunca desde la red.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { crearCanal, PresupuestoAgotado } from './canal.mjs';
import { codificar, decodificar } from './clon.mjs';
let modulo;
export async function cargarQuickJS() {
  if (!process.env.CBL_QUICKJS) return null;
  if (!modulo) {
    const require = createRequire(resolve(process.env.CBL_QUICKJS, '../cbl-espina.cjs'));
    const core = await import(pathToFileURL(require.resolve('quickjs-emscripten-core')).href);
    const { default: variant } = await import(pathToFileURL(require.resolve('@jitl/quickjs-wasmfile-release-sync')).href);
    modulo = await core.newQuickJSWASMModuleFromVariant(variant);
  }
  return modulo;
}
// Un tick es una visita al interrupt handler de ESTA compilación, no un opcode.
export const PRESUPUESTO_Q = 20;
export function motorQuickJS(Q, { presupuesto = PRESUPUESTO_Q } = {}) {
  return function crearPrograma(fuente, id, recibir, maxOrdenes = 4000) {
    const canal = crearCanal(recibir, maxOrdenes), runtime = Q.newRuntime(), ctx = runtime.newContext();
    let ticks = 0, agotado = false, destruido = false, ultimaCuenta = 0, corte = null;
    runtime.setInterruptHandler(() => { ticks++; return agotado = ticks > presupuesto; });
    const instalar = (nombre, fn) => {
      const h = ctx.newFunction(nombre, (...args) => {
        try { return fn(...args); }
        catch (e) { return { error: ctx.newError(e.message) }; }
      });
      ctx.setProp(ctx.global, nombre, h); h.dispose();
    };
    instalar('__salidaTexto', h => { canal.emitir(decodificar(ctx.getString(h))); });
    instalar('setTimeout', (fn, ms, ...args) => {
      const n = canal.timer(fn.dup(), ms ? ctx.getNumber(ms) : 0, ...args.map(h => h.dup()));
      return ctx.newNumber(n);
    });
    const liberar = t => { t.fn.dispose(); t.args.forEach(h => h.dispose()); };
    instalar('clearTimeout', h => {
      const n = ctx.getNumber(h), t = canal.timers.get(n);
      if (t) liberar(t); canal.cancelar(n);
    });
    const comprobar = r => {
      if (r.error) { const e = ctx.dump(r.error); r.error.dispose(); if (!agotado) throw new Error(JSON.stringify(e)); }
      else r.value?.dispose?.();
    };
    const evaluar = (s, nombre = `worker:${id}`) => comprobar(ctx.evalCode(s, nombre));
    const iniciar = () => { ticks = 0; agotado = false; };
    const trabajos = () => {
      while (runtime.hasPendingJob() && !agotado) comprobar(runtime.executePendingJobs(1));
    };
    iniciar();
    evaluar(`const __codificar = ${codificar.toString()}, __decodificar = ${decodificar.toString()};
      globalThis.postMessage = m => __salidaTexto(__codificar(m));
      globalThis.self = globalThis; globalThis.Date = undefined;
      Math.random = () => { throw new Error('Math.random deshabilitado en la espina determinista'); };\n${fuente}`);
    trabajos();
    if (agotado) throw new PresupuestoAgotado('Q-arranque', ticks);
    return {
      postMessage: m => canal.postMessage(m),
      entregar() {
        if (!canal.vivo) return false;
        const t = canal.tarea(); if (!t) return false;
        iniciar();
        if ('mensaje' in t) {
          evaluar(`onmessage({data:__decodificar(${JSON.stringify(codificar(t.mensaje))})})`);
        } else { comprobar(ctx.callFunction(t.fn, ctx.undefined, ...t.args)); liberar(t); }
        trabajos(); ultimaCuenta = ticks;
        if (agotado) {
          const contador = ctx.getProp(ctx.global, '__contador');
          corte = { ticks, contador: ctx.dump(contador) }; contador.dispose();
          canal.salidas.push({ type: 'error', mensaje: new PresupuestoAgotado('Q', ticks).message, linea: null });
        }
        canal.vaciar();
        if (agotado) this.terminate();
        return true;
      },
      medir() {
        if (destruido) return { ticks: ultimaCuenta, corte };
        const h = runtime.computeMemoryUsage(), memoria = ctx.dump(h); h.dispose();
        return { ticks: ultimaCuenta, corte, memoria, wasmHeap: Q.getWasmMemory().buffer.byteLength };
      },
      terminate() {
        if (destruido) return;
        destruido = true;
        for (const t of canal.timers.values()) liberar(t);
        canal.terminate(); ctx.dispose(); runtime.dispose();
      },
    };
  };
}
