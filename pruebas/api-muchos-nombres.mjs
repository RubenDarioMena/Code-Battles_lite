// Paridad mensaje a mensaje, incluidos globals sin instrumentar y objetos por línea.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { crearPrograma as vm } from '../herramientas/partida/programa.mjs';
import { escenario } from '../herramientas/espina-interprete/escenarios.mjs';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const nativo = crearTrabajadorInterprete({ acorn });
const drenar = w => { let n = 0; while (w.entregar()) assert(++n < 100); };

export function muchos(crear) {
  const e = escenario('war'), mensajes = [];
  const nombres = Array.from({ length: 50 }, (_, i) => `LAU-${String(i + 1).padStart(2, '0')}`);
  for (const id of nombres) e.snap.maq[id] = structuredClone(e.snap.maq[e.propia]);
  const antes = structuredClone(e.snap);
  const trabajadores = nombres.map((id, i) => {
    const otro = nombres[(i + 1) % nombres.length].replaceAll('-', '_');
    const codigo = `const primera = __L(7), segunda = __L(19);
const retenida = primera.${otro};
__L(3).regularShoot({x:2,y:3});
__L(4).console.log(primera.${otro}.mode, ${otro}.mode, __L(4).yo.mode);
try { primera.${otro}.inexistente; } catch(e) { __L(5).console.log(e.message, e.__linea); }
try { segunda.${otro}.inexistente; } catch(e) { __L(6).console.log(e.message, e.__linea); }
await __L(8).esperar(.1);
__L(9).console.log(retenida.mode, primera.${otro}.mode, ${otro}.mode);
${i === 49 ? '__L(27).LAU_99.mode;' : ''}`;
    const w = crear(e.fuente, id, m => mensajes.push({ unidad: id, ...m }), 4000);
    w.postMessage({ ...e.mensaje(''), codigo, nombres, propia: id }); return w;
  });
  try {
    trabajadores.forEach(drenar); assert.deepEqual(e.snap, antes);
    const siguiente = structuredClone(e.snap);
    for (const d of Object.values(siguiente.maq)) d.mode = 'burst';
    trabajadores.forEach(w => { w.postMessage({ type: 'despierta', id: 1, snap: siguiente }); drenar(w); });
    assert.equal(mensajes.filter(m => m.type === 'error').length, 1);
    assert.match(mensajes.at(-1).mensaje, /undefined/);
    assert(mensajes.some(m => m.type === 'consola' && m.texto === 'burst burst burst'));
    assert(mensajes.some(m => m.type === 'consola' && m.texto.endsWith(' 7')));
    assert(mensajes.some(m => m.type === 'consola' && m.texto.endsWith(' 19')));
    return mensajes;
  } finally { trabajadores.forEach(w => w.terminate()); }
}
assert.deepEqual(muchos(nativo), muchos(vm));

// La pereza no cambia propiedades propias, orden, flags, identidad ni mutación.
export function inspeccionar(crear, serie, nombresExtra = []) {
  const e = escenario(serie), mensajes = [];
  const m = e.mensaje(''), nombre = e.propia.replaceAll('-', '_');
  const codigo = `const a = __L(12), b = __L(23);
const unidad = a.${nombre};
console.log(a === b, unidad === a.${nombre}, '${nombre}' in a);
console.log(Object.keys(a), Object.getOwnPropertyNames(a));
const d = Object.getOwnPropertyDescriptor(a, '${nombre}');
console.log(d.enumerable, d.configurable, typeof d.get, 'set' in d);
console.log(Reflect.set(a, '${nombre}', 1), Reflect.deleteProperty(a, '${nombre}'));
Object.preventExtensions(a);
console.log(Object.isExtensible(a), typeof a.${nombre});
try { b.${nombre}.noExiste; } catch(e) { console.log(e.message, e.__linea); }
console.log(typeof a.duplicado, typeof a.mal_nombre, typeof a.yo);
`;
  const w = crear(e.fuente, e.propia, m => mensajes.push(m), 4000);
  try {
    w.postMessage({ ...m, codigo, nombres: [...m.nombres, 'duplicado', 'duplicado', 'mal-nombre', 'mal_nombre', 'invalido!', 'yo', ...nombresExtra] });
    drenar(w); assert.equal(mensajes.at(-1).type, 'done', JSON.stringify(mensajes)); return mensajes;
  } finally { w.terminate(); }
}
for (const serie of ['war', 'campaign', 'factory']) assert.deepEqual(inspeccionar(nativo, serie), inspeccionar(vm, serie));
// War permite nombres que coinciden con métodos; conserva la sustitución y orden.
assert.deepEqual(inspeccionar(nativo, 'war', ['autoTarget']), inspeccionar(vm, 'war', ['autoTarget']));
console.log('API: 50 lanzadores se leen entre sí, nombre ausente, líneas retenidas, globals, fotos y reflexión iguales mensaje a mensaje a VM.');
