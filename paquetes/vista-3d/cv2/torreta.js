import { conectarRig } from '../rig.js';

// La guía en reposo tiene longitud −32° y latitud −45° en Blender.
// El muñón gira sobre X: su componente este permanece fija. Resolver primero
// la altura y compensar después el rumbo permite usar el telescopio descentrado.
const lon = -32 * Math.PI / 180, lat = -Math.PI / 4;
const este = Math.cos(lat) * Math.cos(lon), arriba = Math.sin(lat), sur = -Math.cos(lat) * Math.sin(lon);
export function estadoRig(l, t, ultimoDisparo, altura, alturaObjetivo = 0) {
  const p = l.lugar;
  const elevacion = p ? Math.atan2((p.z || 0) + alturaObjetivo - altura, Math.hypot(p.x - l.cx, p.y - l.cy)) : 0;
  const radio = Math.hypot(arriba, sur);
  const inclinacion = Math.atan2(arriba, sur) - Math.asin(Math.max(-1, Math.min(1, Math.sin(elevacion) / radio)));
  const azimut = Math.atan2(arriba * Math.sin(inclinacion) + sur * Math.cos(inclinacion), este) - l.yaw;
  const edad = t - ultimoDisparo;
  const disparando = edad >= 0 && edad < .18;
  const abierto = !l.atascado && (l.modo !== 'idle' || disparando);
  return { azimut, inclinacion, hojas: Number(abierto), extension: abierto ? (disparando ? edad / .18 : 1) : 0,
    atascado: !!l.atascado };
}

export function montarTorreta(THREE, raiz, rig, mapa) {
  if (!rig) return () => {};
  const niveles = rig.niveles.map((_, i) => {
    const nodo = raiz.getObjectByName('L' + i + '_' + mapa.raiz);
    nodo.visible = false;
    return { nodo, solver: conectarRig(THREE, nodo, rig, i) };
  });
  return (estado, distancia) => {
    const nivel = distancia < 20 ? 0 : distancia < 44 ? 1 : 2;
    for (const [i, { nodo, solver }] of niveles.entries()) {
      nodo.visible = i === nivel;
      if (nodo.visible) solver.aplicar({ [mapa.azimut]: estado.azimut, [mapa.inclinacion]: estado.inclinacion,
        [mapa.hojas]: estado.hojas, [mapa.extension]: estado.extension });
    }
  };
}
