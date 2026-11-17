// Ejecuta la lógica de página con rAF/DOM falsos. Nunca inicia Chromium/Electron.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { medirPagina } from '../herramientas/medir-carga/pagina.mjs';
import { estadisticas, resumir } from '../herramientas/medir-carga/estadisticas.mjs';
import { crearEfectos, crearRecetasWar, recetaWar } from '../paquetes/vfx/index.js';

assert.deepEqual(estadisticas([]), { muestras: 0, mediaMs: null, p95Ms: null, p99Ms: null, maxMs: null, totalMs: 0 });
const s = estadisticas(Array.from({ length: 100 }, (_, i) => i + 1));
assert.equal(s.mediaMs, 50.5); assert.equal(s.p95Ms, 95); assert.equal(s.p99Ms, 99);
const ayuda = spawnSync(process.execPath, ['herramientas/medir-carga.mjs', '--help'], { encoding: 'utf8' });
assert.equal(ayuda.status, 0, ayuda.stderr); assert(ayuda.stdout.includes('--origen'));
const ritmoMalo = spawnSync(process.execPath, ['herramientas/medir-carga.mjs', '--ritmo', '0'], { encoding: 'utf8' });
assert.notEqual(ritmoMalo.status, 0); assert(ritmoMalo.stderr.includes('--ritmo'));
const invalida = spawnSync(process.execPath, ['herramientas/medir-carga.mjs', '--segundos', '0'], { encoding: 'utf8' });
assert.notEqual(invalida.status, 0); assert(invalida.stderr.includes('--segundos'));

const recetas = crearRecetasWar({ radioDanio: 1.3 });
const colores = Object.fromEntries(Object.values(recetas).flatMap(r => r.capas.flatMap(c => c.color.map(t => [t, '#369']))));
for (const escenario of ['real', 'saturacion']) {
  let ahora = 0, siguiente = 0, callback, iniciadas = 0, seleccion = '2d', recibidos = 0;
  const raf = new Map();
  const fx = crearEfectos({ recetas, recetaDe: recetaWar, dt: .05 });
  const mundo = { t: 0, explosiones: [] }, partida = { pasoActual: 0 };
  const B = {
    mundo, partida, fin: null, RETOS: [{}, { inicial: { 'LAU-01': ['while (true) {', 'await yo.wait(1);', '}'] } }],
    programas: {}, fuentes: { 'LAU-01': 'fuente anterior' },
    elegirReto: n => assert.equal(n, 0), fijarSemilla: n => assert.equal(n, 7), turbo: n => assert.equal(n, 1),
    abrirPrograma: id => assert.equal(id, 'LAU-01'),
    ejecutar() { iniciadas++; assert.equal(B.programas['LAU-01'], B.RETOS[1].inicial['LAU-01'].join('\n')); assert(!('LAU-01' in B.fuentes)); },
    medirEfectos(f) { callback = f; },
    sucesosVistas(lista) {
      const antes = JSON.stringify(mundo);
      assert.equal(lista.length % 3, 0);
      for (let i = 0; i < lista.length; i += 3) {
        const [disparo, derribo, explosion] = lista.slice(i, i + 3);
        assert.deepEqual([disparo.tipo, derribo.tipo, explosion.tipo], ['disparo', 'derribo', 'explosion']);
        assert.equal(explosion.datos.golpe, 1); assert.equal(explosion.paso, partida.pasoActual);
        // Enriquecimiento equivalente al de las fachadas (probadas en vfx-juego).
        fx.anotar({ ...disparo, datos: { ...disparo.datos, origen: [4, 6, 1] } });
        fx.anotar({ ...derribo, datos: { ...derribo.datos, origen: [explosion.datos.x, explosion.datos.y, 1] } });
        fx.anotar(explosion);
      }
      recibidos += lista.length; assert.equal(JSON.stringify(mundo), antes);
    },
  };
  const contexto = vm.createContext({ window: { __banco: B }, performance: { now: () => ahora },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2,
    matchMedia: () => ({ matches: false }),
    document: {
      querySelector: sel => ({ click() { seleccion = sel.includes('3d') ? '3d' : '2d'; }, getAttribute: () => 'true' }),
      getElementById: () => ({ getContext: () => null, width: 1280, height: 720,
        getBoundingClientRect: () => ({ toJSON: () => ({ width: 1280, height: 720 }) }) }),
    },
    requestAnimationFrame: f => { raf.set(++siguiente, f); return siguiente; }, cancelAnimationFrame: id => raf.delete(id),
    setInterval: () => 1, clearInterval() {},
  });
  const pendiente = vm.runInContext(`(${medirPagina.toString()})({ segundos: .2, escenario: '${escenario}', vista: '3d' })`, contexto);
  for (let frame = 0; frame < 300; frame++) {
    if (escenario === 'real' && frame === 150) mundo.explosiones.push({ t0: mundo.t });
    ahora += 1000 / 60; mundo.t = ahora / 1000; partida.pasoActual = Math.round(mundo.t / .05);
    const vivas = fx.particulas(mundo.t, { colores, calidad: 'alto' }).length;
    callback?.({ vista: seleccion, vivas, particulasMs: 1, dibujarMs: 2 });
    const cola = [...raf.values()]; raf.clear(); cola.forEach(f => f(ahora));
  }
  const resultado = resumir(await pendiente);
  assert.equal(iniciadas, 1); assert.equal(callback, null); assert.equal(raf.size, 0);
  assert(resultado.duracionMs >= 200); assert(resultado.fotogramas >= 12);
  assert.equal(resultado.cpu.total.mediaMs, 3); assert.equal(resultado.cpu.particulas.mediaMs, 1);
  assert(resultado.pasosMax > 0); assert.equal(resultado.fotogramasMas33, 0);
  if (escenario === 'saturacion') {
    assert(recibidos >= 720); assert(resultado.inyectados > 0);
    assert.equal(resultado.vivasMax, 2000, 'el caudal ofrecido llena el presupuesto alto con las recetas reales');
  } else {
    assert.equal(recibidos, 0); assert.equal(resultado.vivasMax, 0);
    assert(resultado.esperaMs >= 150 * 1000 / 60, 'la ventana real empieza con la primera explosión');
  }
}
console.log('Medida: CLI sin lanzamiento, percentiles, reloj rAF, ventana/calor, programa, semilla, CPU, inyección y presupuesto alto; emulación Node, sin GPU real.');
