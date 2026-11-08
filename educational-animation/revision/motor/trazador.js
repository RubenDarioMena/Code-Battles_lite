/* Trazador del modo revisión · instrumenta un programa JavaScript por su árbol (acorn) sin mover líneas.
 *
 * instrumentar(fuente, opciones) → { codigo, nodos }
 *   codigo  el mismo programa con ganchos __T en línea: misma cantidad de líneas, así la línea en ejecución
 *           y los errores del juego siguen coincidiendo (el juego añade después sus __L(linea)).
 *   nodos   tabla de todos los nodos del árbol: { id, tipo, a, b, linea, lineaFin, padre, campo, hijos, prof,
 *           ganchos, nombre?, op?, valor?, clase?, generador?, delega? }. a y b son posiciones en la fuente original.
 *   comentarios  [{ a, b, linea, texto, bloque }]: las notas del autor, para explicar la intención.
 *
 * Ganchos (cada uno deja un evento en la traza, en orden de ejecución):
 *   s(id)      empieza una sentencia                         → [id]
 *   c(id, x)   se evaluó una condición (if, while, for, ?:)    → [id, valor]
 *              o empieza una vuelta de for…of / for…in: id es el bucle y valor, el elemento de esa vuelta
 *   v(id, x)   se evaluó una expresión (lecturas, llamadas…)   → [id, valor]
 *   w(id, x)   el programa va a esperar (await): envía el lote → [id]
 *   Cuando cambia el reloj (opciones.reloj) se añade ["t", tiempo, estado].
 *
 * No sabe nada del juego: el reloj, el estado y el envío llegan como texto de expresión en `opciones`.
 * opciones.filtro(gancho, nodo, padre, campo) → false deja sin poner un gancho s, c o v (nodos de acorn).
 * El juego lo usa para los pulsos del editor: solo las órdenes, lecturas y condiciones que le interesan,
 * con menos coste y sin envolver nada más. w siempre se pone: es el que envía el lote.
 * Funciona en el navegador (window.CMGTrazador), en un Worker y en Node (require). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CMGTrazador = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";
  const OPCIONES_ACORN = { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, locations: true };
  const SENTENCIA = /(Statement|Declaration)$/;
  const CUERPOS = new Set(["body", "consequent"]); // listas de sentencias: Program.body, BlockStatement.body, SwitchCase.consequent
  const SIN_VALOR = new Set(["Literal", "TemplateLiteral", "ArrayExpression", "ObjectExpression", "FunctionExpression",
    "ArrowFunctionExpression", "ClassExpression", "ThisExpression", "Super", "SequenceExpression", "AssignmentExpression",
    "SpreadElement", "YieldExpression", "TaggedTemplateExpression", "MetaProperty", "ImportExpression", "ParenthesizedExpression"]);
  const EXPRESION = /(Expression|Identifier|Literal)$/;

  function leerAcorn(opciones) {
    const a = opciones.acorn || (typeof acorn !== "undefined" ? acorn : null) || (typeof self !== "undefined" && self.acorn) || null;
    if (!a) throw new Error("Falta acorn para analizar el programa.");
    return a;
  }

  // Tabla de nodos: todos, en orden de fuente, con padre, campo y profundidad.
  function tabla(ast) {
    const nodos = [], info = new Map();
    (function visitar(n, padre, campo, prof) {
      const x = { id: nodos.length, tipo: n.type, a: n.start, b: n.end, linea: n.loc.start.line, lineaFin: n.loc.end.line,
        padre: padre ? info.get(padre).id : null, campo, hijos: [], prof, ganchos: "" };
      if (n.type === "Identifier") x.nombre = n.name;
      if (n.type === "PrivateIdentifier") x.nombre = "#" + n.name;
      if (n.operator) x.op = n.operator;
      if (n.type === "Literal") x.valor = n.regex ? String(n.value) : n.value;
      if (n.type === "VariableDeclaration") x.clase = n.kind;
      if (n.generator) x.generador = true; // function*: llamarla crea un generador sin ejecutar su cuerpo
      if (n.type === "YieldExpression" && n.delegate) x.delega = true; // yield*: entrega uno a uno los de otro
      if (n.type === "MemberExpression") { x.computado = !!n.computed; if (n.optional) x.opcional = true; }
      if (n.type === "CallExpression" && n.optional) x.opcional = true;
      nodos.push(x); info.set(n, x);
      if (padre) info.get(padre).hijos.push(x.id);
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "type" || k === "start" || k === "end") continue;
        const v = n[k];
        if (Array.isArray(v)) { for (const h of v) if (h && typeof h.type === "string") visitar(h, n, k, prof + 1); }
        else if (v && typeof v.type === "string") visitar(v, n, k, prof + 1);
      }
    })(ast, null, null, 0);
    return { nodos, info };
  }

  // ¿Esta expresión está en una posición de valor que se puede envolver sin cambiar el programa?
  function envolvible(n, padre, campo) {
    if (!EXPRESION.test(n.type) || SIN_VALOR.has(n.type)) return false;
    if (n.type === "Identifier" && n.name === "undefined") return false;
    if (!padre) return false;
    const p = padre.type;
    if ((p === "CallExpression" || p === "NewExpression") && campo === "callee") return false;     // conserva this
    if (p === "MemberExpression" && campo === "property" && !padre.computed) return false;
    if (p === "MemberExpression" && campo === "object" && n.type === "Identifier") return false; // LAU_02.jammed se lee entero
    if (p === "TaggedTemplateExpression" && campo === "tag") return false;
    if (p === "AssignmentExpression" && campo === "left") return false;
    if (p === "UpdateExpression") return false;
    if ((p === "ForInStatement" || p === "ForOfStatement") && campo === "left") return false;
    if (p === "VariableDeclarator" && campo === "id") return false;
    if (/^(Function|Class)/.test(p) && campo === "id") return false;                              // function esPar(n)
    if (p === "CatchClause" && campo === "param") return false;
    if (/Pattern$/.test(p) || p === "RestElement") return false;
    if (/Function/.test(p) && campo === "params") return false;
    if ((p === "Property" || p === "MethodDefinition" || p === "PropertyDefinition") && campo === "key" && !padre.computed) return false;
    if (p === "LabeledStatement" || p === "BreakStatement" || p === "ContinueStatement") return false;
    if (p === "UnaryExpression" && (padre.operator === "typeof" || padre.operator === "delete")) return false;
    if (p === "AwaitExpression") return false;                                                     // lo cubre el gancho w
    if (p === "ChainExpression") return false;
    if (/^(Import|Export)/.test(p)) return false;
    return true;
  }

  function instrumentar(fuente, opciones = {}) {
    const acornLib = leerAcorn(opciones);
    const src = String(fuente).replace(/\r\n?/g, "\n");
    const comentarios = [];
    const ast = acornLib.parse(src, { ...OPCIONES_ACORN, onComment: (bloque, texto, a, b, ini) => comentarios.push({ a, b, linea: ini.line, texto: texto.trim(), bloque }) });
    const { nodos, info } = tabla(ast);
    const ins = [];   // { pos, texto, cierre, prof }
    const abrir = (pos, texto, prof) => ins.push({ pos, texto, cierre: false, prof });
    const cerrar = (pos, texto, prof) => ins.push({ pos, texto, cierre: true, prof });
    const marcar = (x, g) => { if (!x.ganchos.includes(g)) x.ganchos += g; };
    const dentroDeCadena = new Set(); // nodos dentro de a?.b: no se tocan (se envuelve la cadena entera)
    const quiere = typeof opciones.filtro === "function" ? (g, n, padre, campo) => opciones.filtro(g, n, padre, campo) !== false : () => true;

    (function visitar(n, padre, campo) {
      const x = info.get(n);
      if (n.type === "ChainExpression") (function marcarCadena(h) { for (const k of Object.keys(h)) { const v = h[k]; if (Array.isArray(v)) v.forEach(z => z && z.type && (dentroDeCadena.add(z), marcarCadena(z))); else if (v && v.type) { dentroDeCadena.add(v); marcarCadena(v); } } })(n);
      const enCadena = dentroDeCadena.has(n);
      // Sentencias en una lista: __T.s(id); delante. Sentencias sueltas (if sin llaves…): { __T.s(id); … }.
      if (SENTENCIA.test(n.type) && padre && n.type !== "FunctionDeclaration" && n.type !== "ClassDeclaration") {
        const enLista = CUERPOS.has(campo) && Array.isArray(padre[campo]);
        if (!quiere("s", n, padre, campo)) { /* sin gancho de sentencia */ }
        else if (enLista) { abrir(n.start, `;__T.s(${x.id});`, x.prof); marcar(x, "s"); }
        else if (n.type === "IfStatement" && campo === "alternate") { /* else if: basta su condición */ }
        else if (n.type !== "BlockStatement" && campo !== "init" && campo !== "left" && padre.type !== "LabeledStatement") {
          // El cuerpo de una etiqueta no se envuelve: «continue etiqueta» debe seguir apuntando al bucle.
          abrir(n.start, `{__T.s(${x.id});`, x.prof); cerrar(n.end, "}", x.prof); marcar(x, "s");
        }
      }
      // Cada vuelta de for…of / for…in: __T.c(idBucle, elemento) al abrir su bloque (no tienen condición).
      if ((n.type === "ForOfStatement" || n.type === "ForInStatement") && n.body.type === "BlockStatement" && quiere("c", n, padre, campo)) {
        const l = n.left, d = l.type === "VariableDeclaration" ? l.declarations[0].id : l;
        abrir(n.body.start + 1, `__T.c(${x.id},${d.type === "Identifier" ? d.name : "true"});`, x.prof); marcar(x, "c");
      }
      // lista.forEach(x => { … }) se lee como un for…of: __T.c(idSentencia, x) al abrir la función.
      if (n.type === "ExpressionStatement" && n.expression.type === "CallExpression" && quiere("c", n, padre, campo)) {
        const c = n.expression, m = c.callee, fn = c.arguments[0];
        if (m.type === "MemberExpression" && !m.computed && m.property.name === "forEach" && c.arguments.length === 1 &&
            (fn.type === "ArrowFunctionExpression" || (fn.type === "FunctionExpression" && !fn.id)) && fn.body.type === "BlockStatement" && fn.params.length) {
          const d = fn.params[0];
          abrir(fn.body.start + 1, `__T.c(${x.id},${d.type === "Identifier" ? d.name : "true"});`, x.prof); marcar(x, "c");
        }
      }
      // Condiciones.
      if (campo === "test" && padre && /^(If|While|DoWhile|For)Statement$|^ConditionalExpression$/.test(padre.type) && !enCadena) {
        if (quiere("c", n, padre, campo)) { abrir(n.start, `__T.c(${x.id},`, x.prof); cerrar(n.end, ")", x.prof); marcar(x, "c"); }
      } else if (n.type === "AwaitExpression") {
        // __T.v(id, await __T.w(idArg, arg)): w envía el lote antes de esperar; v guarda lo que devolvió.
        const arg = n.argument, xa = info.get(arg);
        abrir(arg.start, `__T.w(${xa.id},`, xa.prof); cerrar(arg.end, ")", xa.prof); marcar(xa, "w");
        if (padre && envolvible(n, padre, campo) && !enCadena && quiere("v", n, padre, campo)) { abrir(n.start, `__T.v(${x.id},`, x.prof); cerrar(n.end, ")", x.prof); marcar(x, "v"); }
      } else if (padre && !enCadena && envolvible(n, padre, campo) && quiere("v", n, padre, campo)) {
        abrir(n.start, `__T.v(${x.id},`, x.prof); cerrar(n.end, ")", x.prof); marcar(x, "v");
      }
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "type" || k === "start" || k === "end") continue;
        const v = n[k];
        if (Array.isArray(v)) { for (const h of v) if (h && typeof h.type === "string") visitar(h, n, k); }
        else if (v && typeof v.type === "string") visitar(v, n, k);
      }
    })(ast, null, null);

    // Mismo punto: primero los cierres (de dentro hacia fuera), luego las aperturas (de fuera hacia dentro).
    ins.sort((p, q) => p.pos - q.pos || (p.cierre === q.cierre ? (p.cierre ? q.prof - p.prof : p.prof - q.prof) : (p.cierre ? -1 : 1)));
    let out = "", ultimo = 0;
    for (const i of ins) { out += src.slice(ultimo, i.pos) + i.texto; ultimo = i.pos; }
    out += src.slice(ultimo);
    const codigo = prefijo(opciones) + out;
    if (codigo.split("\n").length !== src.split("\n").length) throw new Error("El trazador movió líneas.");
    return { codigo, nodos, comentarios, fuente: src };
  }

  // Definición de __T en una sola línea, delante de la línea 1 del programa.
  function prefijo({ reloj = "null", estado = "null", enviar = "(ev)=>postMessage({type:\"traza\",ev})", lote = 400 } = {}) {
    return "const __T=(()=>{const B=[];let T0;" +
      `const R=()=>{try{return ${reloj}}catch(e){return null}};` +
      `const E=()=>{try{return ${estado}}catch(e){return null}};` +
      `const S=${enviar};` +
      "const V=(x)=>{if(x===undefined)return{$:\"u\"};const t=typeof x;if(t===\"function\")return{$:\"f\"};" +
      "if(t===\"number\"&&!isFinite(x))return{$:\"n\",v:String(x)};if(t===\"bigint\")return{$:\"n\",v:String(x)};" +
      "if(x&&t===\"object\"){try{if(typeof x.then===\"function\")return{$:\"p\"};const j=JSON.stringify(x);" +
      "return j.length>400?{$:\"o\",r:j.slice(0,400)}:JSON.parse(j)}catch(e){return{$:\"o\"}}}return x};" +
      "const M=()=>{const t=R();if(t!==T0){T0=t;B.push([\"t\",t,E()])}};" +
      `const F=()=>{if(B.length)S(B.splice(0))};` +
      `return{s(i){M();B.push([i]);if(B.length>${lote})F()},` +
      `c(i,x){M();B.push([i,V(x)]);if(B.length>${lote})F();return x},v(i,x){M();B.push([i,V(x)]);if(B.length>${lote})F();return x},` +
      "w(i,x){M();B.push([i]);F();return x},fin(){F()}}})();";
  }

  // Valor de la traza → texto corto para personas (null, true, «D7 en (14,2; 3,5)»…).
  function valorTexto(v) {
    if (v && typeof v === "object" && "$" in v) return { u: "undefined", f: "función", p: "promesa", n: v.v, o: "objeto" }[v.$] || "?";
    if (typeof v === "string") return JSON.stringify(v);
    if (v && typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  return { instrumentar, prefijo, valorTexto, OPCIONES_ACORN };
});
