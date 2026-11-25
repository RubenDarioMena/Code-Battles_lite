import { dependencias } from './dependencias.js';


// seudo: modelo. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  ctx.bloques = () => ctx.cmg.datos?.().bloques ?? [];
  ctx.eventos = () => ctx.cmg.datos?.().eventos ?? [];
  ctx.conIds = function(lista) {
    return lista.map(n => {
      const c = { ...n, id: `s${ctx.sigId++}` };
      if (c.cond) c.cond = { ...c.cond };
      if (c.cuerpo) c.cuerpo = ctx.conIds(c.cuerpo);
      if (c.t === "si") c.sino = ctx.conIds(c.sino || []);
      return c;
    });
  };
  ctx.recorrer = function(lista, fn, padre = "raiz", rama = "cuerpo") {
    lista.forEach((n, i) => {
      fn(n, padre, rama, i, lista);
      if (n.cuerpo) ctx.recorrer(n.cuerpo, fn, n.id, "cuerpo");
      if (n.sino) ctx.recorrer(n.sino, fn, n.id, "sino");
    });
  };
  ctx.buscar = function(prog, id) {
    if (id === "raiz") return { nodo: prog };
    let res = null;
    ctx.recorrer(prog.cuerpo, (n, padre, rama, idx, lista) => { if (n.id === id) res = { nodo: n, padre, rama, idx, lista }; });
    return res;
  };

  // Árbol → JavaScript, con el nodo de cada línea para iluminar la que se ejecuta.
  ctx.generar = function(prog) {
    const lineas = [], mapa = [];
    const emit = (txt, id, nivel) => { lineas.push("  ".repeat(nivel) + txt); mapa.push(id); };
    const q = (s) => JSON.stringify(s), vars = ["i", "j", "k", "m", "n"];
    const at = (tipo, sensor) => `autoTarget(${q(tipo)}, ${q(sensor)})`;
    const cond = (c) => c.op === "existe" ? c.que : c.op === "noexiste" ? `!${c.que}` : `${c.que} ${ctx.OP_JS[c.op]} ${typeof c.n === "string" ? q(c.n) : c.n}`;
    (function bloque(lista, nivel, prof) {
      // Una variable que se asigna varias veces en la misma lista se declara con let y luego se reasigna.
      const veces = {}, vistas = new Set();
      for (const n of lista) if (n.var) veces[n.var] = (veces[n.var] || 0) + 1;
      const decl = (v) => { if (veces[v] === 1) return `const ${v}`; if (vistas.has(v)) return v; vistas.add(v); return `let ${v}`; };
      for (const n of lista) {
        const declarar = () => Object.hasOwn(n, "declaracion") ? (n.declaracion ? `${n.declaracion} ${n.var}` : n.var) : decl(n.var);
        if (n.t === "apuntar") emit(`${declarar()} = ${at(n.tipo, n.sensor)}${n.alt ? ` ?? ${at(n.alt, n.sensor)}` : ""};`, n.id, nivel);
        else if (n.t === "oir") emit(`${declarar()} = ${n.red}.detect(${q(n.tipo)});`, n.id, nivel);
        else if (n.t === "disparo") emit(`regularShoot(${n.lugar});`, n.id, nivel);
        else if (n.t === "rafaga") emit(`burstFire(${n.lugar});`, n.id, nivel);
        else if (n.t === "verbo") emit(`${n.espera ? "await " : ""}${n.nombre}(${n.lugar ?? ""});`, n.id, nivel);
        else if (n.t === "detener") emit("stopFire();", n.id, nivel);
        else if (n.t === "esperar") emit(`${n.espera === false ? "" : "await "}${n.fn || (ctx.factory ? "wait" : "esperar")}(${n.s});`, n.id, nivel);
        else if (n.t === "recoger" || n.t === "entregar") emit(`${n.espera === false ? "" : "await "}${n.fn || (n.t === "recoger" ? "pickUp" : "deliver")}(${n.lugar}${n.t === "recoger" ? ", " + q(n.mat) : ""});`, n.id, nivel);
        else if (n.t === "contar") emit(`${declarar()} = ${n.espera ? "await " : ""}${n.fn || "count"}(${n.lugar}, ${q(n.mat)});`, n.id, nivel);
        else if (n.t === "aviso") emit(`console.${n.nivel}(${n.valor});`, n.id, nivel);
        else if (n.t === "salir") emit("break;", n.id, nivel);
        else if (n.t === "cuando") {
          emit(`${n.evento}(async (${n.parametro}) => {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          emit("});", n.id, nivel);
        }
        else if (n.t === "siempre" || n.t === "mientras") {
          emit(`while (${n.t === "siempre" ? "true" : cond(n.cond)}) {`, n.id, nivel);
          bloque(n.cuerpo, nivel + 1, prof);
          emit("}", n.id, nivel);
        } else if (n.t === "repetir") {
          const v = n.indice || vars[prof] || `i${prof}`;
          emit(`for (${n.declaracion || "let"} ${v} = 0; ${v} < ${n.n}; ${v}++) {`, n.id, nivel);
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
  };
  ctx.parsear = function(src) {
    if (typeof dependencias.acorn === "undefined") throw new ctx.NoTraducible("no se pudo cargar el traductor (sin conexión).");
    let ast;
    try { ast = dependencias.acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, locations: true }); }
    catch (e) { throw new ctx.NoTraducible(`el texto tiene un error de sintaxis (${e.message}).`); }
    const no = (n, que) => { throw new ctx.NoTraducible(`línea ${n.loc.start.line}: ${que} todavía no tiene seudocódigo.`); };
    const texto = (n) => src.slice(n.start, n.end);
    const str = (a) => a && a.type === "Literal" && typeof a.value === "string";
    const num = (a) => a && a.type === "Literal" && typeof a.value === "number";
    const nombre = (e) => e && (e.type === "Identifier" || (e.type === "MemberExpression" && !e.computed && nombre(e.object) && e.property.type === "Identifier"));
    const llamada = (e, fn) => e && e.type === "CallExpression" && e.callee.type === "Identifier" && e.callee.name === fn;
    const apunta = (e) => llamada(e, "autoTarget") && e.arguments.length === 2 && str(e.arguments[0]) && str(e.arguments[1]) ? { tipo: e.arguments[0].value, sensor: e.arguments[1].value } : null;
    const robotCall = e => {
      if (!ctx.factory || !e) return null;
      const espera = e.type === "AwaitExpression"; const c = espera ? e.argument : e;
      if (c.type !== "CallExpression") return null;
      const f = c.callee.type === "Identifier" ? c.callee.name : c.callee.type === "MemberExpression" && !c.callee.computed && c.callee.object.name === "yo" ? c.callee.property.name : null;
      const t = {pickUp:"recoger",recoger:"recoger",deliver:"entregar",entregar:"entregar",wait:"esperar",esperar:"esperar",count:"contar",cuantos:"contar"}[f];
      if (!t) return null;
      const [a,b] = c.arguments;
      if (t === "esperar") return c.arguments.length === 1 && num(a) ? { t, s:a.value, fn:texto(c.callee), espera } : null;
      if (!(str(a) || nombre(a)) || c.arguments.length !== (t === "entregar" ? 1 : 2) || (t !== "entregar" && !str(b))) return null;
      return {t, lugar:texto(a), mat:b?.value, fn:texto(c.callee), espera};
    };
    const lectura = e => robotCall(e)?.t === "contar";
    // Lo que se guarda en una variable: apuntar (con alternativa ??) o escuchar a la red de sensores.
    function valorVariable(v, init, s) {
      const robot = robotCall(init);
      if (robot?.t === "contar") return { ...robot, var:v };
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
    const OPS_AST = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "===": "==", "!==": "!=" };
    function cond(e) {
      if (nombre(e)) return { que: texto(e), op: "existe", n: 0 };
      if (e.type === "UnaryExpression" && e.operator === "!" && nombre(e.argument)) return { que: texto(e.argument), op: "noexiste", n: 0 };
      if (e.type === "BinaryExpression" && OPS_AST[e.operator] && (nombre(e.left) || lectura(e.left)) && (num(e.right) || str(e.right))) return { que: texto(e.left), op: OPS_AST[e.operator], n: e.right.value };
      if (e.type === "LogicalExpression") no(e, `«${e.operator}» en una condición`);
      no(e, "esta condición");
    }
    const cuerpo = (s) => s.type === "BlockStatement" ? lista(s.body) : lista([s]);
    function lista(stmts) {
      const out = [];
      for (const s of stmts) {
        if (s.type === "EmptyStatement") continue;
        if (s.type === "BlockStatement") no(s, "un ámbito de bloque independiente");
        if (s.type === "VariableDeclaration") {
          if (s.declarations.length !== 1 || s.declarations[0].id.type !== "Identifier" || !s.declarations[0].init) no(s, "esta declaración");
          out.push({ ...valorVariable(s.declarations[0].id.name, s.declarations[0].init, s), declaracion: s.kind });
          continue;
        }
        if (s.type === "ExpressionStatement") {
          const e = s.expression;
          const llamadaPropia = e.type === "AwaitExpression" ? e.argument : e;
          const ficha = llamadaPropia.type === "CallExpression" && ctx.bloques().find(f => f.nombre === llamadaPropia.callee.name);
          if (ficha && !!ficha.await === (e !== llamadaPropia) && llamadaPropia.arguments.length === ficha.firma.length) {
            out.push({ t: "verbo", nombre: ficha.nombre, lugar: ficha.firma.length ? texto(llamadaPropia.arguments[0]) : null, espera: !!ficha.await });
            continue;
          }
          const robot = robotCall(e);
          if (robot && robot.t !== "contar") { out.push(robot); continue; }
          if (e.type === "AssignmentExpression" && e.operator === "=" && e.left.type === "Identifier") { out.push({ ...valorVariable(e.left.name, e.right, s), declaracion: null }); continue; }
          const arg = e.arguments && e.arguments[0];
          if (e.type === "CallExpression" && e.arguments.length === 1 && ctx.eventos().some(f => f.evento === texto(e.callee))
              && arg.type === "ArrowFunctionExpression" && arg.params.length === 1 && arg.params[0].type === "Identifier"
              && arg.body.type === "BlockStatement") {
            out.push({ t: "cuando", evento: texto(e.callee), parametro: arg.params[0].name, cuerpo: cuerpo(arg.body) });
            continue;
          }
          const lugar = (a) => a && (nombre(a) || (a.type === "Literal" && a.value === null));
          if ((llamada(e, "regularShoot") || llamada(e, "burstFire")) && e.arguments.length === 1 && lugar(arg)) { out.push({ t: e.callee.name === "regularShoot" ? "disparo" : "rafaga", lugar: texto(arg) }); continue; }
          if (llamada(e, "stopFire") && !e.arguments.length) { out.push({ t: "detener" }); continue; }
          if (e.type === "AwaitExpression" && llamada(e.argument, "esperar") && e.argument.arguments.length === 1 && num(e.argument.arguments[0])) { out.push({ t: "esperar", s: e.argument.arguments[0].value }); continue; }
          if (e.type === "CallExpression" && e.callee.type === "MemberExpression" && !e.callee.computed && e.callee.object.name === "console" && ["log", "info", "warn", "error"].includes(e.callee.property.name)
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
          out.push({ t: "repetir", indice: v, declaracion: s.init.kind, n: s.test.right.value, cuerpo: cuerpo(s.body) });
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
    return ctx.raizDe(lista(ast.body));
  };
  return function iniciar() {

  (ctx.factory = ctx.cmg.serie === "factory");
  (ctx.app = ctx.$("app")), (ctx.$codigo = ctx.cmg.codigo), (ctx.$prog = ctx.$("prog")), (ctx.$paleta = ctx.$("paleta-seudo")), (ctx.$editor = ctx.$("editor"));
  ({ leer: ctx.leer, escribir: ctx.escribir } = ctx.preferencias);
  (ctx.esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])));

  // ---------- Textos (kw = orden, kc = control, tx = texto, slot = valor que se elige) ----------
  (ctx.TXT = {
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
  });
  if (ctx.factory) for (const [idioma, tx] of Object.entries(ctx.TXT)) {
    tx.recoger = [["kw", "pickUp"], ["slot", "lugar"], ["slot", "mat"]];
    tx.entregar = [["kw", "deliver"], ["slot", "lugar"]];
    tx.contar = [["slot", "var"], ["tx", "←"], ["kw", "count"], ["slot", "lugar"], ["slot", "mat"]];
    tx.esperar[0][1] = "wait";
    Object.assign(tx.paleta, { recoger: "pickUp", entregar: "deliver", contar: "count", esperar: "wait" });
  }
  (ctx.COND = [["slot", "cond.que"], ["slot", "cond.op"], ["slot", "cond.n"]]);
  (ctx.CATEGORIA = { verbo: "accion", cuando: "control", recoger: "accion", entregar: "accion", contar: "sentido", apuntar: "sentido", oir: "sentido", disparo: "accion", rafaga: "accion", detener: "accion", aviso: "accion", esperar: "espera", siempre: "control", repetir: "control", mientras: "control", si: "control", salir: "control" });
  (ctx.ICONO = { recoger: "recoger", entregar: "entregar", contar: "sensor", apuntar: "apuntar", oir: "sensor", disparo: "disparo", rafaga: "rafaga", detener: "detener", esperar: "esperar", aviso: "aviso", siempre: "whileTrue", repetir: "para", mientras: "mientras", si: "siNo", salir: "salir" });
  (ctx.LADRILLOS = ["apuntar", "oir", "disparo", "rafaga", "detener", "esperar", "|", "siempre", "repetir", "mientras", "si", "salir", "|", "aviso"]);
  (ctx.OPS = ["existe", "noexiste", ">", ">=", "<", "<=", "==", "!="]);
  (ctx.OP_JS = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "==": "===", "!=": "!==" });
  (ctx.OP_VER = { ">": ">", ">=": "≥", "<": "<", "<=": "≤", "==": "=", "!=": "≠" });
  (ctx.esContenedor = (n) => !!n.cuerpo);

  // ---------- Modelo ----------
  (ctx.sigId = 1);
  (ctx.raizDe = (lista) => ({ t: "programa", id: "raiz", cuerpo: ctx.conIds(lista) }));
  (ctx.listaDe = (prog, padre, rama) => ctx.buscar(prog, padre).nodo[rama]);
  (ctx.sinIds = (n) => JSON.parse(JSON.stringify(n, (k, v) => k === "id" ? undefined : v)));

  // JavaScript → árbol, solo para lo que el seudocódigo sabe decir.
  ctx.NoTraducible = class extends Error {};
  };
}
