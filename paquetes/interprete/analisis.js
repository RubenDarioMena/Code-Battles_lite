// La caché pertenece al analizador inyectado, es acotada y no conserva motores.
const caches = new WeakMap();
const MAX_ARBOLES = 128, MAX_CARACTERES = 2_000_000;
export function analizar(acorn, fuente) {
  let cache = caches.get(acorn);
  if (!cache) { cache = new Map(); caches.set(acorn, cache); }
  if (cache.has(fuente)) {
    const ast = cache.get(fuente); cache.delete(fuente); cache.set(fuente, ast); return ast;
  }
  const ast = acorn.parse(fuente, { ecmaVersion: 2022, locations: true, sourceType: 'script' });
  function visitar(n) {
    if (!n || typeof n !== 'object' || !n.type) return false;
    if (n.type === 'WithStatement' || n.type === 'ImportExpression' || n.async && n.generator)
      throw new SyntaxError(`Construcción no soportada: ${n.type === 'ImportExpression' ? 'import()' : n.async ? 'async generator' : 'with'}`);
    let suspende = n.type === 'AwaitExpression' || n.type === 'YieldExpression';
    let usaArguments = n.type === 'Identifier' && n.name === 'arguments';
    for (const [k, v] of Object.entries(n)) {
      if (k === 'loc') continue;
      if (Array.isArray(v)) { for (const h of v) { suspende = visitar(h) || suspende; usaArguments = h?.argumentsLexicos || usaArguments; } }
      else if (v && typeof v === 'object') { suspende = visitar(v) || suspende; usaArguments = v.argumentsLexicos || usaArguments; }
    }
    n.suspende = /Function/.test(n.type) ? false : suspende;
    n.usaArguments = usaArguments;
    n.argumentsLexicos = /Function/.test(n.type) && n.type !== 'ArrowFunctionExpression' ? false : usaArguments;
    n.fuente = fuente;
    return n.suspende;
  }
  visitar(ast);
  if (fuente.length <= MAX_CARACTERES) {
    cache.set(fuente, ast);
    let caracteres = [...cache.keys()].reduce((s, f) => s + f.length, 0);
    while (cache.size > MAX_ARBOLES || caracteres > MAX_CARACTERES) {
      const clave = cache.keys().next().value; caracteres -= clave.length; cache.delete(clave);
    }
  }
  return ast;
}
export function medirCache(acorn) {
  const c = caches.get(acorn);
  return { arboles: c?.size || 0, caracteres: c ? [...c.keys()].reduce((s, f) => s + f.length, 0) : 0 };
}
