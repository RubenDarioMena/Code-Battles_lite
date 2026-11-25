/** @param {any} cmg @param {any} servicios @param {import("../index.js").Plataforma["almacen"]} [almacen] */
export function instalarRevisionJuego(cmg, servicios, almacen = undefined) {
  const dom = /** @type {any} */ (document);
/* Modo revisión dentro del juego (War, JavaScript).
 *
 * Los binoculares (en la barra del mapa y en el menú ⋯ del teléfono) abren el modo revisión con el código que
 * hay ahora en el editor: no hace falta haberlo ejecutado. Es un recorrido de lectura (CMGRevision, modo
 * «lectura»): fila a fila, qué hace el programa en lenguaje de personas. Primero se entiende el código;
 * después, la partida (y en ella, los pulsos del editor: paquetes/app/juego/pulsos.js).
 * JavaScript y Python (lector de lezer: motor/python.js). Tapa el juego. La montaña vuelve al mapa y </> al editor.
 * El motor del modo revisión se carga la primera vez que se abre (trazador.js y flujo.js ya están cargados:
 * los usan los pulsos). */
  const $ = (id) => dom.getElementById(id);
  const app = $("app"), boton = $("b-revisar");
  const ti = (k, p) => servicios.CMGI18n ? servicios.CMGI18n.t(k, p) : k;
  const R = () => cmg.revision;
  let caja = null, vista = null, aviso = null;
  let tAviso;

  function avisar(texto) {
    if (!aviso) { aviso = dom.createElement("div"); aviso.className = "rj-aviso"; aviso.setAttribute("role", "status"); dom.body.append(aviso); }
    aviso.textContent = texto; aviso.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(() => { aviso.hidden = true; }, 3600);
  }

  async function abrir() {
    const r = R();
    if (!r) return;
    const todos = r.programas();
    let motor;
    try { motor = await servicios.cargarRevision(); }
    catch (e) { return avisar(ti("juego.revision.error", { m: e.message })); }
    // Solo se lee el programa (acorn para JavaScript, lezer para Python): nada se ejecuta.
    const programas = {};
    for (const p of todos) {
      try {
        if (p.lenguaje === "python") programas[p.id] = motor.python.leer(p.texto, { nombre: motor.catalogo.desdePython });
        else {
          const x = motor.trazador.instrumentar(p.texto, { acorn: servicios.acorn });
          programas[p.id] = { lenguaje: "js", fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios, eventos: [] };
        }
      } catch (e) {
        return avisar(ti("juego.revision.sintaxis", { id: p.id, l: e.loc ? e.loc.line : "?", m: String(e.message).replace(/\s*\(\d+:\d+\)$/, "").replace(/\s*\(\d+\)$/, "") }));
      }
    }
    cerrar();
    if (!caja) { caja = dom.createElement("div"); caja.id = "revision-juego"; caja.className = "revision-juego"; dom.body.append(caja); }
    caja.hidden = false;
    app.dataset.revision = "";
    const G = { formato: 2, serie: r.serie, reto: r.reto, titulo: r.titulo, programas };
    vista = motor.revision.montar(caja, G, { modo: "lectura", almacen, programa: r.seleccionado, alMapa: () => salir("mapa"), alCodigo: () => salir("codigo") });
    
  }

  function cerrar() {
    if (vista) { vista.destruir(); vista = null; }
    if (caja) caja.hidden = true;
    delete app.dataset.revision;
    
  }
  function salir(panel) {
    cerrar();
    app.dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
  }

  if (boton) boton.addEventListener("click", abrir);
  return { abrir, cerrar, get abierta() { return !!vista; }, get vista() { return vista; } };
}
