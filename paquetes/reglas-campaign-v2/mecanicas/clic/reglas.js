// Autocontenida para inyectar la misma predicción en la API del programa.
export function lugarDeObjetivo(objetivo, tiro, evento = 'enemies.onClick') {
  if (evento !== 'enemies.onClick' || !objetivo || !tiro || !Object.hasOwn(tiro.alturas, objetivo.type) ||
      !Number.isFinite(objetivo.vx) || !Number.isFinite(objetivo.vy)) return objetivo;
  const espera = Math.max(0, tiro.cd);
  let t = espera, x, y;
  for (let i = 0; i < 4; i++) {
    x = objetivo.x + objetivo.vx * t;
    y = objetivo.y + objetivo.vy * t;
    t = espera + Math.hypot(x - tiro.cx, y - tiro.cy) / tiro.vel;
  }
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: tiro.alturas[objetivo.type], id: objetivo.id };
}

export function repartirClic(unidades, punto, enemigo, escucha, forzar = false) {
  const datos = enemigo && { id: enemigo.id, type: enemigo.tipo, x: enemigo.x, y: enemigo.y,
    hp: enemigo.hp, vx: enemigo.vx, vy: enemigo.vy };
  return Array.from(unidades, unidad => {
    const evento = !forzar && (datos && escucha(unidad, 'enemies.onClick') ? 'enemies.onClick' :
      escucha(unidad, 'terrain.onClick') && 'terrain.onClick');
    return { tipo: 'orden', unidad, verbo: evento ? 'clicProgramado' : 'intentoPuntual',
      args: evento ? [evento, evento === 'enemies.onClick' ? datos : punto] : [datos || punto] };
  });
}
