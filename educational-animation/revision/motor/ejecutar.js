/* Modo revisión · ejecuta un programa JavaScript suelto (sin el juego) con la traza del trazador.
 *
 *   CMGEjecutar.ejecutar(fuente, { acorn, limite, tiempo }) → Promise<{ programa, salida, error, cortado, reloj }>
 *
 * Sirve para los ejemplos que no necesitan partida (los seis cafés) y para «tu código». Hay un reloj
 * virtual: esperar(s) lo adelanta sin esperar de verdad, así un programa con await esperar() se puede
 * revisar igual que en el juego. console.log/info/warn/error se guardan en `salida`.
 * Un programa que no termina se corta a los `limite` eventos o `tiempo` ms: la traza llega hasta ahí.
 *
 * Lo agendado también va con ese reloj: setTimeout/setInterval (ms) y esperar (s) son temporizadores virtuales
 * que corren, por orden de tiempo, cuando el programa no tiene otra cosa que hacer (ha terminado o espera).
 * Nada queda vivo al devolver el resultado: lo que no llegó a correr se descarta. En la traza, cada ejecución
 * de un callback agendado (setTimeout, setInterval, queueMicrotask) va entre ["corre"] y ["/corre"], y lo que
 * pase después del código principal, tras ["luego"]. Un error dentro de un callback queda en `error`. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGTrazador);
  else raiz.CMGEjecutar = fabrica(raiz.CMGTrazador);
})(typeof globalThis !== "undefined" ? globalThis : self, function (T) {
  "use strict";
  const AF = Object.getPrototypeOf(async function () {}).constructor;
  const CORTE = "__corte_revision__";
  // Una vuelta del bucle de eventos (vacía todas las microtareas), sin el mínimo de 4 ms de setTimeout anidado.
  const vuelta = typeof MessageChannel === "function"
    ? () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(); }; c.port2.postMessage(0); })
    : () => new Promise(r => setTimeout(r, 0));
  const MAX_CORRIDAS = 10000;

  async function ejecutar(fuente, { acorn, limite = 60000, tiempo = 3000 } = {}) {
    const opciones = { acorn, reloj: "__reloj.t", enviar: "__enviar" };
    const r = T.instrumentar(fuente, opciones);
    const pre = T.prefijo(opciones), cuerpo = r.codigo.slice(pre.length);
    const eventos = [], salida = [], reloj = { t: 0 };
    const inicio = Date.now();
    let cortado = false, error = null, traza = null, hecho = false;
    const enviar = (lote) => {
      if (cortado) return;
      for (const e of lote) eventos.push(e);
      if (eventos.length > limite || Date.now() - inicio > tiempo) { cortado = true; throw new Error(CORTE); }
    };
    const fallo = (e) => {
      if (e && e.message === CORTE) cortado = true;
      else if (!error) error = { mensaje: String(e && e.message || e), tipo: e && e.name || "Error" };
    };
    const texto = (x) => typeof x === "string" ? x : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })() ?? String(x);
    const consola = {};
    for (const nivel of ["log", "info", "warn", "error"]) consola[nivel] = (...a) => { salida.push({ nivel, t: reloj.t, texto: a.map(texto).join(" ") }); };

    // Temporizadores virtuales. Como en el juego, el reloj avanza mientras el programa espera, no al llamar.
    const cola = [];
    let ids = 0, orden = 0;
    const redondo = (x) => Math.round(x * 1000) / 1000;
    const agendar = (ms, fn, intervalo = null) => {
      const id = ++ids;
      cola.push({ id, n: ++orden, t: redondo(reloj.t + Math.max(0, Number(ms) || 0) / 1000), fn, intervalo });
      return id;
    };
    const quitar = (id) => { const k = cola.findIndex(x => x.id === id); if (k >= 0) cola.splice(k, 1); };
    // Una ejecución de un callback agendado: marcada en la traza y con sus errores recogidos.
    const correr = (fn, args) => {
      if (cortado) return;
      try {
        if (traza) traza.fin(); eventos.push(["corre"]);
        const r = fn(...args);
        // Un callback async: su rechazo también es un error del programa (no una excepción suelta).
        if (r && typeof r.then === "function") r.then(undefined, fallo);
      }
      catch (e) { fallo(e); }
      finally { try { if (traza) traza.fin(); } catch (e) { fallo(e); } if (!cortado) eventos.push(["/corre"]); }
    };
    const api = {
      setTimeout: (fn, ms, ...a) => typeof fn === "function" ? agendar(ms, () => correr(fn, a)) : 0,
      setInterval: (fn, ms, ...a) => typeof fn === "function" ? agendar(ms, () => correr(fn, a), Math.max(1, Number(ms) || 0)) : 0,
      clearTimeout: quitar, clearInterval: quitar,
      queueMicrotask: (fn) => { if (typeof fn === "function") queueMicrotask(() => correr(fn, [])); },
    };
    const esperar = (s) => new Promise(res => agendar((Number(s) || 0) * 1000, () => res("ok")));

    // Lo que pase después del código principal va tras ["luego"]: lo marca su finally, antes que cualquier
    // microtarea que dejara agendada.
    const luego = () => { if (!cortado) eventos.push(["luego"]); };
    const nombres = ["__enviar", "__reloj", "console", "esperar", "__traza", "__luego", ...Object.keys(api)];
    const principal = Promise.resolve().then(() => new AF(...nombres, `${pre}__traza(__T);try{${cuerpo}\n}finally{__T.fin();__luego()}`)(
      enviar, reloj, consola, esperar, (x) => { traza = x; }, luego, ...Object.values(api)));
    principal.then(() => { hecho = true; }, (e) => { fallo(e); hecho = true; });

    // El bucle de eventos: tras cada vuelta, si el programa no puede seguir solo, corre el temporizador más próximo.
    let corridas = 0;
    for (;;) {
      await vuelta();
      if (cortado) break;
      if (Date.now() - inicio > tiempo || corridas > MAX_CORRIDAS) { cortado = true; break; }
      if (!cola.length) { if (!hecho) cortado = true; break; } // espera algo que nunca llega
      cola.sort((a, b) => a.t - b.t || a.n - b.n);
      const x = cola.shift();
      if (x.t > reloj.t) reloj.t = x.t;
      if (x.intervalo != null) cola.push({ ...x, n: ++orden, t: redondo(x.t + x.intervalo / 1000) });
      corridas++;
      x.fn();
    }
    try { if (traza) traza.fin(); } catch (e) { fallo(e); }
    if (eventos.length && eventos[eventos.length - 1][0] === "luego") eventos.pop();
    // Sin esperas, el reloj no se mueve: no hace falta guardar sus marcas.
    const conReloj = eventos.some(e => e[0] === "t" && e[1] > 0);
    return {
      programa: { lenguaje: "js", fuente: r.fuente, nodos: r.nodos, comentarios: r.comentarios, eventos: conReloj ? eventos : eventos.filter(e => e[0] !== "t") },
      salida: salida.slice(), error, cortado, reloj: conReloj ? reloj.t : null,
    };
  }

  return { ejecutar };
});
