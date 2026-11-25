// Las escalas y anclas están en ejes glTF (Y arriba), antes de escalar.
import { terrenosBatalla, terrenosLejanos } from './decorado.js';

const arte = '../../../arte/blender/papercraft/';
const pieza = (ruta, tam, escala = 1, ancla = [0, 0, 0]) => ({
  url: new URL(ruta, import.meta.url).href, escala, desplazamiento: [0, 0, 0], ancla, tam, rig: null,
});

export const modelos = {
  veh_v1: pieza('../../../Prototypes/Campaign-V2/modelos/vehiculo_tubular.glb', [1.5, 1, 1], .55),
  tirador_v1: { primitiva: 'crawler' },
  'torreta-esfera': {
    ...pieza('../../../Prototypes/Campaign-V2/modelos/torreta_observacion.glb', [1.38, 1.32, 1.38]),
    rig: { raiz: 'TorretaObservacion', azimut: 'azimut', inclinacion: 'inclinacion', hojas: 'hojas', extension: 'extension' },
  },
  'muralla-traba-tramo': pieza(arte + 'glb/muralla/opcion-03-tramo.glb', [7, 10.5, 3.2], .54),
  'muralla-traba-nudo': { ...pieza(arte + 'glb/muralla/opcion-03-nudo.glb', [7, 16, 5.6], .54), apoyo: [0, 16, 0] },
  'torreon-cordon': pieza(arte + 'glb/muralla/opcion-07-nudo.glb', [7, 16, 5.41], .54),
};
// Las teselas y el kit salen del cálculo de encuadre de T10 (decorado.js).
export const terrenos = [...terrenosBatalla, ...terrenosLejanos];
for (const id of terrenos) {
  const [fila, col] = id.split('-').slice(1).map(Number);
  modelos[id] = { ...pieza(arte + 'glb/mapa/' + id + '.glb', [100, .2, 52]), centroProvisional: [100 * col + 50, -.1, 52 * fila + 26] };
}
// Cajas del kit en metros (Y arriba, origen en la base): solo sirven al provisional si falla la carga.
const cajasKit = { alcornoque: [6.8, 6.3, 4.8], esparto: [1.6, 1.5, 1.5], espigas: [1.5, 2, 1.7], laja: [3, .8, 2.1],
  lienzo: [7.4, 6.5, 3.4], matorral: [3, 1.9, 2.1], 'pino-alto': [4.7, 8.3, 4.9], 'pino-joven': [3.3, 5.8, 3.4],
  roca: [3, 1.9, 2.1], torre: [5.2, 9.2, 5.7] };
for (const [id, tam] of Object.entries(cajasKit)) modelos['kit-' + id] = pieza(arte + 'glb/kit/' + id + '.glb', tam);

export function urlBinario(ruta, base = import.meta.url) {
  const u = new URL(ruta, base);
  if (/(^|\.)githack\.com$/.test(u.hostname) && /\.(glb|png)$/i.test(u.pathname))
    return new URL(u.pathname + u.search, 'https://raw.githubusercontent.com').href;
  return u.href;
}

// Cada vista posee las plantillas y comparte sus geometrías entre las copias.
export function crearRegistro(cargar, provisional) {
  const cargas = new Map();
  return id => {
    const ficha = modelos[id];
    if (!ficha) throw new Error('Modelo desconocido: ' + id);
    if (!cargas.has(id)) cargas.set(id, Promise.resolve()
      .then(() => ficha.primitiva ? provisional(ficha) : cargar(urlBinario(ficha.url), ficha))
      .catch(() => provisional(ficha)));
    return cargas.get(id);
  };
}
