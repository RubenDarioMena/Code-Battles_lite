/* Modo revisión · ejecuta un programa JavaScript suelto (sin el juego) con la traza del trazador.
 *
 *   CMGEjecutar.ejecutar(fuente, { acorn, limite, tiempo }) → Promise<{ programa, salida, error, cortado, reloj }>
 *
 * Sirve para los ejemplos que no necesitan partida (los seis cafés) y para «tu código». Hay un reloj
 * virtual: esperar(s) lo adelanta sin esperar de verdad, así un programa con await esperar() se puede
 * revisar igual que en el juego. console.log/info/warn/error se guardan en `salida`.
 * Un programa que no termina se corta a los `limite` eventos o `tiempo` ms: la traza llega hasta ahí. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGTrazador);
  else raiz.CMGEjecutar = fabrica(raiz.CMGTrazador);
})(typeof globalThis !== "undefined" ? globalThis : self, function (T) {
  "use strict";
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const CORTE = "__corte_revision__";

  async function ejecutar(fuente, { acorn, limite = 60000, tiempo = 3000 } = {}) {
    const opciones = { acorn, reloj: "__reloj.t", enviar: "__enviar" };
    const r = T.instrumentar(fuente, opciones);
    const pre = T.prefijo(opciones), cuerpo = r.codigo.slice(pre.length);
    const eventos = [], salida = [], reloj = { t: 0 };
    const inicio = Date.now();
    let cortado = false, error = null;
    const enviar = (lote) => {
      if (cortado) return;
      for (const e of lote) eventos.push(e);
      if (eventos.length > limite || Date.now() - inicio > tiempo) { cortado = true; throw new Error(CORTE); }
    };
    const texto = (x) => typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() ?? String(x);
    const consola = {};
    for (const nivel of ["log", "info", "warn", "error"]) consola[nivel] = (...a) => { salida.push({ nivel, t: reloj.t, texto: a.map(texto).join(" ") }); };
    // Como en el juego, el reloj avanza mientras el programa espera, no al llamar a esperar().
    const esperar = (s) => Promise.resolve().then(() => { reloj.t = Math.round((reloj.t + (Number(s) || 0)) * 1000) / 1000; return "ok"; });
    try {
      await new AF("__enviar", "__reloj", "console", "esperar", `${pre}try{${cuerpo}\n}finally{__T.fin()}`)(enviar, reloj, consola, esperar);
    } catch (e) {
      if (!(e && e.message === CORTE)) error = { mensaje: String(e && e.message || e), tipo: e && e.name || "Error" };
    }
    // Sin esperas, el reloj no se mueve: no hace falta guardar sus marcas.
    const conReloj = eventos.some(e => e[0] === "t" && e[1] > 0);
    return {
      programa: { lenguaje: "js", fuente: r.fuente, nodos: r.nodos, comentarios: r.comentarios, eventos: conReloj ? eventos : eventos.filter(e => e[0] !== "t") },
      salida, error, cortado, reloj: conReloj ? reloj.t : null,
    };
  }

  return { ejecutar };
});
