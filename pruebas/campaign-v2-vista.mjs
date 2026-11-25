import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearRegistro, modelos, urlBinario } from '../paquetes/vista-3d/cv2/modelos.js';
import { estadoRig } from '../paquetes/vista-3d/cv2/torreta.js';
import { crearSolver, leerRig } from '../paquetes/rig/index.js';
import { adaptarVistaMetros } from '../paquetes/app/juego/campaign-v2.js';
import { instalarCampoJuego } from '../paquetes/app/juego/campo.js';

const base = 'https://raw.githack.com/autor/repo/ref/';
const raw = 'https://raw.githubusercontent.com/autor/repo/ref/';
const ruta = 'arte/glb/muralla/tramo.glb';
assert.equal(urlBinario(ruta, base), raw + ruta);
for (const png of ['fibra', 'relieve']) {
  assert.equal(urlBinario('../../texturas/' + png + '.png', base + ruta), raw + 'arte/texturas/' + png + '.png');
}
assert.equal(urlBinario('mapa.json', base), base + 'mapa.json');
for (const baseLocal of ['http://localhost:8771/', 'cbl://app/', 'https://githack.com.ejemplo.org/'])
  assert.equal(urlBinario(ruta, baseLocal), baseLocal + ruta);
let cargas = 0;
const cargar = crearRegistro(async url => { cargas++; return readFile(new URL(url)); }, () => assert.fail('Falta el modelo'));
for (const [id, ficha] of Object.entries(modelos)) {
  if (ficha.primitiva) {
    const primitivas = crearRegistro(() => assert.fail('La primitiva no requiere GLB'), f => f.primitiva);
    assert.equal(await primitivas(id), 'crawler');
    continue;
  }
  assert.equal(cargar(id), cargar(id));
  const b = await cargar(id);
  assert.equal(b.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  for (const img of gltf.images ?? []) {
    const png = await readFile(new URL(urlBinario(img.uri, ficha.url)));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
  }
}
assert.equal(cargas, Object.values(modelos).filter(f => f.url).length);
const fallido = crearRegistro(() => { throw Error('404'); }, ficha => ({ placeholder: ficha.tam }));
assert.deepEqual(await fallido('muralla-traba-nudo'), { placeholder: [7, 16, 5.6] });

const b = await cargar('torreta-esfera'), json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
const solver = crearSolver(leerRig(json), 0), cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, a + ' ≠ ' + b);
for (const yaw of [-2.3, 0, .7, Math.PI]) {
  const alto = 9.2, z = 2.5, d = 17;
  const l = { cx: 210.5, cy: 81.5, yaw, modo: 'regular', lugar: { x: 210.5 + d * Math.cos(yaw), y: 81.5 + d * Math.sin(yaw), z } };
  const pose = estadoRig(l, 2, 1, alto);
  assert.deepEqual([pose.hojas, pose.extension, pose.atascado], [1, 1, false]);
  // Verifica ambos ángulos llevando el eje físico del telescopio del GLB a coordenadas del mundo.
  const inicio = [...solver.evaluar({ ...pose, extension: 0 }).mundo.telescopio_4];
  const fin = solver.evaluar(pose).mundo.telescopio_4;
  const [x, h, y] = [12, 13, 14].map(i => fin[i] - inicio[i]);
  cerca(Math.cos(Math.atan2(y, x)), Math.cos(yaw)); cerca(Math.sin(Math.atan2(y, x)), Math.sin(yaw));
  cerca(Math.atan2(h, Math.hypot(x, y)), Math.atan2(z - alto, d));
  cerca(estadoRig(l, 2.09, 2, alto).extension, .5);
  assert.equal(estadoRig(l, 2, 2, alto).extension, 0);
  const atasco = estadoRig({ ...l, atascado: true }, 2, 2, alto);
  assert.deepEqual([atasco.atascado, atasco.extension, atasco.hojas], [true, 0, 0]);
  assert.equal(estadoRig({ ...l, modo: 'idle' }, 1, -Infinity, alto).hojas, 0);
}
const vista = adaptarVistaMetros({ suelo(x, y) { assert.deepEqual([x, y], [30, 40]); return { x: 221.25, y: 84.5, z: 0 }; } },
  () => ({ marco: { origen: [204, 72] } }));
const campo = instalarCampoJuego({ $: () => ({ getBoundingClientRect: () => ({ left: 5, top: 6 }) }),
  runtime: { instalarGestosClic: () => ({}) }, vistaActual: () => vista, COLS: 32, ROWS: 18, r2: x => x });
assert.deepEqual(campo.coordenadasEn(35, 46), { x: 17.25, y: 12.5, z: 0 });
console.log('P4a · Registro, PNG externos, caché y fallo de carga, puntería física del rig, retroceso, atasco y clic en casillas.');
