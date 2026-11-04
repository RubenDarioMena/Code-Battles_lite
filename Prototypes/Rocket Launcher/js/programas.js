/* Aplicación del borrador a varias unidades. Es integración del juego, fuera del editor. */
(() => {
  "use strict";
  function crearAplicador({ estado, confirmarReemplazo, alAplicar }) {
    let aplicando = false;
    return async function aplicarMulti(reemplazar) {
      const actual = estado();
      if (actual.ejec || !actual.edicion.mixto || aplicando) return;
      const ids = [...actual.edicion.ids], nuevo = actual.texto, destino = actual.programas;
      aplicando = true;
      try {
        if (reemplazar && !await confirmarReemplazo(ids)) return;
        const vigente = estado();
        if (vigente.ejec || vigente.programas !== destino) return;
        for (const id of ids) {
          const anterior = destino[id];
          destino[id] = reemplazar ? nuevo : anterior + (anterior && nuevo && !anterior.endsWith("\n") ? "\n" : "") + nuevo;
        }
        alAplicar(ids);
      } finally { aplicando = false; }
    };
  }
  window.CMGProgramas = { crearAplicador };
})();
