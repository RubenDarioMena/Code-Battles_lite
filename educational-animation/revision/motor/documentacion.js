/* Modo revisión · de qué tema es la documentación de un elemento del programa.
 *
 *   CMGDocumentacion.tema(P, nodo) → { clave, params, titulo }
 *
 * Al mantener pulsada una fila del diagrama (o una ficha de su etiqueta) se abre la documentación de lo
 * que es ese elemento: un if, un for…of, un argumento con valor por defecto, un método de lista… La clave
 * sale solo del árbol y del catálogo del juego, como el resto del modo revisión, y nombra el hueco que
 * llenará cada página (texto y animación). De momento cada página dice «TEMA: PLACEHOLDER».
 * Títulos en textos.js: revision.doc.tema.<clave>. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGExplicar, raiz.CMGI18n);
  else raiz.CMGDocumentacion = fabrica(raiz.CMGExplicar, raiz.CMGI18n);
})(typeof globalThis !== "undefined" ? globalThis : self, function (E, I18N) {
  "use strict";
  const t = (k, p) => I18N.t("revision." + k, p);
  const LISTA = new Set("push pop shift unshift map filter forEach reduce find findIndex some every includes indexOf lastIndexOf slice splice concat join sort reverse flat flatMap fill at keys values entries".split(" "));
  const TEXTO = new Set("toUpperCase toLowerCase trim split replace replaceAll startsWith endsWith padStart padEnd charAt repeat substring".split(" "));
  const COMPARA = new Set(["==", "===", "!=", "!==", "<", "<=", ">", ">="]);
  const DIRECTOS = {
    WhileStatement: "while", DoWhileStatement: "doWhile", ForStatement: "for", ForOfStatement: "forOf", ForInStatement: "forIn",
    BreakStatement: "break", ContinueStatement: "continue", ReturnStatement: "return", ThrowStatement: "throw",
    TryStatement: "try", CatchClause: "try", SwitchStatement: "switch", SwitchCase: "switch",
    FunctionDeclaration: "funcion", FunctionExpression: "funcion", ArrowFunctionExpression: "flecha",
    AssignmentPattern: "parametroDefecto", RestElement: "resto", SpreadElement: "resto",
    AwaitExpression: "await", AssignmentExpression: "asignacion", UpdateExpression: "incremento",
    ConditionalExpression: "ternario", ArrayExpression: "lista", ObjectExpression: "objeto", TemplateLiteral: "plantilla",
    NewExpression: "new", ClassDeclaration: "clase", ArrayPattern: "desestructurar", ObjectPattern: "desestructurar",
  };

  function tema(P, i) {
    const N = P.nodos, n = N[i];
    const r = (clave, params) => ({ clave, params: params || {}, titulo: t("doc.tema." + clave, params) });
    if (!n) return r("generico");
    if (n.tipo === "Program") return r("programa");
    if (n.tipo === "IfStatement") return r(n.campo === "alternate" ? "elseIf" : "if");
    if (n.tipo === "VariableDeclaration") return r(n.clase === "const" ? "const" : n.clase === "var" ? "var" : "let");
    if (n.tipo === "VariableDeclarator") return tema(P, n.padre);
    if (n.tipo === "ExpressionStatement") return tema(P, P.hijo(i, "expression"));
    if (n.tipo === "BlockStatement") return n.padre != null ? tema(P, n.padre) : r("bloque");
    // console.log también está en el catálogo, pero su página es la de la consola de JavaScript.
    if (n.tipo === "CallExpression" && N[P.hijo(i, "callee")].tipo === "MemberExpression") {
      const o = N[P.hijo(P.hijo(i, "callee"), "object")];
      if (o.tipo === "Identifier" && o.nombre === "console") return r("consola", { m: N[P.hijo(P.hijo(i, "callee"), "property")].nombre });
    }
    // Lo que es del juego (órdenes, lecturas, máquinas) va antes que lo genérico de JavaScript.
    const juego = E.resolver(P, i);
    if (juego && juego.clase === "metodo") return r("juegoMetodo", { m: juego.nombre });
    if (juego && juego.clase === "propiedad") return r("juegoPropiedad", { m: juego.nombre });
    if (juego && juego.clase === "objeto") return r("juegoObjeto", { m: n.nombre });
    if (n.tipo === "CallExpression") {
      const f = P.hijo(i, "callee"), nf = N[f];
      if (nf.tipo === "Identifier") return P.funciones.has(nf.nombre) ? r("llamada") : r("funcionJs", { m: nf.nombre });
      if (nf.tipo === "MemberExpression" && !nf.computado) {
        const m = N[P.hijo(f, "property")].nombre, o = N[P.hijo(f, "object")];
        if (o.tipo === "Identifier" && o.nombre === "console") return r("consola", { m });
        if (o.tipo === "Identifier" && o.nombre === "Math") return r("math", { m });
        if (LISTA.has(m)) return r("metodoLista", { m });
        if (TEXTO.has(m)) return r("metodoTexto", { m });
        return r("metodo", { m });
      }
      return r("llamada");
    }
    if (n.tipo === "MemberExpression") {
      if (n.campo === "callee" && N[n.padre].tipo === "CallExpression") return tema(P, n.padre);
      return r(n.computado ? "indice" : "propiedad");
    }
    if (n.tipo === "Identifier") {
      const pa = n.padre != null ? N[n.padre] : null;
      if (pa && ((pa.tipo === "MemberExpression" && n.campo === "property") || (pa.tipo === "CallExpression" && n.campo === "callee"))) return tema(P, n.padre);
      if (pa && /Function/.test(pa.tipo) && n.campo === "params") return r("parametro");
      if (P.funciones.has(n.nombre)) return r("funcion");
      return r("variable");
    }
    if (n.tipo === "Literal") return r(typeof n.valor === "number" ? "numero" : typeof n.valor === "string" ? "texto" : typeof n.valor === "boolean" ? "booleano" : n.valor === null ? "null" : "generico");
    if (n.tipo === "BinaryExpression") return r(COMPARA.has(n.op) ? "comparacion" : n.op === "%" ? "modulo" : "aritmetica", { op: n.op });
    if (n.tipo === "LogicalExpression") return r(n.op === "??" ? "nulo" : "logico", { op: n.op });
    if (n.tipo === "UnaryExpression") return r(n.op === "!" ? "negacion" : n.op === "typeof" ? "typeof" : "aritmetica", { op: n.op });
    if (DIRECTOS[n.tipo]) return r(DIRECTOS[n.tipo]);
    return r("generico", { tipo: n.tipo });
  }

  return { tema };
});
