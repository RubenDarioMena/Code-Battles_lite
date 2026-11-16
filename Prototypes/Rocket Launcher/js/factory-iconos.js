/* Iconos de la paleta de Factory (recoger, entregar). Antes al final de js/factory-vista.js, que pasó a
 * paquetes/vista-2d (fase 2). Se registran al cargar, como antes. */
(() => {
  "use strict";
  const svg = cuerpo => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
  const caja = `<path class="s1" stroke-width="2" stroke-linejoin="round" d="M5 15l11-5 11 5v12H5zM5 15l11 5 11-5M16 20v7"/>`;
  window.ICONOS.recoger = { c1: "#7FA3FF", c2: "#E2894F", svg: svg(`${caja}<path class="s2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M16 3v11m-4-4l4 4 4-4"/>`) };
  window.ICONOS.entregar = { c1: "#7FA3FF", c2: "#5FC28A", svg: svg(`${caja}<path class="s2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M16 14V3m-4 4l4-4 4 4"/>`) };
})();
