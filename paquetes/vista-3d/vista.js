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
  };
  /** @type {any} */
  const deps = { ...opciones, ES_FACTORY: opciones.serie === 'factory',
    $: id => id === 'c3d' ? (opciones.canvas ?? contenedor.querySelector('canvas')) : opciones.$(id) };
  const base = opciones.serie === 'campaign' ? crearCampaign3D(estado, deps) : crear3D(estado, deps);
  if (!base) return null;
  return {
    ...base,
    dibujar(anterior, escena, fraccion, ahora = performance.now()) {
      if (destruida) return;
      actual = escena; dibujando = true;
      try { base.actualizar(fraccion * opciones.dt, ahora); base.render(); }
      finally { dibujando = false; }
    },
    alSuceso() {},
    elegir(x, y) { const r = contenedor.getBoundingClientRect(); return base.elegir(x, y, r.width, r.height); },
    proyectar(x, alto, y) { const r = contenedor.getBoundingClientRect(); return base.proyectar(x, alto, y, r.width, r.height); },
    suelo(x, y) { const r = contenedor.getBoundingClientRect(); return base.suelo(x, y, r.width, r.height); },
    redimensionar() { const r = contenedor.getBoundingClientRect(); if (r.width && r.height) base.tamano(r.width, r.height); },
    destruir() { if (destruida) return; destruida = true; base.destruir(); actual = null; },
  };
}
