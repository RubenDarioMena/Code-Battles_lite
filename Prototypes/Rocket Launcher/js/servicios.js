// Three ESM local; los clásicos restantes se capturan tras sus scripts ordenados.
import * as THREE from '../../../shared/vendor/three-r180/three.module.min.js';

// Solo Factory solicita el cargador. El namespace ESM de Three nunca se modifica.
const cargarGLTFLoader = () => import('../../../shared/vendor/three-r180/loaders/GLTFLoader.js')
  .then(modulo => modulo.GLTFLoader);
export const servicios = {
  CMGI18n: window.CMGI18n, CMGPresentacion: window.CMGPresentacion,
  CMGTerreno: window.CMGTerreno, CMGTrazador: window.CMGTrazador,
  CMGFlujo: window.CMGFlujo, CMGPythonRevision: window.CMGPythonRevision,
  THREE, cargarGLTFLoader, acorn: window.acorn, LezerPython: window.LezerPython,
  // ?editor=textarea deja el motor anterior para comparar; si no, el editor usa CodeMirror local.
  CMGCodeMirror: /[?&]editor=textarea(&|$)/.test(window.location?.search || '') ? null : window.CMGCodeMirror,
  cargarRevision,
};
let cargaRevision = null;

// Conserva la carga diferida y su orden. Los globales nuevos se leen una vez, al acabar.
function cargarRevision() {
  if (cargaRevision) return cargaRevision;
  const base = "../../educational-animation/revision/";
  const motor = [["textos", null], ["trazador", servicios.CMGTrazador], ["catalogo", null],
    ["flujo", servicios.CMGFlujo], ["python", servicios.CMGPythonRevision],
    ["explicar", null], ["documentacion", null], ["revision", null]];
  cargaRevision = (async () => {
    if (!document.querySelector("link[data-revision]")) {
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = base + "motor/revision.css"; l.dataset.revision = "";
      document.head.append(l);
    }
    for (const [archivo, existente] of motor) {
      if (existente) continue;
      await new Promise((ok, mal) => {
        const s = document.createElement("script"); s.src = base + "motor/" + archivo + ".js";
        s.onload = ok; s.onerror = () => mal(new Error("motor/" + archivo + ".js"));
        document.head.append(s);
      });
    }
    return { catalogo: window.CMGCatalogoRevision, revision: window.CMGRevision,
      // Si un clásico falló al arrancar, conserva la recuperación diferida que ya ofrecía revisión.
      trazador: servicios.CMGTrazador || window.CMGTrazador,
      python: servicios.CMGPythonRevision || window.CMGPythonRevision };
  })();
  cargaRevision.catch(() => { cargaRevision = null; });
  return cargaRevision;
}

// El aviso de fallo sigue funcionando aunque falle el grafo de imports del juego.
// El HTML solo publica el aviso; su presentación usa la misma dependencia capturada.
addEventListener("cmg:error-arranque", evento => {
  const detalle = /** @type {CustomEvent} */ (evento).detail;
  if (servicios.CMGPresentacion) detalle.html = servicios.CMGPresentacion.html(detalle.html);
});
