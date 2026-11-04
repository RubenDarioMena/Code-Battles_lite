/* Atajos JavaScript de la paleta común: salen del catálogo único (catalogo.js). Cada llamada crea una lista independiente. */
(() => {
  "use strict";
  function crear({ pausa = "" } = {}) {
    return { atajos: window.CMGCatalogo.atajos("js", { pausa }), textoAtajo: window.CMGCatalogo.textoAtajo };
  }
  window.CMGPlantillasJS = { crear };
})();
