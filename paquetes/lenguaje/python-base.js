  const RESERVADAS_JS = new Set(("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval undefined NaN Infinity globalThis self console __L __py Object Array String Number Boolean Math JSON Promise Error Symbol Proxy Reflect Function postMessage onmessage close location navigator setTimeout").split(" "));
  const BUILTINS = new Set(["print", "len", "range", "str", "int", "float", "bool", "abs", "min", "max", "round", "sum", "enumerate", "list", "sorted", "reversed", "any", "all", "repr"]);
  // D3: print → registro; warn/info/error, a sus niveles de la consola del juego.
  const CONSOLA = { print: "log", info: "info", warn: "warn", error: "error" };
  const DUNDER = /^__(name|main|init|file|doc|class|dict|module)__$/;
  const PUNTUACION = new Set(["(", ")", "[", "]", "{", "}", ",", ":", ".", ";", "Comment"]);
  const NO_SOPORTADO = {
    DictionaryExpression: "Los diccionarios", DictionaryComprehensionExpression: "Los diccionarios", SetExpression: "Los conjuntos",
    SetComprehensionExpression: "Los conjuntos", ComprehensionExpression: "Los generadores", YieldExpression: "yield", NamedExpression: "El operador :=",
    Ellipsis: "«...»", ClassDefinition: "Las clases", ImportStatement: "import", ImportFromStatement: "import", TryStatement: "try",
    WithStatement: "with", RaiseStatement: "raise", AssertStatement: "assert", DecoratedStatement: "Los decoradores", MatchStatement: "match",
    PrintStatement: "print sin paréntesis", TypeDef: "Las anotaciones de tipo", ConditionalStatement: null,
  };
  const ARITMETICA = new Set(["+", "-", "*", "/", "//", "%", "**", "&", "|", "^", "<<", ">>", "@"]);
  const COMPARA = new Set(["<", ">", "<=", ">=", "==", "!=", "in", "not in", "is", "is not"]);
  // Precedencia de Python (de menos a más): if-else 1, or 2, and 3, not 4, comparaciones 5, | 6, ^ 7, & 8,
  // << >> 9, + - 10, * / // % @ 11, unarios 12, ** 13, await 14.
  const LBP = { if: 1, or: 2, and: 3, "|": 6, "^": 7, "&": 8, "<<": 9, ">>": 9, "+": 10, "-": 10, "*": 11, "/": 11, "//": 11, "%": 11, "@": 11, "**": 13 };
  for (const c of COMPARA) LBP[c] = 5;

  class Diagnostico { constructor(pos, mensaje) { this.pos = pos; this.mensaje = mensaje; } }
  const falla = (pos, mensaje) => { throw new Diagnostico(pos, mensaje); };

  function plano(arbol) {
    const c = arbol.cursor();
    const rec = () => {
      const n = { t: c.name, a: c.from, b: c.to, e: c.type.isError, h: [] };
      if (c.firstChild()) { do n.h.push(rec()); while (c.nextSibling()); c.parent(); }
      return n;
    };
    return rec();
  }
  const util = n => n.h.filter(h => !PUNTUACION.has(h.t));

  class Ambito {
    constructor(tipo, padre, esAsync) {
      /** @type {Set<string> | undefined} */ this.params = undefined;
      this.tipo = tipo; this.padre = padre; this.esAsync = esAsync;
      this.locales = new Set(); this.globales = new Set(); this.nolocales = new Set();
      this.funciones = new Map(); this.otros = new Set(); this.temps = 0; this.marca = null;
    }
    get modulo() { let a = this; while (a.padre) a = a.padre; return a; }
    get funcion() { let a = this; while (a.tipo === "comprension") a = a.padre; return a; }
  }


export { RESERVADAS_JS, BUILTINS, CONSOLA, DUNDER, PUNTUACION, NO_SOPORTADO, ARITMETICA, COMPARA, LBP, Diagnostico, falla, plano, util, Ambito };
