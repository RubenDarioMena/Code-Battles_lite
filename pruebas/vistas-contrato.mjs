// Contrato público en Node, sin navegador: escena congelada y canvas que registra el dibujo.
import assert from 'node:assert/strict';
import * as plano from '../paquetes/vista-2d/index.js';
import * as tres from '../paquetes/vista-3d/index.js';
import reglasFactory, { retos as retosFactory } from '../paquetes/reglas-factory/index.js';
import { crearVistaNula } from '../paquetes/app/index.js';

assert.equal(typeof plano.crearVista, 'function');
assert.equal(typeof tres.crearVista, 'function');
const windowAnterior = globalThis.window;
globalThis.window = { devicePixelRatio: 1 };
try {
  const llamadas = [];
  const contexto = new Proxy({}, {
    get: (_, k) => (...args) => { llamadas.push([k, ...args]); },
    set: () => true,
  });
  const canvas = { clientWidth: 640, clientHeight: 400, width: 0, height: 0, getContext: () => contexto };
  const maquina = Object.freeze({ id: 'DEP-01', clase: 'deposito', cx: 4, cy: 5, x: 99, y: 99 });
  const enemigo = Object.freeze({ id: 'D1', tipo: 'crawler', x: 14, y: 10, z: 0, vx: -2, vy: 1, hp: 1, hpMax: 1, golpeT: -9 });
  const escena = Object.freeze({ t: 0, def: Object.freeze({ niebla: false }), deposito: maquina,
    maquinas: Object.freeze([maquina]), enemigos: Object.freeze([enemigo]),
    lanzadores: Object.freeze([]), sensores: Object.freeze([]), reparadores: Object.freeze([]),
    misiles: Object.freeze([]), explosiones: Object.freeze([]), porId: Object.freeze({ 'DEP-01': maquina }) });
  const opciones = { serie: 'war', dt: .05, cols: 32, rows: 18, tema: {},
    MISIL: { radio: 1.3 }, LINEA_BASE: 3, TIPOS: { crawler: { suelo: true } }, INTENSIDAD: { media: 1 },
    HALO: {}, LUCES: {}, visual: { halo: 'no', brillo: 'no', intensidad: 'media' },
    funcionDe: () => ({ principal: 'ofensiva' }), radioDe: () => .6 };
  const vista = plano.crearVista(canvas, opciones);
  for (const nombre of ['dibujar', 'alSuceso', 'vaciar', 'elegir', 'proyectar', 'redimensionar', 'destruir'])
    assert.equal(typeof vista[nombre], 'function', nombre);
  // Comparación de llamadas con el plano anterior: fracciones 0 y 1 son off 0 y dt.
  for (const fraccion of [0, 1]) {
    llamadas.length = 0;
    vista.dibujar(null, escena, fraccion, 1234);
    const actuales = structuredClone(llamadas);
    assert(actuales.some(([k]) => k === 'fillRect') && actuales.some(([k]) => k === 'roundRect'));
    llamadas.length = 0;
    const estado = { escena, seleccion: null, seleccionadas: new Set(), cols: 32, rows: 18, col: opciones.tema };
    plano.crearPlano(estado, { ...opciones, $c2d: canvas, ctx2: contexto })(fraccion * opciones.dt, 1234);
    assert.deepEqual(actuales, llamadas, `mismo dibujo con off = ${fraccion} × dt`);
  }
  const p = vista.proyectar(maquina.cx, 0, maquina.cy);
  assert.equal(vista.elegir(p.x, p.y), maquina.id, 'elige cx/cy antes que x/y');
  const fuera = vista.proyectar(30, 0, 17);
  assert.equal(vista.elegir(fuera.x, fuera.y), null);
  const cerca = vista.proyectar(4.89, 0, 5), lejos = vista.proyectar(4.91, 0, 5);
  assert.equal(vista.elegir(cerca.x, cerca.y), maquina.id);
  assert.equal(vista.elegir(lejos.x, lejos.y), null, 'conserva el umbral .9');
  const pe = vista.proyectar(enemigo.x, 0, enemigo.y);
  assert.equal(vista.elegir(pe.x, pe.y), enemigo.id, 'también elige enemigos desde la escena');
  assert.deepEqual(vista.suelo(p.x, p.y), { x: 4, y: 5, z: 0 });
  assert.equal(vista.proyectar(4, 10, 5, .6).y, vista.proyectar(4, 0, 4.4).y, 'etiqueta sobre el radio en 2D');
  vista.alSuceso({ paso: 0, tipo: 'disparo' });
  vista.redimensionar();
  assert.doesNotThrow(() => { vista.destruir(); vista.destruir(); });
  // Factory: la escena conserva robot/entidades; elegir debe reproducir mundo.maquinas.
  const mundoFactory = reglasFactory.crearMundo({ reto: retosFactory.RETOS[0], intento: 1 });
  const escenaFactory = reglasFactory.escena(mundoFactory);
  const factory = plano.crearVista(canvas, { ...opciones, serie: 'factory', cols: 9, rows: 7 });
  factory.dibujar(null, escenaFactory, 0, 1234);
  for (const e of mundoFactory.maquinas) {
    const p = factory.proyectar(e.cx ?? e.x, 0, e.cy ?? e.y);
    assert.equal(factory.elegir(p.x, p.y), e.id, 'Factory: misma selección desde la escena para ' + e.id);
  }
  factory.destruir();
  // Campaign: crear/destruir registra y retira todos los gestos sin dibujar ni abrir navegador.
  const eventos = new Map();
  const canvasCampaign = { ...canvas,
    addEventListener: (tipo, fn) => eventos.set(tipo, fn),
    removeEventListener: (tipo, fn) => { assert.equal(eventos.get(tipo), fn); eventos.delete(tipo); } };
  const campaign = plano.crearVista(canvasCampaign, { ...opciones, serie: 'campaign', mapa: { cols: 40, rows: 30 } });
  assert.equal(eventos.size, 6);
  campaign.destruir(); campaign.destruir();
  assert.equal(eventos.size, 0);
  assert.equal(tres.crearVista({}, { serie: 'war', dt: .05 }), null, 'respaldo sin THREE');
  const nula = crearVistaNula();
  assert.equal(nula.proyectar(1, 0, 1).visible, false);
} finally {
  if (windowAnterior === undefined) delete globalThis.window;
  else globalThis.window = windowAnterior;
}
console.log('crearVista: exportaciones 2D/3D, contrato 2D, dibujo idéntico con fracciones 0/1, selección y destrucción verificados en Node.');
