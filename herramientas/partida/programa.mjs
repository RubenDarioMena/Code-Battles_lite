import vm from 'node:vm';

/* Imitación del canal Worker, SIN worker_threads ni temporizadores de Node.
 * Cada unidad tiene globales, promesas y cola de microtareas propios. Cada entrega
 * ejecuta hasta await; afterEvaluate vacía también las continuaciones de promesas.
 * postMessage clona al enviar, como un Worker. El anfitrión entrega por unidad/FIFO.
 * setTimeout usa tiempo virtual local; no hace avanzar el mundo por su cuenta.
 * No se reproduce el vigía de 2,5 s ni el reparto de CPU/orden entre Workers del
 * navegador. MAX_ORDENES sí se aplica en el anfitrión. Un bucle síncrono sin
 * mensajes ni await se interrumpe con timeout de VM; no es el vigía del juego.
 * node:vm proporciona aislamiento de globales, no es un sandbox de seguridad.
 */

/** Crea una unidad con el texto capturado del Worker real.
 * @param {string} fuente @param {string} id @param {(m: any) => void} recibir
 * @param {number} maxOrdenes */
export function crearPrograma(fuente, id, recibir, maxOrdenes) {
  const salidas = [], entradas = [], temporizadores = new Map();
  let vivo = true, reloj = 0, secuencia = 0, mensajes = 0, sensores = 0;
  const contexto = vm.createContext({
    postMessage(m) {
      if (!vivo) return;
      salidas.push(structuredClone(m));
      // Permite salir de un bucle emisor antes de vaciar la cola. La orden 4001
      // queda en ella y el anfitrión produce exactamente el diagnóstico del juego.
      if (['lee', 'cmd', 'consola'].includes(m.type) && ++mensajes > maxOrdenes)
        throw new Error('Ceder al anfitrión para comprobar MAX_ORDENES');
      if (m.type === 'lecturaFactory' && ++sensores > 500)
        throw new Error('Ceder al anfitrión para comprobar los 500 sensores');
    },
    setTimeout(fn, ms = 0, ...args) {
      const n = ++secuencia;
      temporizadores.set(n, { fn, args, cuando: reloj + Math.max(0, Number(ms) || 0) });
      return n;
    },
    clearTimeout(n) { temporizadores.delete(n); },
  }, { name: `programa:${id}`, microtaskMode: 'afterEvaluate' });
  const ejecutar = codigo => {
    try { vm.runInContext(codigo, contexto, { filename: `worker:${id}`, timeout: 1000 }); }
    catch (error) {
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw error;
      throw new Error(`La VM de ${id} no pudo ceder; no hay resultado comparable: ${error.message}`); }
  };
  ejecutar('self = globalThis;\n' + fuente);
  return {
    /** @param {any} m */
    postMessage(m) { if (vivo) entradas.push(structuredClone(m)); },
    terminate() { vivo = false; entradas.length = salidas.length = 0; temporizadores.clear(); },
    /** Entrega una tarea y sus salidas, en orden de llegada. */
    entregar() {
      if (!vivo) return false;
      if (entradas.length) {
        contexto.__entrada = entradas.shift(); mensajes = 0; sensores = 0;
        ejecutar('onmessage({ data: __entrada });');
      } else if (temporizadores.size) {
        const [n, tarea] = [...temporizadores].sort((a, b) => a[1].cuando - b[1].cuando || a[0] - b[0])[0];
        temporizadores.delete(n); reloj = tarea.cuando;
        contexto.__tarea = tarea;
        ejecutar('__tarea.fn(...__tarea.args);');
      } else return false;
      while (vivo && salidas.length) recibir(salidas.shift());
      return true;
    },
  };
}
