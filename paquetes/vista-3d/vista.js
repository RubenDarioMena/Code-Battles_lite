import { crearEfectosWar } from './efectos-war.js';
import { crear3D } from './war.js';
import { crearCampaign3D } from './campaign.js';

/** @param {HTMLElement} contenedor
 * @param {import('./index.js').OpcionesVista3D} opciones
 * @returns {import('./index.js').VistaCreada3D | null} */
export function crearVista(contenedor, opciones) {
  const externo = opciones.estado;
  let actual = null, dibujando = false, destruida = false;
  const estado = {
    get escena() { return dibujando ? actual : externo?.escena ?? actual; },
    get seleccion() { return externo?.seleccion ?? null; },
    get seleccionadas() { return externo?.seleccionadas ?? new Set(); },
    get arrastreCampo() { return externo?.arrastreCampo ?? null; },
    get cols() { return externo?.cols ?? opciones.cols; },
    get rows() { return externo?.rows ?? opciones.rows; },
    get col() { return externo?.col ?? opciones.tema; },
    /** @returns {{calidad: import('../vfx/index.js').Calidad, sinDestellos?: boolean}} */
    get efectos() { return externo?.efectos ?? { calidad: opciones.calidad ?? 'alto' }; },
    get medicionEfectos() { return externo?.medicionEfectos; },
  };
  let efectos = null;
  /** @type {any} */
  const deps = { ...opciones, montarEfectos: opciones.serie === 'war' ? datos => {
    efectos = crearEfectosWar(estado, opciones); efectos.montar(datos);
  } : undefined, ES_FACTORY: opciones.serie === 'factory',
    $: id => id === 'c3d' ? (opciones.canvas ?? contenedor.querySelector('canvas')) : opciones.$(id) };
  const base = opciones.serie === 'campaign' ? crearCampaign3D(estado, deps) : crear3D(estado, deps);
  if (!base) return null;
  return {
    ...base,
    dibujar(anterior, escena, fraccion, ahora = performance.now()) {
      if (destruida) return;
      actual = escena; dibujando = true;
      try { base.actualizar(fraccion * opciones.dt, ahora); efectos?.dibujar(fraccion * opciones.dt); base.render(); }
      finally { dibujando = false; }
    },
    alSuceso(s) { if (!destruida) efectos?.alSuceso(s); },
    vaciar() { efectos?.vaciar(); },
    tamano(w, h) { base.tamano(w, h); efectos?.redimensionar(); },
    elegir(x, y) { const r = contenedor.getBoundingClientRect(); return base.elegir(x, y, r.width, r.height); },
    proyectar(x, alto, y) { const r = contenedor.getBoundingClientRect(); return base.proyectar(x, alto, y, r.width, r.height); },
    suelo(x, y) { const r = contenedor.getBoundingClientRect(); return base.suelo(x, y, r.width, r.height); },
    redimensionar() { const r = contenedor.getBoundingClientRect(); if (r.width && r.height) { base.tamano(r.width, r.height); efectos?.redimensionar(); } },
    destruir() { if (destruida) return; destruida = true; efectos?.destruir(); base.destruir(); actual = null; },
  };
}
