// Importar interfaz en Node no requiere DOM ni ejecuta sus instaladores.
import assert from 'node:assert/strict';
import * as interfaz from '../index.js';

assert.equal(typeof globalThis.document, 'undefined');
const nombres = ['instalarConsola', 'instalarInfoReto', 'instalarMaquinas', 'instalarInspector',
  'instalarPestanas', 'instalarRegistro', 'instalarAyuda', 'instalarVariantes',
  'instalarEtiquetas', 'instalarRetosPantalla', 'instalarEditorTexto', 'instalarSugerencias',
  'montarHudHito', 'montarInterfazHito', 'montarMandoTactil', 'crearMinificha'];
assert.deepEqual(Object.keys(interfaz).sort(), [...nombres, 'CAMPAIGN_UI', 'FACTORY_FORM', 'registrarIconosFactory', 'instalarLayout'].sort());
assert.equal(typeof interfaz.CAMPAIGN_UI.crear, 'function');
assert.equal(typeof interfaz.FACTORY_FORM.crear, 'function');
for (const nombre of nombres) assert.equal(typeof interfaz[nombre], 'function', nombre);
console.log(`interfaz: ${nombres.length} instaladores importables en Node sin DOM.`);
