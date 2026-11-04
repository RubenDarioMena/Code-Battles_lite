/* Instancia reutilizable. El anfitrión aporta documentos y datos, nunca ejecución. */
(() => {
  "use strict";
  let secuencia = 0;
  const ICONO_PANTALLA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const plantilla = `
    <div class="editor-herramientas">
      <span class="modos-codigo" role="group" aria-label="Vista del programa">
        <button class="mini" type="button" data-modo-codigo="js" aria-pressed="true" data-tip="JavaScript">JS</button>
        <button class="mini" type="button" data-modo-codigo="pseudo" aria-pressed="false" data-tip="Seudocódigo">Seudo</button>
      </span>
      <button class="mini b-teclado" id="b-teclado" type="button" aria-pressed="false" aria-label="Modo sin teclado" data-tip="Modo sin teclado"></button>
      <button class="mini" type="button" id="b-menos" aria-label="Letra más pequeña" data-tip="Letra más pequeña">A−</button>
      <button class="mini" type="button" id="b-mas" aria-label="Letra más grande" data-tip="Letra más grande">A+</button>
      <button class="mini" type="button" id="b-ajustes" aria-haspopup="dialog" aria-label="Ajustes del editor" data-tip="Ajustes del editor">⚙</button>
      <button class="mini b-pantalla" type="button" id="b-pantalla" aria-pressed="false" aria-label="Pantalla completa" data-tip="Pantalla completa">${ICONO_PANTALLA}</button>
    </div>
    <div class="paleta" id="paleta" role="toolbar" aria-label="Insertar código"></div>
    <div class="paleta paleta-seudo" id="paleta-seudo" role="toolbar" aria-label="Seudocódigo" hidden></div>
    <div class="barra-edicion" id="edicion" role="toolbar" aria-label="Edición"></div>
    <div class="aviso" id="aviso" role="status" hidden></div>
    <div class="prog prog-seudo" id="prog" hidden></div>
    <div class="editor colores" id="editor">
      <div class="gutter"><div class="gutter-in" id="gutter"></div></div>
      <div class="area" id="area">
        <div class="espejo" id="espejo" aria-hidden="true"></div>
        <div class="banda" id="banda"></div><pre class="resaltado" id="resaltado" aria-hidden="true"></pre>
        <textarea id="codigo" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Código JavaScript"></textarea>
        <div class="bloques" id="bloques" tabindex="0" role="group" aria-label="Código sin teclado" hidden>
          <div class="bloques-in" id="bloques-in"><div class="bloques-capa" id="bloques-capa" aria-hidden="true"></div><div class="bloques-texto" id="bloques-texto"></div></div>
        </div>
      </div>
      <div class="asas" id="asas" hidden><div class="asas-in" id="asas-in"></div></div>
    </div>
    <div class="simbolos" id="simbolos" role="toolbar" aria-label="Símbolos"></div>
    <dialog id="ajustes" class="ajustes-editor" aria-label="Ajustes del editor">
      <h2>Ajustes del editor</h2>
      <label>Asa de líneas <select id="ajustes-asa"><option value="numero">Número</option><option value="borde">Borde</option></select></label>
      <button id="ajustes-orden-barra" type="button" aria-haspopup="dialog">Ordenar botones y grupos…</button>
      <button id="ajustes-cerrar" type="button">Cerrar</button>
    </dialog>
    <dialog id="orden-barra" class="orden-barra"><button id="orden-cerrar" type="button">Cerrar</button><div id="orden-grupos" class="orden-grupos"></div><button id="orden-restaurar" type="button">Restaurar orden</button></dialog>`;
  const TAMANOS = [12, 13, 14, 16, 18];
  // El criterio del juego (ventana estrecha o tableta en vertical), más el teléfono en horizontal,
  // que en el juego queda como PC, y un hueco muy estrecho para el editor aunque la ventana sea grande.
  const formaPorAncho = ancho => {
    const w = innerWidth, h = innerHeight, tactil = matchMedia("(pointer: coarse)").matches;
    return w < 760 || (w < 1000 && h > w) || (tactil && Math.min(w, h) < 500) || ancho < 340 ? "movil" : "escritorio";
  };

  function crear(opciones) {
    const { raiz, proveedor = {}, alCambiar = () => {}, alAviso } = opciones;
    if (!raiz || raiz.dataset.cmgEditor) throw Error("La raíz del editor debe estar libre.");
    const adaptadores = opciones.adaptadores || { js: window.CMGAdaptadorJS };
    const adaptador = adaptadores[opciones.documento?.lenguaje || "js"];
    if (!adaptador) throw Error("Lenguaje del documento no disponible.");
    const uid = "cmg-editor-" + ++secuencia, nodos = new Map(), propios = [], reemplazos = [];
    raiz.dataset.cmgEditor = uid; raiz.classList.add("cmg-editor");
    const ambito = opciones.ambito || raiz;
    const temporal = document.createElement("template"); temporal.innerHTML = plantilla;
    if (opciones.adoptar) {
      // La integración conserva los IDs públicos y los controles externos del juego.
      // Se crea el marcado del editor, trasladando los nodos del anfitrión con sus oyentes.
      for (const id of ["paleta", "paleta-seudo", "edicion", "aviso", "prog", "editor"]) {
        const viejo = opciones.elemento(id), nuevo = temporal.content.querySelector('[id="' + id + '"]');
        if (!viejo || !nuevo) throw Error("Falta el elemento de integración " + id);
        if (id === "editor") {
          nuevo.className = viejo.className;
          for (const extra of [...viejo.children].filter(n => !n.matches(".gutter,.area,.asas"))) nuevo.append(extra);
        }
        viejo.replaceWith(nuevo); reemplazos.push([viejo, nuevo]);
      }
      for (const n of ambito.querySelectorAll("[id]")) nodos.set(n.id, n);
      for (const n of raiz.querySelectorAll("[id]")) n.dataset.editor = n.id;
    } else {
      raiz.dataset.autonomo = "true";
      const fragmento = temporal.content;
      for (const n of fragmento.querySelectorAll("[id]")) {
        const id = n.id; n.dataset.editor = id; n.id = uid + "-" + id; nodos.set(id, n);
      }
      propios.push(...fragmento.childNodes); raiz.append(fragmento);
    }
    const $ = id => id === "app" ? (opciones.app || raiz) : nodos.get(id) || opciones.elemento?.(id);
    // El anfitrión lleva data-forma, data-modo y data-sin-teclado; las reglas compartidas de CSS lo buscan por esta clase.
    const anfitrion = $("app"), anfitrionNuevo = !anfitrion.classList.contains("cmg-anfitrion");
    anfitrion.classList.add("cmg-anfitrion");
    const vida = window.CMGEditorVida.crear(raiz, ambito, !!opciones.atajosGlobales);
    const memoria = new Map();
    const preferencias = opciones.preferencias || {
      leer: (k, d) => memoria.has(k) ? memoria.get(k) : d,
      escribir: (k, v) => memoria.set(k, v),
    };
    let doc = { id: uid, lenguaje: adaptador.id, texto: "", revision: 0, ...opciones.documento };
    const revisiones = new Map([[doc.id, { texto: doc.texto, revision: doc.revision }]]);
    const codigo = $("codigo"), marcasActuales = { corre: null, err: null };
    codigo.value = doc.texto; codigo.dataset.editor = "codigo";
    const datosVacios = () => ({ lugares: [], materiales: [], ladrillos: [], tipos: [], sensores: [], red: [], otras: [] });
    const cmg = {
      codigo, serie: opciones.serie || "", get claveDocumento() { return doc.id; },
      lexico: adaptador.lexico, clasificar: (f, i) => adaptador.clasificar(f, i, proveedor.vocabulario?.() || {}),
      reHueco: adaptador.hueco.re, funciones: () => proveedor.funciones?.() || [],
      firma: nombre => proveedor.firma?.(nombre) || proveedor.funciones?.().find(f => f.nombre === nombre)?.firma || null,
      sugerencias: c => proveedor.sugerencias?.(c) || null,
      datos: () => opciones.datos?.() || datosVacios(), inicial: () => opciones.inicial?.() || null,
      get marcas() { return { ...marcasActuales }; },
      alternarEjecucion: () => opciones.alEjecutar?.(),
      alDesplazar: () => ui.pintarBanda(),
    };
    const ui = window.CMGEditorUI.crear({ opciones: { ...opciones, proveedor }, cmg, $, ambito, vida, adaptador, marcasActuales });
    Object.assign(cmg, ui);

    vida.escuchar(codigo, "input", () => {
      if (codigo.readOnly) return;
      if (codigo.value !== doc.texto) {
        doc = { ...doc, texto: codigo.value, revision: doc.revision + 1 };
        revisiones.set(doc.id, { texto: doc.texto, revision: doc.revision });
        marcasActuales.corre = marcasActuales.err = null;
        alCambiar({ ...doc });
      }
      ui.medirEditor();
    });
    vida.escuchar(codigo, "scroll", ui.pintarBanda);
    const iconos = opciones.iconos || window.ICONOS || {};
    const dependencias = { cmg, $, ambito, preferencias, vida, adaptador, iconos };
    window.CMGEdicion.crear(dependencias);
    function iniciarVistas() {
      if (!cmg.seudo && !vida.destruida) window.CMGSeudo.crear({ ...dependencias, preferencias: opciones.preferenciasVistas || preferencias });
      return cmg.seudo;
    }
    if (!opciones.aplazarVistas) iniciarVistas();
    const autonomo = !opciones.adoptar ? montarAutonomo() : null;
    codigo.readOnly = !!opciones.soloLectura?.();
    codigo.dispatchEvent(new CustomEvent("cmg:estado"));
    ui.atajos(proveedor.atajos?.() || adaptador.plantillas || []);
    // Lo que en el juego aporta su propia interfaz (layout.js y juego.js): forma, letra, ajustes,
    // tooltips y pantalla completa. Solo para instancias autónomas.
    function montarAutonomo() {
      const soltarTips = window.CMGTips ? window.CMGTips.adquirir() : () => {};
      // Forma: la fija el anfitrión (opciones.forma) o se deduce del ancho del propio editor.
      const aplicarForma = () => {
        const f = opciones.forma || formaPorAncho(raiz.getBoundingClientRect().width);
        if (raiz.dataset.forma !== f) { raiz.dataset.forma = f; vida.requestAnimationFrame(() => ui.medirEditor()); }
        // En el teléfono no hay tecla Esc que anunciar.
        if (f === "escritorio") $("b-pantalla").dataset.tipCod = "Esc para salir"; else delete $("b-pantalla").dataset.tipCod;
      };
      aplicarForma();
      if (!opciones.forma) {
        vida.observar(new ResizeObserver(aplicarForma)).observe(raiz);
        vida.escuchar(window, "resize", aplicarForma);
      }
      // La barra de símbolos del teléfono solo aparece mientras se escribe.
      vida.escuchar(codigo, "focus", () => { raiz.dataset.escribiendo = "true"; });
      vida.escuchar(codigo, "blur", () => { delete raiz.dataset.escribiendo; });
      // Letra: los mismos cinco tamaños que el juego, guardados en las preferencias del anfitrión.
      const guardada = Number(preferencias.leer("letra", null));
      if (TAMANOS.includes(guardada)) raiz.style.setProperty("--code-size", guardada + "px");
      const letra = paso => {
        const actual = Math.round(parseFloat(getComputedStyle(raiz).getPropertyValue("--code-size")) || 14);
        const i = TAMANOS.includes(actual) ? TAMANOS.indexOf(actual) : 2;
        const t = TAMANOS[Math.max(0, Math.min(TAMANOS.length - 1, i + paso))];
        raiz.style.setProperty("--code-size", t + "px"); preferencias.escribir("letra", t); ui.medirEditor();
      };
      vida.escuchar($("b-menos"), "click", () => letra(-1));
      vida.escuchar($("b-mas"), "click", () => letra(1));
      const $ajustes = $("ajustes");
      vida.escuchar($("b-ajustes"), "click", () => $ajustes.showModal());
      vida.escuchar($("ajustes-cerrar"), "click", () => $ajustes.close());
      // Pantalla completa: el editor ocupa la ventana (también en iPhone, sin la API del navegador)
      // y, donde se puede, se pide además la pantalla completa del navegador.
      const $pantalla = $("b-pantalla"), raizDoc = document.documentElement;
      let enPantalla = false, pedidaNavegador = false;
      const ajustarVisible = () => {
        if (!enPantalla) return;
        const vv = window.visualViewport;
        raiz.style.setProperty("--alto-visible", Math.round(vv ? vv.height : innerHeight) + "px");
        raiz.style.setProperty("--arriba-visible", Math.round(vv ? vv.offsetTop : 0) + "px");
      };
      function pantalla(si = !enPantalla) {
        si = !!si;
        if (vida.destruida || si === enPantalla) return enPantalla;
        enPantalla = si;
        raiz.dataset.pantallaCompleta = String(si);
        $pantalla.setAttribute("aria-pressed", String(si));
        $pantalla.dataset.tip = si ? "Salir de pantalla completa" : "Pantalla completa";
        $pantalla.setAttribute("aria-label", $pantalla.dataset.tip);
        if (si) {
          if (!raizDoc.dataset.cmgPantalla) raizDoc.dataset.cmgPantalla = uid;
          ajustarVisible();
          if (opciones.pantallaNavegador !== false && document.fullscreenEnabled && !document.fullscreenElement && raizDoc.requestFullscreen) {
            pedidaNavegador = true;
            // Si el editor sale (o se destruye) antes de que el navegador responda, se suelta al llegar.
            raizDoc.requestFullscreen().then(() => { if (!enPantalla && document.fullscreenElement) document.exitFullscreen().catch(() => {}); })
              .catch(() => { pedidaNavegador = false; });
          }
        } else {
          if (raizDoc.dataset.cmgPantalla === uid) delete raizDoc.dataset.cmgPantalla;
          raiz.style.removeProperty("--alto-visible"); raiz.style.removeProperty("--arriba-visible");
          if (pedidaNavegador && document.fullscreenElement) document.exitFullscreen().catch(() => {});
          pedidaNavegador = false;
        }
        vida.requestAnimationFrame(() => ui.medirEditor());
        opciones.alPantallaCompleta?.(si);
        return si;
      }
      vida.escuchar($pantalla, "click", () => pantalla());
      // Esc del navegador sale de su pantalla completa: el editor sale con ella.
      vida.escuchar(document, "fullscreenchange", () => { if (pedidaNavegador && !document.fullscreenElement) { pedidaNavegador = false; pantalla(false); } });
      // Esc sale si nadie más lo usó (sugerencias, variantes o la selección del modo sin teclado).
      vida.escuchar(raiz, "keydown", ev => {
        if (ev.key !== "Escape" || !enPantalla || ev.defaultPrevented || ev.target.closest("dialog")) return;
        if (raiz.querySelector(".variantes:not([hidden]), .sugerencias:not([hidden])")) return;
        ev.preventDefault(); pantalla(false); $pantalla.focus();
      });
      if (window.visualViewport) { vida.escuchar(window.visualViewport, "resize", ajustarVisible); vida.escuchar(window.visualViewport, "scroll", ajustarVisible); }
      return {
        pantalla,
        destruir() { if (enPantalla) pantalla(false); soltarTips(); delete raiz.dataset.pantallaCompleta; },
      };
    }
    const editor = {
      codigo, fachada: cmg, iniciarVistas,
      documento: () => ({ ...doc }),
      abrir(documento) {
        if (vida.destruida) return;
        if (documento.lenguaje !== adaptador.id) throw Error("Conversión de lenguaje todavía no disponible.");
        const previo = revisiones.get(documento.id);
        const revision = Math.max(documento.revision || 0, doc.revision + (doc.id !== documento.id || doc.texto !== documento.texto ? 1 : 0), previo ? previo.revision + (previo.texto !== documento.texto ? 1 : 0) : 0);
        doc = { ...documento, revision }; revisiones.set(doc.id, { texto: doc.texto, revision });
        codigo.value = doc.texto; marcasActuales.corre = marcasActuales.err = null;
        codigo.dispatchEvent(new CustomEvent("cmg:documento", { detail: { clave: doc.id } }));
        ui.medirEditor();
      },
      insertar(...args) { return !vida.destruida && !opciones.soloLectura?.() && ui.insertar(...args); },
      marcas(revision, lista) {
        if (vida.destruida || revision !== doc.revision) return false;
        marcasActuales.corre = lista.find(m => m.clase === "corre")?.linea || null;
        marcasActuales.err = lista.find(m => m.clase === "err")?.linea || null;
        ui.pintarBanda(); return true;
      },
      irALinea(n) {
        if (vida.destruida || !n) return;
        const lineas = codigo.value.split("\n"), pos = lineas.slice(0, n - 1).reduce((s,l) => s + l.length + 1, 0);
        codigo.setSelectionRange(pos, pos + (lineas[n - 1] || "").length);
        codigo.dispatchEvent(new CustomEvent("cmg:seleccion"));
        if (!cmg.edicion.activo) codigo.focus();
      },
      modoSinTeclado(si) { if (!vida.destruida) cmg.edicion.activar(si); },
      pantallaCompleta(si) { return autonomo ? autonomo.pantalla(si) : false; },
      forma: () => anfitrion.dataset.forma || null,
      refrescar() { if (!vida.destruida) { codigo.readOnly = !!opciones.soloLectura?.(); codigo.dispatchEvent(new CustomEvent("cmg:estado")); ui.atajos(proveedor.atajos?.() || adaptador.plantillas || []); ui.medirEditor(); } },
      destruir() {
        if (vida.destruida) return;
        autonomo?.destruir();
        vida.destruir(); for (const n of propios) n.remove();
        if (anfitrionNuevo) anfitrion.classList.remove("cmg-anfitrion");
        for (const [viejo, nuevo] of reemplazos.reverse()) nuevo.replaceWith(viejo);
        raiz.classList.remove("cmg-editor"); delete raiz.dataset.cmgEditor; delete raiz.dataset.autonomo;
        if (!opciones.app) { delete raiz.dataset.modo; delete raiz.dataset.sinTeclado; delete raiz.dataset.forma; delete raiz.dataset.escribiendo; raiz.style.removeProperty("--code-size"); }
        revisiones.clear(); memoria.clear();
      },
    };
    ui.medirEditor();
    return editor;
  }
  window.CMGEditor = { crear };
})();
