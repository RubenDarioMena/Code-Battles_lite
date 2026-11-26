// WHL · rueda kamikaze. Se mueve con «movimiento»; detonate() la hace estallar donde está: daña en área a los
// enemigos de War (el puente llama a danoEnArea con su impacto) y a los hostiles V2, y la rueda se destruye. Reaparece
// en su casa a los `reaparece` segundos y su programa vuelve a la primera línea (paso.js y el anfitrión).
import { ficha } from './ficha.js';
export { ficha };

export function crear(def) {
  return { id: def.id, def, clase: ficha.id, modelo: ficha.modelo, capacidades: ficha.capacidades,
    home: { ...def.home }, position: { ...def.home }, hp: def.vida, nearest: null, detonada: false,
    ruta: [], moving: false, viaje: 0, resultado: 'ok' };
}

// Autocontenidas: el trabajador del programa las recibe como texto (anfitrion/trabajador.js).
function ordenarRueda(u, verbo) {
  if (verbo !== 'detonate') return 'desconocido';
  if (u.detonada) return 'ya_detonada';
  u.detonada = true;
  return 'ok';
}
function apiRueda(estado, limites, ordenar, emitir) {
  return {
    detonate() {
      const res = ordenar(estado(), 'detonate');
      if (res === 'ok') emitir('detonate', null, res);
      return res;
    },
  };
}
export const programa = { api: apiRueda, ordenar: ordenarRueda };

export function orden(campo, u, verbo) {
  if (u.clase !== ficha.id || verbo !== 'detonate') return false;
  u.detonada = true;
  return true;
}

// Distancia al enemigo de suelo más cercano (War u hostil V2); null si no hay ninguno en el campo.
export function cercano(campo, punto) {
  let mejor = null;
  for (const e of [...campo.enemigosWar, ...campo.hostiles]) {
    if ((e.z ?? 0) > .5) continue;
    const d = Math.hypot(e.x - punto.x, e.y - punto.y);
    if (mejor === null || d < mejor) mejor = d;
  }
  return mejor === null ? null : Math.round(mejor * 100) / 100;
}

export function paso(campo) {
  for (const u of Object.values(campo.aliados)) {
    if (u?.clase !== ficha.id) continue;
    if (u.detonada) {
      const { x, y } = u.position, d = u.def;
      campo.impactos.push({ id: 'v2-' + ++campo.secuencia, de: u.id, x0: x, y0: y, x1: x, y1: y, radio: d.radio, dano: d.dano, estallido: true });
      for (const e of campo.hostiles) if (Math.hypot(e.x - x, e.y - y) <= d.radio) { e.hp -= d.dano; e.golpeT = campo.t; }
      campo.hostiles = campo.hostiles.filter(e => e.hp > 0);
      campo.aliados[u.id] = null;
      campo.reponer[u.id] = campo.t + d.reaparece;
      continue;
    }
    u.nearest = cercano(campo, u.position);
  }
}
