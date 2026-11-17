// Solo Node. Escenarios/reglas/intérprete reales; rAF/DOM emulados por separado.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { crearEscenario } from '../herramientas/medir-unidades/escenarios.mjs';
import { medirSinPantalla } from '../herramientas/medir-unidades/sin-pantalla.mjs';
import { estadisticas, deriva, resumirPagina } from '../herramientas/medir-unidades/estadisticas.mjs';
import { instrumentarMedida } from '../herramientas/medir-unidades/instrumentacion.mjs';
import { medirEnJuego, prepararJuego } from '../herramientas/medir-unidades/en-juego.mjs';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { instalarBucleJuego } from '../paquetes/app/index.js';
import { retos } from '../paquetes/reglas-war/index.js';

const percentiles = estadisticas(Array.from({ length: 100 }, (_, i) => i + 1));
assert.deepEqual(percentiles, { muestras: 100, mediaMs: 50.5, p50Ms: 50, p95Ms: 95, p99Ms: 99, maxMs: 100 });
assert.equal(estadisticas([]).p95Ms, null);
assert(deriva({ duracionMs: 60000, pasos: 1199 }).mantieneRitmo);
assert(!deriva({ duracionMs: 60000, pasos: 1198 }).mantieneRitmo);
assert.equal(deriva({ duracionMs: 60000, pasos: 1200 }).pasosPorSegundoReal, 20);
assert(!deriva({ duracionMs: 60000, pasos: 1202 }).mantieneRitmo);
for (const args of [['--help'], ['--modo', 'juego', '--segundos', '0'], ['--modo', 'juego', '--unidades', '501'], ['--series', 'factory']]) {
  const r = spawnSync(process.execPath, ['herramientas/medir-unidades.mjs', ...args], { encoding: 'utf8' });
  assert.equal(r.status === 0, args[0] === '--help', r.stderr);
  assert(!r.stderr.includes('browserType.launch') && !r.stderr.includes('electron.launch'));
}
for (const serie of ['war', 'campaign']) {
  const e = crearEscenario(serie, 500), p = crearPartida(e);
  assert.deepEqual(e, crearEscenario(serie, 500));
  assert.equal(p.mundo.programables.length, 500);
  const todas = serie === 'war' ? p.mundo.maquinas : p.mundo.unidades;
  assert.equal(new Set(todas.map(u => u.id)).size, todas.length);
  const posiciones = new Set();
  for (const u of p.mundo.programables) {
    const { cols, rows } = e.escenario.reto.mapa;
    assert(u.cx >= 0 && u.cx < cols && u.cy >= 0 && u.cy < rows);
    const k = `${u.cx},${u.cy}`; assert(!posiciones.has(k)); posiciones.add(k);
    assert.equal(e.programas[u.id], e.escenario.reto.inicial[u.id].join('\n'));
  }
  if (serie === 'war') assert.equal(retos.normalizar(e.escenario.reto).lanzadores.length, 2);
  // Las 500 ejecutan, esperan y emiten órdenes válidas: dos trazas completas iguales.
  const a = await medirSinPantalla({ serie, unidades: 500, pasos: 16, calentamiento: 0 });
  const b = await medirSinPantalla({ serie, unidades: 500, pasos: 16, calentamiento: 0 });
  assert.equal(a.costes.total.muestras, 16);
  assert.deepEqual(a.huella, b.huella); assert.equal(a.huellaOrdenes, b.huellaOrdenes);
  assert(a.ordenes > 0);
  if (serie === 'campaign') assert(a.actividad.encargos >= 500 && a.actividad.metros > 0);
}
// Regresión: null se compara como cero en las reglas de War. La carga pequeña
// también debe completar 60s aunque haya brechas, sin neutralizar evaluar().
assert.equal((await medirSinPantalla({ serie: 'war', unidades: 50, pasos: 1200, calentamiento: 40 })).huella.pasos, 1240);
// Descomposición exacta, respuesta/ceder asíncronos incluidos, sin sumar tiempos ociosos.
{
  let ahora = 0;
  const p = { pasoActual: 0, paso() { ahora += 2; this.pasoActual++; }, instantanea() { ahora += 3; return {}; } };
  const a = { async ceder() { ahora += 5; }, async responder() { ahora += 7; } };
  const m = instrumentarMedida(p, a, () => ahora);
  const c = m.envolverConductor({ async avanzar(n) {
    for (let i = 0; i < n; i++) { p.paso(); p.instantanea(); await a.responder(); p.instantanea(); await a.ceder(); ahora++; }
  } });
  await c.avanzar(2); ahora += 1000; await c.avanzar(1);
  assert.equal(m.muestras.length, 3);
  for (const f of m.muestras) assert.deepEqual({ ...f, paso: 1 }, { paso: 1, simulacion: 2, instantanea: 6, responder: 7, ceder: 5, total: 21 });
}
// Ejecuta la función real del bucle con fakes. Comprueba el recorte y que el gancho apagado
// no agrega lecturas de algunoCorre ni cambia el acumulador o el dibujo.
const fuenteBucle = instalarBucleJuego.toString();
for (const observar of [false, true]) {
  let frame, lecturas = 0;
  const ctx = { ejec: true, pausa: false, acum: 0, DT: .05, velocidad: 1, turbo: 1,
    algunoCorre: () => { lecturas++; return false; },
    __banco: observar ? { alFotograma: f => { frame = f; } } : {},
    invalidarEscena() {}, avanzar() {}, vistaActual: () => ({ dibujar() {} }), estadoVista: { escena: {} },
    pintarCapa() {}, caducarAvisos() {}, pintarHud() {}, actualizarVivos() {}, editorPrograma: { iniciarVistas() {} } };
  const c = vm.createContext({ performance: { now: () => 0 }, requestAnimationFrame() {}, ctx });
  vm.runInContext(`(${fuenteBucle})(ctx).bucle(300)`, c);
  assert.equal(ctx.acum, .25); assert.equal(lecturas, observar ? 3 : 2);
  if (observar) { assert.equal(frame.real, .25); assert.equal(frame.transcurrido, .3); }
}
// rAF de la página real: línea de inicio, ventana de 60s, espera del último lote,
// recorte, tiempo sin acumular, cierre y criterio fallido por deriva.
for (const lento of [false, true]) {
  let ahora = 0, callback, detenido = false;
  const banco = { medirUnidades: f => f(ctx), set alFotograma(v) { callback = v; } };
  const ctx = { partida: { pasoActual: 0 }, conductor: { error: null, cerrar() { detenido = true; } }, ejec: {},
    aplicarVista(v) { this.vista = v; }, calidadEfectos: { leer: () => ({ calidad: 'alto' }) } };
  const medida = { muestras: [] };
  const c = vm.createContext({ window: { __banco: banco }, crearEscenario: () => ({}),
    prepararJuego: async () => ({ medida, arranqueMs: 1 }), performance: { now: () => ahora },
    document: { getElementById: () => ({ getContext: () => null, getBoundingClientRect: () => ({ toJSON: () => ({}) }) }) },
    navigator: { userAgent: 'fake Node' }, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    setInterval: () => 1, clearInterval() {} });
  const pendiente = vm.runInContext(`(${medirEnJuego.toString()})({serie:'war',unidades:500,segundos:60,vista:'2d'})`, c);
  await new Promise(resolve => setImmediate(resolve));
  callback({ ahora: 0 });
  for (let i = 1; i <= 1200; i++) {
    ahora = i * 50; ctx.partida.pasoActual = i - (lento ? 2 : 0);
    medida.muestras.push({ simulacion: 1, instantanea: 2, ceder: 3, responder: 4, total: 10 });
    callback({ ahora, transcurrido: lento && i === 10 ? .3 : .05, real: .05, sinAcumular: lento && i === 20 });
  }
  const r = resumirPagina(await pendiente);
  assert.equal(r.cumple, !lento); assert.equal(r.fotogramas, 1200); assert.equal(r.fotogramasRecortados, lento ? 1 : 0);
  assert.equal(r.sinAcumularMs, lento ? 50 : 0); assert.equal(callback, null); assert(detenido);
}
// Preparación enlaza el conductor real del contexto, restaura la fábrica y usa ejecutar.
{
  const p = { paso() {}, instantanea() {}, mundo: {}, pasoActual: 0 }, a = { ceder() {}, responder() {} };
  const ctx = { cerrarProgramas() {}, nuevoMundo() { this.mundo = { programables: [{ id: 'x' }] }; }, configurarEdicion() {},
    partida: p, anfitrion: a, get crearConductor() { return crear; },
    ejecutar() { this.ejec = {}; this.conductor = this.crearConductor({}); } };
  const crear = () => ({ avanzar: async () => {}, error: null });
  const original = Object.getOwnPropertyDescriptor(ctx, 'crearConductor');
  await prepararJuego(ctx, { escenario: { reto: {} }, programas: { x: 'await wait(.1)' }, unidades: 1, semilla: 7 });
  assert.deepEqual(Object.getOwnPropertyDescriptor(ctx, 'crearConductor'), original);
  assert.equal(ctx.velocidad, 1); assert.equal(ctx.turbo, 1);
}
console.log('Medir unidades: 500 reales válidas por serie, huellas/fuentes/órdenes, estadística, CLI sin navegador, decoradores, bucle y ventana rAF emulada; sin GPU.');
