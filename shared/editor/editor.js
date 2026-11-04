/* Instancia reutilizable. El anfitrión aporta documentos y datos, nunca ejecución. */
(() => {
  "use strict";
  let secuencia = 0;
  const plantilla = `
    <div class="editor-herramientas">
      <button class="mini b-teclado" id="b-teclado" type="button" aria-label="Modo sin teclado"></button>
      <button class="mini" type="button" data-modo-codigo="js">JS</button>
      <button class="mini" type="button" data-modo-codigo="pseudo">Seudo</button>
      <select id="ajustes-asa" aria-label="Asa de líneas"><option value="numero">Número</option><option value="borde">Borde</option></select>
      <button id="ajustes-orden-barra" type="button">Ordenar barra</button>
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
    <dialog id="orden-barra" class="orden-barra"><button id="orden-cerrar" type="button">Cerrar</button><div id="orden-grupos" class="orden-grupos"></div><button id="orden-restaurar" type="button">Restaurar orden</button></dialog>`;

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
    codigo.readOnly = !!opciones.soloLectura?.();
    codigo.dispatchEvent(new CustomEvent("cmg:estado"));
    ui.atajos(proveedor.atajos?.() || adaptador.plantillas || []);
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
      refrescar() { if (!vida.destruida) { codigo.readOnly = !!opciones.soloLectura?.(); codigo.dispatchEvent(new CustomEvent("cmg:estado")); ui.atajos(proveedor.atajos?.() || adaptador.plantillas || []); ui.medirEditor(); } },
      destruir() {
        if (vida.destruida) return;
        vida.destruir(); for (const n of propios) n.remove();
        for (const [viejo, nuevo] of reemplazos.reverse()) nuevo.replaceWith(viejo);
        raiz.classList.remove("cmg-editor"); delete raiz.dataset.cmgEditor; delete raiz.dataset.autonomo;
        if (!opciones.app) { delete raiz.dataset.modo; delete raiz.dataset.sinTeclado; }
        revisiones.clear(); memoria.clear();
      },
    };
    ui.medirEditor();
    return editor;
  }
  window.CMGEditor = { crear };
})();
