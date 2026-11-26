import * as ThreeReal from '../../../shared/vendor/three-r180/three.module.min.js';
// Three real con renderizador y DOM falsos: comprueba geometría y lecturas sin WebGL ni navegador.
import assert from 'node:assert/strict';
import * as vistas from '../index.js';

let comprobaciones = 0;
const ok = (v, m) => { assert.ok(v, m); comprobaciones++; };
const igual = (a, b, m) => { assert.deepEqual(a, b, m); comprobaciones++; };
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };
const { crear3D, crearCampaign3D, factory3d } = vistas;
igual(Object.keys(vistas).sort(), ['crearFicha3D', 'crearRestos3D', 'crearVistaCV2', 'conectarRig', 'crearDibujanteEfectos', 'crearVista', 'crear3D', 'crearCampaign3D', 'factory3d', 'crearFabricaCV2', 'puertasDelMarco', 'paletaFabrica'].sort(), 'entrada pública');
for (const f of [crear3D, crearCampaign3D, ...['construir', 'actualizar', 'cargar', 'ik'].map(k => factory3d[k])]) ok(typeof f === 'function', 'exporta funciones');
igual(factory3d.ultimo, null, 'gancho mutable de Factory inicialmente vacío');
factory3d.ultimo = { prueba: true };
igual(factory3d.ultimo, { prueba: true }, 'Factory conserva un objeto mutable para el puente');
factory3d.ultimo = null;

// Misma comprobación de cinemática que pruebas/factory-3d.mjs (sin cambiar esa prueba).
const a = factory3d.ik(.5, .1), L1 = .44, L2 = .38;
const x = L1 * Math.sin(a.a1) + L2 * Math.sin(a.a1 + a.a2), y = L1 * Math.cos(a.a1) + L2 * Math.cos(a.a1 + a.a2);
igual([Math.abs(x - .5) < 1e-6, Math.abs(y - .1) < 1e-6, Math.abs(a.a1 + a.a2 + a.a3 - Math.PI) < 1e-9], [true, true, true], 'IK de dos tramos con la pinza hacia el suelo');
igual(crear3D({}, {}), null, 'War devuelve null sin THREE');
igual(crear3D({}, { ES_FACTORY: true }), null, 'Factory devuelve null sin THREE');
igual(crearCampaign3D({}, {}), null, 'Campaign devuelve null sin THREE');

const THREE = { ...ThreeReal };
igual(THREE.REVISION, '180', 'usa el Three local del juego');
let escenaDibujada = null;
class Renderizador {
  domElement = { height: 400, toDataURL: () => 'data:image/png;simulada' };
  info = { render: { calls: 42, triangles: 1234 } };
  forceContextLoss() {}
  getContext() { return { ALIASED_POINT_SIZE_RANGE: 1, getParameter: () => [1, 127] }; }
  dispose() { this.destruido = true; }
  setPixelRatio() {}
  setSize() {}
  render(escena) { escena.updateMatrixWorld(); escenaDibujada = escena; }
}
THREE.WebGLRenderer = Renderizador;
const ctx2 = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, moveTo() {}, arc() {}, closePath() {}, fill() {} };
const eventos = new Map();
const canvas = { getContext: () => ctx2, addEventListener: (k, f) => eventos.set(k, f), removeEventListener: (k, f) => { if (eventos.get(k) === f) eventos.delete(k); }, setPointerCapture() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
const app = { dataset: {} };
Object.assign(globalThis, {
  window: { devicePixelRatio: 1 },
  document: { createElement: () => ({ getContext: () => ctx2 }) },
  MutationObserver: class { observe() {} disconnect() {} }, innerWidth: 1280, innerHeight: 720,
});
igual(crearCampaign3D({}, {}), null, 'Campaign devuelve null si no se inyecta crearTerreno');

const lanzador = { id: 'LAU-01', clase: 'lanzador', cx: 4.5, cy: 9.5, yaw: Math.PI, modo: 'regular', lugar: { x: 12, y: 9, z: 2.5 }, atascado: false };
const sensor = { id: 'VIB-01', clase: 'vibracion', cx: 8.5, cy: 4.5, alcance: 5 };
const deposito = { id: 'DEP-01', clase: 'deposito', cx: 1.5, cy: 9.5 };
const reparador = { id: 'REP-01', clase: 'reparador', cx: 2.4, cy: 7.4, estado: 'base' };
const escena = congelar({
  t: 3, def: { niebla: false }, lanzadores: [lanzador], sensores: [sensor], deposito, reparadores: [reparador],
  maquinas: [lanzador, sensor, deposito, reparador],
  porId: Object.fromEntries([lanzador, sensor, deposito, reparador].map(e => [e.id, e])),
  enemigos: [{ id: 'D1', tipo: 'drone', x: 14, y: 9.5, z: 2.5, vx: -2, vy: 0, golpeT: -9 }],
  misiles: [{ id: 1, t0: 2.5, dur: 1, x0: 4.5, y0: 9.5, z0: .8, x1: 12, y1: 9, z1: 2.5, arco: 2 }],
  explosiones: [{ x: 10, y: 9, z: 2, t0: 2.9 }],
});
const antes = JSON.stringify(escena);
const estado = { escena, seleccion: 'LAU-01', seleccionadas: new Set(['LAU-01', 'D1']), cols: 32, rows: 18, arrastreCampo: null };
const deps = {
  THREE,
  $: id => id === 'app' ? app : canvas, ES_FACTORY: false,
  FUNCIONES: { ofensiva: 'O', rastreo: 'R', utilitaria: 'U', fabrica: 'F' },
  funcionDe: () => ({ principal: 'ofensiva', secundaria: 'rastreo' }), leerVar: () => '#336699',
  radioDe: () => .6, alcance: () => 14, direccionDe: () => 0,
  TIPOS: { drone: { suelo: false, frio: false } }, MISIL: { radio: 1.3 }, LINEA_BASE: 3,
  FR: .62, ARCO: [2, 2.9], HALO: { medio: [[-.12, 0], [0, .9], [.18, 0]] },
  INTENSIDAD: { media: 1 }, LUCES: { lanzador: [[0, .5, 0]] },
  visual: { halo: 'medio', brillo: 'faros', intensidad: 'media' }, terrenoEditor: null,
};
const vista = crear3D(estado, deps);
ok(vista, 'crea War con Three real y renderizador falso');
vista.construir();
vista.actualizar(0, 0);
vista.tamano(1280, 720);
vista.render();
ok(escenaDibujada.isScene && escenaDibujada.children.length >= 4, 'construye una escena Three con luces y grupos');
const luces = escenaDibujada.children.filter(o => o.isLight);
igual(luces.map(o => o.intensity), [.85 * Math.PI, .55 * Math.PI], 'compensa las luces físicas con π');
igual(escenaDibujada.background.getHexString(), '336699', 'el fondo vuelve al color CSS sRGB');
const texturas = [];
escenaDibujada.traverse(o => { if (o.material?.map) texturas.push(o.material.map); });
ok(texturas.length > 0 && texturas.every(t => t.colorSpace === THREE.SRGBColorSpace), 'lienzos etiquetados sRGB');
ok(escenaDibujada.getObjectByProperty('isInstancedMesh', true).count > 0, 'construye los montes instanciados');
let mallas = 0;
escenaDibujada.traverse(o => { if (o.isMesh) mallas++; });
ok(mallas > 20, 'construye máquinas, misiles, explosiones y paisaje');
ok(eventos.has('pointermove') && eventos.has('wheel'), 'registra los gestos del visor');
const inicial = vista.camara();
igual(inicial.dibujo, { calls: 42, triangles: 1234 }, 'expone los contadores del último render');
eventos.get('wheel')({ preventDefault() {}, deltaY: -100 });
ok(vista.camara().dist < inicial.dist, 'la rueda conserva el zoom');
vista.centrar(10, 5); vista.recentrar();
igual(vista.camara().dist, inicial.dist, 'recentrar restaura la postura');
let liberadasInstancias = 0;
escenaDibujada.traverse(o => { if (o.name === 'War instancias') o.addEventListener('dispose', () => liberadasInstancias++); });
vista.construir(); vista.actualizar(.02, 50); vista.render();
igual(liberadasInstancias, 5, 'reconstruir libera los cinco lotes usados por un dron y un misil');
vista.aplicarColores();
const coloresWar = [];
escenaDibujada.traverse(o => { if (o.name === 'War instancias') coloresWar.push(o.material.color.getHexString()); });
ok(coloresWar.every(c => c === '336699'), 'cambio de tema alcanza todos los materiales instanciados');
igual(JSON.stringify(escena), antes, 'construir y actualizar no escriben en la escena congelada');

// El paisaje del editor se recibe ya validado: la vista no consulta URL ni almacenamiento.
const terrenoEditor = congelar({ bloques: [{ id: 'b1', nombre: 'prueba', color: '#abcdef', posicion: [1, 1, 1], rotacion: [0, 0, 0], escala: [1, 1, 1] }] });
const llamadas = [];
const terreno = {
  crearGeometria(three, datos) { igual(datos, terrenoEditor, 'inyecta datos del editor'); llamadas.push('suelo'); return new three.PlaneGeometry(4, 4); },
  crearGeometriaAgua(three) { llamadas.push('agua'); return new three.PlaneGeometry(1, 1); },
  BLOQUES: { geometria(three) { llamadas.push('bloque'); return new three.BoxGeometry(1, 1, 1); } },
};
const editor = crear3D(estado, { ...deps, terreno, terrenoEditor });
editor.construir(); editor.actualizar(0, 0); editor.render();
igual(llamadas, ['suelo', 'agua', 'bloque'], 'usa las tres geometrías inyectadas');
ok(escenaDibujada.getObjectByName('Terreno del editor'), 'añade el terreno del editor');
igual(JSON.stringify(escena), antes, 'el paisaje del editor tampoco escribe en la escena');

// Fachada crearVista: el mismo motor, tamaño del campo y extrapolación, sin WebGL.
let rectangulos = 0;
const contenedor = { getBoundingClientRect() { rectangulos++; return { width: 1280, height: 720 }; } };
const comun = vistas.crearVista(contenedor, { ...deps, estado, canvas, serie: 'war', dt: .05 });
comun.construir(); comun.redimensionar();
const reparando = congelar({ ...escena, reparadores: [{ ...reparador, estado: 'reparar' }] });
for (const fraccion of [0, 1]) {
  comun.dibujar(null, reparando, fraccion, 160);
  let drone, reparador;
  escenaDibujada.traverse(o => { if (o.isInstancedMesh && o.geometry.type === 'SphereGeometry' && o.userData.ids?.includes('D1')) drone = o; if (o.userData.id === 'REP-01') reparador = o; });
  const matriz = new THREE.Matrix4(); drone.getMatrixAt(drone.userData.ids.indexOf('D1'), matriz);
  ok(Math.abs(matriz.elements[12] - (14 - 2 * fraccion * .05)) < 1e-6, 'render ve actualizar(off) antes de dibujar');
  igual(reparador.rotation.y, 1, 'el cuarto argumento ahora llega sin alterarse al motor');
}
const puntoDrone = comun.proyectar(13.9, 2.5, 9.5);
igual(comun.elegir(puntoDrone.x, puntoDrone.y), 'D1', 'raycast real selecciona la instancia aérea');
igual(comun.proyectar(4, 0, 5), vista.proyectar(4, 0, 5, 1280, 720), 'proyección mide el mismo rectángulo del campo');
const punto = comun.proyectar(deposito.cx, 0, deposito.cy);
igual(comun.elegir(punto.x, punto.y), deposito.id, 'elección 3D sin ancho/alto externos');
const suelo = comun.suelo(punto.x, punto.y);
ok(Math.abs(suelo.x - deposito.cx) < 1e-6 && Math.abs(suelo.y - deposito.cy) < 1e-6, 'coordenadas del suelo desde el contenedor');
ok(rectangulos >= 4, 'tamaño, proyección y selección miden el contenedor');
comun.alSuceso({ paso: 0, tipo: 'disparo' });
comun.destruir(); comun.destruir();
igual(eventos.size, 0, 'destruir retira los gestos de la fachada');
igual(vista.retrato('drone'), 'data:image/png;simulada', 'retrato conserva el camino suelto');
const piezasRetrato = []; escenaDibujada.traverse(o => { if (o.isMesh) piezasRetrato.push(o); });
igual(piezasRetrato.length, 9, 'retrato dron: ocho piezas y piso');
ok(piezasRetrato.every(o => !o.isInstancedMesh), 'el retrato no instancia sus piezas');

THREE.WebGLRenderer = class { constructor() { throw new Error('sin WebGL'); } };
igual(crear3D(estado, deps), null, 'War conserva el respaldo si falla WebGL');
igual(crearCampaign3D(estado, { ...deps, crearTerreno() {} }), null, 'Campaign conserva el respaldo si falla WebGL');
console.log(`vista-3d: ${comprobaciones} comprobaciones`);
