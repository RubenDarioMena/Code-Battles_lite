// Primitivas, transformaciones y topología: node pruebas/terreno-bloques.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const contexto = vm.createContext({ window: {} });
for (const archivo of ['datos.js', 'bloques.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'shared/terreno', archivo), 'utf8'), contexto, { filename: archivo });
}
const T = contexto.window.CMGTerreno, B = T.BLOQUES;
const THREE = require('../shared/vendor/three-r128.min.js');
const mapa = () => T.crear({ relieve: false });
const copia = v => JSON.parse(JSON.stringify(v));
const cerca = (a, b, tolerancia = 1e-8) => assert.ok(Math.abs(a - b) < tolerancia, `${a} ≠ ${b}`);
let comprobaciones = 0;
function prueba(nombre, fn) {
  try { fn(); comprobaciones++; }
  catch (error) { error.message = nombre + ': ' + error.message; throw error; }
}
function cara(b, n) { return b.indices.slice(n * 3, n * 3 + 3).map(i => b.vertices.slice(i * 3, i * 3 + 3)); }
const resta = (a, b) => a.map((x, i) => x - b[i]);
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function volumen(b) {
  let resultado = 0;
  for (let n = 0; n < b.indices.length / 3; n++) {
    const [a, p, c] = cara(b, n);
    resultado += punto(a, cruz(p, c)) / 6;
  }
  return resultado;
}
function cerrada(b) {
  const aristas = new Map();
  for (let n = 0; n < b.indices.length; n += 3) for (let e = 0; e < 3; e++) {
    const a = b.indices[n + e], p = b.indices[n + (e + 1) % 3];
    const k = `${Math.min(a, p)}:${Math.max(a, p)}`, registro = aristas.get(k) || { veces: 0, sentido: 0 };
    registro.veces++; registro.sentido += a < p ? 1 : -1; aristas.set(k, registro);
  }
  for (const registro of aristas.values()) { assert.equal(registro.veces, 2); assert.equal(registro.sentido, 0); }
}
for (const [tipo, interior, esperado] of [
  ['caja', [0, 2, 0], 64], ['rampa', [0, 1, 1], 32], ['cilindro', [0, 2, 0], 128 * Math.sin(Math.PI / 8)],
]) prueba(`${tipo}: caras exteriores y malla cerrada con volumen correcto`, () => {
  const m = mapa(), b = B.crear(m, tipo);
  cerrada(b); cerca(volumen(b), esperado);
  for (let n = 0; n < b.indices.length / 3; n++) {
    const [a, p, c] = cara(b, n), normal = cruz(resta(p, a), resta(c, a));
    const centro = a.map((v, i) => (v + p[i] + c[i]) / 3);
    assert.ok(punto(normal, resta(centro, interior)) > 0);
  }
  assert.ok(b.vertices.filter((_, i) => i % 3 === 1).every(y => y >= 0 && y <= 4));
  assert.equal(m.bloques.length, 1); assert.doesNotThrow(() => T.validar(m));
});
prueba('plano: dos triángulos de 4 × 4 orientados hacia arriba', () => {
  const b = B.crear(mapa(), 'plano');
  assert.equal(b.vertices.length, 12); assert.equal(b.indices.length, 6);
  for (let n = 0; n < 2; n++) {
    const [a, p, c] = cara(b, n), normal = cruz(resta(p, a), resta(c, a));
    assert.equal(normal[0], 0); assert.ok(normal[1] > 0); assert.equal(normal[2], 0);
  }
});
prueba('IDs reproducibles, únicos y eliminación sin modificar otros bloques', () => {
  const a = mapa(), b = mapa();
  for (const tipo of ['caja', 'rampa', 'plano']) {
    assert.equal(B.crear(a, tipo).id, B.crear(b, tipo).id);
  }
  const previo = a.bloques[1];
  assert.equal(B.eliminar(a, [a.bloques[0].id]), true);
  B.crear(a, 'cilindro');
  assert.equal(new Set(a.bloques.map(x => x.id)).size, a.bloques.length);
  assert.strictEqual(a.bloques[0], previo);
  assert.equal(B.eliminar(a, ['ausente']), false);
});
prueba('colocación inicial apoya la base en el terreno', () => {
  const m = T.crear(), b = B.crear(m, 'caja', { x: -8, z: -11 });
  cerca(b.posicion[1], T.alturaEn(m, -8, -11));
  assert.ok(b.posicion[1] > 0); assert.deepEqual(copia(b.posicion).filter((_, i) => i !== 1), [-8, -11]);
  const plano = B.crear(m, 'plano', { x: 16, z: 9 });
  cerca(plano.posicion[1], T.alturaEn(m, 16, 9) + .04);
});
prueba('adaptador r128 conserva índices y crea normales y límites finitos', () => {
  const b = B.crear(mapa(), 'caja'), g = B.geometria(THREE, b);
  assert.equal(g.getAttribute('position').count, 8);
  assert.deepEqual(Array.from(g.index.array), copia(b.indices));
  assert.deepEqual(g.boundingBox.min.toArray(), [-2, 0, -2]);
  assert.deepEqual(g.boundingBox.max.toArray(), [2, 4, 2]);
  assert.ok(Array.from(g.getAttribute('normal').array).every(Number.isFinite));
  assert.ok(Number.isFinite(g.boundingSphere.radius) && g.boundingSphere.radius > 0);
  g.dispose();
});
prueba('unión conserva transformación mundial y color de primera selección', () => {
  const m = mapa(), a = B.crear(m, 'caja'), b = B.crear(m, 'rampa');
  a.posicion = [10, 3, -4]; a.rotacion = [0, Math.PI / 2, 0]; a.escala = [2, 1, .5];
  b.posicion = [-5, 1, 8]; b.color = '#123456';
  const esperado = [];
  for (const original of [b, a]) for (let i = 0; i < original.vertices.length; i += 3) {
    const x = original.vertices[i] * original.escala[0], y = original.vertices[i + 1] * original.escala[1], z = original.vertices[i + 2] * original.escala[2];
    const angulo = original.rotacion[1];
    esperado.push(x * Math.cos(angulo) + z * Math.sin(angulo) + original.posicion[0], y + original.posicion[1], -x * Math.sin(angulo) + z * Math.cos(angulo) + original.posicion[2]);
  }
  const id = B.unir(THREE, m, [b.id, a.id]), combinado = m.bloques[0];
  assert.equal(combinado.id, id); assert.equal(m.bloques.length, 1); assert.equal(combinado.color, b.color);
  assert.deepEqual(copia(combinado.posicion), [0, 0, 0]); assert.deepEqual(copia(combinado.rotacion), [0, 0, 0]); assert.deepEqual(copia(combinado.escala), [1, 1, 1]);
  assert.equal(combinado.vertices.length, esperado.length);
  combinado.vertices.forEach((v, i) => cerca(v, esperado[i]));
  assert.equal(combinado.indices.length, a.indices.length + b.indices.length);
  cerrada(combinado); assert.doesNotThrow(() => T.validar(m));
});
for (const distancia of [2, -.5]) prueba(`extrusión ${distancia}: tapa cerrada y volumen orientado coherente`, () => {
  const b = B.crear(mapa(), 'caja'), volumenInicial = volumen(b), caraInicial = cara(b, 2);
  const area = Math.hypot(...cruz(resta(caraInicial[1], caraInicial[0]), resta(caraInicial[2], caraInicial[0]))) / 2;
  assert.equal(B.extruir(b, 2, distancia), true);
  assert.equal(b.vertices.length / 3, 11); assert.equal(b.indices.length / 3, 18);
  cerrada(b); cerca(volumen(b) - volumenInicial, area * distancia);
  for (const p of cara(b, 2)) cerca(p[1], 4 + distancia);
});
prueba('extrusión limita la distancia a ocho metros', () => {
  const b = B.crear(mapa(), 'caja');
  assert.equal(B.extruir(b, 2, 1000), true);
  for (const p of cara(b, 2)) cerca(p[1], 12);
});
prueba('caras degeneradas, índices y distancias inválidos se rechazan sin cambios', () => {
  const b = B.crear(mapa(), 'plano'), original = JSON.stringify(b);
  for (const [cara, d] of [[-1, 1], [99, 1], [.5, 1], [0, 0], [0, NaN], [0, Infinity], [0, '2']]) {
    assert.equal(B.extruir(b, cara, d), false); assert.equal(JSON.stringify(b), original);
  }
  const degenerado = { ...copia(b), vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0], indices: [0, 1, 2] };
  const antes = JSON.stringify(degenerado);
  assert.equal(B.extruir(degenerado, 0, 1), false); assert.equal(JSON.stringify(degenerado), antes);
});
prueba('límites de extrusión se comprueban antes de mutar', () => {
  const b = B.crear(mapa(), 'caja');
  while (b.vertices.length / 3 < 4094) b.vertices.push(0, 0, 0);
  const original = JSON.stringify(b);
  assert.equal(B.extruir(b, 2, 1), false); assert.equal(JSON.stringify(b), original);
  const fuera = B.crear(mapa(), 'plano'); fuera.vertices = fuera.vertices.map((n, i) => i % 3 === 1 ? 255 : n);
  const antes = JSON.stringify(fuera);
  assert.equal(B.extruir(fuera, 0, 8), false); assert.equal(JSON.stringify(fuera), antes);
});
prueba('crear respeta capacidad y parámetros sin dejar inserciones parciales', () => {
  const m = mapa();
  for (let i = 0; i < 64; i++) B.crear(m, 'caja');
  const antes = T.serializar(m), referencia = m.bloques;
  for (const accion of [() => B.crear(m, 'caja'), () => B.crear(m, 'esfera'), () => B.crear(m, 'plano', { x: Infinity }), () => B.crear(m, 'plano', { x: 300 })]) {
    assert.throws(accion); assert.equal(T.serializar(m), antes); assert.strictEqual(m.bloques, referencia);
  }
});
prueba('unión fuera de límites o con selección inválida es atómica', () => {
  const m = mapa(), a = B.crear(m, 'caja'), b = B.crear(m, 'caja');
  a.posicion = [250, 0, 0]; a.escala = [20, 1, 1];
  const antes = T.serializar(m), referencia = m.bloques;
  for (const ids of [[a.id, b.id], [a.id], [a.id, a.id], [a.id, 'ausente']]) {
    assert.throws(() => B.unir(THREE, m, ids)); assert.equal(T.serializar(m), antes); assert.strictEqual(m.bloques, referencia);
  }
});
prueba('JSON conserva geometría, transformaciones y color de bloques editados', () => {
  const m = mapa(), b = B.crear(m, 'rampa'); b.color = '#abcdef'; b.rotacion = [.2, -.4, .8];
  assert.equal(B.extruir(b, 6, .5), true);
  const normalizado = T.validar(JSON.parse(T.serializar(m)));
  assert.deepEqual(copia(normalizado.bloques), copia(m.bloques));
  normalizado.bloques[0].vertices[0] = 111;
  assert.notEqual(m.bloques[0].vertices[0], 111);
});
console.log(`Bloques de terreno: ${comprobaciones} comprobaciones correctas.`);
