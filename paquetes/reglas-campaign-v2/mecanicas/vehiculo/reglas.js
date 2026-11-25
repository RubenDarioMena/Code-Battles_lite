import { ficha } from './ficha.js';
import { lugarDeObjetivo } from '../clic/reglas.js';
export { ficha };

export function crear(def) {
  return { id: def.id, def, clase: ficha.id, modelo: ficha.modelo, capacidades: ficha.capacidades,
    home: { ...def.home }, position: { ...def.home }, hp: def.vida, missiles: def.cargador, cd: 0,
    carga: 0, reparacion: 0, ruta: [], moving: false, viaje: 0, resultado: 'ok', target: null, puntual: null };
}

export function orden(campo, u, verbo, lugar) {
  if (u.clase !== ficha.id) return false;
  if (verbo === 'regularShoot' || verbo === 'stopFire') u.target = verbo === 'stopFire' ? null : lugar;
  if (verbo === 'intentoPuntual') u.puntual ??= lugar;
  return true;
}

export function puntual(campo, u, punto, alturas) {
  orden(campo, u, 'intentoPuntual', lugarDeObjetivo(punto, tiro(u, alturas)));
}

export function tiro(u, alturas) {
  return { cx: u.position.x, cy: u.position.y, cd: u.cd, vel: u.def.misil.vel, alturas };
}

export function objetivos(campo, u, alturas) {
  const visual = {}, thermal = {}, distancias = {};
  for (const e of [...campo.enemigosWar, ...campo.hostiles]) {
    const d = Math.hypot(e.x - u.position.x, e.y - u.position.y);
    if (d > u.def.sensor || d >= (distancias[e.tipo] ?? Infinity)) continue;
    distancias[e.tipo] = d;
    const objetivo = lugarDeObjetivo({ id: e.id, type: e.tipo, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy }, tiro(u, alturas));
    visual[e.tipo] = { x: objetivo.x, y: objetivo.y, z: objetivo.z, id: e.id, tipo: e.tipo };
    if (e.tipo !== 'stealth') thermal[e.tipo] = visual[e.tipo];
  }
  return { visual, thermal };
}

export function paso(campo, dt) {
  for (const u of Object.values(campo.aliados)) {
    if (u?.clase !== ficha.id) continue;
    const d = u.def;
    if (u.position.x < campo.limites.muro) {
      if (u.hp < d.vida) {
        u.reparacion += d.reparar * dt;
        if (u.reparacion >= 1 - 1e-9) { u.hp++; u.reparacion = 0; }
      }
      if (u.missiles < d.cargador) {
        u.carga += d.recargar * dt;
        if (u.carga >= 1 - 1e-9) { u.missiles++; u.carga = 0; }
      }
    }
    u.cd = Math.max(0, u.cd - dt);
    const p = u.puntual ?? u.target;
    if (u.cd > 1e-9 || !p) continue;
    u.puntual = null;
    const distancia = Math.hypot(p.x - u.position.x, p.y - u.position.y);
    if (distancia > d.alcance || !u.missiles) continue;
    u.missiles--; u.cd = 1 / d.cadencia;
    campo.proyectiles.push({ id: 'v2-' + ++campo.secuencia, de: u.id, t0: campo.t,
      arco: 0, dur: Math.max(dt, distancia / d.misil.vel), x0: u.position.x, y0: u.position.y, z0: .6,
      x1: p.x, y1: p.y, z1: p.z ?? 0, radio: d.misil.radio, dano: d.misil.dano });
  }
  campo.proyectiles = campo.proyectiles.filter(p => {
    if (campo.t + 1e-9 < p.t0 + p.dur) return true;
    campo.impactos.push(p);
    for (const e of campo.hostiles)
      if (Math.hypot(e.x - p.x1, e.y - p.y1) <= p.radio) { e.hp -= p.dano; e.golpeT = campo.t; }
    campo.hostiles = campo.hostiles.filter(e => e.hp > 0);
    return false;
  });
}
