import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
// Importar las entradas públicas sin preparar DOM ni Three.
import { crearDibujanteEfectos as crear2D } from '../paquetes/vista-2d/index.js';
import { crearDibujanteEfectos as crear3D } from '../paquetes/vista-3d/index.js';
import { opcionesHojas } from '../herramientas/vfx-hojas.mjs';

const contexto = vm.createContext({});
vm.runInContext(readFileSync(new URL('../shared/vendor/three-r128.min.js', import.meta.url), 'utf8'), contexto);
const THREE = contexto.THREE, grupo = new THREE.Group();
const p = { x: 2, y: 3, z: 4, tam: 1, alfa: .5, color: [1, .5, 0], forma: 'disco', mezcla: 'normal', paso: 0, capa: 0, indice: 0, estela: 0 };
const dib3 = crear3D(THREE, grupo, { alturaBufer: 400, pixelRatio: 2, fov: 38, capacidad: 2, maxPunto: 127 });
assert.equal(grupo.children.length, 2);
const [normal, suma] = grupo.children;
let liberados = 0;
for (const n of grupo.children) {
  assert.equal(n.type, 'Points'); assert.equal(n.geometry.attributes.position.array.length, 6);
  assert.equal(n.material.depthWrite, false); assert.equal(n.material.fog, true);
  assert(n.renderOrder > 1); const picks = []; n.raycast(null, picks); assert.equal(picks.length, 0);
  assert.equal(n.material.uniforms.maxPunto.value, 127);
  n.geometry.addEventListener('dispose', () => liberados++); n.material.addEventListener('dispose', () => liberados++);
  assert(n.material.vertexShader.includes('#include <fog_vertex>'));
  assert(n.material.fragmentShader.includes('#include <fog_fragment>'));
}
dib3.dibujar([p, { ...p, mezcla: 'suma', forma: 'brillo' }]);
assert.equal(normal.geometry.drawRange.count, 1); assert.equal(suma.geometry.drawRange.count, 1);
assert.deepEqual(Array.from(normal.geometry.attributes.position.array.slice(0, 3)), [2, 4, 3]);
assert.equal(normal.geometry.attributes.tam.array[0], 1);
assert(normal.geometry.attributes.position.version > 0);
assert.equal(suma.material.blending, THREE.AdditiveBlending);
dib3.dibujar([p, p, p]); assert.equal(normal.geometry.drawRange.count, 2); assert.equal(suma.geometry.drawRange.count, 0);
dib3.dibujar([]); assert.equal(normal.geometry.drawRange.count, 0);
dib3.redimensionar({ alturaCss: 200, pixelRatio: 2, fov: 38 });
assert.equal(normal.material.uniforms.escala.value, 400 / (2 * Math.tan(38 * Math.PI / 360)));
dib3.destruir(); dib3.destruir(); assert.equal(grupo.children.length, 0); assert.equal(liberados, 4);
dib3.dibujar([p]); assert.equal(grupo.children.length, 0);

let creados = 0;
const paradas = [];
const crearLienzo = lado => {
  assert.equal(lado, 64); const id = ++creados;
  return { id, getContext: () => ({ createRadialGradient: () => ({ addColorStop: (...args) => paradas.push(args) }), fillRect() {} }) };
};
const llamadas = [];
const ctx = { globalAlpha: .7, globalCompositeOperation: 'xor',
  save() { this.guardado = [this.globalAlpha, this.globalCompositeOperation]; llamadas.push(['save']); },
  restore() { [this.globalAlpha, this.globalCompositeOperation] = this.guardado; llamadas.push(['restore']); },
  drawImage(sello, ...args) { llamadas.push(['drawImage', sello.id, this.globalAlpha, this.globalCompositeOperation, ...args]); } };
const dib2 = crear2D({ T: 10, ox: 1, oy: 2, crearLienzo, limiteCache: 3 });
const humo = { ...p, forma: 'humo' }, luz = { ...p, forma: 'brillo', mezcla: 'suma' };
dib2.dibujar(ctx, [luz, p, humo]);
const dibujos = llamadas.filter(c => c[0] === 'drawImage');
assert.deepEqual(dibujos.map(c => c[3]), ['source-over', 'source-over', 'lighter']);
assert.deepEqual(dibujos[0].slice(4), [16, 27, 10, 10]); // altura ignorada
assert.deepEqual([ctx.globalAlpha, ctx.globalCompositeOperation], [.7, 'xor']);
assert.equal(creados, 3); assert(paradas.length >= 9);
dib2.dibujar(ctx, [{ ...p, color: [.999, .501, .001] }]); assert.equal(creados, 3, 'color cuantizado reutiliza sello');
dib2.dibujar(ctx, [{ ...p, forma: 'humo', color: [0, 0, 0] }]); assert.equal(creados, 4);
dib2.dibujar(ctx, [humo]); assert.equal(creados, 5, 'cache acotada expulsa sello antiguo');
dib2.vaciarCache(); dib2.dibujar(ctx, [humo]); assert.equal(creados, 6);
dib2.destruir(); dib2.destruir();
const proyectado = crear2D({ T: 2, crearLienzo, proyectar: (x, y, z) => ({ x: x + z, y }) });
llamadas.length = 0; proyectado.dibujar(ctx, [p]);
assert.deepEqual(llamadas.find(c => c[0] === 'drawImage').slice(4), [5, 2, 2, 2]);
assert.equal(opcionesHojas([]).origen, 'http://127.0.0.1:8771');
assert.deepEqual(opcionesHojas(['--calidades', 'alto,bajo']).calidades, ['alto', 'bajo']);
assert.throws(() => opcionesHojas(['--calidades', 'ultra']), /Calidades/);
console.log('Dibujantes VFX: imports sin entorno; Three r128 real sin GPU; búferes, coordenadas, niebla, liberación y contexto 2D falso; CLI de hojas sin lanzar navegador.');
