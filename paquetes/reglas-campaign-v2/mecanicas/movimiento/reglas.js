export { ficha } from './ficha.js';

// Autocontenida: el intérprete y el mundo validan y construyen la misma ruta en metros.
export function ordenarMovimiento(u, verbo, lugar, campo) {
  if (verbo === 'stop') {
    u.ruta = []; u.moving = false; u.resultado = 'detenida'; u.viaje++;
    return 'ok';
  }
  if (!Number.isFinite(lugar?.x) || !Number.isFinite(lugar?.y)) return 'sin_objetivo';
  const destino = { x: Math.max(campo.x0, Math.min(campo.x1, lugar.x)),
    y: Math.max(campo.y0, Math.min(campo.y1, lugar.y)) };
  const cruza = (u.position.x < campo.muro) !== (destino.x < campo.muro);
  const ruta = [];
  if (cruza) {
    if (!campo.puertas.length) return 'sin_puerta';
    const distancia = y => Math.hypot(campo.muro - u.position.x, y - u.position.y) + Math.hypot(destino.x - campo.muro, destino.y - y);
    const y = campo.puertas.reduce((a, b) => distancia(b) < distancia(a) ? b : a);
    ruta.push({ x: campo.muro, y });
  }
  ruta.push(destino);
  u.ruta = ruta; u.moving = true; u.viaje++; u.resultado = 'ok';
  return 'ok';
}

export function orden(campo, u, verbo, lugar) {
  if (!u.capacidades.includes('movimiento') || !['moveTo', 'stop'].includes(verbo)) return false;
  const viaje = u.viaje, anterior = u.moving;
  if (ordenarMovimiento(u, verbo, lugar, campo.limites) === 'ok' && anterior)
    campo.eventos.push({ unidad: u.id, evento: 'finMovimiento', datos: { viaje, resultado: verbo === 'stop' ? 'detenida' : 'redirigida' } });
  return true;
}

export function paso(campo, dt) {
  for (const u of Object.values(campo.aliados)) {
    if (!u?.moving) continue;
    let avance = u.def.vel * dt;
    while (u.ruta.length) {
      const punto = u.ruta[0], dx = punto.x - u.position.x, dy = punto.y - u.position.y;
      const d = Math.hypot(dx, dy);
      if (d > avance + 1e-9) {
        u.position.x += dx * avance / d; u.position.y += dy * avance / d;
        break;
      }
      u.position = u.ruta.shift(); avance = Math.max(0, avance - d);
    }
    if (!u.ruta.length) {
      u.moving = false;
      campo.eventos.push({ unidad: u.id, evento: 'finMovimiento', datos: { viaje: u.viaje, resultado: 'ok' } },
        { unidad: u.id, evento: 'onArrive', datos: { ...u.position } });
    }
  }
}

// Se inyecta junto a ordenarMovimiento en la API de cada programa móvil.
function apiMovimiento(estado, limites, ordenar, emitir, esperarEvento, Promise) {
  function modo(verbo, lugar) {
    const u = estado();
    const res = ordenar(u, verbo, lugar, limites());
    if (res === 'ok') emitir(verbo, lugar, res);
    return res;
  }
  return {
    moveTo: lugar => modo('moveTo', lugar),
    stop: () => modo('stop', null),
    arrive() {
      const u = estado();
      return u.moving ? esperarEvento('finMovimiento', 'viaje', u.viaje) : Promise.resolve(u.resultado);
    },
  };
}

export const programa = { api: apiMovimiento, ordenar: ordenarMovimiento };
