// Las escalas y anclas están en ejes glTF (Y arriba), antes de escalar.
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
export const terrenos = ['terreno-1-1', 'terreno-1-2'];
for (const [i, id] of terrenos.entries()) {
  modelos[id] = { ...pieza(arte + 'glb/mapa/' + id + '.glb', [100, .2, 52]), centroProvisional: [150 + 100 * i, -.1, 78] };
}

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
