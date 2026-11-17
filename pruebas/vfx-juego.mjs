import * as ThreeReal from '../shared/vendor/three-r180/three.module.min.js';
// Fachadas y composición reales; canvas y GPU emulados. No abre navegador.
import assert from 'node:assert/strict';
import { crearVista as crear2D, crearTerreno } from '../paquetes/vista-2d/index.js';
import { crearVista as crear3D } from '../paquetes/vista-3d/index.js';
import { crearEfectos, crearRecetasWar, recetaWar } from '../paquetes/vfx/index.js';
import { instalarVistasJuego } from '../paquetes/app/juego/vistas.js';
import factory, { retos } from '../paquetes/reglas-factory/index.js';
import { adaptar } from './juego-adaptador.mjs';
import { casosReferencia } from '../herramientas/partida/casos.mjs';
import campaign, * as datosCampaign from '../paquetes/reglas-campaign/index.js';

const THREE = { ...ThreeReal };
const cargarGLTFLoader = async () => class { load(_url, ok) { ok(null); } };
let render, recursosLiberados = 0, consultasGl = 0;
THREE.WebGLRenderer = class {
  constructor({ canvas }) { this.domElement = canvas; this.ratio = 1; }
  setPixelRatio(r) { this.ratio = r; }
  setSize(w, h) { this.domElement.width = w * this.ratio; this.domElement.height = h * this.ratio; }
  getContext() { consultasGl++; return { ALIASED_POINT_SIZE_RANGE: 7, getParameter(k) { assert.equal(k, 7); return [1, 137]; } }; }
  render(escena, camara) { escena.updateMatrixWorld(); camara.updateMatrixWorld(); render = escena; }
  dispose() { recursosLiberados++; }
};
function lienzo() {
  const llamadas = [];
  const ctx = new Proxy({}, { get(o, k) {
    if (k in o) return o[k];
    return (...args) => {
      llamadas.push([k, ...args]);
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return { addColorStop() {} };
      if (k === 'createImageData') return { data: new Uint8Array(args[0] * args[1] * 4) };
      if (k === 'measureText') return { width: 20 };
    };
  } });
  return { width: 640, height: 400, clientWidth: 640, clientHeight: 400, llamadas,
    getContext: () => ctx, getBoundingClientRect: () => ({ width: 640, height: 400 }), addEventListener() {}, removeEventListener() {}, setPointerCapture() {} };
}
const claves = ['window', 'document', 'MutationObserver', 'innerWidth', 'innerHeight', 'location', 'getComputedStyle', 'matchMedia'];
const previos = Object.fromEntries(claves.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
const col = Object.fromEntries(['bg', 'surface', 'ink', 'muted', 'grid', 'grid-2', 'suelo', 'base', 'building', 'edge', 'accent', 'sel',
  'misil', 'explosion', 'enemigo', 'enemigo-frio', 'bad', 'ok', 'rol-ofensiva'].map((k, i) => [k, i % 2 ? '#336699' : '#aa4422']));
const congelar = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };
const l = { id: 'L', clase: 'lanzador', cx: 4, cy: 6, yaw: 0, modo: 'idle' };
const d = { id: 'DEP', clase: 'deposito', cx: 1, cy: 4 };
const enemigo = { id: 'E', tipo: 'drone', x: 14, y: 8, z: 3, vx: -2, vy: 1, hp: 1, hpMax: 1, golpeT: -9 };
const escena = congelar({ t: 0, def: { niebla: false }, lanzadores: [l], deposito: d, maquinas: [l, d], sensores: [], reparadores: [],
  enemigos: [enemigo], explosiones: [], misiles: [], porId: { L: l, DEP: d } });
const contenedor = { getBoundingClientRect: () => ({ width: 640, height: 400 }) };
const opciones = { serie: 'war', dt: .05, THREE, cargarGLTFLoader, cols: 32, rows: 18, tema: col,
  $: id => id === 'app' ? { dataset: {} } : lienzo(),
  MISIL: { radio: 1.3 }, TIPOS: { drone: {}, crawler: { suelo: true } }, LINEA_BASE: 3,
  FUNCIONES: { ofensiva: 'O', fabrica: 'F' }, FR: .62, ARCO: [2, 2.9], HALO: { medio: [[0, .5], [.2, 0]] }, LUCES: {}, INTENSIDAD: { media: 1 },
  visual: { halo: 'no', brillo: 'no', intensidad: 'media' },
  leerVar: k => col[k] || '#336699', funcionDe: () => ({ principal: 'ofensiva' }), radioDe: () => .6,
  alcance: () => 10, direccionDe: () => 0, rgba: () => '#336699', mezclaBlanco: () => '#336699', r2: x => x };
function nubes() {
  const out = []; render.traverse(o => { if (o.isPoints) out.push(o); }); return out;
}
function esperadas(s, origen, calidad = 'alto', tv = .1, sinDestellos = false) {
  const gestor = crearEfectos({ recetas: crearRecetasWar({ radioDanio: 1.3 }), recetaDe: recetaWar, dt: .05 });
  gestor.anotar({ ...s, datos: { ...s.datos, ...origen } });
  return gestor.particulas(tv, { colores: col, calidad, sinDestellos });
}
function comprobar(vista, canvas, dimension, esperadas) {
  if (dimension === '2d') {
    const llamadas = canvas.llamadas.filter(x => x[0] === 'drawImage');
    assert.equal(llamadas.length, esperadas.filter(p => p.alfa > 0 && p.tam > 0).length);
    const puntos = llamadas.map(([, , x, y, w]) => [x + w / 2, y + w / 2]);
    const orden = p => p.mezcla === 'suma' ? 2 : p.forma === 'humo' ? 0 : 1;
    const previstas = [...esperadas].filter(p => p.alfa > 0 && p.tam > 0).sort((a, b) => orden(a) - orden(b));
    previstas.forEach((p, i) => {
      const q = vista.proyectar(p.x, 0, p.y);
      assert(Math.abs(puntos[i][0] - q.x) < 1e-8); assert(Math.abs(puntos[i][1] - q.y) < 1e-8);
    });
    if (llamadas.length) {
      const indices = canvas.llamadas.map(([k]) => k);
      assert(indices.lastIndexOf('stroke') > indices.lastIndexOf('drawImage'), 'selección sobre VFX');
    }
  } else {
    assert.equal(nubes().length, 2);
    nubes().forEach((n, i) => {
      const previstas = esperadas.filter(p => (p.mezcla === 'suma' ? 1 : 0) === i);
      assert.equal(n.geometry.drawRange.count, previstas.length);
      assert(n.renderOrder > 1); assert.equal(n.material.uniforms.maxPunto.value, 137);
      previstas.forEach((p, j) => {
        const a = n.geometry.attributes.position.array.slice(j * 3, j * 3 + 3);
        [p.x, p.z, p.y].forEach((v, k) => assert(Math.abs(a[k] - v) < 2e-6));
      });
    });
  }
}
let cambiarMovimiento;
try {
  Object.assign(globalThis, { window: { devicePixelRatio: 2 }, document: { createElement: lienzo, documentElement: {} },
    MutationObserver: class { observe() {} disconnect() {} }, innerWidth: 1280, innerHeight: 720,
    matchMedia: () => ({ matches: false, addEventListener(_tipo, f) { cambiarMovimiento = f; }, removeEventListener() {} }),
    location: { search: '' }, getComputedStyle: () => ({ getPropertyValue: k => col[k.slice(2)] || '#336699' }) });
  for (const dimension of ['2d', '3d']) {
    for (const calidad of ['alto', 'medio', 'bajo', 'no']) {
      const canvas = lienzo();
      let foto = escena;
      let configuracion = { calidad, sinDestellos: false };
      const muestras = [];
      const estado = { get escena() { return foto; }, get efectos() { return configuracion; },
        medicionEfectos: { ahora: () => 1, registrar: m => muestras.push(m) }, cols: 32, rows: 18, col, seleccionadas: new Set(['L']) };
      const vista = dimension === '2d' ? crear2D(canvas, { ...opciones, calidad, estado })
        : crear3D(contenedor, { ...opciones, calidad, estado, canvas });
      if (dimension === '3d') { vista.construir(); vista.redimensionar(); }
      const dibujar = (t = .1, fraccion = 0) => { foto = congelar({ ...foto, t }); canvas.llamadas.length = 0; vista.dibujar(null, foto, fraccion, 100); };
      const casos = [
        [{ paso: 0, tipo: 'disparo', unidad: 'L', datos: { x: 4, y: 12, z: 5 } }, { origen: [4, 6, 1], rumbo: Math.PI / 2 }],
        [{ paso: 0, tipo: 'explosion', unidad: 'L', datos: { x: 16, y: 10, z: 2, misil: 1, golpe: 1 } }, {}],
        [{ paso: 0, tipo: 'explosion', unidad: 'L', datos: { x: 18, y: 10, z: 0, misil: 2, golpe: 0 } }, {}],
        [{ paso: 0, tipo: 'atasco', unidad: 'L' }, { origen: [4, 6, 1], rumbo: 0 }],
        [{ paso: 0, tipo: 'reparado', unidad: 'L' }, { origen: [4, 6, 0], rumbo: 0 }],
        [{ paso: 0, tipo: 'brecha', unidad: 'E', datos: { x: 3, y: 8 } }, { origen: [3, 8, 0] }],
      ];
      for (const [s, origen] of casos) {
        vista.vaciar(); congelar(s); const antes = JSON.stringify(s);
        vista.alSuceso(s); dibujar();
        comprobar(vista, canvas, dimension, esperadas(s, origen, calidad));
        assert.equal(JSON.stringify(s), antes, 'suceso original intacto');
      }
      // Última posición realmente dibujada, incluida la extrapolación visual.
      vista.vaciar(); foto = escena; dibujar(0, .5);
      foto = congelar({ ...escena, enemigos: [] });
      const derribo = congelar({ paso: 0, tipo: 'derribo', unidad: 'E', datos: { tipo: 'drone', por: 'L' } });
      vista.alSuceso(derribo); dibujar();
      comprobar(vista, canvas, dimension, esperadas(derribo, { origen: [13.95, 8.025, 3] }, calidad));
      // Enemigo nunca dibujado: derribo anterior a su explosión del mismo paso.
      vista.vaciar();
      vista.alSuceso(derribo);
      const explosion = congelar({ paso: 0, tipo: 'explosion', unidad: 'L', datos: { x: 19, y: 11, z: 4, misil: 3, golpe: 1 } });
      vista.alSuceso(explosion); dibujar();
      comprobar(vista, canvas, dimension, [...esperadas(derribo, { origen: [19, 11, 4] }, calidad), ...esperadas(explosion, {}, calidad)]);
      // Respaldo de escena si el consumidor solo dispone de ese suceso.
      vista.vaciar(); foto = congelar({ ...foto, explosiones: [{ t0: 0, x: 19, y: 11, z: 4 }] });
      vista.alSuceso(derribo); dibujar();
      comprobar(vista, canvas, dimension, esperadas(derribo, { origen: [19, 11, 4] }, calidad));
      if (dimension === '2d') {
        foto = congelar({ ...foto, explosiones: [{ t0: 0, x: 19, y: 11, z: 4 }, { t0: 0, x: 4, y: 6, z: 1, atasco: true }] });
        dibujar();
        assert.deepEqual(canvas.llamadas.filter(([k]) => k === 'fillText').map(x => x[1]).filter(x => String(x).startsWith('↑')), ['↑4'], 'altura aérea permanece también con calidad no');
        assert(canvas.llamadas.some(([k, dash]) => k === 'setLineDash' && String(dash) === '4,3'));
      }
      // Vaciar retira también pendientes y posiciones de la ejecución anterior.
      vista.vaciar(); dibujar(); comprobar(vista, canvas, dimension, []);
      // La fracción usa escena.t + off, no el reloj del fotograma.
      vista.alSuceso(casos[0][0]); dibujar(.075, .5);
      comprobar(vista, canvas, dimension, esperadas(casos[0][0], casos[0][1], calidad));
      // Cambia la calidad y accesibilidad entre dibujos del MISMO suceso vivo.
      // No se reanota ni se vacía: al volver a alto reaparecen sus partículas.
      for (const nivel of ['no', 'bajo', 'medio', 'alto']) {
        for (const sinDestellos of [true, false]) {
          configuracion = { calidad: nivel, sinDestellos }; dibujar();
          comprobar(vista, canvas, dimension, esperadas(casos[0][0], casos[0][1], nivel, .1, sinDestellos));
          const m = muestras.at(-1);
          assert.equal(m.vista, dimension); assert.equal(m.vivas, esperadas(casos[0][0], casos[0][1], nivel, .1, sinDestellos).length);
          assert.equal(m.particulasMs, 0); assert.equal(m.dibujarMs, 0);
        }
      }
      if (dimension === '3d') {
        const [normal] = nubes(); let liberados = 0;
        for (const n of nubes()) { n.geometry.addEventListener('dispose', () => liberados++); n.material.addEventListener('dispose', () => liberados++); }
        vista.tamano(320, 240);
        assert.equal(normal.material.uniforms.escala.value, 480 / (2 * Math.tan(38 * Math.PI / 360)));
        vista.destruir(); assert.equal(liberados, 4); assert.equal(normal.parent, null);
      } else vista.destruir();
      vista.alSuceso(casos[0][0]); vista.destruir();
    }
  }
  // Las otras series crean y dibujan sus fachadas, sin montar ni emitir VFX.
  for (const serie of ['factory', 'campaign']) {
    const reglas = serie === 'factory' ? factory : campaign;
    const reto = serie === 'factory' ? retos.RETOS[0] : datosCampaign.nivel.NIVEL;
    const foto = reglas.escena(reglas.crearMundo({ reto, intento: 1 }));
    const estado = { escena: foto, cols: 32, rows: 18, col, seleccionadas: new Set() };
    for (const dimension of ['2d', '3d']) {
      const canvas = lienzo(), previas = consultasGl;
      const opts = { ...opciones, serie, estado, canvas, mapa: datosCampaign.nivel.MAPA, crearTerreno, reglas: datosCampaign,
        funcionDe: () => ({ principal: 'fabrica' }) };
      const vista = dimension === '2d' ? crear2D(canvas, opts) : crear3D(contenedor, opts);
      vista.alSuceso({ paso: 0, tipo: 'explosion', datos: { x: 9, y: 7, golpe: 1, misil: 1 } });
      if (dimension === '3d') { vista.construir(); vista.redimensionar(); }
      vista.dibujar(null, foto, 0, 100);
      if (dimension === '3d') {
        assert.equal(nubes().length, 0);
        assert.deepEqual(render.children.filter(o => o.isLight).map(o => o.intensity),
          (serie === 'factory' ? [.85, .55] : [.82, .62]).map(i => i * Math.PI));
      }
      else assert.equal(canvas.llamadas.filter(([k, imagen]) => k === 'drawImage' && imagen.width === 64).length, 0);
      assert.equal(consultasGl, previas); vista.destruir();
    }
  }
  for (const serie of ['factory', 'campaign']) {
    const ctx = { ...opciones, SERIE: serie, ES_FACTORY: serie === 'factory', ES_CAMPAIGN: serie === 'campaign', DT: .05,
      servicios: { THREE, cargarGLTFLoader }, campaign: datosCampaign, reglas: { escena: () => escena }, mundo: {}, COLS: 32, ROWS: 18,
      $: id => id === 'c2d' || id === 'c3d' ? lienzo() : id === 'app' ? { dataset: {} } : contenedor };
    const api = instalarVistasJuego(ctx);
    let entregas = 0;
    api.vistaActual().alSuceso = () => entregas++;
    api.V3.alSuceso = () => entregas++;
    api.sucesosVistas([{ paso: 0, tipo: 'disparo' }]);
    assert.equal(entregas, 0, serie + ': la app no reenvía los sucesos');
    api.vistaActual().destruir(); api.V3.destruir();
  }
  // App: URL, escena invalidada por lote, las dos vistas aunque una esté oculta.
  for (const [valor, calidad] of [['', 'alto'], ['invalido', 'alto'], ['alto', 'alto'], ['medio', 'medio'], ['bajo', 'bajo'], ['no', 'no']]) {
    globalThis.location.search = '?vfx=' + valor;
    const plano = lienzo(), tres = lienzo(); let lecturas = 0;
    const ctx = { ...opciones, SERIE: 'war', DT: .05, COLS: 32, ROWS: 18, servicios: { THREE, cargarGLTFLoader },
      reglas: { escena() { lecturas++; return escena; } }, mundo: {}, seleccionadas: new Set(['L']),
      $: id => id === 'c2d' ? plano : id === 'c3d' ? tres : id === 'app' ? { dataset: {} } : contenedor };
    const api = instalarVistasJuego(ctx); api.leerColores(); api.V3.construir(); api.V3.redimensionar();
    void api.estadoVista.escena; const antes = lecturas;
    const s = congelar({ paso: 0, tipo: 'disparo', unidad: 'L', datos: { x: 4, y: 12 } });
    api.sucesosVistas([s]); assert.equal(lecturas, antes + 1);
    const foto = congelar({ ...escena, t: .1 });
    api.vistaActual().dibujar(null, foto, 0, 0);
    assert.equal(plano.llamadas.filter(([k]) => k === 'drawImage').length, esperadas(s, { origen: [4, 6, 1], rumbo: Math.PI / 2 }, calidad).filter(p => p.alfa > 0).length);
    ctx.vista = '3d'; api.vistaActual().dibujar(null, foto, 0, 0);
    const cantidad = () => nubes().reduce((n, o) => n + o.geometry.drawRange.count, 0);
    assert.equal(cantidad(), esperadas(s, { origen: [4, 6, 1], rumbo: Math.PI / 2 }, calidad).length);
    // Preferencia de Ajustes y cambio del sistema atraviesan app → getter → fachada.
    api.calidadEfectos.cambiar('auto'); cambiarMovimiento({ matches: true });
    const efectiva = ['alto', 'medio', 'bajo', 'no'].includes(valor) ? valor : 'bajo';
    const previstas = esperadas(s, { origen: [4, 6, 1], rumbo: Math.PI / 2 }, efectiva, .1, true);
    api.vistaActual().dibujar(null, foto, 0, 0); assert.equal(cantidad(), previstas.length);
    ctx.vista = '2d'; plano.llamadas.length = 0; api.vistaActual().dibujar(null, foto, 0, 0);
    assert.equal(plano.llamadas.filter(([k]) => k === 'drawImage').length, previstas.filter(p => p.alfa > 0).length);
    api.calidadEfectos.cambiar('no'); cambiarMovimiento({ matches: false });
    assert.equal(api.estadoVista.efectos.calidad, ['alto', 'medio', 'bajo', 'no'].includes(valor) ? valor : 'no');
    api.calidadEfectos.destruir?.();
    api.vaciarEfectos(); assert.equal(cantidad(), 0);
    ctx.vista = '2d'; plano.llamadas.length = 0; api.vistaActual().dibujar(null, foto, 0, 0);
    assert.equal(plano.llamadas.filter(([k]) => k === 'drawImage').length, 0);
    api.vistaActual().destruir(); api.V3.destruir();
  }
  // El ciclo real entrega sus lotes a la composición y limpia cada ejecución.
  let vaciados = 0, disparos = 0;
  const caso = casosReferencia().find(c => c.reglas === 'war' && c.reto === 2);
  const juego = adaptar(caso, { vaciarEfectos: () => vaciados++,
    sucesosVistas: lista => { disparos += lista.filter(s => s.tipo === 'disparo').length; } });
  juego.cargar(caso.programas);
  for (let n = 0; !disparos && n < 1000; n++) await juego.avanzar(1);
  assert(disparos > 0, 'alSucesos del conductor alcanza sucesosVistas');
  const antes = vaciados;
  juego.cargar(caso.programas);
  assert(vaciados > antes, 'ejecutar de nuevo vacía los efectos'); juego.detener();
  assert(recursosLiberados > 0);
} finally {
  for (const k of claves) { if (previos[k]) Object.defineProperty(globalThis, k, previos[k]); else delete globalThis[k]; }
}
console.log('VFX War: fachadas 2D/3D, orígenes de todas las recetas, copias intactas, fracción, calidad URL, cambio en caliente, limpieza y recursos; Factory/Campaign sin partículas. Canvas/GPU emulados, sin navegador.');
