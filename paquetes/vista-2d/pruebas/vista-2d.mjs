// Pruebas de vista-2d en Node: dibujan con un lienzo falso a partir de escenas congeladas (no pueden escribirlas).
import assert from 'node:assert/strict';
import { crearPlano, dibujarFactory, crearPlanoCampaign, crearTerreno } from '../index.js';

let comprobaciones = 0;
const ok = (v, m) => { assert.ok(v, m); comprobaciones++; };
const igual = (a, b, m) => { assert.deepEqual(a, b, m); comprobaciones++; };
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };

/** Contexto 2D falso: cuenta las llamadas y acepta cualquier propiedad. */
function lienzo() {
  const llamadas = {};
  const cualquiera = () => new Proxy(function () {}, { get: (_t, k) => k === 'addColorStop' ? () => {} : cualquiera(), apply: () => cualquiera() });
  const ctx = new Proxy({}, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { llamadas[k] = (llamadas[k] || 0) + 1; return k === 'measureText' ? { width: 10 } : k.startsWith('create') || k === 'getImageData' ? cualquiera() : undefined; }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { ctx, llamadas, canvas: { clientWidth: 640, clientHeight: 400, width: 0, height: 0, getContext: () => ctx } };
}
globalThis.window = /** @type {any} */ ({ devicePixelRatio: 1 });
globalThis.performance ??= /** @type {any} */ ({ now: () => 0 });

const col = new Proxy({}, { get: () => '#336699' });
const lanzador = { id: 'LAU-01', clase: 'lanzador', cx: 4.5, cy: 9.5, yaw: Math.PI, modo: 'regular', lugar: { x: 12, y: 9, z: 2.5, id: 'D1' }, atascado: false, misiles: 6 };
const escenaWar = congelar({
  t: 3, def: { niebla: false }, lanzadores: [lanzador], sensores: [{ id: 'VIB-01', clase: 'vibracion', cx: 8.5, cy: 4.5, alcance: 5 }],
  deposito: { id: 'DEP-01', clase: 'deposito', cx: 1.5, cy: 9.5 }, reparadores: [{ id: 'REP-01', clase: 'reparador', cx: 2.4, cy: 7.4, estado: 'base' }],
  maquinas: [lanzador], enemigos: [{ id: 'D1', tipo: 'drone', x: 14, y: 9.5, z: 2.5, vx: -2, vy: 0, hp: 1, hpMax: 1, golpeT: -9 }],
  misiles: [{ id: 1, x: 8, y: 9.5, z: 1, tx: 12, ty: 9, tz: 2.5, t0: 2.5, sx: 4.5, sy: 9.5, objetivo: 'D1' }],
  explosiones: [{ x: 10, y: 9, z: 2, t0: 2.9, golpe: 1 }], porId: { 'LAU-01': lanzador },
});
const estado = (escena, extra = {}) => ({ escena, seleccionadas: new Set(['LAU-01']), seleccion: 'LAU-01', arrastreCampo: null,
  cols: 32, rows: 18, col, geo2: { T: 10, ox: 0, oy: 0 }, def: {}, vista: '2d', ...extra });
const base = { FUNCIONES: { ofensiva: 'O', rastreo: 'R', utilitaria: 'U', fabrica: 'F' }, funcionDe: () => ({ principal: 'ofensiva', secundaria: 'rastreo' }),
  radioDe: () => .6, rgba: () => 'rgba(0,0,0,1)', mezclaBlanco: () => '#fff', r2: x => x };

// War: dibuja la escena sin escribirla y publica su geometría en estado.geo2.
{
  const { ctx, llamadas, canvas } = lienzo();
  const e = estado(escenaWar);
  const dibujar = crearPlano(e, { ...base, $c2d: canvas, ctx2: ctx, ES_FACTORY: false, LINEA_BASE: 3,
    TIPOS: { drone: { suelo: false, frio: false, letra: 'D' }, crawler: { suelo: true, letra: 'O' }, stealth: { frio: true, letra: 'F' } },
    MISIL: { vel: 14, radio: 1.3 }, SENSOR: { visual: { alcance: 14 }, thermal: { alcance: 11 } }, LAU: {}, FR: .62,
    HALO: { medio: [[-.12, 0], [0, .9], [.18, 0]] }, INTENSIDAD: { media: 1 }, ARCO: [2, 2.9], LUCES: {},
    visual: { paleta: 'a', halo: 'medio', brillo: 'pilotos', intensidad: 'media' }, direccionDe: () => 0, alcance: () => 14 });
  dibujar(0.02);
  ok(llamadas.fillRect > 0 && llamadas.arc > 0, 'War: dibuja suelo, máquinas y enemigos');
  ok(e.geo2.T > 0, 'War: publica la geometría para elegir y etiquetar');
}

// Factory: el mismo plano delega en dibujarFactory.
{
  const robot = { id: 'R1', clase: 'robot', x: 4, y: 5, cx: 4.5, cy: 5.5, carga: null, tarea: null };
  const entidades = [{ id: 'ENT-1', tipo: 'bodega', x: 1, y: 1, w: 2, h: 2, cx: 2, cy: 2, puerta: { x: 3, y: 2 }, stock: { cobre: 3 }, entregado: {} },
    { id: 'FUN', tipo: 'maquina', x: 7, y: 1, w: 2, h: 2, cx: 8, cy: 2, puerta: { x: 7, y: 2 }, acepta: 'cobre', entrada: 0, stock: {}, procesando: false, progreso: 0, tProceso: 1 }];
  const escena = congelar({ t: 1, revelado: false, entidades, robot, porId: { R1: robot, 'ENT-1': entidades[0], FUN: entidades[1] } });
  const { ctx, llamadas } = lienzo();
  dibujarFactory(ctx, escena, col, 'R1', { T: 20, ox: 0, oy: 0 });
  ok(Object.keys(llamadas).length > 3, 'Factory: dibuja edificios y robot desde la escena');
}

// Campaign: relieve determinista y plano con mapa y reglas inyectados.
{
  const mapa = { cols: 40, rows: 30, losa: { x0: 5, y0: 5, x1: 30, y1: 25 }, muralla: { x: 36, y0: 0, y1: 30, grosor: 2 },
    camino: [[0, 15], [40, 15]], montes: [[2, 2, 3, 4]], rio: [[0, 28], [40, 29]], carriles: [] };
  const t1 = crearTerreno(mapa), t2 = crearTerreno(mapa);
  igual([t1.altura(10.5, 7.25), t1.altura(33, 3)], [t2.altura(10.5, 7.25), t2.altura(33, 3)], 'Campaign: relieve determinista');
  igual([t1.cols, t1.rows], [40, 30], 'Campaign: tamaño del relieve');
}

console.log(`vista-2d: ${comprobaciones} comprobaciones`);
