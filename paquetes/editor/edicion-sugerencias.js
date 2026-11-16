import { dependencias, localizarHTML } from './dependencias.js';

/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: sugerencias. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  // Varias peticiones seguidas se resuelven una vez, al terminar la tarea actual (insertar() fija
  // la selección después de su evento input). Cerrar la lista anula las pendientes.
  ctx.actualizarSugerencias = function() {
    const v = ++ctx.versionSug;
    ctx.vida.queueMicrotask(() => {
      if (v !== ctx.versionSug || (ctx.gesto && ctx.gesto.arrastre)) return;
      if (ctx.$codigo.readOnly || !ctx.editorVisible() || (!ctx.activo && document.activeElement !== ctx.$codigo)) return ctx.cerrarSugerencias();
      if (ctx.sinSugerir === ctx.claveSel()) return;
      const [a, b] = ctx.sel(), e = ctx.estructura(), c = ctx.E.contexto(e, a, b);
      if (!c || !(c.hueco || c.vacio || (ctx.activo && c.hoja && c.tipo))) return ctx.cerrarSugerencias();
      const numero = ctx.activo && c.nodo.k === "num";
      const datos = ctx.cmg.sugerencias({ tipo: c.tipo, funcion: c.funcion, objeto: c.objeto, indice: c.indice, hueco: c.hueco, variables: ctx.variables(e, a) });
      if (!datos && !numero) return ctx.cerrarSugerencias();
      ctx.abrirSugerencias(datos || { titulo: "Número", grupos: [] }, a, b, c, numero);
    });
  };
  ctx.abrirSugerencias = function(datos, a, b, c, numero) {
    const items = [];
    let html = `<div class="sug-cab"><b>${ctx.esc(datos.titulo)}</b>${datos.donde ? `<span>${ctx.esc(datos.donde)}</span>` : ""}<button type="button" class="sug-x" data-cerrar aria-label="Cerrar sugerencias">×</button></div>`;
    if (numero) html += `<div class="sug-num"><button type="button" data-paso="-1" aria-label="Restar">−</button><code class="num">${ctx.esc(ctx.$codigo.value.slice(a, b))}</code><button type="button" data-paso="1" aria-label="Sumar">+</button></div>`;
    for (const g of datos.grupos) {
      if (!g.items.length) continue;
      if (g.titulo) html += `<div class="sug-g">${ctx.esc(g.titulo)}</div>`;
      for (const it of g.items) {
        html += `<button type="button" class="sug" role="option" data-i="${items.length}"><code class="${ctx.esc(it.cls || "")}">${ctx.esc(it.ver || it.ins)}</code>${it.nota ? `<span class="nota">${ctx.esc(it.nota)}</span>` : ""}</button>`;
        items.push(it);
      }
    }
    html += `<button type="button" class="sug escribir" data-escribir>✎ Escribir otro valor…</button>`;
    ctx.$sug.innerHTML = localizarHTML(html);
    const rotuloSugerencias = `Valores para ${datos.titulo.toLowerCase()}`;
    ctx.$sug.setAttribute("aria-label", dependencias.presentacion ? dependencias.presentacion.texto(rotuloSugerencias) : rotuloSugerencias);
    ctx.sugerido = { a, b, c, items, activo: -1 };
    ctx.$sug.hidden = false;
    ctx.colocarSugerencias(true);
  };
  ctx.cerrarSugerencias = function() { ctx.versionSug++; if (!ctx.$sug.hidden) { ctx.$sug.hidden = true; ctx.$sug.innerHTML = ""; } ctx.sugerido = null; };
  // Rectángulo de [a, b) en pantalla: de la vista de bloques o, con teclado, de un espejo del textarea.
  ctx.rectDe = function(a, b) {
    if (ctx.activo) {
      const rs = ctx.renglones(a === b ? [ctx.rectCaret(a)].filter(Boolean).map(r => ({ ...r, width: 1, right: r.left + 1 })) : ctx.rectsDe(a, b));
      return rs.length ? { left: rs[0].left, top: rs[0].top, bottom: rs[rs.length - 1].bottom } : null;
    }
    const cs = getComputedStyle(ctx.$codigo), r = ctx.$codigo.getBoundingClientRect(), espejo = document.createElement("div"), v = ctx.$codigo.value, marca = document.createElement("span");
    for (const k of ctx.METRICAS) espejo.style[k] = cs[k];
    Object.assign(espejo.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${ctx.$codigo.clientWidth}px`, height: `${ctx.$codigo.clientHeight}px`, overflow: "hidden", visibility: "hidden", pointerEvents: "none" });
    marca.textContent = v.slice(a, b) || "​";
    espejo.append(document.createTextNode(v.slice(0, a)), marca, document.createTextNode(v.slice(b)));
    ctx.vida.portal(espejo);
    espejo.scrollTop = ctx.$codigo.scrollTop;
    const rs = marca.getClientRects(), res = rs.length ? { left: rs[0].left, top: rs[0].top, bottom: rs[rs.length - 1].bottom } : null;
    espejo.remove();
    return res;
  };
  ctx.colocarSugerencias = function(desplazar = false) {
    if (!ctx.sugerido) return;
    const r = ctx.rectDe(ctx.sugerido.a, ctx.sugerido.b), cont = ctx.$editor.getBoundingClientRect();
    if (!r || r.bottom < cont.top || r.top > cont.bottom) { ctx.$sug.style.visibility = "hidden"; return; }
    ctx.$sug.style.visibility = "";
    // Nunca tapa la paleta ni la barra de edición: se siguen pudiendo usar con la lista abierta. Encima del
    // código (PC) marcan el techo; debajo (teléfono, junto al teclado), el suelo.
    const vv = window.visualViewport, barras = [ctx.$barra, ctx.$("paleta")].filter(x => x.getClientRects().length).map(x => x.getBoundingClientRect());
    // Tampoco sube por encima del código: la barra superior y el mapa quedan libres.
    const enCodigo = cont.top + cont.height / 2, simbolos = ctx.$("simbolos");
    const techo = Math.max(vv ? vv.offsetTop : 0, cont.top - 8, ...barras.filter(b => b.bottom <= enCodigo).map(b => b.bottom)) + 4;
    const altoSimbolos = simbolos && !simbolos.hidden && ctx.app.classList.contains("teclado") ? 46 : 0;
    const suelo = Math.min((vv ? vv.offsetTop + vv.height : innerHeight) - altoSimbolos, ...barras.filter(b => b.top >= enCodigo).map(b => b.top)) - 4;
    ctx.$sug.classList.remove("hoja", "compacta");
    ctx.$sug.style.maxHeight = ""; ctx.$sug.style.width = "";
    let m = ctx.$sug.getBoundingClientRect(), x, y, max;
    const abajo = suelo - r.bottom - 6, arriba = r.top - 6 - techo, lado = cont.right - r.right - 10;
    const minimo = Math.min(m.height, 110);   // la cabecera y dos opciones
    if (lado >= m.width && suelo - techo >= minimo) {
      // A la derecha de lo elegido, si cabe: no tapa las líneas siguientes.
      max = Math.min(320, suelo - techo);
      x = r.right + 10;
      y = Math.max(techo, Math.min(suelo - Math.min(m.height, max), r.top - 8));
    } else if (Math.max(abajo, arriba) >= minimo) {
      // Debajo mientras quepan unas cuantas opciones; si no, encima. Nunca fuera de la pantalla.
      // Si sobra sitio deja a la vista la línea vecina, la que más a menudo se toca después.
      const enAbajo = abajo >= Math.min(m.height, 130) || abajo >= arriba;
      const libre = enAbajo ? abajo : arriba, linea = Math.min(r.bottom - r.top, 26), salto = libre - linea >= minimo ? linea : 0;
      max = Math.min(320, libre - salto);
      x = Math.max(6, Math.min(innerWidth - m.width - 6, r.left - 8));
      y = enAbajo ? r.bottom + 6 + salto : Math.max(techo, r.top - 6 - salto - Math.min(m.height, max));
    } else {
      // Sin sitio junto a la selección (teléfono): hoja apoyada en el borde inferior. Deja libre la
      // columna de asas de línea (números o borde derecho) para poder elegir una línea con la lista abierta.
      ctx.$sug.classList.add("hoja");
      // Con cabecera y grupos, 110 px no garantizan dos opciones. En una hoja
      // muy baja se omiten los títulos de grupo, conservando todos sus valores.
      ctx.$sug.classList.toggle("compacta", suelo - techo < 160);
      const izq = ctx.activo && ctx.asa === "numero" ? ctx.$gutter.getBoundingClientRect().right + 2 : 6;
      const der = ctx.activo && ctx.asa === "borde" ? ctx.$asas.getBoundingClientRect().left - 2 : innerWidth - 6;
      ctx.$sug.style.width = `${Math.round(der - izq)}px`;
      m = ctx.$sug.getBoundingClientRect();
      max = Math.min(320, Math.max(minimo, suelo - techo));
      x = izq;
      y = suelo - Math.min(m.height, max);
      // Si la vista de bloques puede desplazarse, sube lo elegido (como mucho hasta el borde superior
      // de la vista) y vuelve a colocar la lista: suele caber ya debajo, sin tapar la línea.
      const tapa = r.bottom + 6 - y, margen = ctx.$vista.scrollHeight - ctx.$vista.clientHeight - ctx.$vista.scrollTop;
      const paso = Math.min(tapa, margen, r.top - ctx.$vista.getBoundingClientRect().top - 8);
      if (ctx.activo && desplazar && paso > 0) { ctx.$vista.scrollTop += paso; return ctx.colocarSugerencias(); }
    }
    ctx.$sug.style.maxHeight = `${max}px`;
    ctx.$sug.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  ctx.siguienteHueco = function(desde) {
    const v = ctx.$codigo.value, fin = v.indexOf("\n", desde) < 0 ? v.length : v.indexOf("\n", desde);
    const re = new RegExp(ctx.cmg.reHueco.source, "g");
    re.lastIndex = desde;
    const m = re.exec(v);
    return m && m.index < fin ? [m.index, m.index + m[0].length] : null;
  };
  ctx.ponerValor = function(texto) {
    if (!ctx.sugerido || !ctx.editable()) return;
    const { a, b, c } = ctx.sugerido, ins = c.vacio ? ctx.E.enLista(ctx.$codigo.value, a, b, texto) : texto;
    const ini = a + ins.indexOf(texto), fin = ini + texto.length;
    ctx.cerrarSugerencias();
    ctx.reemplazar(a, b, ins, ini, fin);
    // Plantillas con huecos (operadores): queda elegido el primero.
    const h = texto.search(ctx.cmg.reHueco);
    if (h >= 0) return ctx.elegir(ini + h, ini + h + texto.slice(h).match(ctx.cmg.reHueco)[0].length);
    // Si la sentencia tiene otro hueco, se sigue rellenando.
    const s = ctx.siguienteHueco(fin);
    if (s) return ctx.elegir(s[0], s[1], { mostrar: true });
    if (ctx.activo) { ctx.elegir(ini, fin); ctx.sinSugerir = ctx.claveSel(); ctx.cerrarSugerencias(); }
    else ctx.elegir(fin, fin);
  };
  ctx.pasoNumero = function(dir) {
    if (!ctx.sugerido) return;
    const { a, b } = ctx.sugerido, t = ctx.$codigo.value.slice(a, b), n = Number(t);
    if (!Number.isFinite(n)) return;
    const paso = /[.eE]/.test(t) || Math.abs(n) < 1 ? 0.05 : 1, nuevo = String(Math.round((n + dir * paso) * 1000) / 1000);
    ctx.reemplazar(a, b, nuevo, a, a + nuevo.length);
  };
  ctx.escribirValor = function() {
    if (!ctx.sugerido) return;
    const actual = ctx.$codigo.value.slice(ctx.sugerido.a, ctx.sugerido.b), valor = ctx.sugerido.c.hueco || ctx.sugerido.c.vacio ? "" : actual;
    ctx.$sug.innerHTML = localizarHTML(`<form class="sug-escribir"><label>Valor<input type="text" value="${ctx.esc(valor)}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></label><button class="btn chico" type="submit">Poner</button></form>`);
    const input = ctx.$sug.querySelector("input");
    input.focus(); input.select();
    ctx.vida.escuchar(ctx.$sug.querySelector("form"), "submit", (ev) => { ev.preventDefault(); if (input.value.trim()) ctx.ponerValor(input.value.trim()); else ctx.cerrarSugerencias(); });
    ctx.colocarSugerencias();
  };
  ctx.marcarActivo = function() {
    ctx.$sug.querySelectorAll(".sug[data-i]").forEach(x => x.classList.toggle("activa", +x.dataset.i === ctx.sugerido.activo));
    const x = ctx.$sug.querySelector(".sug.activa");
    if (x) x.scrollIntoView({ block: "nearest" });
  };
  // Teclado (PC): flechas recorren la lista, Intro o Tab ponen el valor, Escape la cierra.
  ctx.teclaSugerencias = function(ev) {
    if (ctx.$sug.hidden || !ctx.sugerido || !ctx.sugerido.items.length || ev.target.closest && ev.target.closest(".sugerencias")) return false;
    const n = ctx.sugerido.items.length, hecho = () => { ev.preventDefault(); ev.stopImmediatePropagation(); return true; };
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      const d = ev.key === "ArrowDown" ? 1 : -1;
      ctx.sugerido.activo = ctx.sugerido.activo < 0 ? (d > 0 ? 0 : n - 1) : (ctx.sugerido.activo + d + n) % n;
      ctx.marcarActivo(); return hecho();
    }
    if ((ev.key === "Enter" && ctx.sugerido.activo >= 0) || ev.key === "Tab") { ctx.ponerValor(ctx.sugerido.items[Math.max(0, ctx.sugerido.activo)].ins); return hecho(); }
    if (ev.key === "Escape") { ctx.sinSugerir = ctx.claveSel(); ctx.cerrarSugerencias(); return hecho(); }
    return false;
  };
  // Agrupa por el título que da el juego (lanzador, console, sensores…).
  ctx.gruposFunciones = function(lista, item) {
    const g = new Map();
    for (const f of lista) { const t = f.grupo || ""; if (!g.has(t)) g.set(t, []); g.get(t).push(item(f)); }
    return [...g].map(([titulo, items]) => ({ titulo, items }));
  };
  ctx.alternativas = function(pos) {
    const e = ctx.estructura(), v = e.src;
    const f = e.sig.find(x => x.a <= pos && pos < x.b);
    const vars = ctx.variables(e, pos);
    // 1. El nombre de una llamada (o su objeto): todas las funciones, con los argumentos que encajen.
    const ll = f && e.nodos.filter(n => n.k === "llamada" && n.nombre && pos >= n.a && pos < n.nombre.b).sort((x, y) => (x.nombre.b - x.a) - (y.nombre.b - y.a))[0];
    const lista = ctx.funcionesDisponibles();
    if (ll && lista.length) {
      const conAwait = ll.padre && ll.padre.k === "unaria" && ll.padre.op === "await";
      const a = conAwait ? ll.padre.a : ll.a, viejo = ctx.cmg.firma(v.slice(ll.nombre.a, ll.nombre.b)) || [];
      const args = ll.args.filter(x => x.k !== "vacio");
      const grupos = ctx.gruposFunciones(lista, fn => {
        const params = fn.firma || [], nombre = ctx.nombreFn(fn);
        const dentro = params.map((p, i) => args[i] && viejo[i] === p ? v.slice(args[i].a, args[i].b) : ctx.H(p));
        return ctx.opc(`${fn.await ? "await " : ""}${nombre}(${dentro.join(", ")})`, "fn", fn.nota || "", `${nombre}(${params.join(", ")})`);
      });
      return { a, b: ll.b, datos: { titulo: "Funciones", donde: "cambia la llamada, conserva los valores que encajan", grupos } };
    }
    // 2. Un operador: los de su familia.
    if (f && f.k === "p") {
      const fam = ctx.FAMILIAS.find(([, ops]) => ops.some(([o]) => o === f.v));
      if (fam) return { a: f.a, b: f.b, datos: { titulo: `Operador · ${fam[0].toLowerCase()}`, grupos: [{ items: fam[1].map(([o, nota]) => ctx.opc(o, "op", nota)) }] } };
    }
    // 3. const / let.
    if (f && f.k === "id" && ctx.DECLARA.some(([d]) => d === f.v)) return { a: f.a, b: f.b, datos: { titulo: "Declaración", grupos: [{ items: ctx.DECLARA.map(([d, nota]) => ctx.opc(d, "kw", nota)) }] } };
    // 4. Un valor: lo que encaja en su sitio (argumento, condición, comparación) y los de su mismo tipo.
    const t = f ? ctx.E.atomo(e, pos) : null;
    if (t) {
      let [a, b] = t;
      const n = e.nodos.find(x => x.a === a && x.b === b && x.k !== "vacio" && x.k !== "programa");
      if (!n || !["id", "num", "str", "lit", "hueco"].includes(n.k)) return null;
      if (n.padre && n.padre.k === "decl" && n.padre.h[0] === n) return null;   // el nombre que se declara
      // Una propiedad (obj.prop) se cambia entera.
      const m = n.prop && n.padre && n.padre.k === "miembro" ? n.padre : n;
      [a, b] = [m.a, m.b];
      const c = ctx.E.contexto(e, a, b);
      let datos = c && (c.tipo || c.hueco) ? ctx.cmg.sugerencias({ tipo: c.tipo, funcion: c.funcion, objeto: c.objeto, indice: c.indice, hueco: c.hueco, variables: vars }) : null;
      if (!datos && n.k !== "num") datos = ctx.cmg.sugerencias({ tipo: "valor", variables: vars });
      const grupos = [...(datos ? datos.grupos : [])];
      if (n.k === "lit") grupos.unshift({ titulo: "Del mismo tipo", items: ctx.LITERALES.map(([l, nota]) => ctx.opc(l, "kw", nota)) });
      if (!grupos.some(g => g.items.length) && n.k !== "num") return null;
      return { a, b, numero: n.k === "num", c: c || undefined, datos: { titulo: datos ? datos.titulo : n.k === "num" ? "Número" : "Valor", donde: datos && datos.donde, grupos } };
    }
    // 5. Un hueco vacío entre ( ) o [ ]: los valores de ese argumento.
    const vacio = e.nodos.find(x => x.k === "vacio" && x.a <= pos && pos <= x.b);
    if (vacio) {
      const c = ctx.E.contexto(e, vacio.a, vacio.a);
      const datos = c && ctx.cmg.sugerencias({ tipo: c.tipo, funcion: c.funcion, objeto: c.objeto, indice: c.indice, hueco: c.hueco, variables: vars });
      return datos ? { a: vacio.a, b: vacio.b, c, datos } : null;
    }
    // 6. Una línea vacía dentro de { }: las órdenes que caben ahí, como sentencias.
    const l = ctx.E.lineaDe(e, pos), ini = ctx.E.inicioLinea(e, l), fin = ctx.E.finLinea(e, l);
    if (!v.slice(ini, fin).trim() && lista.length) {
      const s = ctx.sangriaEn(v, ini);
      const grupos = ctx.gruposFunciones(lista, fn => {
        const nombre = ctx.nombreFn(fn), params = fn.firma || [];
        return ctx.opc(`${s}${fn.await ? "await " : ""}${nombre}(${params.map(ctx.H).join(", ")})${ctx.FIN}`, "fn", fn.nota || "", `${nombre}(${params.join(", ")})`);
      });
      return { a: ini, b: fin, datos: { titulo: "Órdenes", donde: `línea ${l + 1}`, grupos } };
    }
    return null;
  };
  ctx.abrirAlternativas = function(pos) {
    if (!ctx.activo || ctx.$codigo.readOnly) { if (ctx.$codigo.readOnly) ctx.cmg.aviso("Detén el programa para editarlo."); return; }
    const r = ctx.alternativas(pos);
    if (!r) {
      const t = ctx.E.atomo(ctx.estructura(), pos);
      if (t) ctx.elegir(t[0], t[1]);
      ctx.toast("No hay alternativas para este elemento.");
      return;
    }
    ctx.elegir(r.a, r.b, { mostrar: true });
    ctx.versionSug++;   // anula la lista automática que pediría elegir()
    ctx.sinSugerir = "";
    ctx.abrirSugerencias(r.datos, r.a, r.b, r.c || { vacio: false, hueco: null }, !!r.numero);
  };
  return function iniciar() {


  // ---------- Sugerencias ----------
  // Al elegir un hueco /* … */, un argumento vacío o (sin teclado) un valor de una llamada conocida,
  // aparece la lista de valores posibles sacada de los datos de la máquina (juego.js: cmg.sugerencias).
  (ctx.$sug = document.createElement("div"));
  ctx.$sug.className = "sugerencias"; ctx.$sug.hidden = true; ctx.$sug.setAttribute("role", "listbox");
  ctx.vida.portal(ctx.$sug);
  (ctx.sugerido = null), (ctx.sinSugerir = ""), (ctx.versionSug = 0);
  (ctx.claveSel = () => `${ctx.$codigo.selectionStart}:${ctx.$codigo.selectionEnd}:${ctx.$codigo.value.length}`);
  (ctx.editorVisible = () => ctx.$editor.getClientRects().length > 0 && ctx.$editor.getBoundingClientRect().height > 20);
  (ctx.METRICAS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariantLigatures", "fontFeatureSettings", "lineHeight",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxSizing", "whiteSpace", "overflowWrap", "wordBreak", "tabSize", "letterSpacing"]);
  // Un clic solo cuenta si la pulsación empezó en la lista: en el teléfono la hoja puede abrirse bajo
  // el dedo que eligió el hueco, y el clic de ese mismo toque elegiría la opción de debajo.
  (ctx.pulsadoEnSug = false);
  ctx.vida.escuchar(ctx.$sug, "pointerdown", (ev) => { ctx.pulsadoEnSug = true; if (!ev.target.closest("input, label")) ev.preventDefault(); });
  ctx.vida.escuchar(ctx.$sug, "click", (ev) => {
    if (ev.detail && !ctx.pulsadoEnSug) return;   // detail 0: activado con el teclado
    ctx.pulsadoEnSug = false;
    if (ev.target.closest("[data-cerrar]")) { ctx.sinSugerir = ctx.claveSel(); return ctx.cerrarSugerencias(); }
    const p = ev.target.closest("[data-paso]");
    if (p) return ctx.pasoNumero(+p.dataset.paso);
    if (ev.target.closest("[data-escribir]")) return ctx.escribirValor();
    const s = ev.target.closest(".sug[data-i]");
    if (s && ctx.sugerido) ctx.ponerValor(ctx.sugerido.items[+s.dataset.i].ins);
  });
  ctx.vida.escuchar(document, "pointerdown", (ev) => {
    ctx.pulsadoEnSug = false;
    if (!ctx.$sug.hidden && !ctx.$sug.contains(ev.target) && !ctx.$vista.contains(ev.target) && ev.target !== ctx.$codigo) ctx.cerrarSugerencias();
  }, true);
  for (const tipo of ["select", "keyup", "pointerup", "focus"]) ctx.vida.escuchar(ctx.$codigo, tipo, () => { if (!ctx.activo) ctx.actualizarSugerencias(); });
  ctx.vida.escuchar(document, "selectionchange", () => { if (!ctx.activo && document.activeElement === ctx.$codigo) ctx.actualizarSugerencias(); });
  ctx.vida.escuchar(ctx.$codigo, "blur", () => ctx.vida.setTimeout(() => { if (!ctx.activo && document.activeElement !== ctx.$codigo && !ctx.$sug.contains(document.activeElement)) ctx.cerrarSugerencias(); }, 120));
  ctx.vida.escuchar(window, "resize", () => { if (ctx.sugerido) ctx.colocarSugerencias(); });
  if (window.visualViewport) ctx.vida.escuchar(visualViewport, "resize", () => { if (ctx.sugerido) ctx.colocarSugerencias(); });

  // ---------- Alternativas: clic derecho o mantener 2 s (sin teclado) ----------
  // Otros elementos del mismo tipo que el elegido, o lo que encaja en su sitio: sobre una función, todas
  // las funciones; sobre un operador, los de su familia; dentro de ( ), [ ] o { }, lo que cabe ahí.
  (ctx.FAMILIAS = ctx.L.familias || [
    ["Comparar", [["===", "igual"], ["!==", "distinto"], [">", "mayor"], ["<", "menor"], [">=", "mayor o igual"], ["<=", "menor o igual"]]],
    ["Combinar", [["&&", "y · se cumplen las dos"], ["||", "o · basta una"], ["??", "si no hay, usa el otro"]]],
    ["Calcular", [["+", "suma"], ["-", "resta"], ["*", "multiplica"], ["/", "divide"], ["%", "resto"]]],
    ["Asignar", [["=", "guarda"], ["+=", "suma y guarda"], ["-=", "resta y guarda"], ["*=", "multiplica y guarda"], ["??=", "solo si no hay"]]],
  ]);
  (ctx.DECLARA = ctx.L.declara || [["const", "no cambia"], ["let", "puede cambiar"]]);
  (ctx.LITERALES = ctx.L.literales || [["true", "verdadero"], ["false", "falso"], ["null", "nada"]]);
  (ctx.opc = (ins, cls, nota, ver) => ({ ins, cls, nota, ver }));
  (ctx.funcionesDisponibles = () => (ctx.cmg.funciones ? ctx.cmg.funciones() : []) || []);
  };
}
