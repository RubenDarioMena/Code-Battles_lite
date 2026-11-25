import assert from 'node:assert/strict';
import { instalarGestosClic } from '../paquetes/app/juego/gestos-clic.js';
import { repartirClic } from '../paquetes/reglas-campaign-v2/index.js';

const handlers = new Map(), ordenes = [], selecciones = [];
let guia, largo;
globalThis.document = { createElement: () => ({ style: {} }) };
globalThis.addEventListener = () => {};
globalThis.setTimeout = (fn, ms) => { assert.equal(ms, 450); largo = fn; return 1; };
globalThis.clearTimeout = () => { largo = null; };
const campo = { addEventListener: (k, fn) => handlers.set(k, fn), append: el => { guia = el; },
  getBoundingClientRect: () => ({ left: 0, top: 0 }) };
const id = 'LAU-01', torreta = { id, clase: 'lanzador', x: 10, y: 1, visible: true };
const ctx = { ejec: {}, cerrarHoja() {}, seleccionadas: new Set([id]), mundo: { porId: { [id]: torreta }, enemigos: [] },
  runtime: { repartirClic, camaraPlano: { x: 0, y: 0, zoom: 1 } }, encolar: e => ordenes.push(e),
  seleccionar: s => selecciones.push(s), anfitrion: { escucha: () => true }, V3: {}, vistaActual: () => plano };
const plano = {};
const caja = { style: {} };
instalarGestosClic(ctx, campo, caja, { unidadEn: x => x === 10 ? id : null, coordenadasEn: (x, y) => ({ x, y }),
  unidades: () => [torreta], puntoPantalla: e => e });
function ev(tipo, x, y, pointerType = 'touch', pointerId = 1, button = 0) {
  handlers.get(tipo)({ target: { tagName: 'CANVAS', setPointerCapture() {} }, pointerType, pointerId, button,
    clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
}
ev('pointerdown', 10, 1); ev('pointerup', 10, 1);
assert.deepEqual(selecciones.pop(), [id]);
ev('pointerdown', 3, 0); ev('pointermove', 20, 10);
assert.equal(caja.hidden, false);
ev('pointerup', 20, 10);
assert.deepEqual(selecciones.pop(), [id]);
ev('pointerdown', 4, 2); largo(); ev('pointerup', 4, 2);
ev('pointerdown', 4, 2, 'mouse', 1, 2);
assert.deepEqual(ordenes.map(o => o.args[0]), ['terrain.onClick', 'terrain.onClick']);
for (const tipo of ['mouse', 'touch']) {
  ev('pointerdown', 10, 1, tipo); largo(); ev('pointermove', 27, 7, tipo);
  assert.equal(guia.hidden, false); assert.ok(parseFloat(guia.style.width) > 15);
  ev('pointerup', 27, 7, tipo);
  assert.equal(guia.hidden, true);
  assert.deepEqual(ordenes.pop(), { tipo: 'orden', unidad: id, verbo: 'intentoPuntual', args: [{ x: 27, y: 7 }] });
}
ev('pointerdown', 4, 2); ev('pointerdown', 40, 2, 'touch', 2);
assert.equal(largo, null); ev('pointermove', 62, 14, 'touch', 2);
assert.ok(ctx.runtime.camaraPlano.zoom > 1);
ev('pointerup', 62, 14, 'touch', 2); ev('pointerup', 4, 2);
ev('pointerdown', 10, 1); largo(); ev('pointercancel', 10, 1);
assert.ok(guia.hidden && caja.hidden);
assert.equal(ordenes.length, 2);
console.log('Selección, recuadro, dos dedos, pulsación larga, botón derecho y arrastre manual en DOM emulado.');
