/* Code Battle Lite · edición por bloques: modo sin teclado, barra de edición y sugerencias.
 * El textarea sigue siendo el modelo (valor, selección y guardado). En modo sin teclado queda oculto
 * y la vista #bloques muestra el mismo código como fichas: un toque elige un elemento entero, el doble
 * toque amplía hasta el siguiente límite semántico y arrastrar copia valores o mueve líneas.
 * La barra de edición está siempre en el teléfono y, en PC, solo en modo sin teclado.
 * Habla con juego.js mediante window.cmg y los eventos cmg:* del textarea; la estructura sale de estructura.js. */
(() => {
  "use strict";
  const cmg = window.cmg, E = window.ESTRUCTURA;
  if (!cmg || !E) return;
  const $ = (id) => document.getElementById(id);
  const app = $("app"), $editor = $("editor"), $codigo = cmg.codigo, $gutter = $("gutter"), $barra = $("edicion");
  const $vista = $("bloques"), $in = $("bloques-in"), $texto = $("bloques-texto"), $capa = $("bloques-capa"), $asas = $("asas"), $asasIn = $("asas-in");
  const prefijo = cmg.prefijoUI || "cmg-juego-";
  const leer = (k, d) => { try { const v = localStorage.getItem(`${prefijo}${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(`${prefijo}${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento: dura la sesión */ } };
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const UNIDAD = "  ";   // sangría de los programas de partida

  let activo = false;                                         // modo sin teclado
  let asa = leer("asa", "numero") === "borde" ? "borde" : "numero";   // dónde se agarran las líneas
  let est = null, estDe = null;
  const estructura = () => { const v = $codigo.value; if (v !== estDe) { est = E.analizar(v, cmg.lexico(v)); estDe = v; } return est; };
  const sel = () => [$codigo.selectionStart, $codigo.selectionEnd];
  const pila = [];   // selecciones anteriores a cada «ampliar»: «reducir» vuelve por ellas

  // ---------- Selección ----------
  function elegir(a, b, { conservar = false, mostrar = false } = {}) {
    if (!conservar) pila.length = 0;
    $codigo.setSelectionRange(Math.min(a, b), Math.max(a, b));
    if (activo) { pintarSeleccion(); if (mostrar) mostrarRango(a); }
    actualizarSugerencias();
  }
  function ampliar() {
    const [a, b] = sel(), r = E.ampliar(estructura(), a, b);
    if (!r || (r[0] === a && r[1] === b)) return;
    pila.push([a, b]);
    elegir(r[0], r[1], { conservar: true, mostrar: true });
  }
  function reducir() {
    const r = pila.pop();
    if (r) return elegir(r[0], r[1], { conservar: true, mostrar: true });
    const [a, b] = sel(), t = E.atomo(estructura(), a);
    if (t && (t[0] !== a || t[1] !== b)) elegir(t[0], t[1]);
  }
  // ¿[a, b) ocupa líneas enteras, sin contar la sangría ni los espacios del final?
  function sonLineas(a, b) {
    if (a === b) return false;
    const e = estructura(), v = e.src;
    const la = E.inicioLinea(e, E.lineaDe(e, a)), lb = E.finLinea(e, E.lineaDe(e, Math.max(a, b - 1)));
    return !v.slice(la, a).trim() && !v.slice(b, lb).trim();
  }
  // Líneas completas con su salto: las que cubre la selección, o la sentencia de la línea del cursor.
  function lineasDe(a, b) {
    const e = estructura();
    if (a === b || !sonLineas(a, b)) return E.unidadLinea(e, E.lineaDe(e, a));
    const l1 = E.lineaDe(e, Math.max(a, b - 1));
    return [E.inicioLinea(e, E.lineaDe(e, a)), l1 + 1 < e.lineas.length ? e.lineas[l1 + 1] : e.src.length];
  }
  const sinSalto = ([a, b]) => [a, b > a && $codigo.value[b - 1] === "\n" ? b - 1 : b];
  const variables = (e, hasta) => [...new Set(e.nodos.filter(n => n.k === "decl" && n.a < hasta && n.h[0] && n.h[0].k === "id").map(n => e.src.slice(n.h[0].a, n.h[0].b)))];

  // ---------- Cambios e historial ----------
  const editable = () => { if (!$codigo.readOnly) return true; cmg.aviso("Detén el programa para editarlo."); return false; };
  // Sustituye [a, b) por texto y deja elegido [sa, sb) del texto nuevo. Cada llamada es un paso de deshacer.
  function reemplazar(a, b, texto, sa = a + texto.length, sb = sa) {
    if ($codigo.readOnly) return false;
    hist.operacion = true;
    $codigo.setSelectionRange(a, b);
    cmg.insertar(texto, sa - a, sb - a);
    pila.length = 0;
    if (activo) pintarSeleccion();
    actualizarSugerencias();
    pintarBarra();
    return true;
  }
  // Pasa al texto nuevo cambiando solo el tramo distinto.
  function cambiar(nuevo, sa, sb) {
    const v = $codigo.value;
    let i = 0; while (i < v.length && i < nuevo.length && v[i] === nuevo[i]) i++;
    let j = 0; while (j < v.length - i && j < nuevo.length - i && v[v.length - 1 - j] === nuevo[nuevo.length - 1 - j]) j++;
    return reemplazar(i, v.length - j, nuevo.slice(i, nuevo.length - j), sa, sb);
  }
  // Un historial por documento (programa o borrador). Lo tecleado seguido cuenta como un solo paso.
  const historiales = new Map();
  const capturar = () => cmg.capturarDocumento ? cmg.capturarDocumento() : $codigo.value;
  const nuevoHistorial = () => ({ pasado: [], futuro: [], ultimo: capturar(), t: 0, tecleo: false, operacion: false });
  let hist = nuevoHistorial(), claveDoc = cmg.claveDocumento, aplicando = false;
  $codigo.addEventListener("input", (ev) => {
    const actual = capturar();
    if (aplicando || actual === hist.ultimo) return;
    const ahora = performance.now();
    const tecleo = !hist.operacion && !!ev.inputType && ((ev.inputType === "insertText" && (ev.data || "").length === 1) || ev.inputType.startsWith("deleteContent"));
    if (!(tecleo && hist.tecleo && ahora - hist.t < 1200)) { hist.pasado.push(hist.ultimo); if (hist.pasado.length > 200) hist.pasado.shift(); }
    hist.futuro.length = 0;
    Object.assign(hist, { ultimo: actual, t: ahora, tecleo, operacion: false });
    pintarBarra();
  });
  $codigo.addEventListener("cmg:documento", (ev) => {
    historiales.set(claveDoc, hist);
    claveDoc = ev.detail.clave;
    const h = historiales.get(claveDoc);
    hist = h && h.ultimo === capturar() ? h : nuevoHistorial();
    pila.length = 0;
    cerrarSugerencias();
    pintarBarra();
  });
  // Un cambio de vista conserva el documento, sin añadir un paso de deshacer.
  $codigo.addEventListener("cmg:sincronizado", () => {
    if (claveDoc !== cmg.claveDocumento) return;
    hist.ultimo = capturar(); hist.tecleo = false; pintarBarra();
  });
  function recorrer(desde, hacia) {
    if (!desde.length || !editable()) return;
    const actual = capturar(), otro = desde.pop();
    hacia.push(actual);
    if (cmg.restaurarDocumento) {
      aplicando = true;
      try { cmg.restaurarDocumento(otro); } finally { aplicando = false; }
      Object.assign(hist, { ultimo: capturar(), tecleo: false });
      pintarBarra();
      return;
    }
    let i = 0; while (i < otro.length && i < actual.length && otro[i] === actual[i]) i++;
    let j = 0; while (j < otro.length - i && j < actual.length - i && otro[otro.length - 1 - j] === actual[actual.length - 1 - j]) j++;
    aplicando = true;
    $codigo.value = otro;
    $codigo.dispatchEvent(new Event("input"));
    aplicando = false;
    Object.assign(hist, { ultimo: otro, tecleo: false });
    elegir(i, otro.length - j, { mostrar: true });
    pintarBarra();
  }
  const deshacer = () => recorrer(hist.pasado, hist.futuro);
  const rehacer = () => recorrer(hist.futuro, hist.pasado);

  // ---------- Sangría ----------
  const sangriaDe = (l) => l.match(/^[ \t]*/)[0];
  // Sangría para una línea nueva en pos (principio de línea): la de la anterior con texto, un nivel más tras «{».
  function sangriaEn(texto, pos) {
    const previas = texto.slice(0, pos).split("\n"); previas.pop();
    const previa = previas.reverse().find(l => l.trim());
    if (previa !== undefined) return sangriaDe(previa) + (/\{\s*(\/\/.*)?$/.test(previa) ? UNIDAD : "");
    const siguiente = texto.slice(pos).split("\n").find(l => l.trim());
    return siguiente ? sangriaDe(siguiente) : "";
  }
  function reindentar(bloque, sangria) {
    const lineas = bloque.replace(/\n$/, "").split("\n"), utiles = lineas.filter(l => l.trim());
    const min = utiles.length ? Math.min(...utiles.map(l => sangriaDe(l).length)) : 0;
    return lineas.map(l => l.trim() ? sangria + l.slice(min) : "").join("\n") + (bloque.endsWith("\n") ? "\n" : "");
  }

  // ---------- Acciones ----------
  // Mueve (o copia) las líneas [la, lb) a la frontera anterior a la línea l, con la sangría del destino.
  function moverLineasA(la, lb, l, copia = false) {
    const v = $codigo.value, e = estructura();
    const destino = l < e.lineas.length ? e.lineas[l] : v.length;
    if (!copia && destino >= la && destino <= lb) return false;
    let bloque = v.slice(la, lb);
    if (!bloque.endsWith("\n")) bloque += "\n";
    const resto = copia ? v : v.slice(0, la) + v.slice(lb);
    const pos = Math.min(resto.length, copia || destino < la ? destino : destino - (lb - la));
    const salto = pos === resto.length && resto.length && !resto.endsWith("\n") ? "\n" : "";
    const nuevo = reindentar(bloque, sangriaEn(resto, pos));
    let final = resto.slice(0, pos) + salto + nuevo + resto.slice(pos);
    if (!v.endsWith("\n") && final.endsWith("\n")) final = final.slice(0, -1);   // mover no añade un salto al final
    const sa = pos + salto.length;
    return cambiar(final, sa, sa + nuevo.replace(/\n$/, "").length);
  }
  function moverLineas(dir) {
    if (!editable()) return;
    const [a, b] = sel(), e = estructura(), [la, lb] = lineasDe(a, b);
    const l0 = E.lineaDe(e, la), l1 = E.lineaDe(e, Math.max(la, lb - 1));
    let l = dir < 0 ? l0 - 1 : l1 + 2;
    while (l > 0 && l < e.lineas.length && !E.fronteraValida(e, l)) l += dir;
    if (l < 0 || l > e.lineas.length || (dir > 0 && l1 + 1 >= e.lineas.length)) return;
    moverLineasA(la, lb, l);
  }
  // Quita [a, b) como un bloque: un argumento deja su hueco y una condición el suyo; las líneas
  // enteras se van con su salto y no quedan espacios dobles.
  // Partes sin las que su construcción no se sostiene: el nombre declarado, lo que espera un await,
  // el nombre de una función o el objeto/método de una llamada. Borrarlas borra la construcción
  // (y su sentencia, si la ocupa entera), en vez de dejar «const =», «await;» o «();».
  function contenedorNecesario(e, n) {
    const pa = n.padre;
    if (!pa) return null;
    let x = null;
    if (pa.k === "decl" && pa.h.includes(n)) {
      const previo = e.sig[n.ia - 1];
      if (!(previo && previo.k === "p" && previo.v === "=") || n.k === "hueco") x = pa;   // el valor inicial se queda en hueco
    } else if (pa.k === "unaria" && pa.op === "await") x = pa;
    else if (pa.k === "llamada" && pa.h[0] === n) x = pa;
    else if (pa.k === "metodo" && pa.h[0] === n) x = pa.llamada;
    else if (pa.k === "miembro") x = pa;
    while (x && x.padre && x.padre.k === "sentencia" && x.padre.h[0] === x) x = x.padre;
    return x;
  }
  function quitar(a, b) {
    const e = estructura(), v = e.src, c = E.contexto(e, a, b);
    // Operando de una operación binaria: se va con su operador y queda el otro («pos ?? x» → «pos»).
    if (c && c.binaria && !c.vacio) {
      const [izq, der] = c.binaria.h;
      return c.nodo === der ? reemplazar(izq.b, der.b, "", izq.b) : reemplazar(izq.a, der.a, "", izq.a);
    }
    const sube = c && c.tipo !== "argumento" && c.tipo !== "elemento" ? contenedorNecesario(e, c.nodo) : null;
    if (sube) return quitar(sube.a, sube.b);
    if (c && c.nodo.padre && c.nodo.padre.k === "decl" && c.tipo == null) {   // valor inicial → hueco
      const h = "/* valor */";
      return reemplazar(a, b, h, a, a + h.length);
    }
    if (c && c.tipo === "argumento" && !c.vacio) {
      const nombre = (cmg.firma(c.funcion) || [])[c.indice];
      if (nombre && !c.hueco) { const h = `/* ${nombre} */`; return reemplazar(a, b, h, a, a + h.length); }
      const ll = c.nodo.padre.k === "metodo" ? c.nodo.padre.llamada : c.nodo.padre, args = ll.args, i = args.indexOf(c.nodo);
      if (i < args.length - 1) return reemplazar(a, args[i + 1].a, "", a);
      if (i > 0) return reemplazar(args[i - 1].b, b, "", args[i - 1].b);
      return reemplazar(a, b, "", a);
    }
    if (c && c.tipo === "condicion") {
      if (c.hueco) return toast("La condición no puede quedar vacía: elige un valor o borra la sentencia.");
      const h = "/* condición */";
      return reemplazar(a, b, h, a, a + h.length);
    }
    if (sonLineas(a, b)) {
      const [la, lb] = lineasDe(a, b), ini = lb === v.length && la > 0 && !v.endsWith("\n") ? la - 1 : la;
      // El cursor queda al final de la línea anterior: lo siguiente que se inserte cae donde estaba lo borrado.
      const cursor = ini === la && la > 0 ? la - 1 : ini;
      return reemplazar(ini, lb, "", cursor, cursor);
    }
    let x = a, y = b;
    if (v[x - 1] === " " && (v[y] === " " || /[)\],;]/.test(v[y] || "") || y === v.length)) x--;
    else if (v[y] === " " && (x === 0 || /[([\n]/.test(v[x - 1]))) y++;
    reemplazar(x, y, "", x);
  }
  function borrar() {
    if (!editable()) return;
    const [a, b] = sel(), v = $codigo.value;
    if (!activo) {   // con teclado: igual que la tecla de borrar
      if (a !== b) return reemplazar(a, b, "", a);
      return a > 0 && reemplazar(a - 1, a, "", a - 1);
    }
    if (a !== b) return quitar(a, b);
    // Sin selección: el elemento anterior al cursor, o une la línea con la anterior.
    let p = a; while (p > 0 && (v[p - 1] === " " || v[p - 1] === "\t")) p--;
    if (p === 0) return;
    if (v[p - 1] === "\n") return reemplazar(p - 1, a, "", p - 1);
    const t = E.atomo(estructura(), p - 1);
    if (t) quitar(t[0], t[1]);
  }
  function duplicar() {
    if (!editable()) return;
    const [a, b] = sel(), v = $codigo.value, c = a !== b ? E.contexto(estructura(), a, b) : null;
    if (c && c.tipo === "elemento" && !c.vacio) { const t = v.slice(a, b); return reemplazar(b, b, ", " + t, b + 2, b + 2 + t.length); }
    const [la, lb] = lineasDe(a, b), bloque = v.slice(la, lb);
    if (!bloque.endsWith("\n")) return reemplazar(lb, lb, "\n" + bloque, lb + 1, lb + 1 + bloque.length);
    reemplazar(lb, lb, bloque, lb, lb + bloque.length - 1);
  }
  // Línea nueva bajo el cursor (o bajo lo elegido), ya sangrada; el cursor queda en ella.
  function lineaNueva() {
    if (!editable()) return;
    const [a, b] = sel(), v = $codigo.value, e = estructura();
    const fin = a === b ? E.finLinea(e, E.lineaDe(e, a)) : sinSalto(lineasDe(a, b))[1];
    const ini = v.lastIndexOf("\n", fin - 1) + 1, linea = v.slice(ini, fin);
    const s = linea.trim() ? sangriaDe(linea) + (/\{\s*(\/\/.*)?$/.test(linea) ? UNIDAD : "") : sangriaEn(v, ini);
    reemplazar(fin, fin, "\n" + s, fin + 1 + s.length);
  }
  function sangrar(dir) {
    if (!editable()) return;
    const [a, b] = sel(), e = estructura(), v = e.src;
    const la = E.inicioLinea(e, E.lineaDe(e, a)), lb = E.finLinea(e, E.lineaDe(e, Math.max(a, b - 1)));
    const texto = v.slice(la, lb).split("\n").map(l => !l.trim() ? l : dir > 0 ? UNIDAD + l : l.replace(/^ {1,2}/, "")).join("\n");
    reemplazar(la, lb, texto, la, la + texto.length);
  }

  // ---------- Portapapeles ----------
  // En la IP de la red local (sin contexto seguro) el navegador no deja leer el portapapeles del sistema:
  // pegar usa entonces lo último copiado aquí.
  let portapapeles = (() => { try { return sessionStorage.getItem("cmg-portapapeles") || ""; } catch { return ""; } })();
  function guardarCopia(t) { portapapeles = t; try { sessionStorage.setItem("cmg-portapapeles", t); } catch { /* solo en memoria */ } }
  function aSistema(t) {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).catch(() => {}); return; }
    if (document.activeElement === $codigo && $codigo.value.slice($codigo.selectionStart, $codigo.selectionEnd) === t) { try { document.execCommand("copy"); } catch { /* queda la copia interna */ } return; }
    // Textarea de solo lectura: no abre el teclado del teléfono.
    const antes = document.activeElement, tmp = document.createElement("textarea");
    tmp.value = t; tmp.readOnly = true;
    Object.assign(tmp.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
    document.body.append(tmp); tmp.select(); tmp.setSelectionRange(0, t.length);
    try { document.execCommand("copy"); } catch { /* queda la copia interna */ }
    tmp.remove();
    if (antes && antes !== document.body && antes.focus) antes.focus({ preventScroll: true });
  }
  function copiar(cortar = false) {
    let [a, b] = sel();
    if (a === b) [a, b] = sinSalto(lineasDe(a, a));   // sin selección: la línea
    if (a === b) return toast("No hay nada que copiar.");
    const t = $codigo.value.slice(a, b);
    guardarCopia(t); aSistema(t);
    if (cortar && editable()) { activo ? quitar(a, b) : reemplazar(a, b, "", a); toast("Cortado"); }
    else toast("Copiado");
  }
  async function pegar() {
    if (!editable()) return;
    let t = "";
    if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) { try { t = await navigator.clipboard.readText(); } catch { t = ""; } }
    t = t || portapapeles;
    if (!t) return toast("No hay nada copiado.");
    pegarTexto(t);
  }
  // Lo que ocupa líneas se pega como líneas, con la sangría del sitio; lo demás, en la selección.
  function pegarTexto(t) {
    const [a, b] = sel(), v = $codigo.value, e = estructura();
    const lineaVacia = a === b && !v.slice(E.inicioLinea(e, E.lineaDe(e, a)), E.finLinea(e, E.lineaDe(e, a))).trim();
    if (t.includes("\n") && (lineaVacia || sonLineas(a, b))) {
      const [la, lb] = lineaVacia ? [E.inicioLinea(e, E.lineaDe(e, a)), E.finLinea(e, E.lineaDe(e, a))] : sinSalto(lineasDe(a, b));
      const nuevo = reindentar(t.replace(/\n$/, ""), sangriaEn(v, la));
      return reemplazar(la, lb, nuevo, la, la + nuevo.length);
    }
    reemplazar(a, b, t, a, a + t.length);
  }

  // ---------- Vista de bloques ----------
  // Una línea por div y una ficha por span (también los espacios), con su posición en data-a.
  let filas = [], pintado = null;
  function pintarVista() {
    const v = $codigo.value, toks = cmg.lexico(v), lineas = [];
    let linea = "", off = 0;
    toks.forEach((t, i) => {
      const [k, txt] = t;
      if (k === "nl") { lineas.push(linea); linea = ""; off++; return; }
      const cls = k === "esp" ? "e" : (cmg.clasificar(toks, i) || (k === "id" ? "nom" : k));
      txt.split("\n").forEach((parte, j) => {
        if (j) { lineas.push(linea); linea = ""; off++; }
        if (parte) linea += `<span class="${cls}" data-a="${off}">${esc(parte)}</span>`;
        off += parte.length;
      });
    });
    lineas.push(linea);
    $texto.innerHTML = lineas.map((l, i) => `<div class="ln" data-l="${i}">${l}</div>`).join("");
    filas = [];
    let inicio = 0;
    v.split("\n").forEach((l, i) => {
      const el = $texto.children[i];
      filas.push({ a: inicio, b: inicio + l.length, el, piezas: [...el.children].map(s => ({ a: +s.dataset.a, b: +s.dataset.a + s.textContent.length, el: s })) });
      inicio += l.length + 1;
    });
    pintado = v;
  }
  function filaDe(pos) {
    let lo = 0, hi = filas.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (filas[m].a <= pos) lo = m; else hi = m - 1; }
    return filas[lo] || null;
  }
  function puntoDOM(pos) {
    const f = filaDe(pos);
    if (!f) return null;
    for (const p of f.piezas) if (pos >= p.a && pos <= p.b) return [p.el.firstChild, pos - p.a];
    if (!f.piezas.length) return [f.el, 0];
    const u = f.piezas[f.piezas.length - 1];
    return pos < f.piezas[0].a ? [f.piezas[0].el.firstChild, 0] : [u.el.firstChild, u.el.textContent.length];
  }
  function rectsDe(a, b) {
    const p = puntoDOM(a), q = puntoDOM(b);
    if (!p || !q) return [];
    const r = document.createRange();
    r.setStart(...p); r.setEnd(...q);
    return [...r.getClientRects()].filter(x => x.width > 0 || x.height > 0);
  }
  // Un rectángulo por renglón visual: los elementos completos y su texto se repiten en getClientRects.
  function renglones(rects) {
    const out = [];
    for (const r of [...rects].sort((x, y) => x.top - y.top)) {
      const u = out[out.length - 1], c = r.top + r.height / 2;
      if (u && c > u.top && c < u.bottom) { u.left = Math.min(u.left, r.left); u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom); }
      else out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  }
  function rectCaret(pos) {
    const p = puntoDOM(pos);
    if (!p) return null;
    if (p[0].nodeType !== 3) { const r = p[0].getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom, height: r.height }; }
    const r = document.createRange();
    r.setStart(...p); r.collapse(true);
    const x = r.getClientRects()[0] || r.getBoundingClientRect();
    return { left: x.left, top: x.top, bottom: x.bottom, height: x.height };
  }
  function caja(cls, l, t, w, h) {
    const base = $in.getBoundingClientRect(), d = document.createElement("div");
    d.className = cls;
    Object.assign(d.style, { left: `${l - base.left}px`, top: `${t - base.top}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
    $capa.append(d);
    return d;
  }
  function pintarSeleccion() {
    if (!activo) return;
    if ($codigo.value !== pintado) pintarVista();
    for (const d of [...$capa.children]) if (!d.classList.contains("destino-b")) d.remove();
    for (const s of $texto.querySelectorAll(".sel")) s.classList.remove("sel");
    const [a, b] = sel();
    if (a === b) { const r = rectCaret(a); if (r) caja("cursor-b", r.left - 1, r.top, 2, r.height); return; }
    // Lo elegido no desplaza la vista al tocarlo: se puede arrastrar con el dedo.
    for (const f of filas) if (f.a <= b && f.b >= a) for (const p of f.piezas) if (p.a < b && p.b > a) p.el.classList.add("sel");
    const rs = renglones(rectsDe(a, b));
    if (!rs.length) return;
    if (sonLineas(a, b)) {
      const t = $texto.getBoundingClientRect(), cs = getComputedStyle($texto), izq = parseFloat(cs.paddingLeft) || 0, der = parseFloat(cs.paddingRight) || 0;
      caja("sel-b lineas", t.left + izq - 4, rs[0].top, t.width - izq - der + 8, rs[rs.length - 1].bottom - rs[0].top);
      return;
    }
    for (const r of rs) caja("sel-b", r.left - 2, r.top, r.right - r.left + 4, r.bottom - r.top);
  }
  function mostrarRango(pos) {
    const r = rectCaret(pos), v = $vista.getBoundingClientRect();
    if (!r) return;
    if (r.top < v.top + 8) $vista.scrollTop -= v.top + 8 - r.top;
    else if (r.bottom > v.bottom - 8) $vista.scrollTop += r.bottom - v.bottom + 8;
  }
  // Posición del texto bajo el puntero: el carácter dentro de una ficha o el borde más cercano.
  const distY = (r, y) => y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
  function enPieza(span, x, y, caracter) {
    const t = span.firstChild;
    if (!t) return 0;
    const r = document.createRange();
    let mejor = 0, dist = Infinity;
    for (let i = 0; i < t.length + (caracter ? 0 : 1); i++) {
      r.setStart(t, i); r.setEnd(t, caracter ? i + 1 : i);
      const c = r.getClientRects()[0] || r.getBoundingClientRect();
      const d = distY(c, y) * 1000 + (caracter ? (x < c.left ? c.left - x : x > c.right ? x - c.right : 0) : Math.abs(c.left - x));
      if (d < dist) { dist = d; mejor = i; }
    }
    return mejor;
  }
  function posEn(x, y) {
    const el = document.elementFromPoint(x, y);
    const pieza = el && el.closest && el.closest("#bloques-texto span[data-a]");
    if (pieza) return +pieza.dataset.a + enPieza(pieza, x, y, false);
    const ln = el && el.closest && el.closest("#bloques-texto .ln");
    let mejor = null, dist = Infinity;
    for (const f of ln ? [filas[+ln.dataset.l]] : filas) {
      if (!f) continue;
      if (!f.piezas.length) { const d = distY(f.el.getBoundingClientRect(), y) * 1000; if (d < dist) { dist = d; mejor = f.a; } continue; }
      for (const p of f.piezas) for (const r of p.el.getClientRects()) {
        const d = distY(r, y) * 1000 + (x < r.left ? r.left - x : x > r.right ? x - r.right : 0);
        if (d < dist) { dist = d; mejor = x <= r.left ? p.a : x >= r.right ? p.b : p.a + enPieza(p.el, x, y, false); }
      }
    }
    return mejor ?? 0;
  }
  // Lo que hay bajo el puntero: una ficha (con el carácter exacto) o un hueco entre fichas.
  function objetivo(x, y) {
    const el = document.elementFromPoint(x, y);
    const pieza = el && el.closest && el.closest("#bloques-texto span[data-a]");
    if (pieza && !pieza.classList.contains("e")) return { pos: +pieza.dataset.a + enPieza(pieza, x, y, true), ficha: true };
    return { pos: posEn(x, y), ficha: false };
  }

  // ---------- Toques: elegir, ampliar con doble toque y arrastrar ----------
  const DOBLE_MS = 380, LARGO_MS = 430;
  let gesto = null, ultimoToque = null, tSimple = 0, pendiente = null;
  // Un botón (barra, paleta, sugerencias…) actúa sobre lo último que se tocó: la elección que esperaba
  // un posible doble toque se aplica ya. Un cambio de texto la anula, su posición ya no vale.
  function resolverPendiente() {
    clearTimeout(tSimple); tSimple = 0;
    const o = pendiente; pendiente = null;
    if (o) simple(o, false);
  }
  document.addEventListener("pointerdown", (ev) => { if (pendiente && !$vista.contains(ev.target)) resolverPendiente(); }, true);
  $codigo.addEventListener("input", () => { clearTimeout(tSimple); tSimple = 0; pendiente = null; });
  const $fantasma = document.createElement("div");
  $fantasma.className = "fantasma-bloque"; $fantasma.hidden = true; $fantasma.setAttribute("aria-hidden", "true");
  document.body.append($fantasma);
  $vista.addEventListener("pointerdown", (ev) => {
    if (!activo || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    if (ev.pointerType === "mouse") { ev.preventDefault(); $vista.focus({ preventScroll: true }); }
    const o = objetivo(ev.clientX, ev.clientY), [a, b] = sel();
    gesto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, o, antes: [a, b], dentro: a < b && o.pos >= a && o.pos < b, raton: ev.pointerType === "mouse" };
    // Con el dedo, una ficha sin elegir se levanta manteniéndola pulsada (si no, el dedo desplaza la vista).
    if (!gesto.raton && !gesto.dentro && o.ficha) gesto.largo = setTimeout(levantar, LARGO_MS);
  });
  function levantar() {
    if (!gesto || gesto.arrastre) return;
    const r = E.atomo(estructura(), gesto.o.pos);
    if (!r) return;
    elegir(r[0], r[1]);
    Object.assign(gesto, { levantado: true, antes: r, dentro: true });
    if (navigator.vibrate) navigator.vibrate(10);
  }
  window.addEventListener("pointermove", (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    if (gesto.arrastre) { gesto.arrastre.x = ev.clientX; gesto.arrastre.y = ev.clientY; moverArrastre(ev.clientX, ev.clientY); return; }
    if (Math.hypot(ev.clientX - gesto.x, ev.clientY - gesto.y) < (gesto.raton ? 5 : 9)) return;
    clearTimeout(gesto.largo);
    if (gesto.lineas) return iniciarArrastre(ev, gesto.lineas, true);
    if (gesto.raton || gesto.dentro || gesto.levantado) {
      const r = gesto.dentro ? gesto.antes : E.atomo(estructura(), gesto.o.pos);
      if (!r || r[0] === r[1]) { gesto = null; return; }
      if (!gesto.dentro) elegir(r[0], r[1]);
      return sonLineas(r[0], r[1]) ? iniciarArrastre(ev, lineasDe(r[0], r[1]), true) : iniciarArrastre(ev, r, false);
    }
    gesto = null;   // el dedo desplaza la vista
  });
  window.addEventListener("pointerup", (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    clearTimeout(gesto.largo);
    const g = gesto; gesto = null;
    if (g.arrastre) return soltar(ev, g.arrastre);
    if (g.lineas) return elegir(...sinSalto(g.lineas));   // toque en un asa: elige la sentencia de esa línea
    if (!g.levantado) toque(g, ev);
  });
  window.addEventListener("pointercancel", (ev) => {
    if (!gesto || ev.pointerId !== gesto.id) return;
    clearTimeout(gesto.largo);
    if (gesto.arrastre) terminarArrastre();
    gesto = null;
  });
  // Con la ficha levantada el dedo arrastra en vez de desplazar.
  $vista.addEventListener("touchmove", (ev) => { if (gesto && (gesto.arrastre || gesto.levantado)) ev.preventDefault(); }, { passive: false });
  $vista.addEventListener("contextmenu", (ev) => { if (activo) ev.preventDefault(); });

  // Un toque elige el elemento entero; el doble toque amplía hasta el siguiente límite semántico.
  // Un toque dentro de lo elegido espera un momento por si llega el segundo, así ampliar no parpadea.
  function toque(g, ev) {
    const ahora = performance.now();
    const doble = ultimoToque && ahora - ultimoToque.t < DOBLE_MS && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 26;
    clearTimeout(tSimple); pendiente = null;
    if (doble) {
      const base = ultimoToque.base;
      ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, base: null };
      if (base && base[0] < base[1] && g.o.pos >= base[0] && g.o.pos < base[1]) $codigo.setSelectionRange(...base);
      const [a, b] = sel();
      if (a === b || g.o.pos < a || g.o.pos >= b) { const t = E.atomo(estructura(), g.o.pos); if (t) $codigo.setSelectionRange(...t); }
      pila.length = 0;
      return ampliar();
    }
    ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, base: g.antes };
    const [a, b] = g.antes, shift = ev.shiftKey;
    if (a < b && g.o.pos >= a && g.o.pos < b && !shift) { pendiente = g.o; tSimple = setTimeout(resolverPendiente, DOBLE_MS); return; }
    simple(g.o, shift);
  }
  function simple(o, extender) {
    const t = o.ficha ? E.atomo(estructura(), o.pos) : null, r = t || [o.pos, o.pos];
    if (extender) { const [a, b] = sel(); return elegir(Math.min(a, r[0]), Math.max(b, r[1])); }
    elegir(r[0], r[1]);
  }

  // Arrastrar: los valores se copian sobre un hueco, un argumento o dentro de ( ) y [ ];
  // las sentencias y líneas completas se mueven entre líneas (con Alt o Ctrl, se copian).
  function iniciarArrastre(ev, [a, b], lineas) {
    if (!editable() || a === b) { gesto = null; return; }
    const v = $codigo.value;
    gesto.arrastre = { a, b, texto: v.slice(a, b), lineas, x: ev.clientX, y: ev.clientY, tactil: ev.pointerType !== "mouse", destino: null };
    const t = v.slice(a, b).replace(/\n$/, ""), primera = t.split("\n")[0].trim();
    $fantasma.textContent = primera.length > 42 ? primera.slice(0, 40) + "…" : primera + (t.includes("\n") ? " …" : "");
    $fantasma.hidden = false;
    $editor.classList.add("arrastrando");
    cerrarSugerencias();
    moverArrastre(ev.clientX, ev.clientY);
    autoDesplazar();
  }
  function moverArrastre(x, y) {
    const d = gesto.arrastre, r = $vista.getBoundingClientRect(), ed = $editor.getBoundingClientRect();
    $fantasma.style.transform = `translate(${Math.round(x + 12)}px, ${Math.round(y - (d.tactil ? 48 : 18))}px)`;
    // Todo el editor cuenta: número de línea, código y columna de asas.
    const dentro = x >= ed.left - 10 && x <= ed.right + 10 && y >= r.top - 4 && y <= r.bottom + 4;
    d.destino = !dentro ? null : d.lineas ? destinoLineas(y, d) : destinoValor(x, y, d);
    pintarDestino(d);
  }
  function destinoLineas(y, d) {
    const e = estructura(), l0 = E.lineaDe(e, d.a), l1 = E.lineaDe(e, Math.max(d.a, d.b - 1)) + 1;
    let mejor = null;
    for (let l = 0; l <= filas.length; l++) {
      const yl = l < filas.length ? filas[l].el.getBoundingClientRect().top : filas[filas.length - 1].el.getBoundingClientRect().bottom;
      if (!mejor || Math.abs(y - yl) < Math.abs(y - mejor.y)) mejor = { tipo: "linea", l, y: yl };
    }
    if (!mejor) return null;
    if (mejor.l >= l0 && mejor.l <= l1) return { ...mejor, nulo: true };   // en su propio sitio
    return { ...mejor, valido: E.fronteraValida(e, mejor.l) };
  }
  function destinoValor(x, y, d) {
    const o = objetivo(x, y), ch = $codigo.value[o.pos];
    // Sobre un paréntesis o corchete que abre, el valor cae dentro.
    const pos = o.ficha && (ch === "(" || ch === "[") ? o.pos + 1 : o.pos;
    if (pos >= d.a && pos <= d.b) return null;
    const t = E.destino(estructura(), pos);
    if (!t) return { tipo: "insertar", a: pos, b: pos, valido: false };
    if (t.a < d.b && t.b > d.a) return null;
    return { ...t, valido: true };
  }
  function pintarDestino(d) {
    for (const x of $capa.querySelectorAll(".destino-b")) x.remove();
    const t = d.destino;
    $fantasma.classList.toggle("no", !!t && t.valido === false);
    if (!t || t.nulo) return;
    if (t.tipo === "linea") { const r = $texto.getBoundingClientRect(); caja(`destino-b linea${t.valido ? "" : " no"}`, r.left + 4, t.y - 1.5, r.width - 8, 3); return; }
    if (t.tipo === "reemplazar") { for (const r of renglones(rectsDe(t.a, t.b))) caja("destino-b hueco", r.left - 3, r.top - 1, r.right - r.left + 6, r.bottom - r.top + 2); return; }
    const c = rectCaret(t.a);
    if (c) caja(`destino-b cursor${t.valido ? "" : " no"}`, c.left - 1.5, c.top, 3, c.height);
  }
  function soltar(ev, d) {
    terminarArrastre();
    const t = d.destino;
    if (!t || t.nulo || t.valido === false || !editable()) return;
    if (d.lineas) return moverLineasA(d.a, d.b, t.l, ev.altKey || ev.ctrlKey || ev.metaKey);
    // Un valor se duplica: el original se queda donde estaba.
    if (t.tipo === "reemplazar") return reemplazar(t.a, t.b, d.texto, t.a, t.a + d.texto.length);
    const ins = t.vacio || t.lista ? E.enLista($codigo.value, t.a, t.b, d.texto) : d.texto, ini = t.a + ins.indexOf(d.texto);
    reemplazar(t.a, t.b, ins, ini, ini + d.texto.length);
  }
  let rafDesplazar = 0;
  function terminarArrastre() {
    $fantasma.hidden = true;
    $editor.classList.remove("arrastrando");
    for (const x of $capa.querySelectorAll(".destino-b")) x.remove();
    cancelAnimationFrame(rafDesplazar);
  }
  // Cerca de los bordes de la vista, el arrastre la desplaza.
  function autoDesplazar() {
    cancelAnimationFrame(rafDesplazar);
    const paso = () => {
      if (!gesto || !gesto.arrastre) return;
      const r = $vista.getBoundingClientRect(), { x, y } = gesto.arrastre, borde = 34;
      const v = y < r.top + borde ? y - r.top - borde : y > r.bottom - borde ? y - r.bottom + borde : 0;
      if (v) { $vista.scrollTop += Math.max(-16, Math.min(16, v * 0.4)); moverArrastre(x, y); }
      rafDesplazar = requestAnimationFrame(paso);
    };
    rafDesplazar = requestAnimationFrame(paso);
  }
  // Palabras arrastradas desde el inspector (arrastre nativo del navegador en PC).
  $vista.addEventListener("dragover", (ev) => {
    if (!activo || $codigo.readOnly || !ev.dataTransfer.types.includes("text/plain")) return;
    ev.preventDefault(); ev.dataTransfer.dropEffect = "copy";
  });
  $vista.addEventListener("drop", (ev) => {
    if (!activo) return;
    ev.preventDefault();
    $editor.classList.remove("soltar");
    const texto = ev.dataTransfer.getData("text/plain");
    if (!texto || !editable()) return;
    const t = destinoValor(ev.clientX, ev.clientY, { a: -1, b: -1 });
    if (t && t.valido) soltar(ev, { texto, lineas: false, destino: t });
    else { const p = posEn(ev.clientX, ev.clientY); reemplazar(p, p, texto, p, p + texto.length); }
  });

  // ---------- Asas de línea: en el número o en el borde derecho ----------
  function iniciarAsa(ev, l) {
    if (!activo || l < 0) return;
    ev.preventDefault();
    const u = E.unidadLinea(estructura(), l);
    if (u[0] === u[1]) return;
    gesto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, raton: ev.pointerType === "mouse", lineas: u, o: { pos: u[0] }, antes: sel() };
  }
  $gutter.addEventListener("pointerdown", (ev) => {
    if (!activo || asa !== "numero" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const d = ev.target.closest(".gutter-in > div");
    if (d) iniciarAsa(ev, [...$gutter.children].indexOf(d));
  });
  $asasIn.addEventListener("pointerdown", (ev) => {
    const d = ev.target.closest("[data-l]");
    if (d && !(ev.pointerType === "mouse" && ev.button !== 0)) iniciarAsa(ev, +d.dataset.l);
  });
  function pintarAsas() {
    if (!activo || asa !== "borde") { $asasIn.innerHTML = ""; return; }
    $asasIn.innerHTML = filas.map((f, i) => $codigo.value.slice(f.a, f.b).trim()
      ? `<div class="asa" data-l="${i}" style="top:${f.el.offsetTop}px" title="Arrastra la línea ${i + 1}"></div>` : "").join("");
    $asasIn.style.transform = `translateY(${-$vista.scrollTop}px)`;
  }
  $vista.addEventListener("scroll", () => {
    cmg.alDesplazar();
    $asasIn.style.transform = `translateY(${-$vista.scrollTop}px)`;
    if (!$sug.hidden) colocarSugerencias();
  }, { passive: true });

  // ---------- Sugerencias ----------
  // Al elegir un hueco /* … */, un argumento vacío o (sin teclado) un valor de una llamada conocida,
  // aparece la lista de valores posibles sacada de los datos de la máquina (juego.js: cmg.sugerencias).
  const $sug = document.createElement("div");
  $sug.className = "sugerencias"; $sug.hidden = true; $sug.setAttribute("role", "listbox");
  document.body.append($sug);
  let sugerido = null, sinSugerir = "", versionSug = 0;
  const claveSel = () => `${$codigo.selectionStart}:${$codigo.selectionEnd}:${$codigo.value.length}`;
  const editorVisible = () => $editor.getClientRects().length > 0 && $editor.getBoundingClientRect().height > 20;
  // Varias peticiones seguidas se resuelven una vez, al terminar la tarea actual (insertar() fija
  // la selección después de su evento input). Cerrar la lista anula las pendientes.
  function actualizarSugerencias() {
    const v = ++versionSug;
    queueMicrotask(() => {
      if (v !== versionSug || (gesto && gesto.arrastre)) return;
      if ($codigo.readOnly || !editorVisible() || (!activo && document.activeElement !== $codigo)) return cerrarSugerencias();
      if (sinSugerir === claveSel()) return;
      const [a, b] = sel(), e = estructura(), c = E.contexto(e, a, b);
      if (!c || !(c.hueco || c.vacio || (activo && c.hoja && c.tipo))) return cerrarSugerencias();
      const numero = activo && c.nodo.k === "num";
      const datos = cmg.sugerencias({ tipo: c.tipo, funcion: c.funcion, objeto: c.objeto, indice: c.indice, hueco: c.hueco, variables: variables(e, a) });
      if (!datos && !numero) return cerrarSugerencias();
      abrirSugerencias(datos || { titulo: "Número", grupos: [] }, a, b, c, numero);
    });
  }
  function abrirSugerencias(datos, a, b, c, numero) {
    const items = [];
    let html = `<div class="sug-cab"><b>${esc(datos.titulo)}</b>${datos.donde ? `<span>${esc(datos.donde)}</span>` : ""}<button type="button" class="sug-x" data-cerrar aria-label="Cerrar sugerencias">×</button></div>`;
    if (numero) html += `<div class="sug-num"><button type="button" data-paso="-1" aria-label="Restar">−</button><code class="num">${esc($codigo.value.slice(a, b))}</code><button type="button" data-paso="1" aria-label="Sumar">+</button></div>`;
    for (const g of datos.grupos) {
      if (!g.items.length) continue;
      if (g.titulo) html += `<div class="sug-g">${esc(g.titulo)}</div>`;
      for (const it of g.items) {
        html += `<button type="button" class="sug" role="option" data-i="${items.length}"><code class="${esc(it.cls || "")}">${esc(it.ver || it.ins)}</code>${it.nota ? `<span class="nota">${esc(it.nota)}</span>` : ""}</button>`;
        items.push(it);
      }
    }
    html += `<button type="button" class="sug escribir" data-escribir>✎ Escribir otro valor…</button>`;
    $sug.innerHTML = html;
    $sug.setAttribute("aria-label", `Valores para ${datos.titulo.toLowerCase()}`);
    sugerido = { a, b, c, items, activo: -1 };
    $sug.hidden = false;
    colocarSugerencias();
  }
  function cerrarSugerencias() { versionSug++; if (!$sug.hidden) { $sug.hidden = true; $sug.innerHTML = ""; } sugerido = null; }
  const METRICAS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "fontVariantLigatures", "fontFeatureSettings", "lineHeight",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxSizing", "whiteSpace", "overflowWrap", "wordBreak", "tabSize", "letterSpacing"];
  // Rectángulo de [a, b) en pantalla: de la vista de bloques o, con teclado, de un espejo del textarea.
  function rectDe(a, b) {
    if (activo) {
      const rs = renglones(a === b ? [rectCaret(a)].filter(Boolean).map(r => ({ ...r, width: 1, right: r.left + 1 })) : rectsDe(a, b));
      return rs.length ? { left: rs[0].left, top: rs[0].top, bottom: rs[rs.length - 1].bottom } : null;
    }
    const cs = getComputedStyle($codigo), r = $codigo.getBoundingClientRect(), espejo = document.createElement("div"), v = $codigo.value, marca = document.createElement("span");
    for (const k of METRICAS) espejo.style[k] = cs[k];
    Object.assign(espejo.style, { position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${$codigo.clientWidth}px`, height: `${$codigo.clientHeight}px`, overflow: "hidden", visibility: "hidden", pointerEvents: "none" });
    marca.textContent = v.slice(a, b) || "​";
    espejo.append(document.createTextNode(v.slice(0, a)), marca, document.createTextNode(v.slice(b)));
    document.body.append(espejo);
    espejo.scrollTop = $codigo.scrollTop;
    const rs = marca.getClientRects(), res = rs.length ? { left: rs[0].left, top: rs[0].top, bottom: rs[rs.length - 1].bottom } : null;
    espejo.remove();
    return res;
  }
  function colocarSugerencias() {
    if (!sugerido) return;
    const r = rectDe(sugerido.a, sugerido.b), cont = $editor.getBoundingClientRect();
    if (!r || r.bottom < cont.top || r.top > cont.bottom) { $sug.style.visibility = "hidden"; return; }
    $sug.style.visibility = "";
    // Nunca sube por encima de la paleta ni de la barra de edición: se siguen pudiendo usar con la lista abierta.
    const vv = window.visualViewport, barras = [$barra, $("paleta")].filter(x => x.getClientRects().length).map(x => x.getBoundingClientRect().bottom);
    const techo = Math.max(vv ? vv.offsetTop : 0, ...barras) + 4;
    const suelo = (vv ? vv.offsetTop + vv.height : innerHeight) - (app.classList.contains("teclado") ? 46 : 0) - 4;
    $sug.classList.remove("hoja");
    $sug.style.maxHeight = "";
    let m = $sug.getBoundingClientRect(), x, y, max;
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
      // Sin sitio junto a la selección (teléfono): hoja a lo ancho apoyada en el borde inferior.
      $sug.classList.add("hoja");
      m = $sug.getBoundingClientRect();
      max = Math.min(320, Math.max(minimo, suelo - techo));
      x = 6;
      y = suelo - Math.min(m.height, max);
    }
    $sug.style.maxHeight = `${max}px`;
    $sug.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function siguienteHueco(desde) {
    const v = $codigo.value, fin = v.indexOf("\n", desde) < 0 ? v.length : v.indexOf("\n", desde);
    const re = new RegExp(cmg.reHueco.source, "g");
    re.lastIndex = desde;
    const m = re.exec(v);
    return m && m.index < fin ? [m.index, m.index + m[0].length] : null;
  }
  function ponerValor(texto) {
    if (!sugerido || !editable()) return;
    const { a, b, c } = sugerido, ins = c.vacio ? E.enLista($codigo.value, a, b, texto) : texto;
    const ini = a + ins.indexOf(texto), fin = ini + texto.length;
    cerrarSugerencias();
    reemplazar(a, b, ins, ini, fin);
    // Plantillas con huecos (operadores): queda elegido el primero.
    const h = texto.search(cmg.reHueco);
    if (h >= 0) return elegir(ini + h, ini + h + texto.slice(h).match(cmg.reHueco)[0].length);
    // Si la sentencia tiene otro hueco, se sigue rellenando.
    const s = siguienteHueco(fin);
    if (s) return elegir(s[0], s[1], { mostrar: true });
    if (activo) { elegir(ini, fin); sinSugerir = claveSel(); cerrarSugerencias(); }
    else elegir(fin, fin);
  }
  function pasoNumero(dir) {
    if (!sugerido) return;
    const { a, b } = sugerido, t = $codigo.value.slice(a, b), n = Number(t);
    if (!Number.isFinite(n)) return;
    const paso = /[.eE]/.test(t) || Math.abs(n) < 1 ? 0.05 : 1, nuevo = String(Math.round((n + dir * paso) * 1000) / 1000);
    reemplazar(a, b, nuevo, a, a + nuevo.length);
  }
  function escribirValor() {
    if (!sugerido) return;
    const actual = $codigo.value.slice(sugerido.a, sugerido.b), valor = sugerido.c.hueco || sugerido.c.vacio ? "" : actual;
    $sug.innerHTML = `<form class="sug-escribir"><label>Valor<input type="text" value="${esc(valor)}" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></label><button class="btn chico" type="submit">Poner</button></form>`;
    const input = $sug.querySelector("input");
    input.focus(); input.select();
    $sug.querySelector("form").addEventListener("submit", (ev) => { ev.preventDefault(); if (input.value.trim()) ponerValor(input.value.trim()); else cerrarSugerencias(); });
    colocarSugerencias();
  }
  function marcarActivo() {
    $sug.querySelectorAll(".sug[data-i]").forEach(x => x.classList.toggle("activa", +x.dataset.i === sugerido.activo));
    const x = $sug.querySelector(".sug.activa");
    if (x) x.scrollIntoView({ block: "nearest" });
  }
  // Teclado (PC): flechas recorren la lista, Intro o Tab ponen el valor, Escape la cierra.
  function teclaSugerencias(ev) {
    if ($sug.hidden || !sugerido || !sugerido.items.length || ev.target.closest && ev.target.closest(".sugerencias")) return false;
    const n = sugerido.items.length, hecho = () => { ev.preventDefault(); ev.stopImmediatePropagation(); return true; };
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      const d = ev.key === "ArrowDown" ? 1 : -1;
      sugerido.activo = sugerido.activo < 0 ? (d > 0 ? 0 : n - 1) : (sugerido.activo + d + n) % n;
      marcarActivo(); return hecho();
    }
    if ((ev.key === "Enter" && sugerido.activo >= 0) || ev.key === "Tab") { ponerValor(sugerido.items[Math.max(0, sugerido.activo)].ins); return hecho(); }
    if (ev.key === "Escape") { sinSugerir = claveSel(); cerrarSugerencias(); return hecho(); }
    return false;
  }
  $sug.addEventListener("pointerdown", (ev) => { if (!ev.target.closest("input, label")) ev.preventDefault(); });
  $sug.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-cerrar]")) { sinSugerir = claveSel(); return cerrarSugerencias(); }
    const p = ev.target.closest("[data-paso]");
    if (p) return pasoNumero(+p.dataset.paso);
    if (ev.target.closest("[data-escribir]")) return escribirValor();
    const s = ev.target.closest(".sug[data-i]");
    if (s && sugerido) ponerValor(sugerido.items[+s.dataset.i].ins);
  });
  document.addEventListener("pointerdown", (ev) => {
    if (!$sug.hidden && !$sug.contains(ev.target) && !$vista.contains(ev.target) && ev.target !== $codigo) cerrarSugerencias();
  }, true);
  for (const tipo of ["select", "keyup", "pointerup", "focus"]) $codigo.addEventListener(tipo, () => { if (!activo) actualizarSugerencias(); });
  document.addEventListener("selectionchange", () => { if (!activo && document.activeElement === $codigo) actualizarSugerencias(); });
  $codigo.addEventListener("blur", () => setTimeout(() => { if (!activo && document.activeElement !== $codigo && !$sug.contains(document.activeElement)) cerrarSugerencias(); }, 120));
  addEventListener("resize", () => { if (sugerido) colocarSugerencias(); });
  if (window.visualViewport) visualViewport.addEventListener("resize", () => { if (sugerido) colocarSugerencias(); });

  // ---------- Barra de edición ----------
  const ICONOS = {
    teclado: '<rect x="2.5" y="6" width="19" height="12.5" rx="2.2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.6h.01M17 13.6h.01M9.5 14.6h5"/><path class="tachado" d="M3.6 3.4l16.8 17.2"/>',
    deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    cortar: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8 16.2L18.5 4M16 16.2L5.5 4"/>',
    copiar: '<rect x="8.5" y="8.5" width="11.5" height="12.5" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2V15a2 2 0 0 0 2 2h3"/>',
    pegar: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><path d="M9 12h6M9 15.5h4"/>',
    borrar: '<path d="M8.5 5H20a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H8.5L2.5 12z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>',
    ampliar: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9.5" width="6" height="5" rx="1"/>',
    reducir: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
    duplicar: '<rect x="3.5" y="3.5" width="11.5" height="11.5" rx="2"/><path d="M19 8.5h.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H10a1.5 1.5 0 0 1-1.5-1.5V19"/><path d="M9.25 6.5v5M6.75 9h5"/>',
    subir: '<path d="M12 19.5V5M6 11l6-6 6 6"/>',
    bajar: '<path d="M12 4.5V19M6 13l6 6 6-6"/>',
    linea: '<path d="M19.5 5v6.5a3 3 0 0 1-3 3H6"/><path d="M10 10.5l-4 4 4 4"/>',
  };
  const svg = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${c}</svg>`;
  const ACCIONES = {
    teclado: { t: "Modo sin teclado", fn: () => activar(!activo, true) },
    deshacer: { t: "Deshacer", fn: deshacer }, rehacer: { t: "Rehacer", fn: rehacer },
    cortar: { t: "Cortar", fn: () => copiar(true) }, copiar: { t: "Copiar", fn: () => copiar(false) }, pegar: { t: "Pegar", fn: pegar }, borrar: { t: "Borrar", fn: borrar },
    ampliar: { t: "Ampliar selección", fn: ampliar }, reducir: { t: "Reducir selección", fn: reducir },
    duplicar: { t: "Duplicar", fn: duplicar }, subir: { t: "Subir línea", fn: () => moverLineas(-1) }, bajar: { t: "Bajar línea", fn: () => moverLineas(1) }, linea: { t: "Línea nueva", fn: lineaNueva },
  };
  // Grupos de la barra: el orden de grupos y de botones se cambia en Ajustes y se guarda por dispositivo.
  const GRUPOS_BASE = [["teclado"], ["deshacer", "rehacer"], ["cortar", "copiar", "pegar", "borrar"], ["ampliar", "reducir"], ["duplicar", "subir", "bajar", "linea"]];
  function validarGrupos(g) {
    const vistos = new Set();
    const out = (Array.isArray(g) ? g : []).map(x => (Array.isArray(x) ? x : []).filter(id => Object.hasOwn(ACCIONES, id) && !vistos.has(id) && vistos.add(id))).filter(x => x.length);
    const faltan = Object.keys(ACCIONES).filter(id => !vistos.has(id));
    if (faltan.length) out.push(faltan);
    return out;
  }
  let grupos = validarGrupos(leer("barra", GRUPOS_BASE));
  const botonBarra = (id) => `<button type="button" data-accion="${id}" aria-label="${esc(ACCIONES[id].t)}" data-tip="${esc(ACCIONES[id].t)}"${id === "teclado" ? ` class="b-teclado" aria-pressed="false"` : ""}>${svg(ICONOS[id])}</button>`;
  function construirBarra() {
    // Un grupo que solo lleva el interruptor del teclado se oculta donde el interruptor no aplica.
    $barra.innerHTML = grupos.map(g => `<span class="grupo-ed${g.length === 1 && g[0] === "teclado" ? " solo-teclado" : ""}">${g.map(botonBarra).join("")}</span>`).join("");
    pintarBarra();
  }
  $("b-teclado").innerHTML = svg(ICONOS.teclado);
  // pointerdown sin foco: con teclado, el textarea lo conserva y el teclado del teléfono no se cierra.
  $barra.addEventListener("pointerdown", (ev) => { if (ev.target.closest("button")) ev.preventDefault(); });
  $barra.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-accion]"), id = b && b.dataset.accion;
    if (!id || !ACCIONES[id]) return;
    // En seudocódigo los botones actúan sobre el renglón elegido (seudo.js); deshacer sigue siendo del texto.
    const r = cmg.seudo && cmg.seudo.activo ? cmg.seudo.accion(id) : false;
    if (r) { if (typeof r === "string") toast(r); return; }
    ACCIONES[id].fn();
  });
  function pintarBarra() {
    for (const b of document.querySelectorAll(".b-teclado")) {
      b.setAttribute("aria-pressed", String(activo));
      b.setAttribute("aria-label", activo ? "Modo sin teclado activo: toca para escribir con teclado" : "Modo sin teclado");
      b.dataset.tip = activo ? "Volver al teclado" : "Modo sin teclado";
    }
    const quieto = $codigo.readOnly;
    for (const b of $barra.querySelectorAll("[data-accion]")) {
      const id = b.dataset.accion;
      b.disabled = id === "deshacer" ? quieto || !hist.pasado.length : id === "rehacer" ? quieto || !hist.futuro.length : quieto && !["teclado", "copiar", "ampliar", "reducir"].includes(id);
    }
  }
  const $toast = document.createElement("div");
  $toast.className = "toast-edicion"; $toast.hidden = true; $toast.setAttribute("role", "status");
  document.body.append($toast);
  let tToast = 0;
  function toast(texto) {
    $toast.textContent = texto; $toast.hidden = false;
    const r = ($barra.getClientRects().length ? $barra : $editor).getBoundingClientRect();
    $toast.style.transform = `translate(${Math.round(Math.max(6, r.left + r.width / 2 - $toast.offsetWidth / 2))}px, ${Math.round(r.bottom + 6)}px)`;
    clearTimeout(tToast);
    tToast = setTimeout(() => { $toast.hidden = true; }, 1500);
  }

  // ---------- Modo sin teclado ----------
  function activar(si, enfocar = false) {
    activo = !!si;
    escribir("sin-teclado", activo);
    $editor.classList.toggle("sin-teclado", activo);
    app.dataset.sinTeclado = String(activo);
    $vista.hidden = !activo;
    $asas.hidden = !(activo && asa === "borde");
    $codigo.tabIndex = activo ? -1 : 0;
    if (activo) $codigo.setAttribute("inputmode", "none"); else $codigo.removeAttribute("inputmode");
    cerrarSugerencias();
    pintarBarra();
    if (activo) {
      if (document.activeElement === $codigo) $codigo.blur();   // cierra el teclado del teléfono
      pintarVista();
      $vista.scrollTop = $codigo.scrollTop;
      cmg.medirEditor();
      queueMicrotask(() => { pintarSeleccion(); mostrarRango(sel()[0]); });
    } else {
      $codigo.scrollTop = $vista.scrollTop;
      cmg.medirEditor();
      if (enfocar) $codigo.focus({ preventScroll: true });
    }
  }
  $("b-teclado").addEventListener("click", () => activar(!activo, true));
  $codigo.addEventListener("cmg:medido", () => {
    if (!activo) return;
    if ($codigo.value !== pintado) pintarVista();
    pintarAsas();
    // insertar() fija la selección después del evento input: la paleta deja así elegido su primer hueco.
    queueMicrotask(() => { pintarSeleccion(); actualizarSugerencias(); });
  });
  $codigo.addEventListener("cmg:seleccion", () => { if (activo) { pintarSeleccion(); mostrarRango(sel()[0]); } actualizarSugerencias(); });
  $codigo.addEventListener("cmg:estado", () => { pintarBarra(); if ($codigo.readOnly) cerrarSugerencias(); });
  $codigo.addEventListener("input", () => { if (!activo) actualizarSugerencias(); });

  // ---------- Teclado físico ----------
  // Sin teclado en PC: la vista toma el foco al hacer clic y entiende atajos de bloques.
  function atomoVecino(dir) {
    const [a, b] = sel(), e = estructura(), v = e.src;
    let p = dir > 0 ? b : a - 1;
    while (p >= 0 && p < v.length && /\s/.test(v[p])) p += dir;
    const t = p >= 0 && p < v.length ? E.fichaEn(e, p) : null;
    if (t) elegir(t.a, t.b, { mostrar: true });
  }
  function lineaVecina(dir) {
    const [a, b] = sel(), e = estructura();
    let l = E.lineaDe(e, dir < 0 ? a : Math.max(a, b - 1)) + dir;
    while (l >= 0 && l < e.lineas.length && !e.src.slice(E.inicioLinea(e, l), E.finLinea(e, l)).trim()) l += dir;
    if (l < 0 || l >= e.lineas.length) return;
    const ini = E.inicioLinea(e, l), fin = E.finLinea(e, l);
    elegir(ini + sangriaDe(e.src.slice(ini, fin)).length, fin, { mostrar: true });
  }
  $vista.addEventListener("keydown", (ev) => {
    if (!activo) return;
    if (pendiente && !["Shift", "Control", "Alt", "Meta"].includes(ev.key)) resolverPendiente();
    if (teclaSugerencias(ev)) return;
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key, l = k.length === 1 ? k.toLowerCase() : k;
    const acciones = [
      [k === "Backspace" || k === "Delete", borrar],
      [mod && l === "z" && !ev.shiftKey, deshacer], [(mod && l === "z" && ev.shiftKey) || (mod && l === "y"), rehacer],
      [mod && l === "d", duplicar], [mod && k === "/", () => cmg.alternarComentario()], [mod && k === "Enter", () => cmg.alternarEjecucion()],
      [ev.altKey && ev.shiftKey && k === "ArrowRight", ampliar], [ev.altKey && ev.shiftKey && k === "ArrowLeft", reducir],
      [ev.altKey && !ev.shiftKey && (k === "ArrowUp" || k === "ArrowDown"), () => moverLineas(k === "ArrowUp" ? -1 : 1)],
      [!ev.altKey && !mod && (k === "ArrowLeft" || k === "ArrowRight"), () => atomoVecino(k === "ArrowLeft" ? -1 : 1)],
      [!ev.altKey && !mod && (k === "ArrowUp" || k === "ArrowDown"), () => lineaVecina(k === "ArrowUp" ? -1 : 1)],
      [k === "Enter" && !mod, lineaNueva], [k === "Tab", () => sangrar(ev.shiftKey ? -1 : 1)],
      [k === "Escape", () => { const [a] = sel(); elegir(a, a); }],
      [k.length === 1 && !mod && !ev.altKey, () => toast("Modo sin teclado: toca ⌨ para escribir.")],
    ];
    const hit = acciones.find(([si]) => si);
    if (hit) { ev.preventDefault(); hit[1](); }
  });
  // Ctrl+C / X / V con la vista enfocada (el evento llega al documento: la vista no es editable).
  const conVista = () => activo && document.activeElement === $vista;
  document.addEventListener("copy", (ev) => {
    if (!conVista()) return;
    const [a, b] = sel(); if (a === b) return;
    ev.preventDefault();
    const t = $codigo.value.slice(a, b);
    ev.clipboardData.setData("text/plain", t); guardarCopia(t); toast("Copiado");
  });
  document.addEventListener("cut", (ev) => {
    if (!conVista()) return;
    const [a, b] = sel(); if (a === b || !editable()) return;
    ev.preventDefault();
    const t = $codigo.value.slice(a, b);
    ev.clipboardData.setData("text/plain", t); guardarCopia(t); quitar(a, b);
  });
  document.addEventListener("paste", (ev) => {
    if (!conVista()) return;
    ev.preventDefault();
    const t = ev.clipboardData.getData("text/plain");
    if (t && editable()) pegarTexto(t);
  });
  // Con teclado: la lista de sugerencias se maneja con flechas y ampliar/mover líneas tienen atajo.
  $codigo.addEventListener("keydown", (ev) => {
    if (activo || teclaSugerencias(ev)) return;
    if (ev.altKey && ev.shiftKey && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) { ev.preventDefault(); ev.key === "ArrowRight" ? ampliar() : reducir(); }
    else if (ev.altKey && !ev.shiftKey && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) { ev.preventDefault(); moverLineas(ev.key === "ArrowUp" ? -1 : 1); }
  }, true);

  // ---------- Ajustes ----------
  const $ajusteAsa = $("ajustes-asa");
  if ($ajusteAsa) {
    $ajusteAsa.value = asa;
    $ajusteAsa.addEventListener("change", () => {
      asa = $ajusteAsa.value === "borde" ? "borde" : "numero";
      escribir("asa", asa);
      $editor.dataset.asa = asa;
      $asas.hidden = !(activo && asa === "borde");
      pintarAsas();
      cmg.medirEditor();
    });
  }

  // ---------- Orden de la barra de edición ----------
  // Un diálogo encima de Ajustes: cada grupo es una fila con su asa; los botones se arrastran dentro
  // del grupo, a otro grupo o a «Grupo nuevo». Mientras se arrastra, el elemento se mueve en vivo.
  const $orden = $("orden-barra"), $grupos = $("orden-grupos");
  function pintarOrden() {
    $grupos.innerHTML = grupos.map((g, i) => `<div class="orden-grupo" data-g="${i}">
        <span class="orden-asa" aria-label="Mover el grupo ${i + 1}" title="Mover el grupo">⋮⋮</span>
        <div class="orden-btns">${g.map(id => `<span class="orden-btn" data-id="${id}" title="${esc(ACCIONES[id].t)}">${svg(ICONOS[id])}<span>${esc(ACCIONES[id].t)}</span></span>`).join("")}</div>
      </div>`).join("") + `<div class="orden-grupo nuevo"><div class="orden-btns"><span class="orden-vacio">Grupo nuevo</span></div></div>`;
  }
  function leerOrden() {
    grupos = validarGrupos([...$grupos.querySelectorAll(".orden-grupo")].map(g => [...g.querySelectorAll(".orden-btn")].map(b => b.dataset.id)));
    escribir("barra", grupos);
    construirBarra();
    pintarOrden();
  }
  let mueve = null;
  $grupos.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest(".orden-btn") || (ev.target.closest(".orden-asa") && ev.target.closest(".orden-grupo"));
    if (!el || el.classList.contains("nuevo") || ev.button > 0) return;
    ev.preventDefault();
    mueve = { el, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, activo: false, grupo: el.classList.contains("orden-grupo") };
  });
  window.addEventListener("pointermove", (ev) => {
    if (!mueve || ev.pointerId !== mueve.id) return;
    if (!mueve.activo) {
      if (Math.hypot(ev.clientX - mueve.x0, ev.clientY - mueve.y0) < 5) return;
      mueve.activo = true; mueve.el.classList.add("levantado");
    }
    if (mueve.grupo) {
      // El grupo se coloca antes del primer grupo cuyo centro queda por debajo del puntero.
      const otros = [...$grupos.querySelectorAll(".orden-grupo:not(.nuevo)")].filter(g => g !== mueve.el);
      const antes = otros.find(g => { const r = g.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      $grupos.insertBefore(mueve.el, antes || $grupos.querySelector(".orden-grupo.nuevo"));
      return;
    }
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY), g = bajo && bajo.closest && bajo.closest(".orden-grupo");
    if (!g || !$grupos.contains(g)) return;
    const fila = g.querySelector(".orden-btns"), otros = [...fila.querySelectorAll(".orden-btn")].filter(b => b !== mueve.el);
    // Antes del botón más cercano si el puntero está en su mitad izquierda; si no, después.
    let mejor = null, d = Infinity;
    for (const b of otros) { const r = b.getBoundingClientRect(), dd = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)); if (dd < d) { d = dd; mejor = b; } }
    if (!mejor) { const vacio = fila.querySelector(".orden-vacio"); fila.insertBefore(mueve.el, vacio); return; }
    const r = mejor.getBoundingClientRect();
    fila.insertBefore(mueve.el, ev.clientX < r.left + r.width / 2 ? mejor : mejor.nextSibling);
  });
  const soltarOrden = (ev) => {
    if (!mueve || ev.pointerId !== mueve.id) return;
    const m = mueve; mueve = null;
    m.el.classList.remove("levantado");
    if (m.activo) leerOrden();
  };
  window.addEventListener("pointerup", soltarOrden);
  window.addEventListener("pointercancel", soltarOrden);
  $("ajustes-orden-barra").addEventListener("click", () => { pintarOrden(); $orden.showModal(); });
  $("orden-cerrar").addEventListener("click", () => $orden.close());
  $("orden-restaurar").addEventListener("click", () => { grupos = validarGrupos(GRUPOS_BASE); escribir("barra", grupos); construirBarra(); pintarOrden(); });

  // ---------- Arranque ----------
  $editor.dataset.asa = asa;
  window.cmg.edicion = { get activo() { return activo; }, activar, elegir, ampliar, reducir, deshacer, rehacer, copiar, pegar, borrar, duplicar, moverLineas, lineaNueva, get portapapeles() { return portapapeles; } };
  construirBarra();
  if (leer("sin-teclado", false) === true) activar(true);
})();
