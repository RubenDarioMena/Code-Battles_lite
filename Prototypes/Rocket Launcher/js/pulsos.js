/* Pulsos en el editor durante la partida (War).
 *
 * Mientras el programa corre, lo que hace en el campo se ve en su código: cada fragmento que se activa da una
 * pequeña pulsación (una onda y un anillo que se expande, como la navegación de la bug tool) con el color de
 * su fila en el modo revisión. No es una traza exacta: es la relación entre lo que pasa en el campo y el código.
 *   - Lecturas del juego (autoTarget, detect, LAU_02.jammed…): solo cuando dan algo (ni null, ni undefined, ni false).
 *   - Órdenes (regularShoot, burstFire, stopFire): cuando se dan; regularShoot(null) no dispara y no pulsa.
 *   - console.log (y info, warn, error): siempre.
 *   - Condiciones de if y de ?: : solo cuando se cumplen. Las de los bucles, nunca; lo que se lee dentro de una
 *     condición tampoco (pulsa la condición entera, si se cumple).
 * JavaScript: el programa se instrumenta con el trazador del modo revisión, con un filtro que solo pone esos
 * ganchos (educational-animation/revision/motor/trazador.js); los lotes llegan en cada await. Los colores salen
 * de las filas del diagrama (flujo.js), los mismos que en el modo revisión.
 * Python: el programa corre traducido a JS, sin ganchos; los mensajes lee, cmd y consola del Worker traen su
 * línea. El lector de Python del modo revisión (motor/python.js) da el árbol: en esa línea pulsa la llamada
 * de esa clase (auto_target(…), regular_shoot(…), print(…)) con el color de su fila. Sin lector, la línea entera.
 *
 *   CMGPulsos.preparar(id, fuente) → código instrumentado para el Worker (o la fuente tal cual si no se puede)
 *   CMGPulsos.python(id, fuente)   el programa id es Python: sus pulsos salen de los mensajes con línea
 *   CMGPulsos.traza(id, eventos)   un lote del trazador
 *   CMGPulsos.linea(id, linea, clase, valor)   Python: lee | cmd | consola
 *   CMGPulsos.conectar({ visibles })           ids cuyo código está ahora en el editor
 *   CMGPulsos.reiniciar()          al empezar otra ejecución */
(() => {
  "use strict";
  const T = window.CMGTrazador, FL = window.CMGFlujo, PY = window.CMGPythonRevision;
  const LECTURAS = new Set(["autoTarget", "detect"]);
  const ORDENES = new Set(["regularShoot", "burstFire", "stopFire"]);
  const CONSOLA = new Set(["log", "info", "warn", "error"]);
  const PROPIEDADES = new Set(["failureRate", "missiles", "mode", "jammed", "fireRate", "sensors", "target", "count"]);
  const COLOR_PY = { lee: "#63D2E0", cmd: "#E0AE4A", consola: "#CFA2FF" };
  const ESPERA = 380;      // ms mínimos entre dos pulsos del mismo fragmento (a 8× llegan lotes casi seguidos)
  const DURA = 720;        // ms que dura un pulso (el anillo de 0,68 s)
  const MAX_POR_LOTE = 12;

  // ¿Qué es este nodo de acorn para los pulsos? lectura | orden | consola | null.
  function claseAcorn(n) {
    if (n.type === "CallExpression") {
      const c = n.callee;
      if (c.type === "Identifier") return LECTURAS.has(c.name) ? "lectura" : ORDENES.has(c.name) ? "orden" : c.name === "log" ? "consola" : null;
      if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier") {
        const m = c.property.name, o = c.object.type === "Identifier" ? c.object.name : null;
        if (o === "console") return CONSOLA.has(m) ? "consola" : null;
        return LECTURAS.has(m) ? "lectura" : ORDENES.has(m) ? "orden" : null;
      }
      return null;
    }
    if (n.type === "MemberExpression" && !n.computed && n.property.type === "Identifier" && PROPIEDADES.has(n.property.name) && n.object.type === "Identifier") return "lectura";
    return null;
  }
  // Condiciones: solo la de un if o un ?: (su campo test), no cualquier sentencia que cuelgue de un if.
  const filtro = (g, n, padre, campo) => g === "s" ? false : g === "c" ? campo === "test" && (padre.type === "IfStatement" || padre.type === "ConditionalExpression") && n.type !== "Literal" : !!claseAcorn(n);

  // La misma clase, desde la tabla de nodos del trazador (para los lotes).
  function claseTabla(N, x) {
    if (x.ganchos.includes("c")) return "condicion";
    if (!x.ganchos.includes("v")) return null;
    if (x.tipo === "MemberExpression") return "lectura";
    if (x.tipo !== "CallExpression") return null;
    const c = N[x.hijos.find(h => N[h].campo === "callee")];
    if (c.tipo === "Identifier") return LECTURAS.has(c.nombre) ? "lectura" : ORDENES.has(c.nombre) ? "orden" : c.nombre === "log" ? "consola" : null;
    const prop = N[c.hijos.find(h => N[h].campo === "property")], obj = N[c.hijos.find(h => N[h].campo === "object")];
    if (obj && obj.nombre === "console") return "consola";
    return prop && (LECTURAS.has(prop.nombre) ? "lectura" : ORDENES.has(prop.nombre) ? "orden" : null);
  }
  // ¿Está dentro de la condición de un if, un bucle o un ?: (sin salir de su sentencia)?
  function enCondicion(N, i) {
    for (let x = N[i]; x && x.padre != null; x = N[x.padre]) {
      if (x.campo === "test") return true;
      if (/(Statement|Declaration)$/.test(x.tipo)) return false;
    }
    return false;
  }

  const programas = new Map();   // id → { fuente, nodos: Map(id → { a, b, clase, color }) } | { python: true }
  const ultimo = new Map();      // "id:nodo" → ms del último pulso
  let visibles = () => [];

  function preparar(id, fuente) {
    programas.delete(id);
    if (!T || !FL || typeof acorn === "undefined") return fuente;
    try {
      const x = T.instrumentar(fuente, { acorn, filtro });
      const P = FL.preparar({ fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios }, { id });
      const F = FL.construir(P);
      const nodos = new Map();
      for (const n of x.nodos) {
        const clase = n.ganchos && claseTabla(x.nodos, n);
        if (!clase || (clase !== "condicion" && enCondicion(x.nodos, n.id))) continue;
        const f = F.duena(n.id);
        nodos.set(n.id, { a: n.a, b: n.b, clase, color: f != null ? F.filas[f].color : "#7FA3FF" });
      }
      programas.set(id, { fuente: x.fuente, nodos });
      return x.codigo;
    } catch (e) {
      // Sin pulsos antes que un programa distinto: el Worker recibe la fuente tal cual.
      return fuente;
    }
  }
  // Python: por cada línea, sus llamadas del juego y de la consola con su fila (para el color).
  const camello = (n) => n.replace(/_+([a-z0-9])/g, (m, x) => x.toUpperCase());
  const CLASE_PY = { lectura: "lee", orden: "cmd", consola: "consola" };
  function python(id, fuente) {
    const pr = { python: true, fuente: fuente || "", lineas: new Map(), colorLinea: new Map() };
    programas.set(id, pr);
    if (!PY || !FL || !fuente) return;
    try {
      const x = PY.leer(fuente);
      const P = FL.preparar(x, { id }), F = FL.construir(P), N = x.nodos;
      for (const n of N) {
        if (/(Statement|Declaration)$/.test(n.tipo) && !pr.colorLinea.has(n.linea)) { const f = F.duena(n.id); if (f != null) pr.colorLinea.set(n.linea, F.filas[f].color); }
        if (n.tipo !== "CallExpression") continue;
        const c = N[n.hijos.find(h => N[h].campo === "callee")];
        let nombre = null, objeto = null;
        if (c.tipo === "Identifier") nombre = c.nombre;
        else if (c.tipo === "MemberExpression" && !c.computado) { nombre = N[c.hijos.find(h => N[h].campo === "property")].nombre; const o = N[c.hijos.find(h => N[h].campo === "object")]; objeto = o.tipo === "Identifier" ? o.nombre : null; }
        if (!nombre) continue;
        const m = camello(nombre);
        const clase = nombre === "print" || (objeto == null && CONSOLA.has(nombre)) ? "consola" : LECTURAS.has(m) ? "lectura" : ORDENES.has(m) ? "orden" : null;
        if (!clase) continue;
        const f = F.duena(n.id);
        const l = pr.lineas.get(n.linea) || pr.lineas.set(n.linea, []).get(n.linea);
        l.push({ a: n.a, b: n.b, tipo: CLASE_PY[clase], color: f != null ? F.filas[f].color : COLOR_PY[CLASE_PY[clase]], n: n.id });
      }
    } catch (e) { /* Sin árbol: pulsos por línea */ }
  }
  function reiniciar() { programas.clear(); ultimo.clear(); limpiarCapa(); }

  // ¿Este valor del trazador «da algo»? undefined llega como { $: "u" }.
  const vacio = (v) => v === null || v === false || v === undefined || (v && typeof v === "object" && v.$ === "u");
  const cierto = (v) => FL ? FL.verdad(v) : !!v;

  function traza(id, eventos) {
    const pr = programas.get(id);
    if (!pr || pr.python || !visibles().includes(id)) return;
    const vistos = new Set(), ahora = performance.now();
    let n = 0;
    for (const e of eventos) {
      if (e.length < 2 || e[0] === "t") continue;
      const x = pr.nodos.get(e[0]);
      if (!x || vistos.has(e[0])) continue;
      const v = e[1];
      if (x.clase === "condicion" ? !cierto(v) : x.clase === "lectura" ? vacio(v) : x.clase === "orden" ? v === "sin_objetivo" : false) continue;
      vistos.add(e[0]);
      const k = `${id}:${e[0]}`;
      if (ahora - (ultimo.get(k) || -1e9) < ESPERA) continue;
      ultimo.set(k, ahora);
      if (++n > MAX_POR_LOTE) break;
      pulsar(pr.fuente, x.a, x.b, x.color, e[0]);
    }
  }
  function linea(id, l, clase, valor) {
    const pr = programas.get(id);
    if (!pr || !pr.python || l == null || !visibles().includes(id)) return;
    if (clase === "lee" && (valor === null || valor === undefined || valor === false)) return;
    if (clase === "cmd" && valor === "sin_objetivo") return;
    const k = `${id}:L${l}`, ahora = performance.now();
    if (ahora - (ultimo.get(k) || -1e9) < ESPERA) return;
    ultimo.set(k, ahora);
    const cod = document.getElementById("codigo");
    if (!cod) return;
    // Con árbol: las llamadas de esa clase en esa línea, con el color de su fila.
    const llamadas = (pr.lineas && pr.lineas.get(l) || []).filter(x => x.tipo === clase);
    if (llamadas.length && cod.value === pr.fuente) { for (const x of llamadas) pulsar(pr.fuente, x.a, x.b, x.color, x.n); return; }
    const lineas = cod.value.split("\n"), txt = lineas[l - 1];
    if (txt == null || !txt.trim()) return;
    let a = 0;
    for (let k2 = 0; k2 < l - 1; k2++) a += lineas[k2].length + 1;
    const sangria = txt.match(/^\s*/)[0].length;
    pulsar(cod.value, a + sangria, a + txt.replace(/\s+$/, "").length, (pr.colorLinea && pr.colorLinea.get(l)) || COLOR_PY[clase] || COLOR_PY.lee, "L" + l);
  }

  // ---------- Dibujo ----------
  // Una capa encima del texto (sin capturar el puntero). Las cajas salen del espejo del editor (mismas
  // métricas que el textarea) o, sin teclado, de las fichas de la vista de bloques.
  let capa = null;
  function laCapa(area) {
    if (!capa || capa.parentElement !== area) { capa = document.createElement("div"); capa.className = "capa-pulsos"; capa.setAttribute("aria-hidden", "true"); area.append(capa); }
    return capa;
  }
  function limpiarCapa() { if (capa) capa.replaceChildren(); }
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function cajas(fuente, a, b) {
    const area = document.getElementById("area"), cod = document.getElementById("codigo"), editor = document.getElementById("editor");
    if (!area || !cod || cod.value !== fuente) return null;
    const ra = area.getBoundingClientRect();
    if (!ra.width || !ra.height) return null;
    // Solo la primera línea del fragmento: un pulso por renglón visible basta para verlo.
    const finLinea = fuente.indexOf("\n", a);
    if (finLinea >= 0 && b > finLinea) b = finLinea;
    let rects = [], dx = 0, dy = 0;
    if (editor && editor.classList.contains("sin-teclado")) {
      const texto = document.getElementById("bloques-texto");
      if (!texto) return null;
      const piezas = [...texto.querySelectorAll("span[data-a]")].filter(s => { const x = +s.dataset.a; return x < b && x + s.textContent.length > a; });
      if (!piezas.length) return null;
      const r = document.createRange(), p0 = piezas[0], p1 = piezas.at(-1);
      r.setStart(p0.firstChild, Math.max(0, a - +p0.dataset.a)); r.setEnd(p1.firstChild, Math.min(p1.textContent.length, b - +p1.dataset.a));
      rects = [...r.getClientRects()];
    } else {
      const espejo = document.getElementById("espejo");
      if (!espejo) return null;
      const antes = fuente.slice(0, a), l = antes.split("\n").length - 1, col = a - (antes.lastIndexOf("\n") + 1);
      const div = espejo.children[l], nodo = div && div.firstChild;
      if (!nodo || nodo.nodeType !== 3) return null;
      const r = document.createRange();
      r.setStart(nodo, Math.min(col, nodo.length)); r.setEnd(nodo, Math.min(col + (b - a), nodo.length));
      rects = [...r.getClientRects()];
      dx = -cod.scrollLeft; dy = -cod.scrollTop;
    }
    return rects.filter(x => x.width > 0).slice(0, 3).map(x => ({ x: x.left - ra.left + dx, y: x.top - ra.top + dy, w: x.width, h: x.height }))
      .filter(x => x.y + x.h > 0 && x.y < ra.height && x.x < ra.width).map(x => ({ ...x, area }));
  }
  function pulsar(fuente, a, b, color, clave) {
    if (document.hidden || b <= a) return;
    const lista = cajas(fuente, a, b);
    if (!lista || !lista.length) return;
    const c = laCapa(lista[0].area);
    for (const r of lista) {
      const p = document.createElement("div");
      p.className = "pulso"; p.dataset.n = clave;
      p.style.cssText = `left:${(r.x - 2).toFixed(1)}px;top:${(r.y - 1).toFixed(1)}px;width:${(r.w + 4).toFixed(1)}px;height:${(r.h + 2).toFixed(1)}px;--c:${color}`;
      c.append(p);
      setTimeout(() => p.remove(), reducido() ? 650 : DURA);
    }
    // Si se acumulan (pestaña en segundo plano, turbo), se quedan los últimos.
    while (c.childElementCount > 40) c.firstElementChild.remove();
  }

  window.CMGPulsos = {
    preparar, python, traza, linea, reiniciar,
    conectar(o) { if (o && typeof o.visibles === "function") visibles = o.visibles; },
    get programas() { return programas; },
  };
})();
