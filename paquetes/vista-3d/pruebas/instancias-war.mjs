import * as ThreeReal from '../../../shared/vendor/three-r180/three.module.min.js';
// Three r180 real; no GPU/DOM. Matrices contra el modelo suelto de los retratos.
import assert from 'node:assert/strict';
import { crearInstanciasWar, enemigoMesh, idDeImpacto, posMisil } from '../instancias-war.js';
const T = { ...ThreeReal };
assert.equal(T.REVISION, '180');
const instancias = [], cajas = [];
const ClaseInstancia = T.InstancedMesh;
T.InstancedMesh = class extends ClaseInstancia {
  constructor(...args) { super(...args); instancias.push(this); this.liberada = 0; this.addEventListener('dispose', () => this.liberada++); }
};
const G = {
  caja: (...d) => { const g = new T.BoxGeometry(...d); cajas.push(g); return g; },
  esfera: new T.SphereGeometry(1, 16, 12),
  rotor: new T.CylinderGeometry(.15, .15, .025, 12), disco: new T.CircleGeometry(1, 24),
};
const M = Object.fromEntries(['enemigo', 'golpe', 'borde', 'misil', 'sombra', 'frio'].map(k => [k,
  new T.MeshLambertMaterial({ transparent: k === 'frio' || k === 'sombra', opacity: k === 'frio' ? .72 : 1 })]));
const L = { altura: new T.LineDashedMaterial({ dashSize: .12, gapSize: .1, transparent: true, opacity: .55 }), estela: new T.LineBasicMaterial() };
const TIPOS = { crawler: { suelo: true }, frioSuelo: { suelo: true, frio: true }, drone: {}, stealth: { frio: true } };
const movil = new T.Group(), opciones = { THREE: T, G, M, L, TIPOS, movil };
let compartidasLiberadas = 0;
for (const r of [...Object.values(G), ...Object.values(M), ...Object.values(L)]) r.addEventListener?.('dispose', () => compartidasLiberadas++);
const sistema = crearInstanciasWar(opciones);
const enemigo = (id, tipo, golpeT = -9) => ({ id, tipo, x: 8 + id.length, y: 7, z: TIPOS[tipo].suelo ? 0 : 2.5, vx: -2, vy: .4, golpeT });
const mi = { id: 3, t0: 2.5, dur: 1, x0: 4.5, y0: 9.5, z0: .8, x1: 12, y1: 9, z1: 2.5, arco: 2 };
const escena = { t: 3, enemigos: [enemigo('C1', 'crawler'), enemigo('C2', 'crawler'), enemigo('CF', 'frioSuelo'),
  enemigo('CG', 'crawler', 2.8), enemigo('D1', 'drone'), enemigo('DF', 'stealth'), enemigo('DG', 'stealth', 2.8)], misiles: [mi] };
const congelar = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };
congelar(escena);
const lotes = () => movil.children.filter(o => o.isInstancedMesh);
const cuentas = () => lotes().map(o => [o, o.count, o.instanceMatrix.version]);
const matriz = new T.Matrix4();
function cerca(actual, esperada, etiqueta) {
  for (let k = 0; k < 16; k++) assert.ok(Math.abs(actual.elements[k] - esperada.elements[k]) < 1e-6, `${etiqueta}: elemento ${k}`);
}
for (const [off, ahora] of [[0, 0], [.03, 123456], [.05, 440]]) {
  sistema.actualizar(escena, off, ahora);
  // Cada pareja tiene un único lote y todos los componentes vivos están compactados.
  const parejas = lotes().map(o => `${o.geometry.uuid}/${o.material.uuid}`);
  assert.equal(new Set(parejas).size, parejas.length);
  assert.equal(lotes().reduce((n, o) => n + o.count, 0), 4 * 3 + 3 * 8 + 1);
  const esperados = new Map();
  for (const e of escena.enemigos) {
    const o = enemigoMesh(T, G, M, L, TIPOS, e);
    o.grupo.position.set(e.x + e.vx * off, 0, e.y + e.vy * off);
    o.cuerpo.material = escena.t - e.golpeT < .25 ? M.golpe : o.mat;
    if (o.cuerpoG) { o.cuerpoG.position.y = e.z; for (const r of o.rotores) r.rotation.y = ahora / 40; }
    o.grupo.updateMatrixWorld(true);
    o.grupo.traverse(n => {
      if (!n.isMesh) return;
      const clave = `${e.id}/${n.geometry.type}/${n.material.uuid}`;
      const lista = esperados.get(clave) ?? []; lista.push(n.matrixWorld.clone()); esperados.set(clave, lista);
    });
  }
  for (const lote of lotes()) {
    assert.equal(lote.count, lote.userData.ids.length);
    assert.ok(lote.count <= lote.instanceMatrix.count);
    assert.equal(lote.frustumCulled, false);
    assert.equal(lote.instanceColor, null);
    for (let i = 0; i < lote.count; i++) {
      lote.getMatrixAt(i, matriz);
      const id = lote.userData.ids[i];
      if (id == null) {
        const bola = new T.Object3D(); bola.position.set(...posMisil(mi, escena.t + off)); bola.scale.setScalar(.12); bola.updateMatrixWorld();
        cerca(matriz, bola.matrixWorld, 'misil');
        assert.equal(idDeImpacto({ object: lote, instanceId: i }), null);
      } else {
        const clave = `${id}/${lote.geometry.type}/${lote.material.uuid}`;
        const lista = esperados.get(clave);
        assert.ok(lista?.length, `pieza ${clave}`);
        cerca(matriz, lista.shift(), clave);
        assert.equal(idDeImpacto({ object: lote, instanceId: i }), id);
      }
    }
  }
  assert.ok([...esperados.values()].every(a => a.length === 0));
  const lineas = movil.children.filter(o => o.isLine);
  assert.equal(lineas.length, 4);
  for (const alt of lineas.filter(o => o.material === L.altura)) {
    assert.deepEqual(Array.from(alt.geometry.attributes.lineDistance.array), [0, 1]);
    assert.equal(alt.scale.y, 2.5);
    assert.equal(idDeImpacto({ object: alt }), alt.userData.id);
  }
  const estela = lineas.find(o => o.material === L.estela);
  for (let k = 0; k < 10; k++) assert.deepEqual(Array.from(estela.geometry.attributes.position.array.slice(k * 3, k * 3 + 3)),
    posMisil(mi, escena.t + off - k * .03).map(Math.fround));
  const versiones = cuentas();
  sistema.actualizar(escena, off, ahora);
  assert.deepEqual(cuentas(), versiones, 'matrices sin cambios no marcan needsUpdate');
}
assert.equal(lotes().filter(o => o.material === M.golpe).reduce((n, o) => n + o.count, 0), 2);
assert.equal(lotes().filter(o => o.material === M.frio).reduce((n, o) => n + o.count, 0), 2);
assert.equal(M.frio.opacity, .72);
const cuerpo = lotes().find(o => o.material === M.enemigo && o.geometry.type === 'BoxGeometry');
assert.equal(cuerpo.count, 2); assert.equal(cuerpo.instanceMatrix.count, 2);
let liberaCuerpo = 0; cuerpo.addEventListener('dispose', () => liberaCuerpo++);
const muchos = Array.from({ length: 513 }, (_, i) => enemigo(`E${i}`, 'crawler'));
sistema.actualizar({ t: 3, enemigos: muchos, misiles: [] }, 0, 0);
const nuevoCuerpo = lotes().find(o => o.geometry === cuerpo.geometry && o.material === cuerpo.material);
assert.equal(nuevoCuerpo.count, 513); assert.equal(nuevoCuerpo.instanceMatrix.count, 1024);
assert.equal(liberaCuerpo, 1, 'el crecimiento libera el buffer de instancias sustituido');
assert.ok(instancias.filter(o => !movil.children.includes(o)).every(o => o.liberada === 1));
sistema.actualizar({ t: 4, enemigos: [], misiles: [] }, 0, 0);
assert.ok(lotes().every(o => o.count === 0 && !o.visible && !o.userData.ids.length), 'escena vacía sin instancias fantasma');
assert.equal(movil.children.filter(o => o.isLine).length, 0);
sistema.actualizar({ t: 4, enemigos: [escena.enemigos[5]], misiles: [] }, 0, 0);
assert.equal(lotes().reduce((n, o) => n + o.count, 0), 8, 'muertos y misiles fuera');
assert.ok(lotes().every(o => o.userData.ids.every(id => id === 'DF')));
assert.equal(lotes().filter(o => o.material === M.golpe).reduce((n, o) => n + o.count, 0), 0, 'caduca golpe');
assert.equal(idDeImpacto({ object: nuevoCuerpo, instanceId: 512 }), null, 'sin ids muertos');
const padre = new T.Group(), hijo = new T.Mesh(G.esfera, M.enemigo); padre.userData.id = 'maquina'; padre.add(hijo);
assert.equal(idDeImpacto({ object: hijo }), 'maquina', 'conserva selección por padre');
let liberadas = 0;
const recursos = new Set([...lotes().map(o => o.geometry), ...movil.children.filter(o => o.isLine).map(o => o.geometry)]);
for (const g of recursos) g.addEventListener('dispose', () => liberadas++);
sistema.destruir(); sistema.destruir();
assert.equal(movil.children.length, 0);
assert.equal(compartidasLiberadas, 0, 'G/M/L son prestados del visor');
assert.equal(liberadas, [...recursos].filter(g => !Object.values(G).includes(g)).length);
assert.ok(instancias.every(o => o.liberada === 1), 'todas las instancias se liberan una sola vez');
sistema.actualizar(escena, 0, 0); assert.equal(movil.children.length, 0);
const combate = { t: 25.6, enemigos: [...Array.from({ length: 6 }, (_, i) => enemigo(`C${i}`, 'crawler')),
  ...Array.from({ length: 3 }, (_, i) => enemigo(`D${i}`, 'drone')),
  ...Array.from({ length: 2 }, (_, i) => enemigo(`F${i}`, 'stealth'))], misiles: [mi] };
// Distribución 6 orugas/3 drones/2 fríos repetida hasta 2000, con golpes alternados.
const carga = { ...combate, enemigos: Array.from({ length: 2000 }, (_, i) => ({
  ...combate.enemigos[i % 11], id: `S${i}`, golpeT: i % 7 ? -9 : combate.t,
})) };
const escala = crearInstanciasWar(opciones);
for (const [foto, calls, triangles] of [[combate, 14, 3528], [carga, 919, 577200]]) {
  escala.actualizar(foto, 0, 123456);
  assert.equal(movil.children.filter(o => o.visible).length, calls, 'llamadas móviles estructurales');
  assert.equal(lotes().reduce((n, o) => n + o.count * o.geometry.index.count / 3, 0), triangles);
}
escala.destruir(); assert.equal(compartidasLiberadas, 0);
console.log('instancias-war: r180, matrices de todos los componentes, materiales, líneas, selección, crecimiento 513→1024, muertos y liberación; sin GPU.');
