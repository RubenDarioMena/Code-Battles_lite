export class Entorno {
  constructor(padre = null, global = null) { this.padre = padre; this.global = global; this.valores = new Map(); }
  declarar(k, v) { this.valores.set(k, v); }
  tiene(k) { return this.valores.has(k) || (this.padre ? this.padre.tiene(k) : k in this.global); }
  leer(k) {
    if (this.valores.has(k)) return this.valores.get(k);
    if (this.padre) return this.padre.leer(k);
    if (k in this.global) return this.global[k];
    throw new ReferenceError(`${k} is not defined`);
  }
  escribir(k, v) {
    if (this.valores.has(k)) this.valores.set(k, v);
    else if (this.padre?.tiene(k)) this.padre.escribir(k, v);
    else if (this.padre) this.padre.escribir(k, v);
    else this.global[k] = v;
    return v;
  }
}
export class Salto {
  constructor(tipo, valor, etiqueta = null) { this.tipo = tipo; this.valor = valor; this.etiqueta = etiqueta; }
}
export function binario(op, a, b) {
  switch (op) {
    case '+': return a + b; case '-': return a - b; case '*': return a * b;
    case '/': return a / b; case '%': return a % b; case '**': return a ** b;
    case '===': return a === b; case '!==': return a !== b;
    case '==': return a == b; case '!=': return a != b;
    case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
    case 'in': return a in b; case 'instanceof': return a instanceof b;
    case '|': return a | b; case '&': return a & b; case '^': return a ^ b;
    case '<<': return a << b; case '>>': return a >> b; case '>>>': return a >>> b;
    default: throw new Error(`Operador no implementado: ${op}`);
  }
}
