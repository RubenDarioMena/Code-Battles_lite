/* Modo revisión dentro del juego (War, JavaScript).
 *
 * Los binoculares (en la barra del mapa y en el menú ⋯ del teléfono) abren el modo revisión con el código que
 * hay ahora en el editor: no hace falta haberlo ejecutado. Es un recorrido de lectura (CMGRevision, modo
 * «lectura»): fila a fila, qué hace el programa en lenguaje de personas. Primero se entiende el código;
 * después, la partida (y en ella, los pulsos del editor: js/pulsos.js).
 * JavaScript y Python (lector de lezer: motor/python.js). Tapa el juego. La montaña vuelve al mapa y </> al editor.
 * El motor del modo revisión se carga la primera vez que se abre (trazador.js y flujo.js ya están cargados:
 * los usan los pulsos). */
(() => {
  "use strict";
  const BASE = "../../educational-animation/revision/";
  // Versión de los archivos del motor: súbela al cambiarlos para que el navegador no use los de la caché.
  const V = "?v=4";
  // [archivo, global]: con global, no se vuelve a cargar si ya está (trazador y flujo los carga el juego para
  // los pulsos). El catálogo del modo revisión es CMGCatalogoRevision: CMGCatalogo es el de la paleta del editor.
  const MOTOR = [["motor/textos.js", null], ["motor/trazador.js", "CMGTrazador"], ["motor/catalogo.js", null], ["motor/flujo.js", "CMGFlujo"], ["motor/python.js", "CMGPythonRevision"],
    ["motor/explicar.js", null], ["motor/documentacion.js", null], ["motor/revision.js", null]];
  const $ = (id) => document.getElementById(id);
  const app = $("app"), boton = $("b-revisar");
  const ti = (k, p) => window.CMGI18n ? window.CMGI18n.t(k, p) : k;
  const R = () => window.cmg && window.cmg.revision;
  let carga = null, caja = null, vista = null, aviso = null;

  function cargar() {
    if (carga) return carga;
    carga = (async () => {
      if (!document.querySelector("link[data-revision]")) {
        const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BASE + "motor/revision.css" + V; l.dataset.revision = "";
        document.head.append(l);
      }
      for (const [f, global] of MOTOR) {
        if (global && window[global]) continue;
        await new Promise((ok, mal) => {
          const s = document.createElement("script"); s.src = BASE + f + V; s.onload = ok; s.onerror = () => mal(new Error(f));
          document.head.append(s);
        });
      }
    })();
    carga.catch(() => { carga = null; });
    return carga;
  }

  function avisar(texto) {
    if (!aviso) { aviso = document.createElement("div"); aviso.className = "rj-aviso"; aviso.setAttribute("role", "status"); document.body.append(aviso); }
    aviso.textContent = texto; aviso.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => { aviso.hidden = true; }, 3600);
  }

  async function abrir() {
    const r = R();
    if (!r) return;
    if (r.serie === "factory") return avisar(ti("juego.revision.factory"));
    const todos = r.programas();
    try { await cargar(); }
    catch (e) { return avisar(ti("juego.revision.error", { m: e.message })); }
    // Solo se lee el programa (acorn para JavaScript, lezer para Python): nada se ejecuta.
    const programas = {};
    for (const p of todos) {
      try {
        if (p.lenguaje === "python") programas[p.id] = window.CMGPythonRevision.leer(p.texto, { nombre: window.CMGCatalogoRevision.desdePython });
        else {
          const x = window.CMGTrazador.instrumentar(p.texto, { acorn });
          programas[p.id] = { lenguaje: "js", fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios, eventos: [] };
        }
      } catch (e) {
        return avisar(ti("juego.revision.sintaxis", { id: p.id, l: e.loc ? e.loc.line : "?", m: String(e.message).replace(/\s*\(\d+:\d+\)$/, "").replace(/\s*\(\d+\)$/, "") }));
      }
    }
    cerrar();
    if (!caja) { caja = document.createElement("div"); caja.id = "revision-juego"; caja.className = "revision-juego"; document.body.append(caja); }
    caja.hidden = false;
    app.dataset.revision = "";
    const G = { formato: 2, serie: "war", reto: r.reto, titulo: r.titulo, programas };
    vista = window.CMGRevision.montar(caja, G, { modo: "lectura", programa: r.seleccionado, alMapa: () => salir("mapa"), alCodigo: () => salir("codigo") });
    window.__revisionJuego = { vista };
  }

  function cerrar() {
    if (vista) { vista.destruir(); vista = null; }
    if (caja) caja.hidden = true;
    delete app.dataset.revision;
    window.__revisionJuego = null;
  }
  function salir(panel) {
    cerrar();
    app.dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
  }

  if (boton) boton.addEventListener("click", abrir);
  window.CMGRevisionJuego = { abrir, cerrar, get abierta() { return !!vista; } };
})();
