import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { kit, terrenosBatalla, zonasProhibidas, zoomMax } from '../paquetes/vista-3d/cv2/decorado.js';

const mapa = JSON.parse(await readFile(new URL('../arte/blender/papercraft/mapa-ampliado.json', import.meta.url), 'utf8'));
assert.deepEqual(zonasProhibidas, {
  campo: { caja: [204, 72, 236, 90], margen: 3 },
  fabrica: { caja: [170, 60, 207, 90], margen: 0 },
  losa: { ...mapa.losa, margen: 2 },
  muralla: { puntos: mapa.muralla, margen: 6 },
  carriles: mapa.carriles.map(carril => ({ ...carril, margen: 2 })),
  carretera: { ...mapa.carretera, margen: 2 },
  rio: { ...mapa.rio, margen: 0 },
});

const cargadas = new Set(terrenosBatalla);
assert.equal(cargadas.size, terrenosBatalla.length);
assert.ok(cargadas.size <= 6);
for (const id of cargadas) assert.match(id, /^terreno-[0-3]-[0-3]$/);
const [anchoTesela, fondoTesela] = mapa.metros.map((metros, i) => metros / mapa.trozos[i]);

// Recorre también los índices exteriores al mapa para detectar bordes y huecos.
function cubrir([x0, z0, x1, z1], motivo, intersecta = () => true) {
  for (let fila = Math.floor(z0 / fondoTesela); fila <= Math.floor(z1 / fondoTesela); fila++) {
    for (let col = Math.floor(x0 / anchoTesela); col <= Math.floor(x1 / anchoTesela); col++) {
      const x = col * anchoTesela;
      const z = fila * fondoTesela;
      if (intersecta(x, z, x + anchoTesela, z + fondoTesela)) {
        const id = `terreno-${fila}-${col}`;
        assert.ok(cargadas.has(id), `${motivo} alcanza ${id}`);
      }
    }
  }
}

// La esfera opaca corta el plano horizontal de la base a altura d·sen(pitch)
// bajo la cámara. Al sumar el desplazamiento de la cámara al radio de ese
// corte, cubrimos el disco completo con cualquier yaw y toda distancia menor.
assert.ok(Number.isFinite(zoomMax) && zoomMax >= 8 && zoomMax <= 60);
for (const [nombre, pitch] of [['campo', 1.15], ['fabrica', 1]]) {
  const [x0, z0, x1, z1] = zonasProhibidas[nombre].caja;
  const x = (x0 + x1) / 2;
  const z = (z0 + z1) / 2;
  const radio = zoomMax * (Math.cos(pitch) + Math.sqrt(1.75 ** 2 - Math.sin(pitch) ** 2));
  cubrir([x - radio, z - radio, x + radio, z + radio], nombre, (izq, norte, der, sur) =>
    Math.hypot(Math.max(izq - x, 0, x - der), Math.max(norte - z, 0, z - sur)) <= radio);
}

const cajasLocales = {
  alcornoque: [-3.49, -2.47, 3.28, 2.35],
  esparto: [-0.80, -0.84, 0.75, 0.65],
  espigas: [-0.92, -0.92, 0.56, 0.77],
  laja: [-1.37, -1.07, 1.68, 1.07],
  lienzo: [-3.71, -1.68, 3.71, 1.68],
  matorral: [-1.37, -1.07, 1.68, 1.07],
  'pino-alto': [-2.10, -2.45, 2.57, 2.45],
  'pino-joven': [-1.47, -1.71, 1.80, 1.71],
  roca: [-1.37, -1.07, 1.68, 1.07],
  torre: [-2.60, -2.84, 2.60, 2.84],
};

// La envolvente alineada a los ejes contiene toda la caja girada alrededor de Y.
function envolvente({ id, x, z, escala, giro }) {
  const [x0, z0, x1, z1] = cajasLocales[id];
  const c = Math.cos(giro) * escala;
  const s = Math.sin(giro) * escala;
  const xs = [];
  const zs = [];
  for (const u of [x0, x1]) {
    for (const v of [z0, z1]) {
      xs.push(x + u * c + v * s);
      zs.push(z - u * s + v * c);
    }
  }
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

function ampliar([x0, z0, x1, z1], margen) {
  return [x0 - margen, z0 - margen, x1 + margen, z1 + margen];
}

function separadas(a, b) {
  return a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
}

// Intervalo del parámetro t en [0,1] que queda dentro de ambas bandas.
function cortaSegmento(caja, a, b) {
  let inicio = 0;
  let fin = 1;
  for (const eje of [0, 1]) {
    const delta = b[eje] - a[eje];
    if (delta === 0) {
      if (a[eje] < caja[eje] || a[eje] > caja[eje + 2]) return false;
    } else {
      const t0 = (caja[eje] - a[eje]) / delta;
      const t1 = (caja[eje + 2] - a[eje]) / delta;
      inicio = Math.max(inicio, Math.min(t0, t1));
      fin = Math.min(fin, Math.max(t0, t1));
    }
  }
  return inicio <= fin;
}

const { campo, fabrica, losa, muralla, carretera, carriles, rio } = zonasProhibidas;
const [cx, cz] = losa.centro;
const [w, h] = losa.metros;
const rectangulos = {
  campo: ampliar(campo.caja, campo.margen),
  fabrica: ampliar(fabrica.caja, fabrica.margen),
  losa: ampliar([cx - w / 2, cz - h / 2, cx + w / 2, cz + h / 2], losa.margen),
};

assert.ok(kit.length >= 40 && kit.length <= 80);
for (const id of ['torre', 'lienzo']) assert.ok(kit.filter(p => p.id === id).length <= 2, id);
const huellas = [];
for (const pieza of kit) {
  const { id, x, z, giro, escala } = pieza;
  const etiqueta = `${id} (${x}, ${z})`;
  assert.ok(Object.hasOwn(cajasLocales, id), etiqueta);
  assert.ok([x, z, giro, escala].every(Number.isFinite) && escala >= 0.8 && escala <= 1.25, etiqueta);
  const caja = envolvente(pieza);
  cubrir(caja, etiqueta);
  for (const [nombre, zona] of Object.entries(rectangulos)) {
    assert.ok(separadas(caja, zona), `${etiqueta} invade ${nombre}`);
  }
  for (const { nombre = 'muralla', puntos, ancho = 0, margen } of [muralla, carretera, ...carriles, rio]) {
    for (let i = 1; i < puntos.length; i++) {
      // El mayor semiancho del tramo cubre todo el río interpolado. Ampliar
      // la caja también en las esquinas es conservador para márgenes circulares.
      const diametro = Array.isArray(ancho) ? Math.max(ancho[i - 1], ancho[i]) : ancho;
      const reserva = ampliar(caja, margen + diametro / 2);
      assert.ok(!cortaSegmento(reserva, puntos[i - 1], puntos[i]), `${etiqueta} invade ${nombre}`);
    }
  }
  for (const anterior of huellas) {
    assert.ok(separadas(caja, anterior.caja), `${etiqueta} solapa ${anterior.etiqueta}`);
  }
  huellas.push({ caja, etiqueta });
}

console.log(`OK · ${kit.length} piezas sin solapes ni invasiones · ${cargadas.size} teselas · niebla cubierta en batalla y fábrica hasta ${zoomMax} m`);
