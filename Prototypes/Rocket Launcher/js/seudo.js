/* Code Battle Lite · seudocódigo de Rocket Launcher (traído de Tres vistas y adaptado al lanzador).
 * El programa se sigue guardando como JavaScript: el seudocódigo es otra vista del mismo texto.
 * Al entrar se traduce a un árbol el subconjunto que el seudocódigo conoce; cada cambio en el árbol
 * vuelve a escribir el JavaScript, así que guardar, ejecutar y deshacer funcionan igual.
 * Lo que no se puede traducir se queda en JavaScript con un aviso. Habla con juego.js por window.cmg. */
(() => {
  "use strict";
  const cmg = window.cmg;
  if (!cmg) return;
  const $ = (id) => document.getElementById(id);
  const app = $("app"), $codigo = cmg.codigo, $prog = $("prog"), $paleta = $("paleta-seudo"), $editor = $("editor");
  const leer = (k, d) => { try { const v = localStorage.getItem(`cmg-juego-${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(`cmg-juego-${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // ---------- Textos (kw = orden, kc = control, tx = texto, slot = valor que se elige) ----------
  const TXT = {
    es: {
      apuntar: [["slot", "var"], ["tx", "←"], ["kw", "apunta a"], ["slot", "tipo"], ["tx", "con"], ["slot", "sensor"], ["tx", "· si no hay:"], ["slot", "alt"]],
      oir: [["slot", "var"], ["tx", "←"], ["kw", "escucha"], ["slot", "tipo"], ["tx", "con"], ["slot", "red"]],
      disparo: [["kw", "dispara a"], ["slot", "lugar"]],
      rafaga: [["kw", "ráfaga a"], ["slot", "lugar"]],
      detener: [["kw", "deja de disparar"]],
      esperar: [["kw", "espera"], ["slot", "s"], ["tx", "s"]],
      aviso: [["kw", "avisa"], ["slot", "valor"], ["tx", "como"], ["slot", "nivel"]],
      salir: [["kc", "sal del bucle"]],
      siempre: [["kc", "repite siempre"]],
      repetir: [["kc", "repite"], ["slot", "n"], ["tx", "veces"]],
      mientras: [["kc", "mientras"], ["cond"]],
      si: [["kc", "si"], ["cond"]],
      sino: "si no", fin: { siempre: "fin repite", repetir: "fin repite", mientras: "fin mientras", si: "fin si" },
      inicio: "programa", vacio: "vacío · toca aquí y luego un ladrillo", cursor: "siguiente", ninguno: "—",
      existe: "existe", noexiste: "no existe",
      paleta: { apuntar: "apunta", oir: "escucha", disparo: "dispara", rafaga: "ráfaga", detener: "detén", esperar: "espera", aviso: "avisa", siempre: "siempre", repetir: "repite", mientras: "mientras", si: "si / si no", salir: "sal" },
    },
    en: {
      apuntar: [["slot", "var"], ["tx", "←"], ["kw", "aim at"], ["slot", "tipo"], ["tx", "with"], ["slot", "sensor"], ["tx", "· if none:"], ["slot", "alt"]],
      oir: [["slot", "var"], ["tx", "←"], ["kw", "listen for"], ["slot", "tipo"], ["tx", "with"], ["slot", "red"]],
      disparo: [["kw", "shoot at"], ["slot", "lugar"]],
      rafaga: [["kw", "burst at"], ["slot", "lugar"]],
      detener: [["kw", "stop firing"]],
      esperar: [["kw", "wait"], ["slot", "s"], ["tx", "s"]],
      aviso: [["kw", "report"], ["slot", "valor"], ["tx", "as"], ["slot", "nivel"]],
      salir: [["kc", "exit loop"]],
      siempre: [["kc", "repeat forever"]],
      repetir: [["kc", "repeat"], ["slot", "n"], ["tx", "times"]],
      mientras: [["kc", "while"], ["cond"]],
      si: [["kc", "if"], ["cond"]],
      sino: "else", fin: { siempre: "end repeat", repetir: "end repeat", mientras: "end while", si: "end if" },
      inicio: "program", vacio: "empty · tap here, then a brick", cursor: "next", ninguno: "—",
      existe: "exists", noexiste: "is missing",
      paleta: { apuntar: "aim", oir: "listen", disparo: "shoot", rafaga: "burst", detener: "stop", esperar: "wait", aviso: "report", siempre: "forever", repetir: "repeat", mientras: "while", si: "if / else", salir: "exit" },
    },
  };
  const COND = [["slot", "cond.que"], ["slot", "cond.op"], ["slot", "cond.n"]];
  const CATEGORIA = { apuntar: "sentido", oir: "sentido", disparo: "accion", rafaga: "accion", detener: "accion", aviso: "accion", esperar: "espera", siempre: "control", repetir: "control", mientras: "control", si: "control", salir: "control" };
  const ICONO = { apuntar: "apuntar", oir: "sensor", disparo: "disparo", rafaga: "rafaga", detener: "detener", esperar: "esperar", aviso: "aviso", siempre: "whileTrue", repetir: "para", mientras: "mientras", si: "siNo", salir: "salir" };
  const LADRILLOS = ["apuntar", "oir", "disparo", "rafaga", "detener", "esperar", "|", "siempre", "repetir", "mientras", "si", "salir", "|", "aviso"];
  const OPS = ["existe", "noexiste", ">", ">=", "<", "<=", "==", "!="];
  const OP_JS = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "==": "===", "!=": "!==" };
  const OP_VER = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "==": "=", "!=": "≠" };
  const esContenedor = (n) => !!n.cuerpo;

  // ---------- Modelo ----------
  let sigId = 1;
  function conIds(lista) {
    return lista.map(n => {
      const c = { ...n, id: `s${sigId++}` };
      if (c.cond) c.cond = { ...c.cond };
      if (c.cuerpo) c.cuerpo = conIds(c.cuerpo);
      if (c.t === "si") c.sino = conIds(c.sino || []);
      return c;
    });
  }
  const raizDe = (lista) => ({ t: "programa", id: "raiz", cuerpo: conIds(lista) });
  function recorrer(lista, fn, padre = "raiz", rama = "cuerpo") {
    lista.forEach((n, i) => {
      fn(n, padre, rama, i, lista);
      if (n.cuerpo) recorrer(n.cuerpo, fn, n.id, "cuerpo");
      if (n.sino) recorrer(n.sino, fn, n.id, "sino");
    });
  }
  function buscar(prog, id) {
    if (id === "raiz") return { nodo: prog };
    let res = null;
    recorrer(prog.cuerpo, (n, padre, rama, idx, lista) => { if (n.id === id) res = { nodo: n, padre, rama, idx, lista }; });
    return res;
  }
  const listaDe = (prog, padre, rama) => buscar(prog, padre).nodo[rama];
  const sinIds = (n) => JSON.parse(JSON.stringify(n, (k, v) => k === "id" ? undefined : v));

  // Árbol → JavaScript, con el nodo de cada línea para iluminar la que se ejecuta.
  function generar(prog) {
    const lineas = [], mapa = [];
    const emit = (txt, id, nivel) => { lineas.push("  ".repeat(nivel) + txt); mapa.push(id); };
    const q = (s) => JSON.stringify(s), vars = ["i", "j", "k", "m", "n"];
    const at = (tipo, sensor) => `autoTarget(${q(tipo)}, ${q(sensor)})`;
    const cond = (c) => c.op === "existe" ? c.que : c.op === "noexiste" ? `!${c.que}` : `${c.que} ${OP_JS[c.op]} ${typeof c.n === "string" ? q(c.n) : c.n}`;
    (function bloque(lista, nivel, prof) {
      // Una variable que se asigna varias veces en la misma lista se declara con let y luego se reasigna.
      const veces = {}, vistas = new Set();
      for (const n of lista) if (n.var) veces[n.var] = (veces[n.var] || 0) + 1;
      const decl = (v) => { if (veces[v] === 1) return `const ${v}`; if (vistas.has(v)) return v; vistas.add(v); return `let ${v}`; };
      for (const n of lista) {
        if (n.t === "apuntar") emit(`${decl(n.var)} = ${at(n.tipo, n.sensor)}${n.alt ? ` ?? ${at(n.alt, n.sensor)}` : ""};`, n.id, nivel);
        else if (n.t === "oir") emit(`${decl(n.var)} = ${n.red}.detect(${q(n.tipo)});`, n.id, nivel);
        else if (n.t === "disparo") emit(`regularShoot(${n.lugar});`, n.id, nivel);
        else if (n.t === "rafaga") emit(`burstFire(${n.lugar});`, n.id, nivel);
        else if (n.t === "detener") emit("stopFire();", n.id, nivel);
        else if (n.t === "esperar") emit(`await esperar(${n.s});`, n.id, nivel);
        else if (n.t === "aviso") emit(`console.${n.nivel}(${n.valor});`, n.id, nivel);
        else if (n.t === "salir") emit("break;", n.id, nivel);
        else if (n.t === "siempre" || n.t === "mientras") {
          emit(`while (${n.t === "siempre" ? "true" : cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          emit("}", n.id, nivel);
        } else if (n.t === "repetir") {
          const v = vars[prof] || `i${prof}`;
          emit(`for (let ${v} = 0; ${v} < ${n.n}; ${v}++) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof + 1);
          emit("}", n.id, nivel);
        } else if (n.t === "si") {
          let s = n;
          emit(`if (${cond(s.cond)}) {`, s.id, nivel);
          for (;;) {
            bloque(s.cuerpo, nivel + 1, prof);
            if (s.sino.length === 1 && s.sino[0].t === "si") { s = s.sino[0]; emit(`} else if (${cond(s.cond)}) {`, s.id, nivel); continue; }
            if (s.sino.length) { emit("} else {", s.id, nivel); bloque(s.sino, nivel + 1, prof); }
            break;
          }
          emit("}", n.id, nivel);
        }
      }
    })(prog.cuerpo, 0, 0);
    return { codigo: lineas.join("\n") + (lineas.length ? "\n" : ""), mapa };
  }

  // JavaScript → árbol, solo para lo que el seudocódigo sabe decir.
  class NoTraducible extends Error {}
  function parsear(src) {
    if (typeof acorn === "undefined") throw new NoTraducible("no se pudo cargar el traductor (sin conexión).");
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, locations: true }); }
    catch (e) { throw new NoTraducible(`el texto tiene un error de sintaxis (${e.message}).`); }
    const no = (n, que) => { throw new NoTraducible(`línea ${n.loc.start.line}: ${que} todavía no tiene seudocódigo.`); };
    const texto = (n) => src.slice(n.start, n.end);
    const str = (a) => a && a.type === "Literal" && typeof a.value === "string";
    const num = (a) => a && a.type === "Literal" && typeof a.value === "number";
    const nombre = (e) => e && (e.type === "Identifier" || (e.type === "MemberExpression" && !e.computed && nombre(e.object) && e.property.type === "Identifier"));
    const llamada = (e, fn) => e && e.type === "CallExpression" && e.callee.type === "Identifier" && e.callee.name === fn;
    const apunta = (e) => llamada(e, "autoTarget") && e.arguments.length === 2 && str(e.arguments[0]) && str(e.arguments[1]) ? { tipo: e.arguments[0].value, sensor: e.arguments[1].value } : null;
    // Lo que se guarda en una variable: apuntar (con alternativa ??) o escuchar a la red de sensores.
    function valorVariable(v, init, s) {
      const a = apunta(init);
      if (a) return { t: "apuntar", var: v, ...a, alt: null };
      if (init && init.type === "LogicalExpression" && init.operator === "??") {
        const x = apunta(init.left), y = apunta(init.right);
        if (x && y && x.sensor === y.sensor) return { t: "apuntar", var: v, ...x, alt: y.tipo };
      }
      if (init && init.type === "CallExpression" && init.callee.type === "MemberExpression" && !init.callee.computed && init.callee.property.name === "detect"
        && init.callee.object.type === "Identifier" && init.arguments.length === 1 && str(init.arguments[0])) return { t: "oir", var: v, red: init.callee.object.name, tipo: init.arguments[0].value };
      no(s, "este valor de variable");
    }
    const OPS_AST = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "===": "==", "==": "==", "!==": "!=", "!=": "!=" };
    function cond(e) {
      if (nombre(e)) return { que: texto(e), op: "existe", n: 0 };
      if (e.type === "UnaryExpression" && e.operator === "!" && nombre(e.argument)) return { que: texto(e.argument), op: "noexiste", n: 0 };
      if (e.type === "BinaryExpression" && OPS_AST[e.operator] && nombre(e.left) && (num(e.right) || str(e.right))) return { que: texto(e.left), op: OPS_AST[e.operator], n: e.right.value };
      if (e.type === "LogicalExpression") no(e, `«${e.operator}» en una condición`);
      no(e, "esta condición");
    }
    const cuerpo = (s) => s.type === "BlockStatement" ? lista(s.body) : lista([s]);
    function lista(stmts) {
      const out = [];
      for (const s of stmts) {
        if (s.type === "EmptyStatement") continue;
        if (s.type === "BlockStatement") { out.push(...lista(s.body)); continue; }
        if (s.type === "VariableDeclaration") {
          if (s.declarations.length !== 1 || s.declarations[0].id.type !== "Identifier" || !s.declarations[0].init) no(s, "esta declaración");
          out.push(valorVariable(s.declarations[0].id.name, s.declarations[0].init, s));
          continue;
        }
        if (s.type === "ExpressionStatement") {
          const e = s.expression;
          if (e.type === "AssignmentExpression" && e.operator === "=" && e.left.type === "Identifier") { out.push(valorVariable(e.left.name, e.right, s)); continue; }
          const arg = e.arguments && e.arguments[0];
          const lugar = (a) => a && (nombre(a) || (a.type === "Literal" && a.value === null));
          if ((llamada(e, "regularShoot") || llamada(e, "burstFire")) && e.arguments.length === 1 && lugar(arg)) { out.push({ t: e.callee.name === "regularShoot" ? "disparo" : "rafaga", lugar: texto(arg) }); continue; }
          if (llamada(e, "stopFire") && !e.arguments.length) { out.push({ t: "detener" }); continue; }
          if (e.type === "AwaitExpression" && llamada(e.argument, "esperar") && e.argument.arguments.length === 1 && num(e.argument.arguments[0])) { out.push({ t: "esperar", s: e.argument.arguments[0].value }); continue; }
          if (e.type === "CallExpression" && e.callee.type === "MemberExpression" && e.callee.object.name === "console" && ["log", "info", "warn", "error"].includes(e.callee.property.name)
            && e.arguments.length === 1 && (nombre(arg) || arg.type === "Literal")) { out.push({ t: "aviso", nivel: e.callee.property.name, valor: texto(arg) }); continue; }
          no(s, "esta instrucción");
        }
        if (s.type === "BreakStatement" && !s.label) { out.push({ t: "salir" }); continue; }
        if (s.type === "WhileStatement") {
          if (s.test.type === "Literal" && s.test.value === true) out.push({ t: "siempre", cuerpo: cuerpo(s.body) });
          else out.push({ t: "mientras", cond: cond(s.test), cuerpo: cuerpo(s.body) });
          continue;
        }
        if (s.type === "ForStatement") {
          const d = s.init && s.init.type === "VariableDeclaration" && s.init.declarations.length === 1 ? s.init.declarations[0] : null, v = d && d.id.name;
          const ok = d && num(d.init) && d.init.value === 0 && s.test && s.test.type === "BinaryExpression" && s.test.operator === "<" && s.test.left.name === v && num(s.test.right)
            && s.update && s.update.type === "UpdateExpression" && s.update.operator === "++" && s.update.argument.name === v;
          if (!ok) no(s, "un for distinto de «for (let i = 0; i < N; i++)»");
          out.push({ t: "repetir", n: s.test.right.value, cuerpo: cuerpo(s.body) });
          continue;
        }
        if (s.type === "IfStatement") {
          const sino = !s.alternate ? [] : s.alternate.type === "IfStatement" ? lista([s.alternate]) : cuerpo(s.alternate);
          out.push({ t: "si", cond: cond(s.test), cuerpo: cuerpo(s.consequent), sino });
          continue;
        }
        if (s.type === "DoWhileStatement") no(s, "do … while");
        if (s.type === "FunctionDeclaration") no(s, "una función");
        no(s, "esta instrucción");
      }
      return out;
    }
    return raizDe(lista(ast.body));
  }

  // ---------- Estado ----------
  let modo = leer("modo", "js") === "pseudo" ? "pseudo" : "js";
  let idioma = leer("idioma-seudo", "es") === "en" ? "en" : "es";
  let modelo = raizDe([]), texto = null, mapa = [], conComentarios = false;
  let cursor = { padre: "raiz", rama: "cuerpo", idx: 0 }, elegido = null, abierto = null, portaBloque = null;
  const pilaAmpliar = [];
  const quieto = () => $codigo.readOnly;
  const activo = () => modo === "pseudo";
  const datos = () => cmg.datos();

  // ---------- Sincronía con el texto ----------
  let escribiendo = false;
  function cambiado() {
    const g = generar(modelo);
    texto = g.codigo; mapa = g.mapa; conComentarios = false;
    escribiendo = true;
    $codigo.value = texto;
    $codigo.dispatchEvent(new Event("input"));
    escribiendo = false;
    pintar();
  }
  // El programa de partida llega comentado en JavaScript: en seudocódigo se ve el de partida.
  function arbolDe(v) {
    const inicial = cmg.inicial();
    if (inicial && v === inicial.texto) return { arbol: parsear(inicial.codigo), comentarios: false };
    return { arbol: parsear(v), comentarios: cmg.lexico(v).some(([k]) => k === "com") };
  }
  function sincronizar() {
    const v = $codigo.value;
    if (v === texto) return pintar();
    try {
      const r = arbolDe(v);
      modelo = r.arbol; conComentarios = r.comentarios; texto = v;
      const g = generar(modelo);
      mapa = g.codigo === v ? g.mapa : [];
      cursor = { padre: "raiz", rama: "cuerpo", idx: modelo.cuerpo.length };
      elegido = null;
      pintar();
      return true;
    } catch (e) {
      if (!(e instanceof NoTraducible)) throw e;
      aplicarModo("js");
      cmg.aviso(`Este programa se quedó en JavaScript: ${esc(e.message)}`);
      return false;
    }
  }

  // ---------- Edición ----------
  function variables() {
    const v = new Set();
    recorrer(modelo.cuerpo, n => { if (n.var) v.add(n.var); });
    return [...v];
  }
  function nuevoLadrillo(t) {
    const d = datos(), tipo = d.tipos.find(x => x.enReto)?.id || "crawler", v = variables()[0] || "pos";
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
    return conIds([{ t, ...base }])[0];
  }
  function insertarEn(n, padre, rama, idx) {
    listaDe(modelo, padre, rama).splice(idx, 0, n);
    elegido = n.id;
    cursor = esContenedor(n) ? { padre: n.id, rama: "cuerpo", idx: 0 } : { padre, rama, idx: idx + 1 };
    cambiado();
  }
  function agregar(n) {
    const lista = listaDe(modelo, cursor.padre, cursor.rama);
    insertarEn(n, cursor.padre, cursor.rama, Math.min(cursor.idx, lista.length));
  }
  function borrar(id) {
    const l = buscar(modelo, id);
    l.lista.splice(l.idx, 1);
    elegido = null;
    cursor = { padre: l.padre, rama: l.rama, idx: l.idx };
    cambiado();
  }
  function duplicar(id) {
    const l = buscar(modelo, id), copia = conIds([sinIds(l.nodo)])[0];
    l.lista.splice(l.idx + 1, 0, copia);
    elegido = copia.id;
    cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 2 };
    cambiado();
  }
  // Subir y bajar entran y salen de los bloques, como en Tres vistas.
  function mover(id, dir) {
    const l = buscar(modelo, id), n = l.nodo;
    if (dir < 0) {
      if (l.idx > 0) {
        const prev = l.lista[l.idx - 1];
        l.lista.splice(l.idx, 1);
        if (esContenedor(prev)) (prev.t === "si" ? prev.sino : prev.cuerpo).push(n); else l.lista.splice(l.idx - 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = buscar(modelo, l.padre);
        l.lista.splice(0, 1);
        if (l.rama === "sino") p.nodo.cuerpo.push(n); else p.lista.splice(p.idx, 0, n);
      } else return;
    } else {
      if (l.idx < l.lista.length - 1) {
        const next = l.lista[l.idx + 1];
        l.lista.splice(l.idx, 1);
        if (esContenedor(next)) next.cuerpo.unshift(n); else l.lista.splice(l.idx + 1, 0, n);
      } else if (l.padre !== "raiz") {
        const p = buscar(modelo, l.padre);
        l.lista.splice(l.idx, 1);
        if (l.rama === "cuerpo" && p.nodo.t === "si") p.nodo.sino.unshift(n); else p.lista.splice(p.idx + 1, 0, n);
      } else return;
    }
    const d = buscar(modelo, id);
    cursor = { padre: d.padre, rama: d.rama, idx: d.idx + 1 };
    cambiado();
  }
  function moverA(id, padre, rama, idx) {
    const l = buscar(modelo, id), destino = listaDe(modelo, padre, rama);
    l.lista.splice(l.idx, 1);
    if (l.lista === destino && l.idx < idx) idx--;
    destino.splice(idx, 0, l.nodo);
    elegido = id;
    cursor = { padre, rama, idx: idx + 1 };
    cambiado();
  }

  // ---------- Valores (huecos) ----------
  const leerCampo = (n, campo) => campo.startsWith("cond.") ? n.cond[campo.slice(5)] : n[campo];
  function fijarCampo(id, campo, v) {
    const n = buscar(modelo, id).nodo;
    if (campo.startsWith("cond.")) n.cond[campo.slice(5)] = v; else n[campo] = v;
    cambiado();
  }
  const PROPIAS = ["failureRate", "missiles", "jammed", "mode", "fireRate"];
  // Opciones de cada hueco: salen de los datos de la máquina y de las variables del programa.
  function opciones(campo, n) {
    const d = datos(), vars = variables(), tx = TXT[idioma];
    const o = (v, nota, ver) => ({ v, nota, ver });
    switch (campo) {
      case "var": return [...new Set([...vars, "pos", "objetivo", "dron", "oruga"])].map(v => o(v));
      case "tipo": case "alt": return [...(campo === "alt" ? [o(null, "sin alternativa", tx.ninguno)] : []), ...d.tipos.map(t => o(t.id, t.nombre + (t.enReto ? " · en este reto" : "")))];
      case "sensor": return d.sensores.map(s => o(s.id, `${s.nombre} · alcance ${s.alcance}`));
      case "red": return d.red.map(r => o(r, "red de sensores"));
      case "lugar": return [...vars.map(v => o(v, "variable")), o("target", "a donde apunta ahora"), o("null", "a ninguna parte")];
      case "s": return [0.1, 0.25, 0.4, 0.5, 1, 2].map(v => o(v));
      case "n": return [2, 3, 4, 5, 10].map(v => o(v));
      case "nivel": return [o("log", "consola"), o("info", "información"), o("warn", "aviso"), o("error", "error")];
      case "valor": return [...PROPIAS.map(v => o(v, "propiedad")), ...vars.map(v => o(v, "variable")), ...['"Atascado"', '"Sin misiles"', '"Fallo alto"'].map(v => o(v, "texto"))];
      case "cond.que": return [...vars.map(v => o(v, "variable")), ...PROPIAS.map(v => o(v, "propiedad")), ...d.red.map(r => o(`${r}.count`, "enemigos oídos")),
        ...d.otras.flatMap(m => [o(`${m}.jammed`, "otro lanzador"), o(`${m}.failureRate`, "otro lanzador")])];
      case "cond.op": return OPS.map(v => o(v, null, v === "existe" ? tx.existe : v === "noexiste" ? tx.noexiste : OP_VER[v]));
      case "cond.n": return [0, 0.1, 0.25, 0.35, 0.5, 1, 2, 5, "idle", "regular", "burst"].map(v => o(v, typeof v === "string" ? "modo" : null, typeof v === "string" ? `"${v}"` : String(v)));
    }
    return [];
  }
  const TITULO = { var: "¿Qué variable?", tipo: "Tipo de enemigo", alt: "Si no hay, ¿a cuál?", sensor: "Sensor", red: "Sensor de la red", lugar: "¿A dónde?", s: "Segundos", n: "¿Cuántas veces?",
    nivel: "¿Cómo avisa?", valor: "¿Qué avisa?", "cond.que": "¿Qué comprueba?", "cond.op": "¿Cómo compara?", "cond.n": "¿Con qué valor?" };
  const $lista = document.createElement("div");
  $lista.className = "sugerencias"; $lista.hidden = true; $lista.setAttribute("role", "listbox");
  document.body.append($lista);
  function abrirHueco(id, campo, el) {
    const n = buscar(modelo, id).nodo, actual = leerCampo(n, campo), ops = opciones(campo, n);
    abierto = { id, campo, ops };
    $lista.innerHTML = `<div class="sug-cab"><b>${esc(TITULO[campo] || "Elige")}</b><button type="button" class="sug-x" data-cerrar aria-label="Cerrar">×</button></div>`
      + ops.map((x, i) => `<button type="button" class="sug${x.v === actual ? " activa" : ""}" role="option" data-i="${i}"><code>${esc(x.ver ?? x.v)}</code>${x.nota ? `<span class="nota">${esc(x.nota)}</span>` : ""}</button>`).join("");
    $lista.hidden = false;
    const r = el.getBoundingClientRect(), m = $lista.getBoundingClientRect(), vv = window.visualViewport;
    const suelo = vv ? vv.offsetTop + vv.height : innerHeight, abajo = suelo - r.bottom - 10;
    const techo = Math.max(...[$("edicion"), $paleta].filter(x => x.getClientRects().length).map(x => x.getBoundingClientRect().bottom), 0) + 4;
    const enAbajo = abajo >= Math.min(m.height, 140) || abajo >= r.top - techo;
    const max = Math.max(100, Math.min(320, enAbajo ? abajo : r.top - techo - 6));
    $lista.style.maxHeight = `${max}px`;
    const y = enAbajo ? r.bottom + 6 : Math.max(techo, r.top - 6 - Math.min(m.height, max));
    $lista.style.transform = `translate(${Math.round(Math.max(6, Math.min(innerWidth - m.width - 6, r.left - 6)))}px, ${Math.round(y)}px)`;
    pintar();
  }
  function cerrarHueco() { if (!abierto) return; abierto = null; $lista.hidden = true; pintar(); }
  $lista.addEventListener("pointerdown", (ev) => ev.preventDefault());
  $lista.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-cerrar]")) return cerrarHueco();
    const b = ev.target.closest(".sug[data-i]");
    if (!b || !abierto) return;
    const { id, campo, ops } = abierto;
    abierto = null; $lista.hidden = true;
    fijarCampo(id, campo, ops[+b.dataset.i].v);
  });
  document.addEventListener("pointerdown", (ev) => { if (abierto && !$lista.contains(ev.target) && !ev.target.closest(".slot")) cerrarHueco(); }, true);

  // ---------- Dibujo ----------
  function valorSlot(n, campo) {
    const v = leerCampo(n, campo), tx = TXT[idioma];
    if (campo === "alt" && v == null) return `<span class="nada">${esc(tx.ninguno)}</span>`;
    if (campo === "cond.op") return esc(v === "existe" ? tx.existe : v === "noexiste" ? tx.noexiste : OP_VER[v]);
    if (campo === "cond.n" && typeof v === "string") return esc(`"${v}"`);
    return esc(v);
  }
  function piezas(n, plantilla) {
    return plantilla.map(([k, v]) => {
      if (k === "cond") return `<span class="cond">${piezas(n, COND.filter(([, c]) => c !== "cond.n" || !["existe", "noexiste"].includes(n.cond.op)))}</span>`;
      if (k === "slot") {
        if (v === "alt" && n.alt == null && quieto()) return "";
        return `<button type="button" class="slot slot-${v.replace(".", "-")}${abierto && abierto.id === n.id && abierto.campo === v ? " abierto" : ""}" data-accion="slot" data-id="${n.id}" data-campo="${v}">${valorSlot(n, v)}</button>`;
      }
      return `<span class="${k}">${esc(v)}</span>`;
    }).join(" ");
  }
  const htmlCursor = () => `<div class="cursor" aria-hidden="true"><span>${esc(TXT[idioma].cursor)}</span></div>`;
  function htmlLista(lista, padre, rama) {
    const conCursor = (i) => !quieto() && cursor.padre === padre && cursor.rama === rama && cursor.idx === i ? htmlCursor() : "";
    let html = `<div class="lista" data-padre="${padre}" data-rama="${rama}">`;
    if (!lista.length && padre !== "raiz") html += `<div class="vacio" data-accion="vacio" data-padre="${padre}" data-rama="${rama}">${esc(TXT[idioma].vacio)}</div>`;
    lista.forEach((n, i) => { html += conCursor(i) + htmlNodo(n); });
    return html + conCursor(lista.length) + `</div>`;
  }
  function htmlNodo(n) {
    const tx = TXT[idioma], cat = CATEGORIA[n.t], sel = elegido === n.id ? " sel" : "";
    if (!esContenedor(n)) return `<div class="fila simple ${cat}${sel}" data-accion="fila" data-parte="simple" data-id="${n.id}" data-nodo="${n.id}" data-item="${n.id}">${piezas(n, tx[n.t])}</div>`;
    let html = `<div class="nodo contenedor ${cat}${sel}" data-item="${n.id}">`;
    html += `<div class="fila cabeza ${cat} ${n.t}" data-accion="fila" data-parte="cabeza" data-id="${n.id}" data-nodo="${n.id}">${piezas(n, tx[n.t])}</div>`;
    html += `<div class="cuerpo">${htmlLista(n.cuerpo, n.id, "cuerpo")}</div>`;
    if (n.t === "si") {
      html += `<div class="fila sino ${cat}" data-accion="fila" data-parte="sino" data-id="${n.id}"><span class="kc">${esc(tx.sino)}</span></div>`;
      html += `<div class="cuerpo">${htmlLista(n.sino, n.id, "sino")}</div>`;
    }
    return html + `<div class="fila pie ${cat}" data-accion="fila" data-parte="pie" data-id="${n.id}">${esc(tx.fin[n.t])}</div></div>`;
  }
  function pintar() {
    if (!activo()) return;
    const scroll = $prog.scrollTop;
    const aviso = conComentarios ? `<div class="seudo-nota">Los comentarios del JavaScript no se ven aquí; al editar en seudocódigo se quitan.</div>` : "";
    $prog.innerHTML = aviso + `<div class="inicio" data-accion="inicio">${esc(TXT[idioma].inicio)}</div>` + htmlLista(modelo.cuerpo, "raiz", "cuerpo");
    $prog.classList.toggle("quieto", quieto());
    $prog.scrollTop = scroll;
    pintarMarcas();
  }
  function pintarPaleta() {
    const I = window.ICONOS || {}, tx = TXT[idioma], d = datos();
    $paleta.innerHTML = LADRILLOS.map(t => {
      if (t === "|") return `<span class="sep-pal" aria-hidden="true"></span>`;
      if (t === "oir" && !d.red.length) return "";
      const ico = I[ICONO[t]] || { svg: "", c1: "#7FA3FF" };
      return `<button type="button" class="atajo ladrillo ${CATEGORIA[t]}" data-ladrillo="${t}" aria-label="${esc(tx.paleta[t])}" style="--c1:${ico.c1};${ico.c2 ? `--c2:${ico.c2};` : ""}${ico.c3 ? `--c3:${ico.c3};` : ""}">${ico.svg}<span>${esc(tx.paleta[t])}</span></button>`;
    }).join("");
  }
  // La línea que se ejecuta (o la del error) ilumina su renglón.
  function pintarMarcas() {
    if (!activo()) return;
    $prog.querySelectorAll(".corre, .err").forEach(x => x.classList.remove("corre", "err"));
    if ($codigo.value !== texto || !mapa.length) return;
    const { corre, err } = cmg.marcas;
    for (const [l, cls] of [[corre, "corre"], [err, "err"]]) {
      const id = l && mapa[l - 1], el = id && $prog.querySelector(`[data-nodo="${id}"]`);
      if (!el) continue;
      el.classList.add(cls);
      const pr = $prog.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.top < pr.top) $prog.scrollTop -= pr.top - er.top + 8; else if (er.bottom > pr.bottom) $prog.scrollTop += er.bottom - pr.bottom + 8;
    }
  }

  $prog.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-accion]");
    if (!t || quieto()) { if (t && quieto()) cmg.aviso("Detén el programa para editarlo."); return; }
    const a = t.dataset.accion;
    if (a === "slot") { elegido = t.dataset.id; pilaAmpliar.length = 0; return abrirHueco(t.dataset.id, t.dataset.campo, t); }
    cerrarHueco();
    pilaAmpliar.length = 0;
    if (a === "inicio") { elegido = null; cursor = { padre: "raiz", rama: "cuerpo", idx: 0 }; }
    else if (a === "vacio") { cursor = { padre: t.dataset.padre, rama: t.dataset.rama, idx: 0 }; elegido = t.dataset.padre; }
    else if (a === "fila") {
      const id = t.dataset.id, l = buscar(modelo, id), parte = t.dataset.parte;
      elegido = id;
      if (parte === "simple" || parte === "pie") cursor = { padre: l.padre, rama: l.rama, idx: l.idx + 1 };
      else if (parte === "cabeza") cursor = { padre: id, rama: "cuerpo", idx: 0 };
      else if (parte === "sino") cursor = { padre: id, rama: "sino", idx: 0 };
    }
    pintar();
  });
  $paleta.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-ladrillo]");
    if (!b) return;
    if (quieto()) return cmg.aviso("Detén el programa para editarlo.");
    agregar(nuevoLadrillo(b.dataset.ladrillo));
  });

  // ---------- Arrastrar y soltar ----------
  // Ratón: arrastrar más de 6 px. Dedo: mantener pulsado un renglón 0,28 s; un ladrillo, arrastrarlo hacia abajo.
  // Soltar un renglón sobre la paleta lo borra.
  let arrastre = null, suprimirClicHasta = 0;
  const $linea = document.createElement("div"); $linea.className = "soltar-linea"; $linea.hidden = true;
  function posibleArrastre(ev, fuente, el) {
    if (quieto() || ev.button > 0) return;
    arrastre = { fuente, el, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, activo: false, tactil: ev.pointerType !== "mouse", id: ev.pointerId };
    if (arrastre.tactil && fuente.id) arrastre.temporizador = setTimeout(() => { if (arrastre && !arrastre.activo) activarArrastre(); }, 280);
  }
  $prog.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".slot")) return;
    const f = ev.target.closest(".fila[data-id]");
    if (f) posibleArrastre(ev, { id: f.dataset.id }, $prog.querySelector(`[data-item="${f.dataset.id}"]`) || f);
  });
  $paleta.addEventListener("pointerdown", (ev) => { const l = ev.target.closest("[data-ladrillo]"); if (l) posibleArrastre(ev, { nuevo: l.dataset.ladrillo }, l); });
  document.addEventListener("pointermove", (ev) => {
    const a = arrastre;
    if (!a || ev.pointerId !== a.id) return;
    a.x = ev.clientX; a.y = ev.clientY;
    const dx = a.x - a.x0, dy = a.y - a.y0, d = Math.hypot(dx, dy);
    if (!a.activo) {
      if (!a.tactil) { if (d > 6) activarArrastre(); }
      else if (a.fuente.nuevo && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) activarArrastre();
      else if (d > 10) cancelarArrastre();
      return;
    }
    moverArrastre();
  });
  document.addEventListener("pointerup", (ev) => { if (arrastre && ev.pointerId === arrastre.id) soltarArrastre(); });
  document.addEventListener("pointercancel", (ev) => { if (arrastre && ev.pointerId === arrastre.id) cancelarArrastre(); });
  document.addEventListener("touchmove", (ev) => {
    const a = arrastre;
    if (!a) return;
    if (a.activo) { ev.preventDefault(); return; }
    if (a.fuente.nuevo && ev.touches[0]) { const dx = ev.touches[0].clientX - a.x0, dy = ev.touches[0].clientY - a.y0; if (Math.abs(dy) > Math.abs(dx)) ev.preventDefault(); }
  }, { passive: false });
  document.addEventListener("click", (ev) => { if (performance.now() < suprimirClicHasta) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  function activarArrastre() {
    const a = arrastre;
    clearTimeout(a.temporizador);
    a.activo = true;
    cerrarHueco();
    const f = document.createElement("div");
    f.className = `fantasma-seudo ${a.fuente.nuevo ? "nuevo" : "prog-seudo"}`;
    const muestra = a.fuente.nuevo ? a.el : (a.el.querySelector(":scope > .fila.cabeza") || a.el);
    f.appendChild(muestra.cloneNode(true));
    f.style.width = `${Math.min(muestra.getBoundingClientRect().width, 340)}px`;
    document.body.appendChild(f);
    a.fantasma = f;
    if (a.fuente.id) a.el.classList.add("arrastrando");
    $prog.appendChild($linea);
    moverArrastre();
  }
  function destinoEn(x, y) {
    const r = $prog.getBoundingClientRect();
    if (x < r.left - 40 || x > r.right + 40 || y < r.top - 30 || y > r.bottom + 30) return null;
    const excl = arrastre.fuente.id ? $prog.querySelector(`[data-item="${arrastre.fuente.id}"]`) : null;
    let mejor = null, dm = Infinity;
    for (const lista of $prog.querySelectorAll(".lista[data-padre]")) {
      if (excl && excl.contains(lista)) continue;
      const lr = lista.getBoundingClientRect(), items = [...lista.children].filter(c => c.dataset.item);
      const ys = items.length ? items.map(it => it.getBoundingClientRect().top - 2).concat(items[items.length - 1].getBoundingClientRect().bottom + 2) : [(lista.querySelector(".vacio") || lista).getBoundingClientRect().top + 14];
      ys.forEach((yy, i) => {
        const d = Math.abs(yy - y) + (x < lr.left - 6 ? 300 : 0) - lr.left * .01;
        if (d < dm) { dm = d; mejor = { padre: lista.dataset.padre, rama: lista.dataset.rama, idx: i, y: yy, x: lr.left, w: lr.width }; }
      });
    }
    return mejor;
  }
  function moverArrastre() {
    const a = arrastre;
    a.fantasma.style.transform = `translate(${a.x + 12}px, ${a.y + (a.tactil ? -48 : 10)}px)`;
    const pr = $paleta.getBoundingClientRect();
    a.borrar = !!a.fuente.id && a.y >= pr.top - 8 && a.y <= pr.bottom + 8;
    $paleta.classList.toggle("borrar", a.borrar);
    a.destino = a.borrar ? null : destinoEn(a.x, a.y);
    const r = $prog.getBoundingClientRect();
    if (a.destino) {
      $linea.hidden = false;
      $linea.style.top = `${a.destino.y - r.top + $prog.scrollTop}px`;
      $linea.style.left = `${a.destino.x - r.left + $prog.scrollLeft}px`;
      $linea.style.width = `${a.destino.w}px`;
    } else $linea.hidden = true;
    if (a.y < r.top + 28 && a.y > r.top - 30) $prog.scrollTop -= 10; else if (a.y > r.bottom - 28 && a.y < r.bottom + 30) $prog.scrollTop += 10;
  }
  function limpiarArrastre(a) {
    clearTimeout(a.temporizador);
    if (a.fantasma) a.fantasma.remove();
    a.el.classList.remove("arrastrando");
    $paleta.classList.remove("borrar");
    $linea.hidden = true; $linea.remove();
  }
  function cancelarArrastre() { const a = arrastre; arrastre = null; if (a) limpiarArrastre(a); }
  function soltarArrastre() {
    const a = arrastre; arrastre = null;
    limpiarArrastre(a);
    if (!a.activo) return;   // fue un toque: lo atiende el clic
    suprimirClicHasta = performance.now() + 80;
    if (a.borrar) return borrar(a.fuente.id);
    if (!a.destino) return pintar();
    const { padre, rama, idx } = a.destino;
    if (a.fuente.nuevo) insertarEn(nuevoLadrillo(a.fuente.nuevo), padre, rama, idx);
    else moverA(a.fuente.id, padre, rama, idx);
  }

  // ---------- Barra de edición en seudocódigo: actúa sobre el renglón elegido ----------
  function accion(id) {
    if (!activo()) return false;
    if (["deshacer", "rehacer", "teclado"].includes(id)) return false;
    if (quieto()) return "Detén el programa para editarlo.";
    if (id === "pegar") {
      if (!portaBloque) return "No hay ningún bloque copiado.";
      agregar(conIds([portaBloque])[0]);
      return true;
    }
    if (id === "linea") return true;
    if (!elegido || !buscar(modelo, elegido)) return "Toca primero un renglón.";
    const n = buscar(modelo, elegido).nodo;
    if (id === "copiar" || id === "cortar") { portaBloque = sinIds(n); if (id === "cortar") borrar(elegido); return id === "cortar" ? "Cortado" : "Copiado"; }
    if (id === "borrar") return borrar(elegido), true;
    if (id === "duplicar") return duplicar(elegido), true;
    if (id === "subir" || id === "bajar") return mover(elegido, id === "subir" ? -1 : 1), true;
    if (id === "ampliar") { const l = buscar(modelo, elegido); if (l.padre !== "raiz") { pilaAmpliar.push(elegido); elegido = l.padre; pintar(); } return true; }
    if (id === "reducir") { const prev = pilaAmpliar.pop(); if (prev && buscar(modelo, prev)) { elegido = prev; pintar(); } else if (n.cuerpo && n.cuerpo[0]) { elegido = n.cuerpo[0].id; pintar(); } return true; }
    return false;
  }

  // ---------- Modo ----------
  function aplicarModo(nuevo) {
    if (nuevo === "pseudo") {
      try {
        const r = arbolDe($codigo.value);
        modelo = r.arbol; conComentarios = r.comentarios; texto = $codigo.value;
        const g = generar(modelo); mapa = g.codigo === texto ? g.mapa : [];
        cursor = { padre: "raiz", rama: "cuerpo", idx: modelo.cuerpo.length }; elegido = null;
      } catch (e) {
        if (!(e instanceof NoTraducible)) throw e;
        cmg.aviso(`No puedo pasar este programa a seudocódigo: ${esc(e.message)} Se queda en JavaScript.`);
        nuevo = "js";
      }
    }
    modo = nuevo;
    escribir("modo", modo);
    app.dataset.modo = modo;
    cerrarHueco();
    $prog.hidden = modo !== "pseudo";
    $paleta.hidden = modo !== "pseudo";
    $editor.hidden = modo === "pseudo";
    $("paleta").hidden = modo === "pseudo";
    if (modo === "pseudo" && document.activeElement === $codigo) $codigo.blur();
    for (const b of document.querySelectorAll("[data-modo-codigo]")) b.setAttribute("aria-pressed", String(b.dataset.modoCodigo === modo));
    if (modo === "pseudo") { pintarPaleta(); pintar(); }
    else cmg.medirEditor();
    app.dispatchEvent(new Event("cmg:modo"));
  }
  function aplicarIdioma(i) {
    idioma = i; escribir("idioma-seudo", idioma);
    for (const b of document.querySelectorAll("[data-idioma-seudo]")) b.setAttribute("aria-pressed", String(b.dataset.idiomaSeudo === idioma));
    if (activo()) { pintarPaleta(); pintar(); }
  }
  document.addEventListener("click", (ev) => {
    const m = ev.target.closest("[data-modo-codigo]");
    if (m) return aplicarModo(m.dataset.modoCodigo);
    const i = ev.target.closest("[data-idioma-seudo]");
    if (i) aplicarIdioma(i.dataset.idiomaSeudo);
  });

  // Cambios que llegan por fuera (deshacer, otro programa, reto nuevo) vuelven a traducirse.
  $codigo.addEventListener("input", () => { if (activo() && !escribiendo) sincronizar(); });
  $codigo.addEventListener("cmg:documento", () => { if (activo()) { texto = null; sincronizar(); pintarPaleta(); } });
  $codigo.addEventListener("cmg:estado", () => { if (activo()) { cerrarHueco(); pintar(); } });
  $codigo.addEventListener("cmg:marcas", () => { if (activo()) pintarMarcas(); });

  cmg.seudo = { get activo() { return activo(); }, accion, aplicarModo, generar, parsear, get modelo() { return modelo; } };
  aplicarIdioma(idioma);
  aplicarModo(modo);
})();
