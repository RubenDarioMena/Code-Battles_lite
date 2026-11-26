// Minador · se mueve con «movimiento»; drop() deja una carga donde está. Cada carga estalla cuando un enemigo de suelo
// entra en su radio: daña en área (enemigos de War vía el puente, hostiles V2 aquí) y emite onDetonation al programa.
import { ficha } from './ficha.js';
export { ficha };

export function crear(def) {
  return { id: def.id, def, clase: ficha.id, modelo: ficha.modelo, capacidades: ficha.capacidades,
    home: { ...def.home }, position: { ...def.home }, hp: def.vida, charges: def.cargas,
    ruta: [], moving: false, viaje: 0, resultado: 'ok' };
}

// Autocontenidas: el trabajador del programa las recibe como texto (anfitrion/trabajador.js).
function ordenarMinador(u, verbo) {
  if (verbo !== 'drop') return 'desconocido';
  if (!(u.charges > 0)) return 'sin_cargas';
  u.charges--;
  return 'ok';
}
function apiMinador(estado, limites, ordenar, emitir) {
  return {
    drop() {
      const res = ordenar(estado(), 'drop');
      if (res === 'ok') emitir('drop', null, res);
      return res;
    },
  };
}
export const programa = { api: apiMinador, ordenar: ordenarMinador };

export function orden(campo, u, verbo) {
  if (u.clase !== ficha.id || verbo !== 'drop') return false;
  if (u.charges > 0) {
    u.charges--;
    (campo.cargas ??= []).push({ id: 'carga-' + ++campo.secuencia, de: u.id, x: u.position.x, y: u.position.y,
      radio: u.def.radio, dano: u.def.dano });
  }
  return true;
}

export function paso(campo) {
  if (!campo.cargas?.length) return;
  const suelo = [...campo.enemigosWar, ...campo.hostiles].filter(e => (e.z ?? 0) <= .5);
  campo.cargas = campo.cargas.filter(c => {
    const dentro = suelo.filter(e => Math.hypot(e.x - c.x, e.y - c.y) <= c.radio);
    if (!dentro.length) return true;
    campo.impactos.push({ id: 'v2-' + ++campo.secuencia, de: c.de, x0: c.x, y0: c.y, x1: c.x, y1: c.y, radio: c.radio, dano: c.dano });
    for (const e of campo.hostiles) if (Math.hypot(e.x - c.x, e.y - c.y) <= c.radio) { e.hp -= c.dano; e.golpeT = campo.t; }
    campo.hostiles = campo.hostiles.filter(e => e.hp > 0);
    // El evento llega al programa del minador aunque esté destruido en ese momento: se descarta si no hay programa.
    campo.eventos.push({ unidad: c.de, evento: 'onDetonation', datos: { x: c.x, y: c.y, enemigos: dentro.length } });
    return false;
  });
}
