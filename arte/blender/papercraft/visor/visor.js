import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const raiz = new URL('../', import.meta.url);
async function datos(nombre) {
  const respuesta = await fetch(new URL(nombre, raiz));
  if (!respuesta.ok) throw new Error(nombre + ' · ' + respuesta.status);
  return respuesta.json();
}
const [mapa, sitios] = await Promise.all([datos('mapa-ampliado.json'), datos('colocaciones.json')]);
const [ancho, fondo] = mapa.metros;
const lienzo = document.querySelector('canvas');
const render = new THREE.WebGLRenderer({canvas: lienzo, alpha: true, antialias: true});
render.setPixelRatio(Math.min(devicePixelRatio, 2));
render.shadowMap.enabled = true;
render.shadowMap.type = THREE.PCFSoftShadowMap;
render.toneMapping = THREE.AgXToneMapping;
render.toneMappingExposure = 1.23;
const escena = new THREE.Scene();
const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, .2, 2500);
const control = new OrbitControls(camara, lienzo);
control.target.set(ancho / 2, 1, fondo / 2);
camara.position.copy(control.target).add(new THREE.Vector3(28, 231, 210));
control.maxPolarAngle = Math.PI * .485;
control.minZoom = .47;
control.maxZoom = 38;
control.zoomToCursor = true;
control.update();
escena.add(new THREE.HemisphereLight(0xfff4da, 0xb7b7cf, 1.5));
const sol = new THREE.DirectionalLight(0xffe1b6, 3.05);
sol.target.position.copy(control.target);
sol.position.copy(sol.target.position).add(new THREE.Vector3(201, 300, 144));
sol.castShadow = true;
const sombra = sol.shadow.camera;
Object.assign(sombra, {left: -234, right: 234, top: 205, bottom: -205, near: 60, far: 730});
sombra.updateProjectionMatrix();
sol.shadow.mapSize.setScalar(Math.min(4096, render.capabilities.maxTextureSize));
sol.shadow.normalBias = .07;
sol.shadow.bias = -.00012;
escena.add(sol, sol.target);

const cargador = new GLTFLoader();
let papel;
async function cargar(ruta) {
  const gltf = await cargador.loadAsync(new URL(ruta, raiz).href);
  const pieza = gltf.scene.getObjectByProperty('isMesh', true);
  if (!papel) {
    papel = pieza.material;
    for (const textura of [papel.map, papel.normalMap]) {
      textura.anisotropy = Math.min(8, render.capabilities.getMaxAnisotropy());
    }
  } else {
    // Los GLB son autónomos. En memoria basta un solo par de texturas.
    pieza.material.map.dispose();
    pieza.material.normalMap.dispose();
    pieza.material.dispose();
    pieza.material = papel;
  }
  pieza.castShadow = pieza.receiveShadow = true;
  return pieza;
}

const rutas = [];
const [columnas, filas] = mapa.trozos;
for (let y = 0; y < filas; y++) {
  for (let x = 0; x < columnas; x++) rutas.push('glb/mapa/terreno-' + y + '-' + x + '.glb');
}
const transformar = new THREE.Object3D();
function lote(geometria, material, puntos, situar) {
  const malla = new THREE.InstancedMesh(geometria, material, puntos.length);
  puntos.forEach((p, i) => {
    situar(transformar, p);
    transformar.updateMatrix();
    malla.setMatrixAt(i, transformar.matrix);
  });
  escena.add(malla);
  return malla;
}

function lineas(puntos, color, id, opacidad) {
  const geometria = new THREE.BufferGeometry().setFromPoints(puntos.map(([x,z]) => new THREE.Vector3(x, .97, z)));
  const obj = new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: opacidad, depthWrite: false, depthTest: false
  }));
  const boton = document.getElementById(id);
  obj.visible = boton.checked;
  boton.addEventListener('change', () => { obj.visible = boton.checked; dibujar(); });
  obj.renderOrder = 3;
  escena.add(obj);
}
const marco = mapa.antiguo;
const [x,z] = marco.origen, [w,h] = marco.metros;
lineas([[x,z],[x+w,z],[x+w,z],[x+w,z+h],[x+w,z+h],[x,z+h],[x,z+h],[x,z]],0xfff1c0,'antiguo',.95);
const cuadricula = [];
for (let i = 0; i <= ancho; i += 10) cuadricula.push([i,0],[i,fondo]);
for (let i = 0; i <= fondo; i += 10) cuadricula.push([0,i],[ancho,i]);
lineas(cuadricula,0x4d473e,'rejilla',.35);

function dibujar() { render.render(escena, camara); }
function ajustar() {
  const aspecto = lienzo.clientWidth / lienzo.clientHeight;
  const alto = Math.max(fondo * 1.22, ancho * 1.095 / aspecto);
  Object.assign(camara, {left: -alto*aspecto/2, right: alto*aspecto/2, top: alto/2, bottom: -alto/2});
  camara.updateProjectionMatrix();
  render.setSize(lienzo.clientWidth, lienzo.clientHeight, false);
  dibujar();
}
control.addEventListener('change', dibujar);
window.addEventListener('resize', ajustar);
ajustar();

// Cuatro descargas simultáneas para limitar el pico de decodificación en móvil.
const nombres = [...new Set(sitios.map(s => s.pieza))];
const tareas = [
  ...rutas.map(ruta => async () => escena.add(await cargar(ruta))),
  ...nombres.map(nombre => async () => {
    const pieza = await cargar('glb/kit/' + nombre + '.glb');
    const puntos = sitios.filter(s => s.pieza === nombre);
    const malla = lote(pieza.geometry, papel, puntos, (obj, p) => {
      obj.position.set(p.x, p.z, p.y);
      obj.rotation.set(0, -p.giro, 0);
      obj.scale.setScalar(p.escala);
    });
    malla.castShadow = malla.receiveShadow = true;
  })
];
async function cargarCola() {
  while (tareas.length) { await tareas.shift()(); dibujar(); }
}
await Promise.all(Array.from({length: 4}, cargarCola));

// Mancha de contacto radial compartida bajo árboles, piedras y albañilería.
const sello = document.createElement('canvas');
sello.width = sello.height = 64;
const ctx = sello.getContext('2d');
const gradiente = ctx.createRadialGradient(32,32,0,32,32,32);
gradiente.addColorStop(0,'rgba(49,37,26,.43)');
gradiente.addColorStop(.48,'rgba(49,37,26,.25)');
gradiente.addColorStop(1,'rgba(49,37,26,0)');
ctx.fillStyle = gradiente;
ctx.fillRect(0,0,64,64);
const contacto = new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(sello), transparent: true, depthWrite: false});
const radios = {'pino-alto': 3.4, 'pino-joven': 2.4, alcornoque: 3.1, roca: 1.7, laja: 1.5, torre: 4, lienzo: 3.2, matorral: 1.5};
lote(new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2), contacto, sitios.filter(s => radios[s.pieza]), (obj,p) => {
  obj.position.set(p.x,p.z+.035,p.y);
  obj.rotation.set(0,-p.giro,0);
  obj.scale.setScalar(radios[p.pieza]*p.escala);
});
dibujar();
