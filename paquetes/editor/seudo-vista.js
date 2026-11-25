

// seudo: vista. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {


  // ---------- Dibujo ----------
  ctx.valorSlot = function(n, campo) {
    const v = ctx.leerCampo(n, campo), tx = ctx.TXT[ctx.idioma];
    if (campo === "alt" && v == null) return `<span class="nada">${ctx.esc(tx.ninguno)}</span>`;
    if (campo === "cond.op") return ctx.esc(v === "existe" ? tx.existe : v === "noexiste" ? tx.noexiste : ctx.OP_VER[v]);
    if (campo === "cond.n" && typeof v === "string") return ctx.esc(`"${v}"`);
    return ctx.esc(v);
  };
  ctx.piezas = function(n, plantilla) {
    return plantilla.map(([k, v]) => {
      if (k === "cond") return `<span class="cond">${ctx.piezas(n, ctx.COND.filter(([, c]) => c !== "cond.n" || !["existe", "noexiste"].includes(n.cond.op)))}</span>`;
      if (k === "slot") {
        if (v === "alt" && n.alt == null && ctx.quieto()) return "";
        return `<button type="button" class="slot slot-${v.replace(".", "-")}${ctx.abierto && ctx.abierto.id === n.id && ctx.abierto.campo === v ? " abierto" : ""}" data-accion="slot" data-id="${n.id}" data-campo="${v}">${ctx.valorSlot(n, v)}</button>`;
      }
      return `<span class="${k}">${ctx.esc(v)}</span>`;
    }).join(" ");
  };
  ctx.htmlLista = function(lista, padre, rama) {
    const conCursor = (i) => !ctx.quieto() && ctx.cursor.padre === padre && ctx.cursor.rama === rama && ctx.cursor.idx === i ? ctx.htmlCursor() : "";
    let html = `<div class="lista" data-padre="${padre}" data-rama="${rama}">`;
    if (!lista.length && padre !== "raiz") html += `<div class="vacio" data-accion="vacio" data-padre="${padre}" data-rama="${rama}">${ctx.esc(ctx.TXT[ctx.idioma].vacio)}</div>`;
    lista.forEach((n, i) => { html += conCursor(i) + ctx.htmlNodo(n); });
    return html + conCursor(lista.length) + `</div>`;
  };
  ctx.htmlNodo = function(n) {
    const tx = ctx.TXT[ctx.idioma], cat = ctx.CATEGORIA[n.t], sel = ctx.elegido === n.id ? " sel" : "";
    const verbo = n.t === "verbo" && ctx.bloques().find(f => f.nombre === n.nombre);
    const simple = verbo ? [["kw", verbo.rotulo(ctx.idioma)], ...(n.lugar ? [["slot", "lugar"]] : [])] : tx[n.t];
    if (!ctx.esContenedor(n)) return `<div class="fila simple ${cat}${sel}" data-accion="fila" data-parte="simple" data-id="${n.id}" data-nodo="${n.id}" data-item="${n.id}">${ctx.piezas(n, simple)}</div>`;
    const evento = n.t === "cuando" && ctx.eventos().find(e => e.evento === n.evento);
    const plantilla = evento ? [["kc", evento.rotulo(ctx.idioma)], ["tx", "→"], ["kw", n.parametro]] : tx[n.t];
    let html = `<div class="nodo contenedor ${cat}${sel}" data-item="${n.id}">`;
    html += `<div class="fila cabeza ${cat} ${n.t}" data-accion="fila" data-parte="cabeza" data-id="${n.id}" data-nodo="${n.id}">${ctx.piezas(n, plantilla)}</div>`;
    html += `<div class="cuerpo">${ctx.htmlLista(n.cuerpo, n.id, "cuerpo")}</div>`;
    if (n.t === "si") {
      html += `<div class="fila sino ${cat}" data-accion="fila" data-parte="sino" data-id="${n.id}"><span class="kc">${ctx.esc(tx.sino)}</span></div>`;
      html += `<div class="cuerpo">${ctx.htmlLista(n.sino, n.id, "sino")}</div>`;
    }
    return html + `<div class="fila pie ${cat}" data-accion="fila" data-parte="pie" data-id="${n.id}">${ctx.esc(evento ? "}" : tx.fin[n.t])}</div></div>`;
  };
  ctx.pintar = function() {
    if (!ctx.activo()) return;
    const scroll = ctx.$prog.scrollTop;
    const aviso = ctx.conComentarios ? `<div class="seudo-nota">Los comentarios del JavaScript no se ven aquí; al editar en esta vista se quitan.</div>` : "";
    ctx.$prog.innerHTML = aviso + `<div class="inicio" data-accion="inicio">${ctx.esc(ctx.TXT[ctx.idioma].inicio)}</div>` + ctx.htmlLista(ctx.modelo.cuerpo, "raiz", "cuerpo");
    ctx.$prog.classList.toggle("quieto", ctx.quieto());
    ctx.$prog.scrollTop = scroll;
    ctx.pintarMarcas();
    ctx.colocarLista();
  };
  ctx.pintarPaleta = function() {
    const I = ctx.iconos || {}, tx = ctx.TXT[ctx.idioma], d = ctx.datos();
    ctx.$paleta.innerHTML = (ctx.factory ? (d.ladrillos || []).concat(d.ladrillos?.includes("mientras") ? ["contar"] : []) : [...ctx.LADRILLOS, ...ctx.bloques().map(f => f.nombre), ...ctx.eventos().map(e => e.evento)]).map(t => {
      if (t === "|") return `<span class="sep-pal" aria-hidden="true"></span>`;
      if (t === "oir" && !d.red.length) return "";
      const evento = ctx.eventos().find(e => e.evento === t);
      const verbo = ctx.bloques().find(f => f.nombre === t);
      const rotulo = verbo ? verbo.rotulo(ctx.idioma) : evento ? evento.rotulo(ctx.idioma) : tx.paleta[t];
      const ico = I[evento ? "apuntar" : ctx.ICONO[t]] || { svg: "", c1: "#7FA3FF" };
      return `<button type="button" class="atajo ladrillo ${ctx.CATEGORIA[verbo ? "verbo" : evento ? "cuando" : t]}" data-ladrillo="${t}" aria-label="${ctx.esc(rotulo)}" style="--c1:${ico.c1};${ico.c2 ? `--c2:${ico.c2};` : ""}${ico.c3 ? `--c3:${ico.c3};` : ""}">${ico.svg}<span>${ctx.esc(rotulo)}</span></button>`;
    }).join("");
  };
  // La línea que se ejecuta (o la del error) ilumina su renglón.
  ctx.pintarMarcas = function() {
    if (!ctx.activo()) return;
    ctx.$prog.querySelectorAll(".corre, .err").forEach(x => x.classList.remove("corre", "err"));
    if (ctx.$codigo.value !== ctx.texto || !ctx.mapa.length) return;
    const { corre, err } = ctx.cmg.marcas;
    for (const [l, cls] of [[corre, "corre"], [err, "err"]]) {
      const id = l && ctx.mapa[l - 1], el = id && ctx.$prog.querySelector(`[data-nodo="${id}"]`);
      if (!el) continue;
      el.classList.add(cls);
      const pr = ctx.$prog.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.top < pr.top) ctx.$prog.scrollTop -= pr.top - er.top + 8; else if (er.bottom > pr.bottom) ctx.$prog.scrollTop += er.bottom - pr.bottom + 8;
    }
  };
  return function iniciar() {

  (ctx.htmlCursor = () => `<div class="cursor" aria-hidden="true"><span>${ctx.esc(ctx.TXT[ctx.idioma].cursor)}</span></div>`);

  ctx.vida.escuchar(ctx.$prog, "click", (ev) => {
    const t = ev.target.closest("[data-accion]");
    if (!t || ctx.quieto()) { if (t && ctx.quieto()) ctx.cmg.aviso("Detén el programa para editarlo."); return; }
    const a = t.dataset.accion;
    if (a === "slot") { ctx.elegido = t.dataset.id; ctx.pilaAmpliar.length = 0; return ctx.abrirHueco(t.dataset.id, t.dataset.campo); }
    ctx.cerrarHueco();
    ctx.pilaAmpliar.length = 0;
    if (a === "inicio") { ctx.elegido = null; ctx.cursor = { padre: "raiz", rama: "cuerpo", idx: 0 }; }
    else if (a === "vacio") { ctx.cursor = { padre: t.dataset.padre, rama: t.dataset.rama, idx: 0 }; ctx.elegido = t.dataset.padre; }
    else if (a === "fila") {
      const id = t.dataset.id, l = ctx.buscar(ctx.modelo, id), parte = t.dataset.parte;
      ctx.elegido = id;
      if (parte === "simple" || parte === "pie") ctx.cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 1 };
      else if (parte === "cabeza") ctx.cursor = { padre: id, rama: "cuerpo", idx: 0 };
      else if (parte === "sino") ctx.cursor = { padre: id, rama: "sino", idx: 0 };
    }
    ctx.pintar();
  });
  ctx.vida.escuchar(ctx.$paleta, "click", (ev) => {
    const b = ev.target.closest("[data-ladrillo]");
    if (!b) return;
    if (ctx.quieto()) return ctx.cmg.aviso("Detén el programa para editarlo.");
    ctx.agregar(ctx.nuevoLadrillo(b.dataset.ladrillo));
  });
  };
}
