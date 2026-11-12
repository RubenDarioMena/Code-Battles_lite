// Formato y pinceles del terreno, sin DOM ni dependencias: node pruebas/terreno.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contexto = vm.createContext({ window: {} });
const archivo = 'shared/terreno/datos.js';
vm.runInContext(readFileSync(path.join(__dirname, '..', archivo), 'utf8'), contexto, { filename: archivo });
const T = contexto.window.CMGTerreno;
vm.runInContext(readFileSync(path.join(__dirname, '..', 'shared/terreno/malla.js'), 'utf8'), contexto, { filename: 'shared/terreno/malla.js' });
const THREE = require('../shared/vendor/three-r128.min.js');
let comprobaciones = 0;
function prueba(nombre, fn) {
  try { fn(); comprobaciones++; }
  catch (error) { error.message = nombre + ': ' + error.message; throw error; }
}
const copiar = dato => JSON.parse(JSON.stringify(dato));
const indice = (mapa, x, z) => Math.round((z - mapa.origen.z) / mapa.paso) * mapa.columnas + Math.round((x - mapa.origen.x) / mapa.paso);
const plano = () => T.crear({ nombre: 'Prueba de terreno', relieve: false });
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);

prueba('formato, resolución y canales', () => {
  const m = plano();
  assert.equal(m.formato, 'cbl-terreno'); assert.equal(m.version, 2);
  assert.equal(m.columnas, 129); assert.equal(m.filas, 97); assert.equal(m.paso, .5);
  assert.deepEqual(copiar(m.origen), { x: -16, z: -18 });
  assert.equal(m.alturas.length, 129 * 97); assert.equal(m.pesos.length, 129 * 97 * 4);
  assert.equal(T.PALETA.length, 4);
  assert.deepEqual(copiar(T.AGUA), { nombre: 'Agua', color: '#428fbb' });
  assert.equal(m.agua.nivel, .35); assert.equal(m.agua.mascara.length, 12513);
  assert.ok(m.agua.mascara.every(v => v === 0)); assert.deepEqual(copiar(m.bloques), []);
  assert.equal(T.CLAVE_BORRADOR, 'cmg-terreno:borrador-v1');
  assert.equal(T.CLAVE_JUEGO, 'cmg-terreno:war-v1');
});
prueba('generación reproducible, relieve y plano', () => {
  const a = T.crear(), b = T.crear();
  assert.equal(T.serializar(a), T.serializar(b));
  assert.ok(a.alturas.some(h => h > 0));
  assert.ok(plano().alturas.every(h => h === 0));
});
prueba('campo protegido y datos finitos al generar', () => {
  const m = T.crear();
  for (let fila = 0; fila < m.filas; fila++) for (let col = 0; col < m.columnas; col++) {
    const i = fila * m.columnas + col;
    const x = m.origen.x + col * m.paso, z = m.origen.z + fila * m.paso;
    const h = m.alturas[i];
    assert.ok(Number.isFinite(h) && h >= -2 && h <= 20);
    if (x >= -1 && x <= 33 && z >= -1 && z <= 19) assert.equal(h, 0);
    const pesos = m.pesos.slice(i * 4, i * 4 + 4);
    assert.ok(pesos.every(p => Number.isFinite(p) && p >= 0 && p <= 1));
    cerca(pesos.reduce((a, b) => a + b, 0), 1);
  }
});
prueba('JSON conserva el mapa y la validación copia sus buffers', () => {
  const original = T.crear({ nombre: 'Mapa reutilizable' });
  const copia = T.validar(JSON.parse(T.serializar(original)));
  assert.deepEqual(copiar(copia), copiar(original));
  const i = indice(copia, -10, -10);
  copia.alturas[i] = 19; copia.pesos[0] = .5; copia.origen.x = 100;
  assert.notEqual(original.alturas[i], 19);
  assert.notEqual(original.pesos[0], .5);
  assert.equal(original.origen.x, -16);
});

for (const [nombre, modificar] of [
  ['formato desconocido', m => { m.formato = 'otro'; }],
  ['versión desconocida', m => { m.version = 99; }],
  ['dimensiones excesivas', m => { m.columnas = 1e8; }],
  ['número de filas diferente', m => { m.filas = 96; }],
  ['escala diferente', m => { m.paso = 1; }],
  ['origen diferente', m => { m.origen.x = 0; }],
  ['altura faltante', m => { m.alturas.pop(); }],
  ['canal faltante', m => { m.pesos.pop(); }],
  ['altura en texto', m => { m.alturas[0] = '1'; }],
  ['altura infinita', m => { m.alturas[0] = Infinity; }],
  ['altura NaN', m => { m.alturas[0] = NaN; }],
  ['altura excesiva', m => { m.alturas[0] = 20.1; }],
  ['altura demasiado baja', m => { m.alturas[0] = -2.1; }],
  ['peso en texto', m => { m.pesos[0] = '1'; }],
  ['peso infinito', m => { m.pesos[0] = Infinity; }],
  ['peso negativo', m => { m.pesos[0] = -.1; }],
  ['peso no normalizado', m => { for (let i = 0; i < 4; i++) m.pesos[i] = .5; }],
  ['campo elevado en JSON', m => { m.alturas[indice(m, 10, 8)] = .1; }],
  ['margen elevado en JSON', m => { m.alturas[indice(m, -1, -1)] = .1; }],
  ['nombre vacío', m => { m.nombre = '   '; }],
  ['nombre demasiado largo', m => { m.nombre = 'a'.repeat(81); }],
  ['nombre no textual', m => { m.nombre = 123; }],
  ['nombre con caracteres de control', m => { m.nombre = 'Mapa\nroto'; }],
]) prueba('rechaza ' + nombre, () => {
  const m = plano(); modificar(m); assert.throws(() => T.validar(m));
});
prueba('rechaza documentos sin estructura', () => {
  for (const valor of [null, undefined, [], 2, 'mapa', {}]) assert.throws(() => T.validar(valor));
});
prueba('los pinceles respetan presión cero', () => {
  const m = T.crear(), antes = T.serializar(m);
  for (const modo of ['subir', 'bajar', 'suavizar', 'aplanar', 'pintar', 'agua', 'secar']) {
    assert.equal(T.aplicar(m, { x: -10, z: -10, modo, radio: 4, fuerza: 1, presion: 0, material: 2, altura: 10 }), false);
  }
  assert.equal(T.serializar(m), antes);
});
prueba('parámetros inválidos de pincel no alteran el documento', () => {
  const m = T.crear(), antes = T.serializar(m);
  for (const opciones of [
    { x: NaN }, { z: Infinity }, { radio: -1 }, { radio: 1e6 }, { fuerza: NaN },
    { presion: -1 }, { modo: 'desconocido' }, { modo: 'pintar', material: 4 },
    { modo: 'pintar', material: 1.5 }, { modo: 'aplanar', altura: Infinity },
  ]) assert.equal(T.aplicar(m, { x: -10, z: -10, modo: 'subir', ...opciones }), false);
  assert.equal(T.serializar(m), antes);
});
prueba('subir y bajar actúan fuera del campo y limitan las alturas', () => {
  const m = plano(), i = indice(m, -10, -10);
  assert.equal(T.aplicar(m, { x: -10, z: -10, radio: 2, fuerza: .5, modo: 'subir' }), true);
  assert.ok(m.alturas[i] > 0);
  for (let n = 0; n < 100; n++) T.aplicar(m, { x: -10, z: -10, radio: 2, fuerza: 20, modo: 'subir' });
  cerca(m.alturas[i], 20);
  for (let n = 0; n < 100; n++) T.aplicar(m, { x: -10, z: -10, radio: 2, fuerza: 20, modo: 'bajar' });
  cerca(m.alturas[i], -2);
  assert.doesNotThrow(() => T.validar(m));
});
prueba('esculpir no eleva ni hunde el campo ni su margen', () => {
  const m = plano();
  for (const [x, z] of [[10, 8], [-1, -1], [33, 19]]) for (const modo of ['subir', 'bajar', 'aplanar']) {
    T.aplicar(m, { x, z, radio: 3, fuerza: 1, modo, altura: 9 });
  }
  for (let z = -1; z <= 19; z += .5) for (let x = -1; x <= 33; x += .5) assert.equal(m.alturas[indice(m, x, z)], 0);
});
prueba('la presión modula un trazo', () => {
  const suave = plano(), fuerte = plano(), i = indice(suave, -10, -10);
  T.aplicar(suave, { x: -10, z: -10, modo: 'subir', fuerza: .5, presion: .25 });
  T.aplicar(fuerte, { x: -10, z: -10, modo: 'subir', fuerza: .5, presion: 1 });
  assert.ok(suave.alturas[i] > 0 && suave.alturas[i] < fuerte.alturas[i]);
});
prueba('pintar funciona dentro del campo y mantiene cuatro pesos normalizados', () => {
  const m = plano(), i = indice(m, 10, 8), antes = m.pesos[i * 4 + 2];
  assert.equal(T.aplicar(m, { x: 10, z: 8, modo: 'pintar', radio: 2, fuerza: .5, material: 2 }), true);
  assert.ok(m.pesos[i * 4 + 2] > antes);
  assert.equal(m.alturas[i], 0);
  for (let n = 0; n < m.alturas.length; n++) {
    const pesos = m.pesos.slice(n * 4, n * 4 + 4);
    assert.ok(pesos.every(p => p >= 0 && p <= 1));
    cerca(pesos.reduce((a, b) => a + b, 0), 1);
  }
  assert.doesNotThrow(() => T.validar(m));
});
prueba('aplanar acerca el relieve a la altura elegida sin sobrepasarla', () => {
  const m = plano(), i = indice(m, -10, -10);
  T.aplicar(m, { x: -10, z: -10, radio: 2, modo: 'aplanar', fuerza: .25, altura: 4 });
  assert.ok(m.alturas[i] > 0 && m.alturas[i] <= 4);
  for (let n = 0; n < 40; n++) T.aplicar(m, { x: -10, z: -10, radio: 2, modo: 'aplanar', fuerza: .5, altura: 4 });
  cerca(m.alturas[i], 4);
});
prueba('suavizar conserva una meseta constante', () => {
  const m = plano();
  for (let z = -14; z <= -6; z += .5) for (let x = -14; x <= -6; x += .5) m.alturas[indice(m, x, z)] = 5;
  T.aplicar(m, { x: -10, z: -10, radio: 2, modo: 'suavizar', fuerza: .5 });
  for (let z = -11; z <= -9; z += .5) for (let x = -11; x <= -9; x += .5) cerca(m.alturas[indice(m, x, z)], 5);
});
prueba('suavizar usa la misma instantánea para todos los vecinos', () => {
  const m = plano(), i = indice(m, -10, -10); m.alturas[i] = 4;
  T.aplicar(m, { x: -10, z: -10, radio: 3, modo: 'suavizar', fuerza: .5 });
  assert.ok(m.alturas[i] < 4 && m.alturas[i] >= 0);
  const norte = m.alturas[indice(m, -10, -10.5)];
  assert.ok(norte > 0);
  cerca(norte, m.alturas[indice(m, -10, -9.5)]);
  cerca(norte, m.alturas[indice(m, -10.5, -10)]);
  cerca(norte, m.alturas[indice(m, -9.5, -10)]);
});
prueba('muestreo bilineal y bordes', () => {
  const m = plano();
  m.alturas[indice(m, -12, -12)] = 0; m.alturas[indice(m, -11.5, -12)] = 2;
  m.alturas[indice(m, -12, -11.5)] = 4; m.alturas[indice(m, -11.5, -11.5)] = 6;
  cerca(T.alturaEn(m, -11.75, -11.75), 3);
  cerca(T.alturaEn(m, -11.5, -12), 2);
  m.alturas[0] = 7; m.alturas[m.alturas.length - 1] = 9;
  cerca(T.alturaEn(m, -1e5, -1e5), 7);
  cerca(T.alturaEn(m, 1e5, 1e5), 9);
});
prueba('malla r128: resolución, caras superiores y extensión del mundo', () => {
  const m = plano(), g = T.crearGeometria(THREE, m);
  assert.equal(g.getAttribute('position').count, 12513);
  assert.equal(g.getAttribute('color').count, 12513);
  assert.equal(g.index.count / 3, 24576);
  for (let n = 0; n < g.getAttribute('normal').count; n++) {
    cerca(g.getAttribute('normal').getX(n), 0);
    cerca(g.getAttribute('normal').getY(n), 1);
    cerca(g.getAttribute('normal').getZ(n), 0);
  }
  assert.deepEqual(g.boundingBox.min.toArray(), [-16, 0, -18]);
  assert.deepEqual(g.boundingBox.max.toArray(), [48, 0, 30]);
  assert.ok(Number.isFinite(g.boundingSphere.radius) && g.boundingSphere.radius > 0);
  const posiciones = g.getAttribute('position');
  for (let n = 0; n < g.index.count; n += 3) {
    const a = g.index.getX(n), b = g.index.getX(n + 1), c = g.index.getX(n + 2);
    assert.ok(a >= 0 && a < posiciones.count && b >= 0 && b < posiciones.count && c >= 0 && c < posiciones.count);
    const abx = posiciones.getX(b) - posiciones.getX(a), abz = posiciones.getZ(b) - posiciones.getZ(a);
    const acx = posiciones.getX(c) - posiciones.getX(a), acz = posiciones.getZ(c) - posiciones.getZ(a);
    assert.ok(abz * acx - abx * acz > 0, 'El triángulo debe mirar hacia +Y.');
  }
  g.dispose();
});
prueba('actualizar la malla reutiliza los buffers y actualiza altura, color y límites', () => {
  const m = plano(), g = T.crearGeometria(THREE, m), i = indice(m, -10, -10);
  const posiciones = g.getAttribute('position'), colores = g.getAttribute('color');
  const versionPosicion = posiciones.version, versionColor = colores.version;
  const colorPrevio = [colores.getX(i), colores.getY(i), colores.getZ(i)];
  T.aplicar(m, { x: -10, z: -10, modo: 'subir', fuerza: 1 });
  T.aplicar(m, { x: -10, z: -10, modo: 'pintar', material: 2, fuerza: .5 });
  T.actualizarGeometria(THREE, g, m);
  assert.strictEqual(g.getAttribute('position'), posiciones); assert.strictEqual(g.getAttribute('color'), colores);
  cerca(posiciones.getY(i), m.alturas[i]);
  assert.ok(posiciones.version > versionPosicion && colores.version > versionColor);
  assert.notDeepEqual([colores.getX(i), colores.getY(i), colores.getZ(i)], colorPrevio);
  assert.ok(g.boundingBox.max.y >= m.alturas[i]);
  assert.ok(Array.from(colores.array).every(v => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));
  g.dispose();
});

prueba('v1 se importa como v2 con agua vacía y sin bloques', () => {
  const antiguo = copiar(T.crear()); antiguo.version = 1;
  delete antiguo.agua; delete antiguo.bloques;
  const actualizado = T.validar(antiguo);
  assert.equal(actualizado.version, 2); assert.equal(actualizado.agua.nivel, .35);
  assert.ok(actualizado.agua.mascara.every(v => v === 0));
  assert.deepEqual(copiar(actualizado.bloques), []);
  assert.deepEqual(copiar(actualizado.alturas), antiguo.alturas);
  assert.deepEqual(copiar(actualizado.pesos), antiguo.pesos);
  assert.equal(antiguo.version, 1); assert.equal(antiguo.agua, undefined);
  assert.equal(JSON.parse(T.serializar(antiguo)).version, 2);
});
for (const [nombre, modificar] of [
  ['agua ausente', m => { delete m.agua; }],
  ['máscara corta', m => { m.agua.mascara.pop(); }],
  ['máscara negativa', m => { m.agua.mascara[0] = -.1; }],
  ['máscara mayor que uno', m => { m.agua.mascara[0] = 1.1; }],
  ['máscara infinita', m => { m.agua.mascara[0] = Infinity; }],
  ['máscara no numérica', m => { m.agua.mascara[0] = '1'; }],
  ['nivel demasiado bajo', m => { m.agua.nivel = -2.01; }],
  ['nivel demasiado alto', m => { m.agua.nivel = 20.01; }],
  ['nivel infinito', m => { m.agua.nivel = Infinity; }],
  ['nivel no numérico', m => { m.agua.nivel = '.35'; }],
]) prueba('v2 rechaza ' + nombre, () => {
  const m = plano(); modificar(m); assert.throws(() => T.validar(m));
});
prueba('agua y secar conservan suelo y materiales, también dentro del campo', () => {
  const m = plano(), i = indice(m, 10, 8);
  const alturas = copiar(m.alturas), pesos = copiar(m.pesos);
  assert.equal(T.aplicar(m, { x: 10, z: 8, radio: 2, modo: 'agua', fuerza: .5 }), true);
  assert.ok(m.agua.mascara[i] > 0 && m.agua.mascara[i] <= 1);
  const pintado = m.agua.mascara[i];
  assert.equal(T.aplicar(m, { x: 10, z: 8, radio: 2, modo: 'secar', fuerza: .5 }), true);
  assert.ok(m.agua.mascara[i] < pintado && m.agua.mascara[i] >= 0);
  assert.deepEqual(copiar(m.alturas), alturas); assert.deepEqual(copiar(m.pesos), pesos);
  assert.ok(m.agua.mascara.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.doesNotThrow(() => T.validar(m));
});
prueba('presión de agua y secado completo', () => {
  const suave = plano(), fuerte = plano(), i = indice(suave, -10, -10);
  T.aplicar(suave, { x: -10, z: -10, modo: 'agua', fuerza: .5, presion: .25 });
  T.aplicar(fuerte, { x: -10, z: -10, modo: 'agua', fuerza: .5, presion: 1 });
  assert.ok(suave.agua.mascara[i] > 0 && suave.agua.mascara[i] < fuerte.agua.mascara[i]);
  for (let n = 0; n < 40; n++) T.aplicar(fuerte, { x: -10, z: -10, modo: 'agua', fuerza: .5 });
  cerca(fuerte.agua.mascara[i], 1);
  for (let n = 0; n < 40; n++) T.aplicar(fuerte, { x: -10, z: -10, modo: 'secar', fuerza: .5 });
  cerca(fuerte.agua.mascara[i], 0);
});
const bloque = (id = 'torre') => ({
  id, nombre: 'Torre provisional', color: '#C29462',
  vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2],
  posicion: [-10, 0, -10], rotacion: [0, 0, 0], escala: [1, 1, 1],
});
prueba('v2 guarda bloques y copia todos sus arrays y la máscara de agua', () => {
  const m = plano(); m.bloques.push(bloque()); m.agua.mascara[0] = .5;
  const copia = T.validar(JSON.parse(T.serializar(m)));
  assert.deepEqual(copiar(copia), copiar(m));
  for (const clave of ['vertices', 'indices', 'posicion', 'rotacion', 'escala']) {
    assert.notStrictEqual(copia.bloques[0][clave], m.bloques[0][clave]);
    copia.bloques[0][clave][0] = 100;
    assert.notEqual(copia.bloques[0][clave][0], m.bloques[0][clave][0]);
  }
  assert.notStrictEqual(copia.bloques, m.bloques); assert.notStrictEqual(copia.bloques[0], m.bloques[0]);
  copia.bloques[0].nombre = 'Otro'; assert.equal(m.bloques[0].nombre, 'Torre provisional');
  copia.agua.mascara[0] = 1; assert.equal(m.agua.mascara[0], .5);
});
for (const [nombre, modificar] of [
  ['id vacío', b => { b.id = ' '; }],
  ['id demasiado largo', b => { b.id = 'x'.repeat(41); }],
  ['nombre de bloque vacío', b => { b.nombre = ''; }],
  ['nombre de bloque demasiado largo', b => { b.nombre = 'x'.repeat(81); }],
  ['color no hexadecimal', b => { b.color = 'red'; }],
  ['menos de tres vértices', b => { b.vertices = [0, 0, 0, 1, 1, 1]; }],
  ['vértice incompleto', b => { b.vertices.push(0); }],
  ['vértice infinito', b => { b.vertices[0] = Infinity; }],
  ['vértice fuera de límites', b => { b.vertices[0] = 256.1; }],
  ['índice fuera de vértices', b => { b.indices[2] = 3; }],
  ['índice negativo', b => { b.indices[0] = -1; }],
  ['índice no entero', b => { b.indices[0] = .5; }],
  ['índice repetido', b => { b.indices[1] = 0; }],
  ['triángulo incompleto', b => { b.indices.pop(); }],
  ['posición incompleta', b => { b.posicion.pop(); }],
  ['posición fuera de límites', b => { b.posicion[0] = 256.1; }],
  ['rotación fuera de límites', b => { b.rotacion[1] = 2 * Math.PI + .01; }],
  ['rotación no finita', b => { b.rotacion[0] = NaN; }],
  ['escala inferior al mínimo', b => { b.escala[0] = .049; }],
  ['escala superior al máximo', b => { b.escala[1] = 20.01; }],
  ['escala no numérica', b => { b.escala[0] = '1'; }],
]) prueba('rechaza bloque con ' + nombre, () => {
  const m = plano(), b = bloque(); modificar(b); m.bloques.push(b);
  assert.throws(() => T.validar(m));
});
prueba('rechaza ids de bloque duplicados y más de 64 bloques', () => {
  const m = plano(); m.bloques = [bloque('uno'), bloque('uno')]; assert.throws(() => T.validar(m));
  m.bloques = Array.from({ length: 65 }, (_, i) => bloque('bloque-' + i)); assert.throws(() => T.validar(m));
});
prueba('rechaza bloques vacíos e ids equivalentes tras quitar espacios', () => {
  const m = plano(); m.bloques = new Array(1); assert.throws(() => T.validar(m));
  m.bloques = [bloque('uno'), bloque(' uno ')]; assert.throws(() => T.validar(m));
});
prueba('límites de vértices e índices se aplican al conjunto de bloques', () => {
  const m = plano(), a = bloque('a'), b = bloque('b');
  a.vertices = Array.from({ length: 2049 * 3 }, (_, i) => i % 3 === 1 ? .5 : 0);
  b.vertices = a.vertices.slice(); m.bloques = [a, b]; assert.throws(() => T.validar(m));
  a.vertices = bloque().vertices; b.vertices = bloque().vertices;
  a.indices = Array.from({ length: 12291 }, (_, i) => i % 3);
  b.indices = a.indices.slice(); assert.throws(() => T.validar(m));
});
prueba('acepta exactamente los presupuestos máximos de geometría y de bloques', () => {
  const m = plano(), b = bloque();
  b.vertices = Array.from({ length: 4096 * 3 }, (_, n) => n % 3 === 0 ? Math.floor(n / 3) % 64 : n % 3 === 1 ? Math.floor(n / 192) : .5);
  b.indices = Array.from({ length: 24576 }, (_, i) => i % 3); m.bloques = [b];
  assert.doesNotThrow(() => T.validar(m));
  m.bloques = Array.from({ length: 64 }, (_, i) => bloque('bloque-' + i));
  assert.doesNotThrow(() => T.validar(m));
});
prueba('malla de agua vacía, pintada y recortada por la altura del suelo', () => {
  const m = plano(), i = indice(m, -10, -10), g = T.crearGeometriaAgua(THREE, m);
  const posiciones = g.getAttribute('position'), color = g.getAttribute('color'), normales = g.getAttribute('normal');
  const indiceBuffer = g.index;
  assert.equal(posiciones.count, 12513); assert.equal(color.itemSize, 4); assert.equal(g.drawRange.count, 0);
  assert.equal(color.getW(i), 0);
  m.agua.mascara[i] = .5; T.actualizarGeometriaAgua(THREE, g, m);
  cerca(color.getW(i), .5); cerca(posiciones.getY(i), m.agua.nivel);
  assert.ok(g.drawRange.count > 0 && g.drawRange.count <= g.index.count);
  assert.equal(g.drawRange.count % 3, 0);
  for (let n = 0; n < g.drawRange.count; n += 3) {
    const a = g.index.getX(n), b = g.index.getX(n + 1), c = g.index.getX(n + 2);
    assert.ok(color.getW(a) > 0 || color.getW(b) > 0 || color.getW(c) > 0);
    const abx = posiciones.getX(b) - posiciones.getX(a), abz = posiciones.getZ(b) - posiciones.getZ(a);
    const acx = posiciones.getX(c) - posiciones.getX(a), acz = posiciones.getZ(c) - posiciones.getZ(a);
    assert.ok(abz * acx - abx * acz > 0);
  }
  m.alturas[i] = m.agua.nivel;
  T.actualizarGeometriaAgua(THREE, g, m);
  assert.equal(color.getW(i), 0); assert.equal(g.drawRange.count, 0);
  m.alturas[i] = m.agua.nivel + .2;
  T.actualizarGeometriaAgua(THREE, g, m); assert.equal(color.getW(i), 0);
  assert.strictEqual(g.getAttribute('position'), posiciones); assert.strictEqual(g.getAttribute('color'), color);
  assert.strictEqual(g.index, indiceBuffer);
  for (let n = 0; n < normales.count; n++) { cerca(normales.getX(n), 0); cerca(normales.getY(n), 1); cerca(normales.getZ(n), 0); }
  assert.ok(Array.from(color.array).every(v => Number.isFinite(v) && v >= 0 && v <= 1));
  g.dispose();
});

console.log(`Terreno: ${comprobaciones} comprobaciones correctas.`);
