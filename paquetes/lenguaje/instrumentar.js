import { lexico, NOMBRES_HUECO } from './javascript.js';
import { vocabulario } from './vocabulario.js';
  function vecino(toks, i, dir) {
    for (let j = i + dir; j >= 0 && j < toks.length; j += dir) { const k = toks[j][0]; if (k !== "esp" && k !== "com") return toks[j]; }
    return null;
  }

  // Cada llamada de la API lleva su número de línea, para iluminarla y para los mensajes de error.
  /** @param {string} src @param {{ serie?: string, objetos?: string[], funciones?: Set<string>, acorn?: any }} [opciones] */
  function instrumentar(src, { serie = "war", objetos = [], funciones, acorn } = {}) {
    const ES_FACTORY = serie === "factory", ES_CAMPAIGN = serie === "campaign";
    const { FN_PROPIAS } = vocabulario(serie);
    const esObjeto = nombre => nombre === "console" || nombre === "yo" || objetos.includes(nombre);
    const locales = new Set();
    if ((ES_FACTORY || ES_CAMPAIGN) && acorn) {
      try {
        const ast = acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
        const binding = n => { if (!n) return; if (n.type === "Identifier") locales.add(n.name); else if (n.type === "RestElement") binding(n.argument); else if (n.type === "AssignmentPattern") binding(n.left); else if (n.type === "ArrayPattern") n.elements.forEach(binding); else if (n.type === "ObjectPattern") n.properties.forEach(p => binding(p.value || p.argument)); };
        const walk = n => { if (!n || typeof n !== "object") return; if (n.type === "VariableDeclarator") binding(n.id); if (n.type === "Property" && n.method) binding(n.key); if (/Function/.test(n.type || "")) { binding(n.id); (n.params || []).forEach(binding); } if (n.type === "CatchClause") binding(n.param); for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") walk(v); };
        walk(ast);
      } catch (_) { /* El worker conserva el diagnóstico de sintaxis. */ }
    }
    const toks = lexico(src); let linea = 1, out = "";
    toks.forEach(([k, t], i) => {
      if (k === "id") {
        const prev = vecino(toks, i, -1), sig = vecino(toks, i, 1);
        const miembro = prev && prev[1] === ".";
        if (!miembro && !locales.has(t) && (((funciones ?? FN_PROPIAS).has(t) && sig && sig[1] === "(") || (esObjeto(t) && sig && sig[1] === "."))) { out += `__L(${linea}).${t}`; return; }
      }
      out += t;
      for (const ch of t) if (ch === "\n") linea++;
    });
    return out;
  }
  function revisar(src, acorn) {
    const lineas = src.split("\n");
    for (let i = 0; i < lineas.length; i++) {
      const m = lineas[i].match(new RegExp(`\\/\\*\\s*(${NOMBRES_HUECO})\\s*\\*\\/`));
      if (m && !/^\s*\/\//.test(lineas[i])) return { linea: i + 1, mensaje: `Rellena el hueco /* ${m[1]} */ antes de ejecutar. Doble clic en un valor del inspector lo pone en su lugar.` };
    }
    if (typeof acorn !== "undefined") {
      try { acorn.parse(src, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
      catch (e) { return { linea: e.loc ? e.loc.line : null, mensaje: `Error de sintaxis: ${e.message.replace(/\s*\(\d+:\d+\)$/, "")}.` }; }
    }
    return null;
  }

export { vecino, instrumentar, revisar };
