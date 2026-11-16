/* Arnés del laboratorio de batalla: corre una prueba entera en Node, con los mismos módulos de la página
 * y el mismo código de Worker (en worker_threads). Sirve a pruebas/lab-batalla.cjs y para equilibrar. */
"use strict";
const path = require("path");
const { Worker } = require("worker_threads");
const base = path.join(__dirname, "..", "laboratorio", "batalla", "js");
const M = require(path.join(base, "mundo.js"));
const RT = require(path.join(base, "runtime.js"));
const { ESCENARIOS } = require(path.join(base, "escenarios.js"));

const CALCE = 'const { parentPort } = require("worker_threads"); globalThis.self = globalThis; globalThis.postMessage = (m) => parentPort.postMessage(m); parentPort.on("message", (d) => { if (globalThis.onmessage) globalThis.onmessage({ data: d }); });\n';
function crearTrabajador() {
  const w = new Worker(CALCE + RT.fuente, { eval: true });
  const o = { onmessage: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
  w.on("message", (d) => { if (o.onmessage) o.onmessage({ data: d }); });
  w.on("error", (e) => { if (o.onmessage) o.onmessage({ data: { type: "error", mensaje: "Worker: " + e.message, linea: null } }); });
  return o;
}
const conf = () => ({ velMisil: M.MISIL.vel, tipos: Object.keys(M.TIPOS), articulos: { torreta: "una torreta", vehiculo: "un vehículo", rueda: "una rueda kamikaze", radar: "un radar" } });

// opciones: codigos (sustituye los de partida), semilla, bot(mundo, sim, rt) cada paso, entradas (repetición de clics y reprogramaciones), hasta (s), cadaPaso(mundo)
async function correr(clave, opciones = {}) {
  const def = typeof clave === "string" ? ESCENARIOS.find(e => e.clave === clave) : clave;
  const mundo = M.crear(def, opciones.semilla || 1), registro = [], consola = [], errores = [];
  let rt = null;
  const sim = M.conectar(mundo, {
    registrar: (id, texto, clase) => registro.push({ t: Math.round(mundo.t * 100) / 100, id, texto, clase }),
    alLlegar: (id, res) => rt.alLlegar(id, res), alDano: (id, info) => rt.alDano(id, info),
    alDestruir: (id) => rt.alDestruir(id), alReponer: (id) => rt.alReponer(id),
    terminar: (resultado, motivo, texto) => { mundo.fin = { resultado, motivo, texto }; },
  });
  rt = RT.crear({
    mundo, sim, codigos: { ...def.inicial, ...(opciones.codigos || {}) }, conf: conf(), crearTrabajador,
    alConsola: (id, nivel, texto) => consola.push({ t: mundo.t, id, nivel, texto }),
    alError: (id, mensaje, linea) => errores.push({ t: mundo.t, id, mensaje, linea }),
  });
  const repetir = opciones.entradas ? [...opciones.entradas] : null;
  const inyectar = repetir ? (paso) => { while (repetir.length && repetir[0].paso <= paso) { const e = repetir.shift(); if (e.programa) rt.reprogramar(e.programa.id, e.programa.codigo); else rt.clic(e.clic.x, e.clic.y, e.clic.enemigo, e.clic.ids); } } : null;
  mundo.activo = true; rt.iniciar();
  const vigia = setInterval(() => rt.vigia(), 200);
  try {
    while (!mundo.fin && (!opciones.hasta || mundo.t < opciones.hasta)) {
      await rt.alQuieto();
      await new Promise(setImmediate);        // cede el turno: los mensajes de los Workers llegan como en el navegador
      if (!rt.quieto()) continue;
      if (opciones.bot) opciones.bot(mundo, sim, rt);
      if (RT.bombear(mundo, sim, rt, 1, inyectar) && opciones.cadaPaso) opciones.cadaPaso(mundo, sim, rt);
    }
  } finally { clearInterval(vigia); rt.cerrar(); }
  return { mundo, sim, rt, registro, consola, errores, fin: mundo.fin, resumen: { fin: mundo.fin ? mundo.fin.resultado : null, motivo: mundo.fin && mundo.fin.motivo, t: Math.round(mundo.t * 10) / 10, muro: mundo.muro, derribos: mundo.derribos, total: mundo.total, consumidos: mundo.consumidos, clics: mundo.nClics, errores: errores.length } };
}
module.exports = { M, RT, ESCENARIOS, correr, crearTrabajador, conf };

// ---------- Jugadores de prueba: hacen clic con una regla fija, cada cierto tiempo ----------
// No imitan a una persona; sirven para comprobar que los clics cambian el resultado y para repetir batallas.
function cada(segundos, accion) {
  let proximo = 0;
  return (mundo, sim, rt) => { if (mundo.t + 1e-9 < proximo) return; proximo = mundo.t + segundos; accion(mundo, sim, rt); };
}
const masAvanzado = (lista) => lista.reduce((a, e) => !a || e.x < a.x ? e : a, null);
const BOTS = {
  // Señala al enemigo más avanzado de cada mitad del campo para la torreta de ese lado.
  observador: () => cada(2, (m, sim, rt) => {
    const norte = masAvanzado(m.enemigos.filter(e => e.y < 13.5)), sur = masAvanzado(m.enemigos.filter(e => e.y >= 13.5));
    if (norte) rt.clic(norte.x, norte.y, norte.id, ["TUR-01"]);
    if (sur) rt.clic(sur.x, sur.y, sur.id, ["TUR-02"]);
  }),
  // Manda los vehículos contra los tiradores y las ruedas contra los cañones (o lo que quede).
  ordenes: () => cada(3, (m, sim, rt) => {
    const de = (t) => m.enemigos.filter(e => e.tipo === t);
    const cerca = (lista, u) => lista.reduce((a, e) => !a || Math.hypot(e.x - u.cx, e.y - u.cy) < Math.hypot(a.x - u.cx, a.y - u.cy) ? e : a, null);
    for (const u of m.unidades) {
      if (!u.viva || (u.clase !== "vehiculo" && u.clase !== "rueda")) continue;
      const presa = u.clase === "vehiculo" ? cerca(de("gunner"), u) || cerca(de("siege"), u) : cerca(de("siege"), u) || cerca(de("gunner"), u);
      if (presa) rt.clic(presa.x, presa.y, presa.id, [u.id]);
    }
  }),
};
BOTS.campana = () => { const a = BOTS.observador(), b = BOTS.ordenes(); return (m, sim, rt) => { a(m, sim, rt); b(m, sim, rt); }; };
module.exports.BOTS = BOTS;
