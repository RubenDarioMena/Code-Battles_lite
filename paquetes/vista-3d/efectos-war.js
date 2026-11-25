import { crearEfectos, crearRecetasWar, recetaWar } from '../vfx/index.js';
import { crearDibujanteEfectos } from './efectos.js';

/** @param {any} estado @param {any} opciones */
export function crearEfectosWar(estado, { dt, MISIL, alturaLanzador = undefined }) {
  const efectos = crearEfectos({ dt, recetas: crearRecetasWar({ radioDanio: MISIL.radio }), recetaDe: recetaWar });
  const origenes = crearOrigenes(dt, alturaLanzador);
  let dibujante = null, renderer, camara, grupo;
  function redimensionar() {
    if (!dibujante) return;
    // El canvas contiene el tamaño físico real tras setSize/setPixelRatio.
    dibujante.redimensionar({ alturaCss: renderer.domElement.height, pixelRatio: 1, fov: camara.fov });
  }
  function vaciar() { efectos.vaciar(); origenes.vaciar(); dibujante?.dibujar([]); }
  return {
    montar(datos) {
      ({ renderer, camara } = datos);
      grupo = new datos.THREE.Group(); datos.escena.add(grupo);
      const gl = renderer.getContext();
      dibujante = crearDibujanteEfectos(datos.THREE, grupo, {
        alturaBufer: renderer.domElement.height, fov: camara.fov,
        maxPunto: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
      });
    },
    alSuceso(s) { origenes.completar(s, estado.escena, efectos.anotar); },
    dibujar(off) {
      const escena = estado.escena;
      origenes.resolver(escena, efectos.anotar);
      origenes.recordar(escena, off);
      redimensionar();
      const medida = estado.medicionEfectos, inicio = medida?.ahora();
      const particulas = efectos.particulas(escena.t + off, { colores: estado.col, ...estado.efectos });
      const evaluadas = medida?.ahora();
      dibujante?.dibujar(particulas);
      if (medida) medida.registrar({ vista: '3d', vivas: particulas.length,
        particulasMs: evaluadas - inicio, dibujarMs: medida.ahora() - evaluadas });
    },
    redimensionar, vaciar,
    destruir() { vaciar(); dibujante?.destruir(); grupo?.parent?.remove(grupo); dibujante = null; },
  };
}

// Solo conserva posiciones visuales, nunca entidades ni referencias al mundo.
function crearOrigenes(dt, alturaLanzador) {
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
        datos.origen = [l.cx, l.cy, (alturaLanzador?.(l) ?? 0) + (s.tipo === 'reparado' ? 0 : 1)];
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
