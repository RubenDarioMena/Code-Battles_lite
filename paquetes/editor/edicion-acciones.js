
/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
import { dependencias } from './dependencias.js';
// edicion: acciones. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {
   // selecciones anteriores a cada «ampliar»: «reducir» vuelve por ellas

  // ---------- Selección ----------
  ctx.elegir = function(a, b, { conservar = false, mostrar = false } = {}) {
    if (!conservar) ctx.pila.length = 0;
    ctx.$codigo.setSelectionRange(Math.min(a, b), Math.max(a, b));
    if (ctx.activo) { ctx.pintarSeleccion(); if (mostrar) ctx.mostrarRango(a); }
    ctx.actualizarSugerencias();
  };
  ctx.ampliar = function() {
    const [a, b] = ctx.sel(), r = ctx.E.ampliar(ctx.estructura(), a, b);
    if (!r || (r[0] === a && r[1] === b)) return;
    ctx.pila.push([a, b]);
    ctx.elegir(r[0], r[1], { conservar: true, mostrar: true });
  };
  ctx.reducir = function() {
    const r = ctx.pila.pop();
    if (r) return ctx.elegir(r[0], r[1], { conservar: true, mostrar: true });
    const [a, b] = ctx.sel(), t = ctx.E.atomo(ctx.estructura(), a);
    if (t && (t[0] !== a || t[1] !== b)) ctx.elegir(t[0], t[1]);
  };
  // ¿[a, b) ocupa líneas enteras, sin contar la sangría ni los espacios del final?
  ctx.sonLineas = function(a, b) {
    if (a === b) return false;
    const e = ctx.estructura(), v = e.src;
    const la = ctx.E.inicioLinea(e, ctx.E.lineaDe(e, a)), lb = ctx.E.finLinea(e, ctx.E.lineaDe(e, Math.max(a, b - 1)));
    return !v.slice(la, a).trim() && !v.slice(b, lb).trim();
  };
  // Líneas completas con su salto: las que cubre la selección, o la sentencia de la línea del cursor.
  ctx.lineasDe = function(a, b) {
    const e = ctx.estructura();
    if (a === b || !ctx.sonLineas(a, b)) return ctx.E.unidadLinea(e, ctx.E.lineaDe(e, a));
    const l1 = ctx.E.lineaDe(e, Math.max(a, b - 1));
    return [ctx.E.inicioLinea(e, ctx.E.lineaDe(e, a)), l1 + 1 < e.lineas.length ? e.lineas[l1 + 1] : e.src.length];
  };
  // Sustituye [a, b) por texto y deja elegido [sa, sb) del texto nuevo. Cada llamada es un paso de deshacer.
  ctx.reemplazar = function(a, b, texto, sa = a + texto.length, sb = sa) {
    if (ctx.$codigo.readOnly) return false;
    ctx.hist.operacion = true;
    ctx.$codigo.setSelectionRange(a, b);
    ctx.cmg.insertar(texto, sa - a, sb - a);
    ctx.pila.length = 0;
    if (ctx.activo) ctx.pintarSeleccion();
    ctx.actualizarSugerencias();
    ctx.pintarBarra();
    return true;
  };
  // Pasa al texto nuevo cambiando solo el tramo distinto.
  ctx.cambiar = function(nuevo, sa, sb) {
    const v = ctx.$codigo.value;
    let i = 0; while (i < v.length && i < nuevo.length && v[i] === nuevo[i]) i++;
    let j = 0; while (j < v.length - i && j < nuevo.length - i && v[v.length - 1 - j] === nuevo[nuevo.length - 1 - j]) j++;
    return ctx.reemplazar(i, v.length - j, nuevo.slice(i, nuevo.length - j), sa, sb);
  };
  ctx.recorrer = function(desde, hacia) {
    if (!desde.length || !ctx.editable()) return;
    const actual = ctx.capturar(), otro = desde.pop();
    hacia.push(actual);
    if (ctx.cmg.restaurarDocumento) {
      ctx.aplicando = true;
      try { ctx.cmg.restaurarDocumento(otro); } finally { ctx.aplicando = false; }
      Object.assign(ctx.hist, { ultimo: ctx.capturar(), tecleo: false });
      ctx.pintarBarra();
      return;
    }
    let i = 0; while (i < otro.length && i < actual.length && otro[i] === actual[i]) i++;
    let j = 0; while (j < otro.length - i && j < actual.length - i && otro[otro.length - 1 - j] === actual[actual.length - 1 - j]) j++;
    ctx.aplicando = true;
    ctx.$codigo.value = otro;
    ctx.$codigo.dispatchEvent(new Event("input"));
    ctx.aplicando = false;
    Object.assign(ctx.hist, { ultimo: otro, tecleo: false });
    ctx.elegir(i, otro.length - j, { mostrar: true });
    ctx.pintarBarra();
  };
  // Sangría para una línea nueva en pos (principio de línea): la de la anterior con texto, un nivel más tras «{».
  ctx.sangriaEn = function(texto, pos) {
    const previas = texto.slice(0, pos).split("\n"); previas.pop();
    const previa = previas.reverse().find(l => l.trim());
    if (ctx.significativa) return ctx.S.niveles(texto, pos)[0] ?? ctx.sangriaDe(previa ?? "");
    if (previa !== undefined) return ctx.sangriaDe(previa) + (ctx.abreLinea(previa) ? ctx.UNIDAD : "");
    const siguiente = texto.slice(pos).split("\n").find(l => l.trim());
    return siguiente ? ctx.sangriaDe(siguiente) : "";
  };
  ctx.reindentar = function(bloque, sangria) {
    const lineas = bloque.replace(/\n$/, "").split("\n"), utiles = lineas.filter(l => l.trim());
    const min = utiles.length ? Math.min(...utiles.map(l => ctx.sangriaDe(l).length)) : 0;
    return lineas.map(l => l.trim() ? sangria + l.slice(min) : "").join("\n") + (bloque.endsWith("\n") ? "\n" : "");
  };

  // ---------- Acciones ----------
  // Mueve (o copia) las líneas [la, lb) a la frontera anterior a la línea l, con la sangría del destino.
  ctx.moverLineasA = function(la, lb, l, copia = false, nivel = null) {
    if (ctx.significativa) return ctx.moverLineasPython(la, lb, l, copia, nivel);
    const v = ctx.$codigo.value, e = ctx.estructura();
    const destino = l < e.lineas.length ? e.lineas[l] : v.length;
    if (!copia && destino >= la && destino <= lb) return false;
    let bloque = v.slice(la, lb);
    if (!bloque.endsWith("\n")) bloque += "\n";
    const resto = copia ? v : v.slice(0, la) + v.slice(lb);
    const pos = Math.min(resto.length, copia || destino < la ? destino : destino - (lb - la));
    const salto = pos === resto.length && resto.length && !resto.endsWith("\n") ? "\n" : "";
    const nuevo = ctx.reindentar(bloque, ctx.sangriaEn(resto, pos));
    let final = resto.slice(0, pos) + salto + nuevo + resto.slice(pos);
    if (!v.endsWith("\n") && final.endsWith("\n")) final = final.slice(0, -1);   // mover no añade un salto al final
    const sa = pos + salto.length;
    return ctx.cambiar(final, sa, sa + nuevo.replace(/\n$/, "").length);
  };
  // Python: quitar las líneas deja «pass» si su bloque se queda vacío; el destino es un hueco entre
  // líneas y un nivel de sangría. Entre el final de un bloque y lo que sigue hay varios niveles:
  // el elegido (nivel: índice o sangría) o, si no, el más profundo.
  ctx.sinLineas = function(v, la, lb, copia) {
    let bloque = v.slice(la, lb);
    if (!bloque.endsWith("\n")) bloque += "\n";
    if (copia) return { bloque, resto: v, crece: 0 };
    const resto = v.slice(0, la) + v.slice(lb);
    const r = ctx.S.rellenar(resto, Math.min(la, resto.length));
    return { bloque, resto: r.texto, crece: r.crece };
  };
  ctx.ponerLineas = function(v, resto, bloque, pos, sangria) {
    const salto = pos === resto.length && resto.length && !resto.endsWith("\n") ? "\n" : "";
    const nuevo = ctx.reindentar(bloque, sangria);
    let final = resto.slice(0, pos) + salto + nuevo + resto.slice(pos);
    if (!v.endsWith("\n") && final.endsWith("\n")) final = final.slice(0, -1);
    const sa = pos + salto.length;
    return ctx.cambiar(final, sa, sa + nuevo.replace(/\n$/, "").length);
  };
  ctx.moverLineasPython = function(la, lb, l, copia, nivel) {
    const v = ctx.$codigo.value, e = ctx.estructura();
    const destino = l < e.lineas.length ? e.lineas[l] : v.length;
    if (!copia && destino >= la && destino <= lb && nivel == null) return false;
    const { bloque, resto, crece } = ctx.sinLineas(v, la, lb, copia);
    let pos = copia || destino < la ? destino : destino - (lb - la);
    if (!copia && destino >= lb) pos += crece;
    pos = Math.min(pos, resto.length);
    const ns = ctx.nivelesEn(resto, pos);
    if (!ns.length) return false;
    const sangria = typeof nivel === "string" && ns.includes(nivel) ? nivel : typeof nivel === "number" && ns[nivel] != null ? ns[nivel] : ns[0];
    if (!copia && pos === la && sangria === ctx.sangriaDe(bloque)) return false;
    return ctx.ponerLineas(v, resto, bloque, pos, sangria);
  };
  // Paso a paso: cada hueco entre líneas, y en cada uno sus niveles del más profundo al menos.
  // Subir desde la línea siguiente a un bloque entra primero al final de ese bloque.
  ctx.moverLineasPasoPython = function(dir, la, lb) {
    const v = ctx.$codigo.value, { bloque, resto, crece } = ctx.sinLineas(v, la, lb, false);
    const propia = ctx.sangriaDe(bloque), huecos = [0];
    for (let i = 0; i < resto.length; i++) if (resto[i] === "\n" && i + 1 < resto.length) huecos.push(i + 1);
    if (resto.endsWith("\n")) huecos.push(resto.length);
    if (resto.length && !resto.endsWith("\n")) huecos.push(resto.length);
    const puestos = [];
    for (const pos of huecos) for (const n of ctx.nivelesEn(resto, pos)) puestos.push({ pos, n });
    const actual = dir < 0 ? la : la + crece;
    // Orden: por posición y, en la misma, de más a menos sangría.
    const antes = (x) => x.pos < actual || (x.pos === actual && x.n.length > propia.length);
    let i = puestos.findIndex(x => x.pos === actual && x.n === propia);
    let t;
    if (i >= 0) t = puestos[i + dir];
    else { const k = puestos.filter(antes).length; t = dir < 0 ? puestos[k - 1] : puestos[k]; }
    if (!t) return false;
    return ctx.ponerLineas(v, resto, bloque, t.pos, t.n);
  };
  ctx.moverLineas = function(dir) {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), e = ctx.estructura(), [la, lb] = ctx.lineasDe(a, b);
    if (ctx.significativa) return ctx.moverLineasPasoPython(dir, la, lb);
    const l0 = ctx.E.lineaDe(e, la), l1 = ctx.E.lineaDe(e, Math.max(la, lb - 1));
    let l = dir < 0 ? l0 - 1 : l1 + 2;
    while (l > 0 && l < e.lineas.length && !ctx.E.fronteraValida(e, l)) l += dir;
    if (l < 0 || l > e.lineas.length || (dir > 0 && l1 + 1 >= e.lineas.length)) return;
    ctx.moverLineasA(la, lb, l);
  };
  // Quita [a, b) como un bloque: un argumento deja su hueco y una condición el suyo; las líneas
  // enteras se van con su salto y no quedan espacios dobles.
  // Partes sin las que su construcción no se sostiene: el nombre declarado, lo que espera un await,
  // el nombre de una función o el objeto/método de una llamada. Borrarlas borra la construcción
  // (y su sentencia, si la ocupa entera), en vez de dejar «const =», «await;» o «();».
  ctx.contenedorNecesario = function(e, n) {
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
  };
  ctx.quitar = function(a, b) {
    const e = ctx.estructura(), v = e.src, c = ctx.E.contexto(e, a, b);
    // Operando de una operación binaria: se va con su operador y queda el otro («pos ?? x» → «pos»).
    if (c && c.binaria && !c.vacio) {
      const [izq, der] = c.binaria.h;
      return c.nodo === der ? ctx.reemplazar(izq.b, der.b, "", izq.b) : ctx.reemplazar(izq.a, der.a, "", izq.a);
    }
    const sube = c && c.tipo !== "argumento" && c.tipo !== "elemento" ? ctx.contenedorNecesario(e, c.nodo) : null;
    if (sube) return ctx.quitar(sube.a, sube.b);
    if (c && c.nodo.padre && c.nodo.padre.k === "decl" && c.tipo == null) {   // valor inicial → hueco
      const h = ctx.H("valor");
      return ctx.reemplazar(a, b, h, a, a + h.length);
    }
    if (c && c.tipo === "argumento" && !c.vacio) {
      const nombre = (ctx.cmg.firma(c.funcion) || [])[c.indice];
      if (nombre && !c.hueco) { const h = ctx.H(nombre); return ctx.reemplazar(a, b, h, a, a + h.length); }
      const ll = c.nodo.padre.k === "metodo" ? c.nodo.padre.llamada : c.nodo.padre, args = ll.args, i = args.indexOf(c.nodo);
      if (i < args.length - 1) return ctx.reemplazar(a, args[i + 1].a, "", a);
      if (i > 0) return ctx.reemplazar(args[i - 1].b, b, "", args[i - 1].b);
      return ctx.reemplazar(a, b, "", a);
    }
    if (c && c.tipo === "condicion") {
      if (c.hueco) return ctx.toast("La condición no puede quedar vacía: elige un valor o borra la sentencia.");
      const h = ctx.H("condición");
      return ctx.reemplazar(a, b, h, a, a + h.length);
    }
    if (ctx.sonLineas(a, b)) {
      const [la, lb] = ctx.lineasDe(a, b), ini = lb === v.length && la > 0 && !v.endsWith("\n") ? la - 1 : la;
      // El cursor queda al final de la línea anterior: lo siguiente que se inserte cae donde estaba lo borrado.
      const cursor = ini === la && la > 0 ? la - 1 : ini;
      if (ctx.significativa) {
        // Un bloque que se queda sin sentencias recibe «pass», elegido para sustituirlo.
        const r = ctx.S.rellenar(v.slice(0, ini) + v.slice(lb), ini);
        if (r.crece) { const t = r.texto.slice(ini, ini + r.crece), p = ini + t.indexOf("pass"); return ctx.reemplazar(ini, lb, t, p, p + 4); }
      }
      return ctx.reemplazar(ini, lb, "", cursor, cursor);
    }
    let x = a, y = b;
    if (v[x - 1] === " " && (v[y] === " " || /[)\],;]/.test(v[y] || "") || y === v.length)) x--;
    else if (v[y] === " " && (x === 0 || /[([\n]/.test(v[x - 1]))) y++;
    ctx.reemplazar(x, y, "", x);
  };
  ctx.borrar = function() {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), v = ctx.$codigo.value;
    if (!ctx.activo) {   // con teclado: igual que la tecla de borrar
      if (a !== b) return ctx.reemplazar(a, b, "", a);
      return a > 0 && ctx.reemplazar(a - 1, a, "", a - 1);
    }
    if (a !== b) return ctx.quitar(a, b);
    // Sin selección: el elemento anterior al cursor, o une la línea con la anterior.
    let p = a; while (p > 0 && (v[p - 1] === " " || v[p - 1] === "\t")) p--;
    if (p === 0) return;
    if (v[p - 1] === "\n") return ctx.reemplazar(p - 1, a, "", p - 1);
    const t = ctx.E.atomo(ctx.estructura(), p - 1);
    if (t) ctx.quitar(t[0], t[1]);
  };
  // Quita el if/while/for/do que rodea lo elegido y deja su contenido elegido, un nivel menos sangrado.
  ctx.desenvolver = function() {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), r = ctx.E.desenvolver(ctx.estructura(), a, b);
    if (r.motivo) return ctx.toast(r.motivo);
    ctx.reemplazar(r.a, r.b, r.texto, r.sel[0], r.sel[1]);
  };
  ctx.duplicar = function() {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), v = ctx.$codigo.value, c = a !== b ? ctx.E.contexto(ctx.estructura(), a, b) : null;
    if (c && c.tipo === "elemento" && !c.vacio) { const t = v.slice(a, b); return ctx.reemplazar(b, b, ", " + t, b + 2, b + 2 + t.length); }
    const [la, lb] = ctx.lineasDe(a, b), bloque = v.slice(la, lb);
    if (!bloque.endsWith("\n")) return ctx.reemplazar(lb, lb, "\n" + bloque, lb + 1, lb + 1 + bloque.length);
    ctx.reemplazar(lb, lb, bloque, lb, lb + bloque.length - 1);
  };
  // Línea nueva bajo el cursor (o bajo lo elegido), ya sangrada; el cursor queda en ella.
  ctx.lineaNueva = function() {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), v = ctx.$codigo.value, e = ctx.estructura();
    const fin = a === b ? ctx.E.finLinea(e, ctx.E.lineaDe(e, a)) : ctx.sinSalto(ctx.lineasDe(a, b))[1];
    const ini = v.lastIndexOf("\n", fin - 1) + 1, linea = v.slice(ini, fin);
    const s = linea.trim() ? ctx.sangriaDe(linea) + (ctx.abreLinea(linea) ? ctx.UNIDAD : "") : ctx.sangriaEn(v, ini);
    ctx.reemplazar(fin, fin, "\n" + s, fin + 1 + s.length);
  };
  ctx.sangrar = function(dir) {
    if (!ctx.editable()) return;
    const [a, b] = ctx.sel(), e = ctx.estructura(), v = e.src;
    const la = ctx.E.inicioLinea(e, ctx.E.lineaDe(e, a)), lb = ctx.E.finLinea(e, ctx.E.lineaDe(e, a === b ? a : b - 1));
    // Tab con solo el cursor también sangra una línea vacía; al sangrar un bloque, sus líneas vacías se conservan.
    const texto = v.slice(la, lb).split("\n").map(l => a !== b && !l.trim() ? l : dir > 0 ? ctx.UNIDAD + l : l.replace(new RegExp(`^ {1,${ctx.UNIDAD.length}}`), "")).join("\n");
    // Con solo el cursor, el cursor sigue en su sitio de la línea: si se eligiera la línea entera, lo siguiente
    // que se escribiera con el teclado la sustituiría.
    if (a === b) { const p = Math.max(la, a + texto.length - (lb - la)); return ctx.reemplazar(la, lb, texto, p, p); }
    ctx.reemplazar(la, lb, texto, la, la + texto.length);
  };
  ctx.guardarCopia = function(t) { ctx.portapapeles = t; try { dependencias.sesion.escribir("cmg-portapapeles", t); } catch { /* solo en memoria */ } };
  ctx.aSistema = function(t) {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(t).catch(() => {}); return; }
    if (document.activeElement === ctx.$codigo && ctx.$codigo.value.slice(ctx.$codigo.selectionStart, ctx.$codigo.selectionEnd) === t) { try { document.execCommand("copy"); } catch { /* queda la copia interna */ } return; }
    // Textarea de solo lectura: no abre el teclado del teléfono.
    const antes = /** @type {HTMLElement} */ (document.activeElement), tmp = document.createElement("textarea");
    tmp.value = t; tmp.readOnly = true;
    Object.assign(tmp.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0" });
    ctx.vida.portal(tmp); tmp.select(); tmp.setSelectionRange(0, t.length);
    try { document.execCommand("copy"); } catch { /* queda la copia interna */ }
    tmp.remove();
    if (antes && antes !== document.body && antes.focus) antes.focus({ preventScroll: true });
  };
  ctx.copiar = function(cortar = false) {
    let [a, b] = ctx.sel();
    if (a === b) [a, b] = ctx.sinSalto(ctx.lineasDe(a, a));   // sin selección: la línea
    if (a === b) return ctx.toast("No hay nada que copiar.");
    const t = ctx.$codigo.value.slice(a, b);
    ctx.guardarCopia(t); ctx.aSistema(t);
    if (cortar && ctx.editable()) { ctx.activo ? ctx.quitar(a, b) : ctx.reemplazar(a, b, "", a); ctx.toast("Cortado"); }
    else ctx.toast("Copiado");
  };
  ctx.pegar = async function() {
    if (!ctx.editable()) return;
    let t = "";
    if (navigator.clipboard && navigator.clipboard.readText && window.isSecureContext) { try { t = await navigator.clipboard.readText(); } catch { t = ""; } if (ctx.vida.destruida) return; }
    t = t || ctx.portapapeles;
    if (!t) return ctx.toast("No hay nada copiado.");
    ctx.pegarTexto(t);
  };
  // Lo que ocupa líneas se pega como líneas, con la sangría del sitio; lo demás, en la selección.
  ctx.pegarTexto = function(t) {
    const [a, b] = ctx.sel(), v = ctx.$codigo.value, e = ctx.estructura();
    const lineaVacia = a === b && !v.slice(ctx.E.inicioLinea(e, ctx.E.lineaDe(e, a)), ctx.E.finLinea(e, ctx.E.lineaDe(e, a))).trim();
    if (t.includes("\n") && (lineaVacia || ctx.sonLineas(a, b))) {
      const [la, lb] = lineaVacia ? [ctx.E.inicioLinea(e, ctx.E.lineaDe(e, a)), ctx.E.finLinea(e, ctx.E.lineaDe(e, a))] : ctx.sinSalto(ctx.lineasDe(a, b));
      // Python: en una línea vacía vale la sangría ya escrita si es un nivel válido (si no hay, la más
      // profunda, como en JS); al sustituir líneas, la de la primera.
      const sangria = !ctx.significativa ? ctx.sangriaEn(v, la) : !lineaVacia ? ctx.sangriaDe(v.slice(la, lb)) : (() => {
        const actual = v.slice(la, lb), ns = ctx.S.niveles(v, la);
        return actual && ns.includes(actual) ? actual : ns[0] ?? "";
      })();
      const nuevo = ctx.reindentar(t.replace(/\n$/, ""), sangria);
      return ctx.reemplazar(la, lb, nuevo, la, la + nuevo.length);
    }
    ctx.reemplazar(a, b, t, a, a + t.length);
  };
  return function iniciar() {

  (ctx.E = ctx.adaptador.estructura);
  (ctx.app = ctx.$("app")), (ctx.$editor = ctx.$("editor")), (ctx.$codigo = ctx.cmg.codigo), (ctx.$gutter = ctx.$("gutter")), (ctx.$barra = ctx.$("edicion"));
  (ctx.$vista = ctx.$("bloques")), (ctx.$in = ctx.$("bloques-in")), (ctx.$texto = ctx.$("bloques-texto")), (ctx.$capa = ctx.$("bloques-capa")), (ctx.$asas = ctx.$("asas")), (ctx.$asasIn = ctx.$("asas-in"));
  ({ leer: ctx.leer, escribir: ctx.escribir } = ctx.preferencias);
  (ctx.esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])));
  // Lo que depende del lenguaje llega del adaptador; sin él, las reglas de JS de siempre.
  (ctx.S = ctx.adaptador.sangria || {});
  (ctx.UNIDAD = ctx.S.unidad || "  ");   // sangría de los programas de partida
  (ctx.abreLinea = ctx.S.abre || ((l) => /\{\s*(\/\/.*)?$/.test(l)));
  (ctx.significativa = !!(ctx.S.significativa && ctx.S.niveles));   // Python: la sangría es el programa
  (ctx.H = (n) => ctx.adaptador.hueco && ctx.adaptador.hueco.crear ? ctx.adaptador.hueco.crear(n) : `/* ${n} */`);
  (ctx.FIN = ctx.adaptador.finSentencia ?? ";");
  (ctx.L = ctx.adaptador.edicion || {});
  (ctx.nombreFn = (fn) => `${fn.objeto ? fn.objeto + "." : ""}${(fn.nombres && fn.nombres[ctx.adaptador.id]) || fn.nombre}`);

  (ctx.activo = false);                                         // modo sin teclado
  (ctx.asa = ctx.leer("asa", "numero") === "borde" ? "borde" : "numero");   // dónde se agarran las líneas
  (ctx.est = null), (ctx.estDe = null);
  (ctx.estructura = () => { const v = ctx.$codigo.value; if (v !== ctx.estDe) { ctx.est = ctx.E.analizar(v, ctx.cmg.lexico(v)); ctx.estDe = v; } return ctx.est; });
  (ctx.sel = () => [ctx.$codigo.selectionStart, ctx.$codigo.selectionEnd]);
  (ctx.pila = []);
  (ctx.sinSalto = ([a, b]) => [a, b > a && ctx.$codigo.value[b - 1] === "\n" ? b - 1 : b]);
  (ctx.variables = (e, hasta) => [...new Set(e.nodos.filter(n => n.k === "decl" && n.a < hasta && n.h[0] && n.h[0].k === "id").map(n => e.src.slice(n.h[0].a, n.h[0].b)))]);

  // ---------- Cambios e historial ----------
  (ctx.editable = () => { if (!ctx.$codigo.readOnly) return true; ctx.cmg.aviso("Detén el programa para editarlo."); return false; });
  // Un historial por documento (programa o borrador). Lo tecleado seguido cuenta como un solo paso.
  // El mapa puede llegar de la instancia: así sobrevive cuando el editor se rehace para otro lenguaje.
  // Cada entrada es el objeto vivo del historial, de modo que el mapa siempre está al día.
  (ctx.historiales = ctx.externos || new Map());
  (ctx.capturar = () => ctx.cmg.capturarDocumento ? ctx.cmg.capturarDocumento() : ctx.$codigo.value);
  (ctx.nuevoHistorial = () => ({ pasado: [], futuro: [], ultimo: ctx.capturar(), t: 0, tecleo: false, operacion: false }));
  (ctx.claveDoc = ctx.cmg.claveDocumento), (ctx.aplicando = false);
  (ctx.deAntes = ctx.historiales.get(ctx.claveDoc));
  (ctx.hist = ctx.deAntes && ctx.deAntes.ultimo === ctx.capturar() ? ctx.deAntes : ctx.nuevoHistorial());
  ctx.historiales.set(ctx.claveDoc, ctx.hist);
  ctx.vida.escuchar(ctx.$codigo, "input", (ev) => {
    const actual = ctx.capturar();
    if (ctx.aplicando || actual === ctx.hist.ultimo) return;
    const ahora = performance.now();
    const tecleo = !ctx.hist.operacion && !!ev.inputType && ((ev.inputType === "insertText" && (ev.data || "").length === 1) || ev.inputType.startsWith("deleteContent"));
    if (!(tecleo && ctx.hist.tecleo && ahora - ctx.hist.t < 1200)) { ctx.hist.pasado.push(ctx.hist.ultimo); if (ctx.hist.pasado.length > 200) ctx.hist.pasado.shift(); }
    ctx.hist.futuro.length = 0;
    Object.assign(ctx.hist, { ultimo: actual, t: ahora, tecleo, operacion: false });
    ctx.pintarBarra();
  });
  ctx.vida.escuchar(ctx.$codigo, "cmg:documento", (ev) => {
    ctx.historiales.set(ctx.claveDoc, ctx.hist);
    ctx.claveDoc = ev.detail.clave;
    const h = ctx.historiales.get(ctx.claveDoc);
    ctx.hist = h && h.ultimo === ctx.capturar() ? h : ctx.nuevoHistorial();
    ctx.historiales.set(ctx.claveDoc, ctx.hist);
    ctx.pila.length = 0;
    ctx.cerrarSugerencias();
    ctx.pintarBarra();
  });
  // Un cambio de vista conserva el documento, sin añadir un paso de deshacer.
  ctx.vida.escuchar(ctx.$codigo, "cmg:sincronizado", () => {
    if (ctx.claveDoc !== ctx.cmg.claveDocumento) return;
    ctx.hist.ultimo = ctx.capturar(); ctx.hist.tecleo = false; ctx.pintarBarra();
  });
  (ctx.deshacer = () => ctx.recorrer(ctx.hist.pasado, ctx.hist.futuro));
  (ctx.rehacer = () => ctx.recorrer(ctx.hist.futuro, ctx.hist.pasado));

  // ---------- Sangría ----------
  (ctx.sangriaDe = (l) => l.match(/^[ \t]*/)[0]);
  // Niveles válidos en pos (inicio de línea o final del texto). El adaptador ya excluye las líneas
  // que continúan otra (paréntesis, textos de varias líneas) y el hueco entre un cuerpo y su elif/else
  // al nivel del if; al final de ese cuerpo, en cambio, sí se puede seguir dentro.
  (ctx.nivelesEn = (resto, pos) => ctx.S.niveles(resto, pos));

  // ---------- Portapapeles ----------
  // En la IP de la red local (sin contexto seguro) el navegador no deja leer el portapapeles del sistema:
  // pegar usa entonces lo último copiado aquí.
  (ctx.portapapeles = (() => { try { return dependencias.sesion.leer("cmg-portapapeles") || ""; } catch { return ""; } })());
  };
}
