/** Fachadas congeladas: jamás se congela ni modifica un intrínseco del anfitrión.
 * Los objetos del programa siguen siendo valores nativos; toda lectura o resultado
 * nativo pasa por seguro(), incluida la reflexión y los descriptores. */
let registroCompartido;
const descriptoresCompartidos = new WeakMap(), constructibles = new WeakMap();
function construible(fn) {
  if (!constructibles.has(fn)) {
    let si = true;
    try { Reflect.construct(new Proxy(fn, { construct() { return {}; } }), []); } catch { si = false; }
    constructibles.set(fn, si);
  }
  return constructibles.get(fn);
}
export function intrinsecos(motor) {
  let escrituraReflejada = 0, definicionReflejada = 0, prototipoReflejado = 0;
  const representaciones = new WeakMap();
  const pares = new Map(), inversos = new Map(), protegidos = registroCompartido || new Set(), fachadas = new WeakSet(), nativas = new WeakSet(), sombras = new WeakMap();
  const raices = { Object, Array, String, Number, Boolean, BigInt, Map, Set, WeakMap, WeakSet,
    Proxy, Reflect, JSON, Math, RegExp, Error, TypeError, RangeError, ReferenceError, SyntaxError,
    EvalError, URIError, AggregateError, Symbol, parseInt, parseFloat, isNaN, isFinite,
    encodeURI, decodeURI, encodeURIComponent, decodeURIComponent };
  function registrar(v) {
    if (!v || !['object', 'function'].includes(typeof v) || protegidos.has(v)) return;
    protegidos.add(v);
    registrar(Object.getPrototypeOf(v));
    for (const k of Reflect.ownKeys(v)) {
      const d = Object.getOwnPropertyDescriptor(v, k);
      registrar(d.value); registrar(d.get); registrar(d.set);
    }
  }
  if (!registroCompartido) Object.values(raices).forEach(registrar);
  if (!registroCompartido) for (const v of [[][Symbol.iterator](), new Map()[Symbol.iterator](), new Set()[Symbol.iterator](), ''[Symbol.iterator](), /x/g[Symbol.matchAll]('x')]) registrar(Object.getPrototypeOf(v));
  const functionOriginal = (function () {}).constructor;
  const asyncOriginal = Object.getPrototypeOf(async function () {}).constructor;
  const generatorOriginal = Object.getPrototypeOf(function* () {}).constructor;
  const asyncGeneratorOriginal = Object.getPrototypeOf(async function* () {}).constructor;
  if (!registroCompartido) {
    [asyncOriginal, generatorOriginal, asyncGeneratorOriginal].forEach(registrar);
    for (const d of Object.values(Object.getOwnPropertyDescriptors(new Error()))) { registrar(d.get); registrar(d.set); }
    registroCompartido = protegidos;
  }
  function fachada(v) {
    if (pares.has(v)) return pares.get(v);
    if (v === functionOriginal) return motor.Function;
    if (v === asyncOriginal) return motor.AF;
    if (v === generatorOriginal) return motor.GF;
    if (v === asyncGeneratorOriginal) return motor.AGF;
    let f;
    const target = typeof v === 'function' ? (construible(v) ? (function () {}).bind(null) : ({ f() {} }).f.bind(null))
      : Array.isArray(v) ? [] : Object.create(null);
    let descriptores = descriptoresCompartidos.get(v);
    if (!descriptores) { descriptores = Object.getOwnPropertyDescriptors(v); descriptoresCompartidos.set(v, descriptores); }
    if (v === Math) descriptores = { ...descriptores, random: { value: undefined } };
    const materializados = new Set();
    function materializar(key) {
      if (!Object.hasOwn(descriptores, key) || materializados.has(key)) return;
      const d = { ...descriptores[key], configurable: false };
      if ('value' in d) { d.value = seguro(d.value); d.writable = false; }
      if (d.get) d.get = seguro(d.get);
      if (d.set) d.set = seguro(d.set);
      Object.defineProperty(target, key, d); materializados.add(key);
    }
    const representar = () => {
      if (typeof v === 'function') return Function.prototype.toString.call(v);
      if (Array.isArray(v)) return '[object Array]';
      if (v === RegExp.prototype) return '[object Object]';
      if ([Object.prototype, Math, JSON, Reflect].includes(v)) return '#<Object>';
      if (v === Number.prototype) return '[object Number]';
      if (v === String.prototype) return '[object String]';
      if (v === Boolean.prototype) return '[object Boolean]';
      if (v === Symbol.prototype) return '[object Symbol]';
      if (v === BigInt.prototype) return '[object BigInt]';
      if ([Map.prototype, Set.prototype, WeakMap.prototype, WeakSet.prototype].includes(v))
        return '#<' + Object.prototype.toString.call(v).slice(8, -1) + '>';
      return String(v);
    };
    f = new Proxy(target, {
      get(t, key, receptor) {
        if (materializados.has(key)) return Reflect.get(t, key, receptor);
        if (Object.hasOwn(descriptores, key)) {
          const d = descriptores[key];
          if ('value' in d) return seguro(d.value);
          return d.get ? Reflect.apply(seguro(d.get), receptor, []) : undefined;
        }
        const p = Object.getPrototypeOf(t); return p ? Reflect.get(p, key, receptor) : undefined;
      },
      getOwnPropertyDescriptor(t, key) { materializar(key); return Object.getOwnPropertyDescriptor(t, key); },
      defineProperty(t, key, d) {
        materializar(key);
        if (definicionReflejada) return Reflect.defineProperty(t, key, d);
        Object.defineProperty(t, key, d); return true;
      },
      setPrototypeOf(t, proto) {
        if (Object.getPrototypeOf(t) === proto) return true;
        if (prototipoReflejado) return false;
        if (v === Object.prototype) throw new TypeError("Immutable prototype object 'Object.prototype' cannot have their prototype set");
        throw new TypeError(`${representar()} is not extensible`);
      },
      set(t, key, valor, receptor) {
        const d = Object.hasOwn(descriptores, key) ? descriptores[key] : undefined;
        if (escrituraReflejada && (d && 'value' in d || !d && !Object.isExtensible(receptor))) return false;
        if (!d) {
          // Los setters heredados siguen ejecutándose como en un objeto congelado.
          let p = Object.getPrototypeOf(t), heredada;
          while (p && !heredada) { heredada = Object.getOwnPropertyDescriptor(p, key); p = Object.getPrototypeOf(p); }
          if (heredada?.set) { Reflect.apply(heredada.set, receptor, [valor]); return true; }
          if (receptor !== f && !heredada) {
            Object.defineProperty(receptor, key, { value: valor, configurable: true, enumerable: true, writable: true }); return true;
          }
          throw new TypeError(`Cannot add property ${String(key)}, object is not extensible`);
        }
        if ('value' in d) throw new TypeError(`Cannot assign to read only property '${String(key)}' of ${typeof v === 'function' ? 'function' : 'object'} '${representar()}'`);
        if (!d.set) throw new TypeError(`Cannot set property ${String(key)} of ${representar()} which has only a getter`);
        Reflect.apply(d.set, receptor, [valor]); return true;
      },
      deleteProperty(t, key) {
        if (Object.hasOwn(t, key)) throw new TypeError(`Cannot delete property '${String(key)}' of ${representar()}`);
        return true;
      },
      apply(_t, receptor, args) {
        motor.cobrar();
        if ([Reflect.deleteProperty, Reflect.defineProperty].includes(v) && sombras.has(args[0])) {
          const s = sombras.get(args[0]); s.materializar(args[1]);
          return Reflect.apply(v, undefined, [s.target, ...args.slice(1)]);
        }
        if (v === Reflect.set && sombras.has(args[0])) {
          const s = sombras.get(args[0]); s.materializar(args[1]); const sombra = s.target;
          const d = Object.getOwnPropertyDescriptor(sombra, args[1]);
          if (args.length < 4 && (!d || 'value' in d)) return false;
          return Reflect.set(sombra, args[1], args[2], args.length > 3 ? args[3] : args[0]);
        }
        if (v === Object.setPrototypeOf && inversos.has(args[0]) && Object.getPrototypeOf(args[0]) !== args[1]) {
          const original = inversos.get(args[0]);
          if (original === Object.prototype) throw new TypeError("Immutable prototype object 'Object.prototype' cannot have their prototype set");
          const texto = representaciones.get(args[0])();
          throw new TypeError(`${texto} is not extensible`);
        }
        if (v === Function.prototype[Symbol.hasInstance]) {
          const original = inversos.get(receptor);
          if (!original || Reflect.apply(v, original, args)) return Reflect.apply(v, original || receptor, args);
          if (args[0] && ['object', 'function'].includes(typeof args[0]))
            for (let p = Object.getPrototypeOf(args[0]); p; p = Object.getPrototypeOf(p))
              if (seguro(p) === receptor.prototype) return true;
          return false;
        }
        if (v === Proxy.revocable && fachadas.has(args[0])) Object.freeze(args[0]);
        if (v === Reflect.set) {
          escrituraReflejada++;
          try { return seguro(Reflect.apply(v, receptor, args)); } finally { escrituraReflejada--; }
        }
        if (v === Reflect.defineProperty) {
          definicionReflejada++;
          try { return Reflect.apply(v, receptor, args); } finally { definicionReflejada--; }
        }
        if (v === Reflect.setPrototypeOf) {
          prototipoReflejado++;
          try { return Reflect.apply(v, receptor, args); } finally { prototipoReflejado--; }
        }
        const original = inversos.get(receptor);
        if (v === Function.prototype.toString && original) return Function.prototype.toString.call(original);
        if (original && ([Number.prototype, String.prototype, Boolean.prototype, Symbol.prototype, BigInt.prototype].includes(original)
          && Reflect.ownKeys(original).some(k => k !== 'constructor' && Object.getOwnPropertyDescriptor(original, k).value === v)
          || original === RegExp.prototype && Reflect.ownKeys(original).some(k => Object.getOwnPropertyDescriptor(original, k).get === v))) receptor = original;
        return seguro(Reflect.apply(v, receptor, args));
      },
      construct(_t, args, nuevo) {
        motor.cobrar();
        if (v === Proxy && fachadas.has(args[0])) Object.freeze(args[0]);
        return seguro(Reflect.construct(v, args, nuevo === f ? v : nuevo));
      },
    });
    pares.set(v, f); inversos.set(f, v); fachadas.add(f); sombras.set(f, { target, materializar }); representaciones.set(f, representar);
    if (typeof f === 'function') nativas.add(f);
    Object.setPrototypeOf(target, seguro(Object.getPrototypeOf(v)));
    for (const k of Reflect.ownKeys(descriptores)) {
      if (Array.isArray(target) && k === 'length') continue;
      Object.defineProperty(target, k, { value: undefined, writable: true, configurable: true, enumerable: Boolean(descriptores[k].enumerable) });
    }
    Object.preventExtensions(target);
    return f;
  }
  function seguro(v) { return protegidos.has(v) ? fachada(v) : v; }
  // Las funciones compiladoras son locales, no reenvían a los constructores nativos.
  for (const [fn, original] of [[motor.Function, functionOriginal], [motor.AF, asyncOriginal], [motor.GF, generatorOriginal], [motor.AGF, asyncGeneratorOriginal]]) {
    fn.prototype = fachada(original.prototype);
    Object.setPrototypeOf(fn, fachada(Function.prototype));
    Object.freeze(fn.prototype); Object.freeze(fn);
  }
  const globales = {};
  for (const [k, v] of Object.entries(raices)) globales[k] = v;
  function globalSeguro(target) {
    return new Proxy(target, {
      get(t, k, receptor) { return seguro(Reflect.get(t, k, receptor)); },
      getOwnPropertyDescriptor(t, k) {
        const d = Object.getOwnPropertyDescriptor(t, k);
        if (d && 'value' in d && seguro(d.value) !== d.value) {
          d.value = seguro(d.value); Object.defineProperty(t, k, d);
        }
        return d;
      },
      defineProperty(t, k, d) {
        const anterior = Object.getOwnPropertyDescriptor(t, k);
        if (anterior && 'value' in anterior && seguro(anterior.value) !== anterior.value)
          Object.defineProperty(t, k, { ...anterior, value: seguro(anterior.value) });
        return Reflect.defineProperty(t, k, 'value' in d ? { ...d, value: seguro(d.value) } : d);
      },
    });
  }
  return { seguro, globales, globalSeguro, fachadas, nativas, liberar() { pares.clear(); inversos.clear(); } };
}
