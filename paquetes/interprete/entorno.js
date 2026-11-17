/** Ámbitos declarativos. Un binding sin inicializar es distinto de undefined. */
export const SIN_INICIAR = Symbol('sin inicializar');
export class Entorno {
  constructor(padre = null, global = null, funcion = false) {
    this.padre = padre; this.global = global; this.funcion = funcion || !padre;
    this.valores = new Map();
  }
  ambitoVar() { return this.funcion ? this : this.padre.ambitoVar(); }
  /** @param {string} k @param {any} v @param {string} clase */
  declarar(k, v = SIN_INICIAR, clase = 'let') {
    if (clase === 'var') {
      const e = this.ambitoVar();
      if (!e.valores.has(k)) {
        e.valores.set(k, { valor: v === SIN_INICIAR ? undefined : v, clase });
        if (e.global && !(k in e.global)) e.global[k] = undefined;
      }
      return;
    }
    if (!this.valores.has(k)) this.valores.set(k, { valor: v, clase });
  }
  tiene(k) { return this.valores.has(k) || (this.padre ? this.padre.tiene(k) : k in this.global); }
  leer(k) {
    if (this.valores.has(k)) {
      const b = this.valores.get(k);
      if (b.valor === SIN_INICIAR) throw new ReferenceError(`Cannot access '${k}' before initialization`);
      return this.global && b.clase === 'var' ? this.global[k] : b.valor;
    }
    if (this.padre) return this.padre.leer(k);
    if (k in this.global) return this.global[k];
    throw new ReferenceError(`${k} is not defined`);
  }
  escribir(k, v, iniciar = false, estricto = false) {
    if (this.valores.has(k)) {
      const b = this.valores.get(k);
      if (!iniciar && b.valor === SIN_INICIAR) throw new ReferenceError(`Cannot access '${k}' before initialization`);
      if (!iniciar && b.clase === 'const') throw new TypeError('Assignment to constant variable.');
      b.valor = v;
      if (this.global && b.clase === 'var') this.global[k] = v;
    } else if (this.padre) return this.padre.escribir(k, v, iniciar, estricto);
    else {
      if (estricto && !(k in this.global)) throw new ReferenceError(`${k} is not defined`);
      this.global[k] = v;
    }
    return v;
  }
  copiar() {
    const e = new Entorno(this.padre);
    for (const [k, b] of this.valores) e.valores.set(k, { ...b });
    return e;
  }
}
export class Salto {
  constructor(tipo, valor, etiqueta = null) { this.tipo = tipo; this.valor = valor; this.etiqueta = etiqueta; }
}
export function nombres(n, salida = []) {
  if (!n) return salida;
  if (n.type === 'Identifier') salida.push(n.name);
  else if (n.type === 'RestElement') nombres(n.argument, salida);
  else if (n.type === 'AssignmentPattern') nombres(n.left, salida);
  else if (n.type === 'ArrayPattern') n.elements.forEach(x => nombres(x, salida));
  else if (n.type === 'ObjectPattern') n.properties.forEach(p => nombres(p.value || p.argument, salida));
  return salida;
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
    default: throw new SyntaxError(`Operador no soportado: ${op}`);
  }
}
