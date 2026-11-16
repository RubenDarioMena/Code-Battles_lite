// Importar interfaz en Node no requiere DOM ni ejecuta sus instaladores.
import assert from 'node:assert/strict';
import * as interfaz from '../index.js';

assert.equal(typeof globalThis.document, 'undefined');
const nombres = ['instalarConsola', 'instalarInfoReto', 'instalarMaquinas', 'instalarInspector',
  'instalarPestanas', 'instalarRegistro', 'instalarAyuda', 'instalarVariantes',
  'instalarEtiquetas', 'instalarRetosPantalla', 'instalarEditorTexto', 'instalarSugerencias'];
assert.deepEqual(Object.keys(interfaz).sort(), [...nombres].sort());
for (const nombre of nombres) assert.equal(typeof interfaz[nombre], 'function', nombre);
console.log('interfaz: 12 instaladores importables en Node sin DOM.');
