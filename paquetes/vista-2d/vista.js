import { crearEfectosWar } from './efectos-war.js';
import { crearPlano } from './war.js';
import { crearPlanoCampaign } from './campaign.js';

/** Fachada común; la geometría y la escena dibujada pertenecen al plano.
 * @param {HTMLCanvasElement} contenedor
 * @param {import('./index.js').OpcionesVista2D} opciones
 * @returns {import('./index.js').Vista2D} */
export function crearVista(contenedor, opciones) {
  const externo = opciones.estado;
  let actual = null, dibujando = false, destruida = false;
  let geo2 = { T: 10, ox: 0, oy: 0 };
  const estado = {
    get escena() { return dibujando ? actual : externo?.escena ?? actual; },
    get seleccion() { return externo?.seleccion ?? null; },
    get seleccionadas() { return externo?.seleccionadas ?? new Set(); },
    get arrastreCampo() { return externo?.arrastreCampo ?? null; },
    get cols() { return externo?.cols ?? opciones.cols; },
    get rows() { return externo?.rows ?? opciones.rows; },
    get col() { return externo?.col ?? opciones.tema; },
    get geo2() { return geo2; }, set geo2(g) { geo2 = g; },
  };
  const efectos = opciones.serie === 'war' ? crearEfectosWar(estado, opciones) : null;
  /** @type {any} */
  const deps = { ...opciones, ES_FACTORY: opciones.serie === 'factory',
    dibujarEfectos: (ctx, off) => efectos?.dibujar(ctx, off),
    $c2d: contenedor, ctx2: contenedor.getContext('2d') };
  const dibujarPlano = opciones.serie === 'campaign'
    ? crearPlanoCampaign(estado, deps) : crearPlano(estado, deps);
  return {
    dibujar(anterior, escena, fraccion, ahora) {
      if (destruida) return;
      actual = escena; dibujando = true;
      try { dibujarPlano(fraccion * opciones.dt, ahora); }
      finally { dibujando = false; }
    },
    alSuceso(s) { if (!destruida) efectos?.alSuceso(s); },
    vaciar() { efectos?.vaciar(); },
    elegir(px, py) {
      const x = (px - geo2.ox) / geo2.T, y = (py - geo2.oy) / geo2.T;
      let mejor = null, dm = .9;
      const escena = estado.escena;
      // Factory publica las mismas unidades como robot + entidades, en ese orden.
      const maquinas = escena?.maquinas ?? (opciones.serie === 'factory' && escena ? [escena.robot, ...escena.entidades] : []);
      for (const e of [...maquinas, ...(escena?.enemigos ?? [])]) {
        const d = Math.hypot((e.cx ?? e.x) - x, (e.cy ?? e.y) - y);
        if (d < dm) { dm = d; mejor = e.id; }
      }
      return mejor;
    },
    proyectar(x, alto, y, radioPlano = 0) {
      return { x: geo2.ox + x * geo2.T, y: geo2.oy + (y - radioPlano) * geo2.T, visible: true };
    },
    suelo(px, py) { return { x: (px - geo2.ox) / geo2.T, y: (py - geo2.oy) / geo2.T, z: 0 }; },
    // El plano ajusta su lienzo y geometría al dibujar, como antes.
    redimensionar() {},
    destruir() { if (destruida) return; destruida = true; efectos?.destruir(); (/** @type {any} */ (dibujarPlano)).destruir?.(); actual = null; },
  };
}
