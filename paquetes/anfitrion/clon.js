// Transporte de datos planos del protocolo. Preserva undefined, huecos, -0, NaN,
// Infinity, BigInt y referencias repetidas/ciclos; JSON.stringify solo perdería campos.
// Funciones/símbolos se rechazan, como structuredClone. No es un clon de objetos DOM.
export function codificar(valor) {
  const vistos = new Map(), registros = [];
  function v(x) {
    if (x === undefined) return ['u'];
    if (typeof x === 'bigint') return ['b', String(x)];
    if (typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0))) return ['n', String(x), Object.is(x, -0)];
    if (typeof x === 'function' || typeof x === 'symbol') throw new TypeError('Mensaje no clonable');
    if (!x || typeof x !== 'object') return ['v', x];
    if (vistos.has(x)) return ['r', vistos.get(x)];
    const id = registros.length; vistos.set(x, id); registros.push(null);
    if (x instanceof Map) registros[id] = ['m', [...x].map(([k, a]) => [v(k), v(a)])];
    else if (x instanceof Set) registros[id] = ['s', [...x].map(v)];
    else registros[id] = [Array.isArray(x) ? 'a' : 'o', Object.keys(x).map(k => [k, v(x[k])]), x.length];
    return ['r', id];
  }
  const raiz = v(valor); return JSON.stringify([raiz, registros]);
}
export function decodificar(texto) {
  const [raiz, registros] = JSON.parse(texto);
  const objetos = registros.map(r => r[0] === 'a' ? new Array(r[2]) : r[0] === 'm' ? new Map() : r[0] === 's' ? new Set() : {});
  function v(x) {
    switch (x[0]) {
      case 'u': return undefined; case 'b': return BigInt(x[1]); case 'n': return x[2] ? -0 : Number(x[1]);
      case 'r': return objetos[x[1]]; default: return x[1];
    }
  }
  registros.forEach((r, i) => {
    if (r[0] === 'm') for (const [k, a] of r[1]) objetos[i].set(v(k), v(a));
    else if (r[0] === 's') for (const a of r[1]) objetos[i].add(v(a));
    else for (const [k, a] of r[1]) Object.defineProperty(objetos[i], k, { value: v(a), enumerable: true, writable: true, configurable: true });
  });
  return v(raiz);
}

// Ambos destinos ofrecen structuredClone; el clon propio cubre entornos sin él.
export const clonar = typeof structuredClone === 'function'
  ? valor => structuredClone(valor) : valor => decodificar(codificar(valor));
