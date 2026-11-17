// Grafo ESM real, glTF y protocolo local; sin red, DOM, navegador ni GPU.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as THREE from '../shared/vendor/three-r180/three.module.min.js';
import { factory3d } from '../paquetes/vista-3d/index.js';

if (!vm.SourceTextModule) {
  const hijo = spawnSync(process.execPath, ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning',
    fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(hijo.status ?? 1);
}
const raiz = new URL('../', import.meta.url);
const pagina = new URL('Prototypes/Rocket%20Launcher/index.html', raiz);
const html = await readFile(pagina, 'utf8');
const mapa = JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(html)[1]);
const moduloThree = new URL(mapa.imports.three, pagina);
assert.equal(moduloThree.href, new URL('shared/vendor/three-r180/three.module.min.js', raiz).href);
assert(!html.includes('three-r128'));
assert.equal(THREE.REVISION, '180');
assert.equal(THREE.ColorManagement.enabled, true);
assert.equal(Object.isExtensible(THREE), false);

const contexto = vm.createContext({ ArrayBuffer, TextDecoder, TextEncoder, console, window: {}, addEventListener() {} });
const cache = new Map();
async function obtener(ruta, origen = pagina.href) {
  const url = ruta === 'three' ? moduloThree : new URL(ruta, origen);
  if (cache.has(url.href)) return cache.get(url.href);
  let modulo;
  if (url.href === moduloThree.href) {
    modulo = new vm.SyntheticModule(Object.keys(THREE), function () {
      for (const [k, valor] of Object.entries(THREE)) this.setExport(k, valor);
    }, { context: contexto, identifier: url.href });
  } else {
    assert(url.href.startsWith(raiz.href), 'todos los imports son locales');
    modulo = new vm.SourceTextModule(await readFile(url, 'utf8'), {
      context: contexto, identifier: url.href,
      importModuleDynamically: async (ruta, padre) => {
        const hijo = await obtener(ruta, padre.identifier);
        if (hijo.status === 'unlinked') await hijo.link((r, p) => obtener(r, p.identifier));
        if (hijo.status === 'linked') await hijo.evaluate();
        return hijo;
      },
    });
  }
  cache.set(url.href, modulo);
  return modulo;
}
const entrada = await obtener('./js/servicios.js');
await entrada.link((r, p) => obtener(r, p.identifier));
await entrada.evaluate();
const servicios = entrada.namespace.servicios;
assert.equal(servicios.THREE.REVISION, '180');
assert.equal(cache.size, 2, 'GLTFLoader todavía no se solicita');
const GLTFLoader = await servicios.cargarGLTFLoader();
assert.equal(GLTFLoader, await servicios.cargarGLTFLoader());
assert([...cache.keys()].some(k => k.endsWith('/utils/BufferGeometryUtils.js')));
assert.equal(THREE.GLTFLoader, undefined, 'el constructor no se añade al namespace');
assert.equal(contexto.window.THREE, undefined, 'sin puente global implícito');

const bytes = await readFile(new URL('modelos/t1.glb', pagina));
const gltf = await new Promise((ok, mal) => new GLTFLoader().parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', ok, mal));
for (let n = 0; n < 3; n++) assert(gltf.scene.getObjectByName(`L${n}_RobotTransporte`));
const originales = new Map();
gltf.scene.traverse(o => { if (o.isMesh) originales.set(o.material.name, o.material); });
let cargas = 0;
const cargador = async () => class {
  load(url, ok) { assert.equal(url, 'modelos/t1.glb'); cargas++; ok(gltf); }
};
const fijo = new THREE.Group(), movil = new THREE.Group();
const contenido = factory3d.construir({
  THREE, cargarGLTFLoader: cargador, estado: { escena: { entidades: [], robot: { cx: 1, cy: 1 } } },
  fijo, movil, objetos: new Map(), M: { borde: new THREE.MeshLambertMaterial() },
  mesh: (g, m) => new THREE.Mesh(g, m), G: { caja: (...d) => new THREE.BoxGeometry(...d) },
  lineas: () => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([])), L: {}, leerVar: () => '#336699',
});
const carga = factory3d.cargar(cargador);
assert.equal(carga, factory3d.cargar(cargador), 'una sola carga concurrente del T1');
await carga;
assert.equal(cargas, 1);
assert.equal(contenido.robot.niveles.length, 3);
let materiales = 0;
contenido.robot.grupo.traverse(o => {
  if (!o.isMesh) return;
  assert(o.material.isMeshLambertMaterial);
  // El color de función se sustituye por el tema; los demás conservan glTF lineal.
  if (o.material.name === 'rol') return;
  const original = originales.get(o.material.name);
  assert(original, o.material.name);
  assert(o.material.color.equals(original.color), o.material.name);
  assert(o.material.emissive.equals(original.emissive), o.material.name);
  materiales++;
});
assert(materiales > 10);

// El protocolo real de escritorio sirve el mismo grafo con MIME de módulos JS.
const require = createRequire(import.meta.url);
const { servir } = require('../cascaras/escritorio/protocolo.cjs');
const paginaCbl = new URL('cbl://app/Prototypes/Rocket%20Launcher/index.html');
assert.equal(new URL(mapa.imports.three, paginaCbl).href, 'cbl://app/shared/vendor/three-r180/three.module.min.js');
for (const ruta of [...cache.keys(), new URL('shared/vendor/three-r180/three.core.min.js', raiz).href]) {
  const url = new URL(ruta);
  const relativo = url.pathname.slice(raiz.pathname.length);
  const respuesta = await servir(fileURLToPath(raiz), { url: 'cbl://app/' + relativo, method: 'GET' });
  assert.equal(respuesta.status, 200, relativo);
  assert.equal(respuesta.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await respuesta.text(), await readFile(url, 'utf8'));
}
console.log('Three r180: import map, carga diferida oficial, T1/LOD/materiales lineales y rutas/MIME cbl verificados; sin GPU ni red.');
