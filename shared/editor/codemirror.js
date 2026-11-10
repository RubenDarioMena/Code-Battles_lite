/* Superficie CodeMirror. El textarea queda como puerto de compatibilidad del anfitrión:
 * value/selección/eventos conservan su contrato; nunca recibe la escritura del usuario.
 * No modifica prototipos. Geometría y foco se consultan al motor, no al puerto oculto. */
(() => {
  "use strict";
  function crear({ codigo, contenedor, editor, cmg, adaptador: inicial, vida }) {
    const C = window.CMGCodeMirror;
    if (!C) throw Error("No se cargó CodeMirror local.");
    let adaptador = inicial, puente = false, destruido = false, actualizando = false;
    const sintaxis = () => adaptador.id === "python" ? C.python() : adaptador.id === "js" ? C.javascript() : [];
    const nativo = nombre => Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, nombre);
    const valor = nativo("value"), lectura = nativo("readOnly"), seleccionar = codigo.setSelectionRange.bind(codigo);
    const focoAnterior = codigo.focus, blurAnterior = codigo.blur, seleccionarAnterior = codigo.setSelectionRange;
    const atributos = ["aria-hidden", "tabindex"].map(k => [k, codigo.getAttribute(k)]);
    const configuracion = new C.Compartment(), idioma = new C.Compartment(), interfaz = new C.Compartment();
    const frases = () => C.EditorState.phrases.of(Object.fromEntries([
      ["Fold line", "plegar"], ["Unfold line", "expandir"], ["folded code", "plegado"], ["unfold", "expandir"],
    ].map(([frase,clave]) => [frase, window.CMGI18n?.t("editor.codemirror." + clave) || ({ plegar: "Contraer bloque", expandir: "Expandir bloque", plegado: "Código contraído" })[clave]])));
    const setMarcas = C.StateEffect.define();
    const marcas = C.StateField.define({
      create: () => C.Decoration.none,
      update(v, tr) {
        v = tr.docChanged ? C.Decoration.none : v.map(tr.changes);
        for (const e of tr.effects) if (e.is(setMarcas)) {
          const porLinea = new Map();
          for (const [clase, n] of [["corre", e.value.corre], ["err", e.value.err]]) if (n > 0 && n <= tr.state.doc.lines) porLinea.set(n, clase);
          v = C.Decoration.set([...porLinea].sort((a,b) => a[0]-b[0]).map(([n, clase]) => C.Decoration.line({ class: "cmg-linea-" + clase }).range(tr.state.doc.line(n).from)));
        }
        return v;
      }, provide: f => C.EditorView.decorations.from(f),
    });
    const colores = C.HighlightStyle.define([
      { tag: [C.tags.keyword, C.tags.bool, C.tags.null], class: "kw" },
      { tag: C.tags.comment, class: "com" }, { tag: C.tags.string, class: "str" },
      { tag: C.tags.number, class: "num" }, { tag: C.tags.propertyName, class: "prop" },
      { tag: C.tags.function(C.tags.variableName), class: "fn" },
      { tag: C.tags.function(C.tags.propertyName), class: "fn" },
    ]);
    const anfitrion = document.createElement("div"); anfitrion.className = "cmg-codemirror";
    contenedor.append(anfitrion); editor.classList.add("con-codemirror");
    codigo.classList.add("codigo-puerto"); codigo.setAttribute("aria-hidden", "true"); codigo.tabIndex = -1;
    const enFichas = () => editor.classList.contains("sin-teclado");
    const maxPos = n => Math.max(0, Math.min(view.state.doc.length, Number(n) || 0));
    const emitir = tipo => codigo.dispatchEvent(new Event(tipo));
    function copiarSeleccion() {
      const s = view.state.selection.main;
      if (codigo.selectionStart !== s.from || codigo.selectionEnd !== s.to || codigo.selectionDirection !== (s.anchor > s.head ? "backward" : "forward"))
        seleccionar(s.from, s.to, s.anchor > s.head ? "backward" : "forward");
    }
    function notificar(u) {
      if (puente || destruido) return;
      actualizando = true;
      try {
        if (u.docChanged) valor.set.call(codigo, u.state.doc.toString());
        if (u.selectionSet || u.docChanged) copiarSeleccion();
        if (u.docChanged) {
          const tipo = u.transactions.map(t => t.annotation(C.Transaction.userEvent)).find(Boolean) || "";
          let ins = ""; u.changes.iterChanges((_a,_b,_c,_d,texto) => { ins += texto.toString(); });
          codigo.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: tipo.startsWith("delete") ? "deleteContentBackward" : tipo.includes("paste") ? "insertFromPaste" : "insertText", data: ins, isComposing: view.composing }));
        }
        if (u.selectionSet) emitir("cmg:seleccion");
      } finally { actualizando = false; }
    }
    const analizar = vista => {
      if (vista.composing) return [];
      const src = vista.state.doc.toString(), diagnosticos = [];
      if (adaptador.id === "js" && window.acorn) {
        try { window.acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
        catch (e) { if (Number.isInteger(e.pos)) diagnosticos.push({ from: Math.min(src.length, e.pos), to: Math.min(src.length, e.pos + 1), severity: "error", message: e.message.replace(/\s*\(\d+:\d+\)$/, "") }); }
      } else if (adaptador.id === "python") {
        const cur = C.syntaxTree(vista.state).cursor();
        do {
          // La misma excepción de lezer 1.1.19 documentada en el lector de revisión.
          if (cur.type.isError && !(cur.from === cur.to && /^Yield(Statement|Expression)$/.test(cur.node.parent?.name || ""))) {
            diagnosticos.push({ from: cur.from, to: cur.to, severity: "error", message: window.CMGI18n?.t("editor.codemirror.python_sintaxis") || "Sintaxis de Python incompleta o inválida" });
            if (diagnosticos.length >= 10) break;
          }
        } while (cur.next());
      }
      return diagnosticos;
    };
    // El historial común ya guarda programas múltiples y vistas. Teclado, menú nativo y botones
    // lo recorren juntos: no se mantiene un segundo historial independiente de CodeMirror.
    const historial = rehacer => { if (codigo.readOnly) return true; cmg.edicion?.[rehacer ? "rehacer" : "deshacer"](); return true; };
    const view = new C.EditorView({ parent: anfitrion, doc: valor.get.call(codigo), extensions: [
      C.EditorView.lineWrapping, C.lineNumbers(), C.foldGutter(), C.bracketMatching(), C.drawSelection(), marcas,
      C.EditorState.tabSize.of(2), interfaz.of(frases()), C.EditorView.contentAttributes.of({ "aria-label": codigo.getAttribute("aria-label") || "Código", autocapitalize: "off", autocorrect: "off", spellcheck: "false" }),
      idioma.of(sintaxis()),
      C.syntaxHighlighting(colores), C.linter(analizar, { delay: 650 }), C.lintGutter(),
      configuracion.of([C.EditorState.readOnly.of(codigo.readOnly), C.EditorView.editable.of(!codigo.readOnly)]),
      C.keymap.of([...C.foldKeymap, ...C.defaultKeymap]),
      C.EditorView.updateListener.of(notificar),
      C.Prec.highest(C.EditorView.domEventHandlers({
        keydown(ev) {
          if (ev.isComposing || view.composing) return false;
          if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ["z", "y"].includes(ev.key.toLowerCase())) {
            ev.preventDefault(); return historial(ev.key.toLowerCase() === "y" || ev.shiftKey);
          }
          const copia = new KeyboardEvent("keydown", { key: ev.key, code: ev.code, shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, cancelable: true });
          codigo.dispatchEvent(copia);
          if (copia.defaultPrevented) { ev.preventDefault(); return true; }
          return false;
        },
        beforeinput(ev) {
          if (ev.inputType === "historyUndo" || ev.inputType === "historyRedo") { ev.preventDefault(); return historial(ev.inputType === "historyRedo"); }
          return false;
        },
        focus() { emitir("focus"); codigo.dispatchEvent(new FocusEvent("focusin", { bubbles: true })); },
        blur() { emitir("blur"); codigo.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); },
        keyup() { emitir("keyup"); }, pointerup() { emitir("pointerup"); },
        drop() { emitir("drop"); return false; },
        dblclick(ev) {
          const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY });
          const r = pos == null ? null : adaptador.crearEdicion({ codigo, insertar: cmg.insertar, aviso: cmg.aviso, escapar: x => x, estructura: () => adaptador.estructura }).rangoCodigo(pos, ev.detail >= 3);
          if (!r) return false;
          codigo.setSelectionRange(...r); ev.preventDefault(); return true;
        },
      })),
    ] });
    function ejecutar(fn) { if (actualizando) vida.queueMicrotask(() => { if (!destruido) fn(); }); else if (!destruido) fn(); }
    function cambiarValor(texto) {
      texto = String(texto).replace(/\r\n?/g, "\n"); valor.set.call(codigo, texto);
      if (puente || destruido || texto === view.state.doc.toString()) return;
      ejecutar(() => {
        const anterior = view.state.doc.toString();
        let a = 0, b = anterior.length, d = texto.length;
        while (a < b && a < d && anterior[a] === texto[a]) a++;
        while (b > a && d > a && anterior[b - 1] === texto[d - 1]) { b--; d--; }
        puente = true;
        try { view.dispatch({ changes: { from: a, to: b, insert: texto.slice(a,d) }, selection: C.EditorSelection.cursor(texto.length) }); } finally { puente = false; }
      });
    }
    Object.defineProperty(codigo, "value", { configurable: true, get: () => valor.get.call(codigo), set: cambiarValor });
    Object.defineProperty(codigo, "readOnly", { configurable: true, get: () => lectura.get.call(codigo), set: v => {
      const anterior = lectura.get.call(codigo);
      lectura.set.call(codigo, v);
      if (anterior === !!v) return;
      ejecutar(() => view.dispatch({ effects: configuracion.reconfigure([C.EditorState.readOnly.of(!!v), C.EditorView.editable.of(!v)]) }));
    } });
    codigo.setSelectionRange = (a,b,dir = "forward") => {
      seleccionar(a,b,dir); if (puente || destruido) return;
      const desde = codigo.selectionStart, hasta = codigo.selectionEnd;
      ejecutar(() => { puente = true; try { view.dispatch({ selection: C.EditorSelection.single(dir === "backward" ? hasta : desde, dir === "backward" ? desde : hasta) }); } finally { puente = false; } });
    };
    codigo.focus = () => { if (!enFichas() && !destruido) view.focus(); };
    codigo.blur = () => { if (view.hasFocus) view.contentDOM.blur(); };
    for (const prop of ["scrollTop", "scrollLeft"]) Object.defineProperty(codigo, prop, { configurable: true, get: () => view.scrollDOM[prop], set: v => { view.scrollDOM[prop] = v; } });
    vida.escuchar(view.scrollDOM, "scroll", () => emitir("scroll"), { passive: true });
    vida.escuchar(window, "cmg:idioma", () => ejecutar(() => view.dispatch({ effects: interfaz.reconfigure(frases()) })));
    const observer = new MutationObserver(() => {
      view.contentDOM.setAttribute("aria-label", codigo.getAttribute("aria-label") || "Código");
      if (!destruido && !actualizando) refrescar();
    });
    observer.observe(codigo, { attributes: true, attributeFilter: ["aria-label"] });
    const claseObserver = new MutationObserver(() => refrescar());
    claseObserver.observe(editor, { attributes: true, attributeFilter: ["class"] });
    function refrescar() {
      if (destruido) return;
      anfitrion.hidden = enFichas();
      view.requestMeasure();
    }
    let marcasClave = "";
    const api = {
      view, elemento: view.contentDOM, scroll: view.scrollDOM,
      tieneFoco: () => view.hasFocus,
      insertar(texto, sa, sb) {
        if (codigo.readOnly) return false;
        const a = codigo.selectionStart, b = codigo.selectionEnd;
        const from = a + (sa ?? texto.length), to = a + (sb ?? sa ?? texto.length);
        // La paleta puede sustituir una selección que está dentro de un bloque plegado.
        view.dispatch({ changes: { from: a, to: b, insert: texto }, selection: C.EditorSelection.range(from,to), annotations: C.Transaction.userEvent.of("input.cmg") });
        return true;
      },
      documento(nuevo) {
        ejecutar(() => {
          adaptador = nuevo;
          const efectos = [idioma.reconfigure(sintaxis())];
          C.foldedRanges(view.state).between(0, view.state.doc.length, (from,to) => efectos.push(C.unfoldEffect.of({from,to})));
          view.dispatch({ effects: efectos }); marcasClave = ""; refrescar();
        });
      },
      marcas(m) {
        const clave = `${m.corre}:${m.err}`; if (clave === marcasClave) return;
        marcasClave = clave; ejecutar(() => view.dispatch({ effects: setMarcas.of(m) }));
      },
      rect: pos => view.coordsAtPos(maxPos(pos)),
      posicion: (x,y) => view.posAtCoords({x,y}, false),
      rects(a,b) {
        const out = [];
        for (const v of view.visibleRanges) {
          const desde = Math.max(a,v.from), hasta = Math.min(b,v.to); if (hasta <= desde) continue;
          const p = view.domAtPos(desde), q = view.domAtPos(hasta), rango = document.createRange();
          rango.setStart(p.node,p.offset); rango.setEnd(q.node,q.offset);
          out.push(...[...rango.getClientRects()].filter(r => r.width > 0 && r.height > 0));
        }
        return out;
      },
      mostrar(pos) {
        const efectos = []; pos = maxPos(pos);
        C.foldedRanges(view.state).between(0, view.state.doc.length, (from,to) => { if (from <= pos && pos <= to) efectos.push(C.unfoldEffect.of({from,to})); });
        efectos.push(C.EditorView.scrollIntoView(pos, { y: "nearest" }));
        ejecutar(() => view.dispatch({ effects: efectos }));
      },
      refrescar,
      destruir() {
        if (destruido) return;
        destruido = true; observer.disconnect(); claseObserver.disconnect(); view.destroy(); anfitrion.remove();
        for (const prop of ["value", "readOnly", "scrollTop", "scrollLeft"]) delete codigo[prop];
        codigo.focus = focoAnterior; codigo.blur = blurAnterior; codigo.setSelectionRange = seleccionarAnterior;
        codigo.classList.remove("codigo-puerto"); editor.classList.remove("con-codemirror");
        for (const [k,v] of atributos) { if (v == null) codigo.removeAttribute(k); else codigo.setAttribute(k,v); }
        delete codigo.cmgMotor;
      },
    };
    codigo.cmgMotor = api; refrescar();
    return api;
  }
  window.CMGEditorCodeMirror = { crear };
})();
