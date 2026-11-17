import { crearEfectos, crearRecetasWar, recetaWar } from '../vfx/index.js';
import { crearDibujanteEfectos } from './efectos.js';

/** @param {any} estado @param {any} opciones */
export function crearEfectosWar(estado, { dt, MISIL, calidad = 'alto', crearLienzo }) {
  const efectos = crearEfectos({ dt, recetas: crearRecetasWar({ radioDanio: MISIL.radio }), recetaDe: recetaWar });
  const origenes = crearOrigenes(dt);
  let dibujante = null, escala = null;
  const vaciar = () => { efectos.vaciar(); origenes.vaciar(); };
  return {
    alSuceso(s) { origenes.completar(s, estado.escena, efectos.anotar); },
    dibujar(ctx, off) {
      const escena = estado.escena, g = estado.geo2;
      origenes.resolver(escena, efectos.anotar);
      origenes.recordar(escena, off);
      if (!escala || g.T !== escala.T || g.ox !== escala.ox || g.oy !== escala.oy) {
        dibujante?.destruir();
        dibujante = crearDibujanteEfectos({ ...g, crearLienzo }); escala = { ...g };
      }
      const particulas = efectos.particulas(escena.t + off, { colores: estado.col, calidad });
      if (particulas.length) dibujante.dibujar(ctx, particulas);
    },
    vaciar,
    destruir() { vaciar(); dibujante?.destruir(); dibujante = null; },
  };
}

// Solo conserva posiciones visuales, nunca entidades ni referencias al mundo.
function crearOrigenes(dt) {
  const enemigos = new Map();
  let pendientes = [];
  const posicion = e => [e.cx ?? e.x, e.cy ?? e.y, e.z ?? 0];
  return {
    recordar(escena, off) {
      for (const e of escena.enemigos || []) enemigos.set(e.id,
        [e.x + (e.vx || 0) * off, e.y + (e.vy || 0) * off, e.z || 0]);
    },
    completar(s, escena, anotar) {
      if (!recetaWar(s)) return;
      const datos = { ...s.datos };
      const l = escena?.lanzadores?.find(e => e.id === s.unidad);
      if (s.tipo === 'disparo' || s.tipo === 'atasco' || s.tipo === 'reparado') {
        if (!l) return;
        datos.origen = [l.cx, l.cy, s.tipo === 'reparado' ? 0 : 1];
        if (s.tipo === 'disparo') datos.rumbo = Math.atan2(Number(datos.y) - l.cy, Number(datos.x) - l.cx);
        else datos.rumbo = l.yaw || 0;
      } else if (s.tipo === 'derribo') {
        const e = enemigos.get(s.unidad) || escena?.enemigos?.find(e => e.id === s.unidad);
        if (e) datos.origen = Array.isArray(e) ? [...e] : posicion(e);
        else { pendientes.push({ ...s, datos }); return; }
      } else if (s.tipo === 'brecha') datos.origen = [datos.x, datos.y, 0];
      if (s.tipo === 'explosion') {
        // El derribo precede a su explosión: el primer estallido posterior del
        // mismo paso y lanzador es el que lo causó, incluso con varios misiles.
        pendientes = pendientes.filter(p => {
          if (p.paso !== s.paso || p.datos.por !== s.unidad) return true;
          anotar({ ...p, datos: { ...p.datos, origen: [datos.x, datos.y, datos.z || 0] } });
          return false;
        });
      }
      anotar({ ...s, datos });
    },
    resolver(escena, anotar) {
      for (const p of pendientes) {
        const x = escena.explosiones?.find(x => !x.atasco && Math.abs(x.t0 - p.paso * dt) < 1e-7);
        if (x) anotar({ ...p, datos: { ...p.datos, origen: [x.x, x.y, x.z || 0] } });
      }
      pendientes = [];
    },
    vaciar() { enemigos.clear(); pendientes = []; },
  };
}
