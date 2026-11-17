// FIFO y temporizadores virtuales locales; ningún reloj del sistema.
import { clonar } from './clon.js';
export function crearCanal(recibir, maxOrdenes = 4000) {
  const entradas = [], salidas = [], timers = new Map();
  let vivo = true, reloj = 0, seq = 0, mensajes = 0, sensores = 0;
  return {
    entradas, salidas, timers,
    get vivo() { return vivo; },
    postMessage(m) { if (vivo) entradas.push(clonar(m)); },
    emitir(m) {
      if (!vivo) return;
      salidas.push(clonar(m));
      if (['lee', 'cmd', 'consola', 'modo', 'lectura'].includes(m.type) && ++mensajes > maxOrdenes)
        throw new Error('Ceder al anfitrión para comprobar MAX_ORDENES');
      if (m.type === 'lecturaFactory' && ++sensores > 500)
        throw new Error('Ceder al anfitrión para comprobar los 500 sensores');
    },
    timer(fn, ms = 0, ...args) {
      const id = ++seq;
      timers.set(id, { fn, args, cuando: reloj + Math.max(0, Number(ms) || 0) }); return id;
    },
    cancelar(id) { timers.delete(id); },
    tarea() {
      if (entradas.length) { mensajes = sensores = 0; return { mensaje: entradas.shift() }; }
      if (!timers.size) return null;
      const [id, t] = [...timers].sort((a, b) => a[1].cuando - b[1].cuando || a[0] - b[0])[0];
      timers.delete(id); reloj = t.cuando; return t;
    },
    vaciar() { while (vivo && salidas.length) recibir(salidas.shift()); },
    terminate() { vivo = false; entradas.length = salidas.length = 0; timers.clear(); },
  };
}
