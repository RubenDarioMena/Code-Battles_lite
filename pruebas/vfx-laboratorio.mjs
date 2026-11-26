import * as ThreeReal from '../shared/vendor/three-r180/three.module.min.js';
// Arranque y controles con DOM/canvas/GPU falsos: no lanza Chromium ni Electron.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { es, en } from '../herramientas/laboratorio-vfx/textos.js';

assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
const parametros = t => [...t.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
for (const k of Object.keys(es)) assert.deepEqual(parametros(es[k]), parametros(en[k]), k);
const html = readFileSync(new URL('../herramientas/laboratorio-vfx/index.html', import.meta.url), 'utf8');
for (const [, ruta] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(!/^https?:/.test(ruta));
  assert(existsSync(new URL(ruta, new URL('../herramientas/laboratorio-vfx/index.html', import.meta.url))));
}
for (const [, k] of html.matchAll(/data-texto="([^"]+)"/g)) assert(k in es, k);
const tema = readFileSync(new URL('../paquetes/editor/estilos/tema.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...tema.matchAll(/--([\w-]+):\s*(#[\da-f]+);/gi)].map(m => [m[1], m[2]]));
let dibujados = 0, liberados = 0, contactos = 0;
const THREE = { ...ThreeReal };
THREE.WebGLRenderer = class {
  setPixelRatio() {} setSize() {}
  getContext() { return { ALIASED_POINT_SIZE_RANGE: 1, getParameter: () => [1, 127] }; }
  render(escena, camara) { escena.updateMatrixWorld(); camara.updateMatrixWorld(); dibujados++; }
  dispose() { liberados++; }
};
function lienzo(id = '') {
  return { width: 640, height: 400, getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fillText() {},
    save() {}, restore() {}, drawImage() { if (id === 'contactos') contactos++; },
  }) };
}
const nodos = Object.fromEntries(['receta', 'calidad', 'velocidad', 'tiempo', 'reproducir', 'pausa', 'contador', 'estado', 'titulo-hoja'].map(id => [id, {
  value: id === 'calidad' ? 'alto' : (id === 'velocidad' ? '1' : ''), textContent: '', eventos: {},
  addEventListener(tipo, f) { this.eventos[tipo] = f; },
  add(option) { if (!this.value) this.value = option.value; },
}]));
for (const id of ['tres', 'plano', 'contactos']) nodos[id] = lienzo(id);
let siguiente, salida;
const claves = ['document', 'location', 'getComputedStyle', 'Option', 'requestAnimationFrame', 'addEventListener', 'laboratorioVfx'];
const previos = Object.fromEntries(claves.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
try {
  Object.assign(globalThis, {
    document: { documentElement: {}, title: '', body: { classList: { add() {} } },
      getElementById: id => nodos[id], querySelectorAll: () => [], createElement: () => lienzo() },
    location: { search: '?captura=1' },
    getComputedStyle: () => ({ getPropertyValue: k => tokens[k.slice(2)] || '' }),
    Option: class { constructor(nombre, value) { this.text = nombre; this.value = value; } },
    requestAnimationFrame: f => { siguiente = f; },
    addEventListener: (tipo, f) => { if (tipo === 'pagehide') salida = f; },
  });
  const { iniciarLaboratorio } = await import('../herramientas/laboratorio-vfx/laboratorio.js');
  iniciarLaboratorio(THREE);
  const api = globalThis.laboratorioVfx;
  assert.equal(api.listo, true, api.error);
  assert.equal(api.nombres.length, 10); assert.equal(contactos, 14);
  assert(dibujados > 0);
  for (const receta of api.nombres) for (const calidad of ['alto', 'medio', 'bajo', 'no']) {
    const m = api.medir(receta, calidad);
    assert.equal(m.muestras, 161); assert(Number.isFinite(m.mediaMs)); assert(m.maxMs >= m.mediaMs);
    assert.equal(m.maxParticulas > 0, calidad !== 'no');
  }
  api.configurar('impacto', 'alto');
  api.ir(.3); const directo = nodos.contador.textContent.split(' · ').slice(0, 2);
  api.ir(.9); api.ir(.3);
  assert.deepEqual(nodos.contador.textContent.split(' · ').slice(0, 2), directo);
  assert.equal(nodos.pausa.textContent, es.continuar);
  nodos.tiempo.value = '.6'; nodos.tiempo.eventos.input();
  assert.equal(nodos.tiempo.value, '0.6');
  nodos.reproducir.eventos.click(); siguiente(0); siguiente(100);
  assert.equal(nodos.tiempo.value, '0.1');
  nodos.velocidad.value = '.25'; siguiente(200);
  assert.equal(nodos.tiempo.value, '0.125');
  nodos.pausa.eventos.click(); siguiente(300);
  assert.equal(nodos.tiempo.value, '0.125');
  assert.throws(() => api.configurar('inexistente', 'alto'), /Receta/);
  salida(); assert.equal(liberados, 1);
} finally {
  for (const k of claves) { if (previos[k]) Object.defineProperty(globalThis, k, previos[k]); else delete globalThis[k]; }
}
console.log('Laboratorio VFX emulado en Node: 10 recetas × 4 calidades, hoja, controles, rebobinado, recursos locales y paridad ES/EN; sin rasterizado ni navegador.');
