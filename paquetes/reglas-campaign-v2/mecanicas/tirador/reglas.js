import { ficha } from './ficha.js';
export { ficha };

export function crear(def) {
  return { id: def.id, tipo: ficha.id, modelo: ficha.modelo, ...def.home, z: 0, vx: 0, vy: 0,
    hp: def.vida, hpMax: def.vida, golpeT: -10, cd: 0, def };
}

export function paso(campo, dt) {
  for (const e of campo.hostiles) {
    if (e.tipo !== ficha.id) continue;
    e.cd = Math.max(0, e.cd - dt);
    if (e.cd > 1e-9) continue;
    const u = Object.values(campo.aliados).find(u => u && Math.hypot(e.x - u.position.x, e.y - u.position.y) <= e.def.alcance);
    if (!u) continue;
    e.cd = e.def.intervalo;
    e.traza = { id: 'v2-' + ++campo.secuencia, de: e.id, t0: campo.t, dur: e.def.traza, arco: 0,
      x0: e.x, y0: e.y, z0: .4, x1: u.position.x, y1: u.position.y, z1: .4 };
    u.hp -= e.def.dano;
    if (u.hp <= 0) {
      campo.aliados[u.id] = null;
      campo.reponer[u.id] = campo.t + u.def.reaparece;
    }
  }
}
