

// seudo: edicion. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  ctx.cambiado = function() {
    const g = ctx.generar(ctx.modelo);
    ctx.texto = g.codigo; ctx.mapa = g.mapa; ctx.conComentarios = false;
    ctx.escribiendo = true;
    ctx.$codigo.value = ctx.texto;
    ctx.$codigo.dispatchEvent(new Event("input"));
    ctx.escribiendo = false;
    ctx.pintar();
  };
  // El programa de partida llega comentado en JavaScript: en seudocódigo se ve el de partida.
  ctx.arbolDe = function(v) {
    const inicial = ctx.cmg.inicial();
    if (inicial && v === inicial.texto) return { arbol: ctx.parsear(inicial.codigo), comentarios: false };
    return { arbol: ctx.parsear(v), comentarios: ctx.cmg.lexico(v).some(([k]) => k === "com") };
  };
  ctx.sincronizar = function() {
    const v = ctx.$codigo.value;
    if (v === ctx.texto) return ctx.pintar();
    try {
      const r = ctx.arbolDe(v);
      ctx.modelo = r.arbol; ctx.conComentarios = r.comentarios; ctx.texto = v;
      const g = ctx.generar(ctx.modelo);
      ctx.mapa = g.codigo === v ? g.mapa : [];
      ctx.cursor = { padre: "raiz", rama: "cuerpo", idx: ctx.modelo.cuerpo.length };
      ctx.elegido = null;
      ctx.pintar();
      return true;
    } catch (e) {
      if (!(e instanceof ctx.NoTraducible)) throw e;
      ctx.aplicarModo("js");
      ctx.cmg.aviso(`Este programa se quedó en JavaScript: ${ctx.esc(e.message)}`);
      return false;
    }
  };

  // ---------- Edición ----------
  ctx.variables = function() {
    const v = new Set();
    ctx.recorrer(ctx.modelo.cuerpo, n => { if (n.var) v.add(n.var); });
    return [...v];
  };
  ctx.nuevoLadrillo = function(t) {
    const d = ctx.datos(), tipo = d.tipos.find(x => x.enReto)?.id || "crawler", v = ctx.variables()[0] || "pos";
    const base = {
      apuntar: { var: "pos", tipo, sensor: "visual", alt: null },
      oir: { var: "pos", tipo: "crawler", red: d.red[0] || "VIB_01" },
      disparo: { lugar: v }, rafaga: { lugar: v }, detener: {}, salir: {},
      esperar: { s: 0.5 },
      aviso: { valor: "failureRate", nivel: "warn" },
      siempre: { cuerpo: [] }, repetir: { n: 3, cuerpo: [] },
      mientras: { cond: { que: v, op: "existe", n: 0 }, cuerpo: [] },
      si: { cond: { que: "failureRate", op: ">=", n: 0.35 }, cuerpo: [], sino: [] },
    }[t];
    if (ctx.factory) {
      const lugar = d.lugares.find(x => x.tipo === "bodega")?.expresion || '"ENT-1"';
      const destino = d.lugares.find(x => x.tipo === "maquina")?.expresion || '"FUN"';
      const propio = { recoger:{lugar,mat:"cobre"}, entregar:{lugar:destino}, contar:{var:"cantidad",lugar,mat:"cobre"}, esperar:{s:1}, aviso:{valor:'"Hola"',nivel:"log"}, mientras:{cond:{que:`count(${lugar}, "cobre")`,op:">",n:0},cuerpo:[]}, si:{cond:{que:`count(${destino}, "cobre")`,op:"<",n:1},cuerpo:[],sino:[]} }[t];
      return ctx.conIds([{t,...(propio || base)}])[0];
    }
    return ctx.conIds([{ t, ...base }])[0];
  };
  ctx.insertarEn = function(n, padre, rama, idx) {
    ctx.listaDe(ctx.modelo, padre, rama).splice(idx, 0, n);
    ctx.elegido = n.id;
    ctx.cursor = ctx.esContenedor(n) ? { padre: n.id, rama: "cuerpo", idx: 0 } : { padre, rama, idx: idx + 1 };
    ctx.cambiado();
  };
  ctx.agregar = function(n) {
    const lista = ctx.listaDe(ctx.modelo, ctx.cursor.padre, ctx.cursor.rama);
    ctx.insertarEn(n, ctx.cursor.padre, ctx.cursor.rama, Math.min(ctx.cursor.idx, lista.length));
  };
  ctx.borrar = function(id) {
    const l = ctx.buscar(ctx.modelo, id);
    l.lista.splice(l.idx, 1);
    ctx.elegido = null;
    ctx.cursor = { padre: l.padre, rama: l.rama, idx: l.idx };
    ctx.cambiado();
  };
  ctx.duplicar = function(id) {
    const l = ctx.buscar(ctx.modelo, id), copia = ctx.conIds([ctx.sinIds(l.nodo)])[0];
    l.lista.splice(l.idx + 1, 0, copia);
    ctx.elegido = copia.id;
    ctx.cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 2 };
    ctx.cambiado();
  };
  // Subir y bajar entran y salen de los bloques, como en Tres vistas.
  ctx.mover = function(id, dir) {
    const l = ctx.buscar(ctx.modelo, id), n = l.nodo;
    if (dir < 0) {
      if (l.idx > 0) {
        const prev = l.lista[l.idx - 1];
        l.lista.splice(l.idx, 1);
        if (ctx.esContenedor(prev)) (prev.t === "si" ? prev.sino : prev.cuerpo).push(n); else l.lista.splice(l.idx - 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = ctx.buscar(ctx.modelo, l.padre);
        l.lista.splice(0, 1);
        if (l.rama === "sino") p.nodo.cuerpo.push(n); else p.lista.splice(p.idx, 0, n);
      } else return;
    } else {
      if (l.idx < l.lista.length - 1) {
        const next = l.lista[l.idx + 1];
        l.lista.splice(l.idx, 1);
        if (ctx.esContenedor(next)) next.cuerpo.unshift(n); else l.lista.splice(l.idx + 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = ctx.buscar(ctx.modelo, l.padre);
        l.lista.splice(l.idx, 1);
        if (l.rama === "cuerpo" && p.nodo.t === "si") p.nodo.sino.unshift(n); else p.lista.splice(p.idx + 1, 0, n);
      } else return;
    }
    const d = ctx.buscar(ctx.modelo, id);
    ctx.cursor = { padre: d.padre, rama: d.rama, idx: d.idx + 1 };
    ctx.cambiado();
  };
  ctx.moverA = function(id, padre, rama, idx) {
    const l = ctx.buscar(ctx.modelo, id), destino = ctx.listaDe(ctx.modelo, padre, rama);
    l.lista.splice(l.idx, 1);
    if (l.lista === destino && l.idx < idx) idx--;
    destino.splice(idx, 0, l.nodo);
    ctx.elegido = id;
    ctx.cursor = { padre, rama, idx: idx + 1 };
    ctx.cambiado();
  };
  ctx.fijarCampo = function(id, campo, v) {
    const n = ctx.buscar(ctx.modelo, id).nodo;
    if (campo.startsWith("cond.")) n.cond[campo.slice(5)] = v; else n[campo] = v;
    ctx.cambiado();
  };
  // Opciones de cada hueco: salen de los datos de la máquina y de las variables del programa.
  ctx.opciones = function(campo, n) {
    const d = ctx.datos(), vars = ctx.variables(), tx = ctx.TXT[ctx.idioma];
    const o = (v, nota, ver) => ({ v, nota, ver });
    if (ctx.factory) {
      if (campo === "lugar") return [...d.lugares.map(x => o(x.expresion, x.tipo)), ...vars.map(v => o(v, "variable"))];
      if (campo === "mat") return d.materiales.map(v => o(v));
      if (campo === "cond.que" || campo === "valor") return [...d.lugares.flatMap(x => d.materiales.map(m => o(`count(${x.expresion}, ${JSON.stringify(m)})`, "lectura"))), ...vars.map(v => o(v))];
      if (campo === "cond.n" || campo === "n") return [0,1,2,3,4,5,6,7,8,10,20,30].map(v => o(v));
      if (campo === "s") return [.05,.1,.5,1,2,3,6,9,15,30,60].map(v => o(v));
      if (campo === "var") return [...new Set([...vars,"cantidad","stock"])].map(v => o(v));
    }
    switch (campo) {
      case "var": return [...new Set([...vars, "pos", "objetivo", "dron", "oruga"])].map(v => o(v));
      case "tipo": case "alt": return [...(campo === "alt" ? [o(null, "sin alternativa", tx.ninguno)] : []), ...d.tipos.map(t => o(t.id, t.nombre + (t.enReto ? " · en este reto" : "")))];
      case "sensor": return d.sensores.map(s => o(s.id, `${s.nombre} · alcance ${s.alcance}`));
      case "red": return d.red.map(r => o(r, "red de sensores"));
      case "lugar": return [...vars.map(v => o(v, "variable")), o("target", "a donde apunta ahora"), o("null", "a ninguna parte")];
      case "s": return [0.1, 0.25, 0.4, 0.5, 1, 2].map(v => o(v));
      case "n": return [2, 3, 4, 5, 10].map(v => o(v));
      case "nivel": return [o("log", "consola"), o("info", "información"), o("warn", "aviso"), o("error", "error")];
      case "valor": return [...ctx.PROPIAS.map(v => o(v, "propiedad")), ...vars.map(v => o(v, "variable")), ...['"Atascado"', '"Sin misiles"', '"Fallo alto"'].map(v => o(v, "texto"))];
      case "cond.que": return [...vars.map(v => o(v, "variable")), ...ctx.PROPIAS.map(v => o(v, "propiedad")), ...d.red.map(r => o(`${r}.count`, "enemigos oídos")),
        ...d.otras.flatMap(m => [o(`${m}.jammed`, "otro lanzador"), o(`${m}.failureRate`, "otro lanzador")])];
      case "cond.op": return ctx.OPS.map(v => o(v, null, v === "existe" ? tx.existe : v === "noexiste" ? tx.noexiste : ctx.OP_VER[v]));
      case "cond.n": return [0, 0.1, 0.25, 0.35, 0.5, 1, 2, 5, "idle", "regular", "burst"].map(v => o(v, typeof v === "string" ? "modo" : null, typeof v === "string" ? `"${v}"` : String(v)));
    }
    return [];
  };
  ctx.abrirHueco = function(id, campo) {
    const n = ctx.buscar(ctx.modelo, id).nodo, actual = ctx.leerCampo(n, campo), ops = ctx.opciones(campo, n);
    ctx.abierto = { id, campo, ops };
    ctx.$lista.innerHTML = `<div class="sug-cab"><b>${ctx.esc(ctx.TITULO[campo] || "Elige")}</b><button type="button" class="sug-x" data-cerrar aria-label="Cerrar">×</button></div>`
      + ops.map((x, i) => `<button type="button" class="sug${x.v === actual ? " activa" : ""}" role="option" data-i="${i}"><code>${ctx.esc(x.ver ?? x.v)}</code>${x.nota ? `<span class="nota">${ctx.esc(x.nota)}</span>` : ""}</button>`).join("");
    ctx.$lista.hidden = false;
    ctx.pintar();
  };
  ctx.colocarLista = function() {
    if (!ctx.abierto) return;
    const el = ctx.$prog.querySelector(".slot.abierto");
    if (!el) return;
    const r = el.getBoundingClientRect(), cont = ctx.$prog.getBoundingClientRect(), vv = window.visualViewport;
    if (r.bottom < cont.top || r.top > cont.bottom) { ctx.$lista.style.visibility = "hidden"; return; }
    ctx.$lista.style.visibility = ""; ctx.$lista.style.maxHeight = "";
    const barras = [ctx.$("edicion"), ctx.$paleta].filter(x => x.getClientRects().length).map(x => x.getBoundingClientRect());
    const medio = cont.top + cont.height / 2;
    // En PC las barras están arriba; en el teléfono, abajo. La lista cabe dentro de la vista del programa
    // y del viewport visible, dejando libres tanto las barras como el teclado.
    const techo = Math.max(vv ? vv.offsetTop : 0, cont.top, ...barras.filter(b => b.bottom <= medio).map(b => b.bottom)) + 4;
    const suelo = Math.min(vv ? vv.offsetTop + vv.height : innerHeight, cont.bottom, ...barras.filter(b => b.top >= medio).map(b => b.top)) - 4;
    const m = ctx.$lista.getBoundingClientRect(), abajo = Math.max(0, suelo - r.bottom - 6), arriba = Math.max(0, r.top - techo - 6);
    const enAbajo = abajo >= Math.min(m.height, 140) || abajo >= arriba;
    const junto = Math.max(abajo, arriba) >= Math.min(m.height, 100);
    const max = Math.max(0, Math.min(320, junto ? (enAbajo ? abajo : arriba) : suelo - techo));
    ctx.$lista.style.maxHeight = `${max}px`;
    const alto = Math.min(m.height, max);
    const y = junto && enAbajo ? r.bottom + 6 : junto ? r.top - 6 - alto : suelo - alto;
    ctx.$lista.style.transform = `translate(${Math.round(Math.max(6, Math.min(innerWidth - m.width - 6, r.left - 6)))}px, ${Math.round(Math.max(techo, y))}px)`;
  };
  ctx.cerrarHueco = function() { if (!ctx.abierto) return; ctx.abierto = null; ctx.$lista.hidden = true; ctx.pintar(); };
  return function iniciar() {


  // ---------- Estado ----------
  (ctx.modo = ctx.leer("modo", ctx.factory ? "bloques" : "js"));
  if (!["js", "pseudo", ...(ctx.factory ? ["bloques"] : [])].includes(ctx.modo)) ctx.modo = "js";
  (ctx.idioma = ctx.leer("idioma-seudo", "es") === "en" ? "en" : "es");
  (ctx.modelo = ctx.raizDe([])), (ctx.texto = null), (ctx.mapa = []), (ctx.conComentarios = false);
  (ctx.cursor = { padre: "raiz", rama: "cuerpo", idx: 0 }), (ctx.elegido = null), (ctx.abierto = null), (ctx.portaBloque = null);
  (ctx.pilaAmpliar = []);
  (ctx.quieto = () => ctx.$codigo.readOnly);
  (ctx.activo = () => ctx.modo !== "js");
  (ctx.datos = () => ctx.cmg.datos());

  // ---------- Sincronía con el texto ----------
  (ctx.escribiendo = false);

  // ---------- Valores (huecos) ----------
  (ctx.leerCampo = (n, campo) => campo.startsWith("cond.") ? n.cond[campo.slice(5)] : n[campo]);
  (ctx.PROPIAS = ["failureRate", "missiles", "jammed", "mode", "fireRate"]);
  (ctx.TITULO = { var: "¿Qué variable?", tipo: "Tipo de enemigo", alt: "Si no hay, ¿a cuál?", sensor: "Sensor", red: "Sensor de la red", lugar: "¿A dónde?", s: "Segundos", n: "¿Cuántas veces?",
    nivel: "¿Cómo avisa?", valor: "¿Qué avisa?", "cond.que": "¿Qué comprueba?", "cond.op": "¿Cómo compara?", "cond.n": "¿Con qué valor?" });
  (ctx.$lista = document.createElement("div"));
  ctx.$lista.className = "sugerencias"; ctx.$lista.hidden = true; ctx.$lista.setAttribute("role", "listbox");
  ctx.vida.portal(ctx.$lista);
  ctx.vida.escuchar(ctx.$prog, "scroll", ctx.colocarLista, { passive: true });
  ctx.vida.escuchar(window, "resize", ctx.colocarLista);
  if (window.visualViewport) {
    ctx.vida.escuchar(visualViewport, "resize", ctx.colocarLista);
    ctx.vida.escuchar(visualViewport, "scroll", ctx.colocarLista);
  }
  ctx.vida.observar(new ResizeObserver(ctx.colocarLista)).observe(ctx.$prog);
  ctx.vida.escuchar(ctx.$lista, "pointerdown", (ev) => ev.preventDefault());
  ctx.vida.escuchar(ctx.$lista, "click", (ev) => {
    if (ev.target.closest("[data-cerrar]")) return ctx.cerrarHueco();
    const b = ev.target.closest(".sug[data-i]");
    if (!b || !ctx.abierto) return;
    const { id, campo, ops } = ctx.abierto;
    ctx.abierto = null; ctx.$lista.hidden = true;
    ctx.fijarCampo(id, campo, ops[+b.dataset.i].v);
  });
  ctx.vida.escuchar(document, "pointerdown", (ev) => { if (ctx.abierto && !ctx.$lista.contains(ev.target) && !ev.target.closest(".slot")) ctx.cerrarHueco(); }, true);
  };
}
