// Autónoma: anfitrion la serializa con toString() para el Worker.
export function preludio() {
    "use strict";
    const TUPLA = Symbol("tupla"), RANGO = Symbol("rango");
    class KW { constructor(v) { this.v = v; } }
    class ErrorPython extends Error { constructor(tipo, msg) { super(tipo + ": " + msg); this.tipoPython = tipo; } }
    const err = (t, m) => new ErrorPython(t, m);
    const nada = x => x === undefined ? null : x;
    const esNum = x => typeof x === "number" || typeof x === "boolean";
    const esInt = x => typeof x === "boolean" || (typeof x === "number" && Number.isInteger(x));
    const esLista = x => Array.isArray(x) && !x[TUPLA];
    const esTupla = x => Array.isArray(x) && !!x[TUPLA];
    const tipo = x => x == null ? "NoneType" : typeof x === "boolean" ? "bool" : typeof x === "number" ? (Number.isInteger(x) ? "int" : "float")
      : typeof x === "string" ? "str" : esTupla(x) ? "tuple" : Array.isArray(x) ? "list" : x[RANGO] ? "range" : typeof x === "function" ? "function" : "object";
    const num = x => typeof x === "boolean" ? +x : x;
    function v(x) {
      if (x == null) return false;
      if (typeof x === "boolean") return x;
      if (typeof x === "number") return x !== 0;
      if (typeof x === "string" || Array.isArray(x)) return x.length > 0;
      if (x[RANGO]) return len(x) > 0;
      return true;
    }
    function reprFloat(x) {
      if (x === Infinity) return "inf";
      if (x === -Infinity) return "-inf";
      if (Number.isNaN(x)) return "nan";
      if (Number.isInteger(x) && Math.abs(x) < 1e21) return String(x);
      const [m, e] = x.toExponential().split("e"), exp = +e;
      const dig = m.replace("-", "").replace(".", ""), sig = x < 0 ? "-" : "";
      if (exp >= -4 && exp < 16) {
        if (exp < 0) return sig + "0." + "0".repeat(-exp - 1) + dig;
        const ent = dig.slice(0, exp + 1).padEnd(exp + 1, "0"), dec = dig.slice(exp + 1);
        return sig + ent + (dec ? "." + dec : "");
      }
      return sig + dig[0] + (dig.length > 1 ? "." + dig.slice(1) : "") + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
    }
    function reprStr(s) {
      const q = s.includes("'") && !s.includes('"') ? '"' : "'";
      return q + s.replace(/[\\\n\r\t]|[\x00-\x1f\x7f]/g, c => ({ "\\": "\\\\", "\n": "\\n", "\r": "\\r", "\t": "\\t" }[c] || "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0")))
        .replace(new RegExp(q, "g"), "\\" + q) + q;
    }
    function repr(x, vistos = new Set()) {
      if (x == null) return "None";
      if (x === true) return "True";
      if (x === false) return "False";
      if (typeof x === "number") return reprFloat(x);
      if (typeof x === "string") return reprStr(x);
      if (typeof x === "function") return `<function ${x.__nombre || x.name || "función"}>`;
      if (vistos.has(x)) return Array.isArray(x) ? "[...]" : "{...}";
      vistos.add(x);
      try {
        if (esTupla(x)) return "(" + x.map(e => repr(e, vistos)).join(", ") + (x.length === 1 ? ",)" : ")");
        if (Array.isArray(x)) return "[" + x.map(e => repr(e, vistos)).join(", ") + "]";
        if (x[RANGO]) return `range(${x.inicio}, ${x.fin}${x.paso !== 1 ? ", " + x.paso : ""})`;
        return "{" + Object.keys(x).map(k => reprStr(k) + ": " + repr(x[k], vistos)).join(", ") + "}";
      } finally { vistos.delete(x); }
    }
    const str = x => typeof x === "string" ? x : repr(x);
    function imprimir(...args) {
      let sep = " ", end = "\n";
      if (args.length && args[args.length - 1] instanceof KW) {
        const k = args.pop().v;
        for (const n of Object.keys(k)) if (n !== "sep" && n !== "end") throw err("TypeError", `'${n}' is an invalid keyword argument for print()`);
        if (k.sep != null) sep = k.sep; if (k.end != null) end = k.end;
      }
      const t = args.map(a => typeof a === "string" ? a : repr(a)).join(sep) + end;
      return t.endsWith("\n") ? t.slice(0, -1) : t;
    }
    function quitarKW(nombre, args, permitidos = []) {
      if (!args.length || !(args[args.length - 1] instanceof KW)) return {};
      const k = args.pop().v;
      for (const n of Object.keys(k)) if (!permitidos.includes(n)) throw err("TypeError", `${nombre}() got an unexpected keyword argument '${n}'`);
      return k;
    }
    function def(nombre, params, obligatorios, estrella, defectos, fn) {
      const w = function (...args) {
        args = args.map(nada);
        const kw = quitarKW(nombre, args, params);
        const n = params.length;
        if (args.length > n && !estrella) throw err("TypeError", `${nombre}() takes ${n} positional argument${n === 1 ? "" : "s"} but ${args.length} ${args.length === 1 ? "was" : "were"} given`);
        const posicionales = args.length;
        for (const k of Object.keys(kw)) {
          const i = params.indexOf(k);
          if (i < posicionales) throw err("TypeError", `${nombre}() got multiple values for argument '${k}'`);
          while (args.length < i) args.push(undefined);
          args[i] = nada(kw[k]);
        }
        for (const [i, valor] of defectos) if (args[i] === undefined) args[i] = valor;
        const faltan = [];
        for (let i = 0; i < obligatorios; i++) if (args[i] === undefined) faltan.push(`'${params[i]}'`);
        if (faltan.length) throw err("TypeError", `${nombre}() missing ${faltan.length} required positional argument${faltan.length === 1 ? "" : "s"}: ${faltan.length === 1 ? faltan[0] : faltan.slice(0, -1).join(", ") + " and " + faltan[faltan.length - 1]}`);
        const r = fn.apply(this, args);
        return r instanceof Promise ? r.then(nada) : nada(r);
      };
      w.__nombre = nombre;
      return w;
    }
    // Redondeo como Python: mitad al par sobre el valor binario exacto.
    function redondear(x, d) {
      if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x;
      if (d < 0) { const f = 10 ** -d; return redondear(x / f, 0) * f; }
      const s = Math.abs(x).toFixed(Math.min(100, d + 30));
      const [ent, dec = ""] = s.split(".");
      const cifras = ent + dec.slice(0, d), resto = dec.slice(d);
      let n = BigInt(cifras);
      const mitad = resto[0] === "5" && /^0*$/.test(resto.slice(1));
      if (resto[0] > "5" || (resto[0] === "5" && !mitad) || (mitad && n % 2n === 1n)) n += 1n;
      const t = n.toString().padStart(d + 1, "0");
      const r = Number(d ? t.slice(0, -d) + "." + t.slice(-d) : t);
      return x < 0 ? -r : r;
    }
    function fijo(x, d) {
      if (!Number.isFinite(x)) return reprFloat(x);
      const t = Math.abs(redondear(x, d)).toFixed(d);
      return x < 0 ? "-" + t : t;
    }
    function general(x, p) {
      if (!Number.isFinite(x)) return reprFloat(x);
      if (x === 0) return "0";
      p = p || 1;
      const [m, e] = x.toExponential(p - 1).split("e"), exp = +e;
      if (exp < -4 || exp >= p) return (m.includes(".") ? m.replace(/0+$/, "").replace(/\.$/, "") : m) + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
      const t = fijo(x, p - 1 - exp);
      return t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t;
    }
    function formato(x, spec, conv) {
      if (conv === "r" || conv === "a") x = repr(x);
      else if (conv === "s") x = str(x);
      if (!spec) return typeof x === "string" ? x : repr(x);
      const m = spec.match(/^(?:([\s\S])?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/);
      if (!m) throw err("ValueError", `Invalid format specifier '${spec}' for object of type '${tipo(x)}'`);
      let [, relleno, alinear, signo, , cero, ancho, grupo, prec, t] = m;
      let s;
      const numerico = esNum(x);
      if (t && !numerico && t !== "s") throw err("ValueError", `Unknown format code '${t}' for object of type '${tipo(x)}'`);
      if (t === "s" && numerico) throw err("ValueError", `Unknown format code 's' for object of type '${tipo(x)}'`);
      if (numerico) {
        const n = num(x);
        const p = prec == null ? null : +prec;
        if (t === "d" || t === "n") { if (!Number.isInteger(n)) throw err("ValueError", `Unknown format code '${t}' for object of type 'float'`); s = String(Math.abs(n)); }
        else if (t === "b" || t === "o" || t === "x" || t === "X") { if (!Number.isInteger(n)) throw err("ValueError", `Unknown format code '${t}' for object of type 'float'`); s = Math.abs(n).toString({ b: 2, o: 8, x: 16, X: 16 }[t]); if (t === "X") s = s.toUpperCase(); }
        else if (t === "f" || t === "F") s = fijo(Math.abs(n), p == null ? 6 : p);
        else if (t === "e" || t === "E") { let [a, e] = Math.abs(n).toExponential(p == null ? 6 : p).split("e"); s = a + "e" + (+e < 0 ? "-" : "+") + String(Math.abs(+e)).padStart(2, "0"); if (t === "E") s = s.toUpperCase(); }
        else if (t === "%") s = fijo(Math.abs(n) * 100, p == null ? 6 : p) + "%";
        else if (t === "g" || t === "G") s = general(Math.abs(n), p == null ? 6 : p);
        else s = p == null ? (typeof x === "boolean" ? String(+x) : reprFloat(Math.abs(n))) : general(Math.abs(n), p);
        if (typeof x === "boolean" && !t && p == null) s = x ? "True" : "False";
        if (grupo) { const [e, d] = s.split("."); s = e.replace(/\B(?=(\d{3})+(?!\d))/g, grupo) + (d != null ? "." + d : ""); }
        const neg = n < 0 || Object.is(n, -0) && t;
        const pre = neg ? "-" : signo === "+" ? "+" : signo === " " ? " " : "";
        if (cero && !alinear) { relleno = "0"; alinear = "="; }
        s = { s: pre + s, pre };
      } else {
        s = String(x);
        if (prec != null) s = s.slice(0, +prec);
        s = { s, pre: "" };
      }
      const w = ancho ? +ancho : 0, f = relleno || " ", a = alinear || (numerico ? ">" : "<");
      let r = s.s;
      if (r.length < w) {
        const falta = w - r.length;
        if (a === "<") r += f.repeat(falta);
        else if (a === ">") r = f.repeat(falta) + r;
        else if (a === "^") r = f.repeat(Math.floor(falta / 2)) + r + f.repeat(Math.ceil(falta / 2));
        else r = s.pre + f.repeat(falta) + r.slice(s.pre.length);
      }
      return r;
    }
    function eq(a, b) {
      a = nada(a); b = nada(b);
      if (a === b) return true;
      if (esNum(a) && esNum(b)) return num(a) === num(b);
      if (Array.isArray(a) && Array.isArray(b)) return esTupla(a) === esTupla(b) && a.length === b.length && a.every((x, i) => eq(x, b[i]));
      if (a && b && a[RANGO] && b[RANGO]) return eq([...a], [...b]);
      return false;
    }
    function orden(op, a, b) {
      if (esNum(a) && esNum(b)) { a = num(a); b = num(b); }
      else if (typeof a === "string" && typeof b === "string") { /* orden de JS por unidades UTF-16, como Python para el BMP */ }
      else if (Array.isArray(a) && Array.isArray(b) && esTupla(a) === esTupla(b)) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) if (!eq(a[i], b[i])) return orden(op, a[i], b[i]);
        a = a.length; b = b.length;
      } else throw err("TypeError", `'${op}' not supported between instances of '${tipo(a)}' and '${tipo(b)}'`);
      return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
    }
    function en(a, b) {
      if (typeof b === "string") { if (typeof a !== "string") throw err("TypeError", `'in <string>' requires string as left operand, not ${tipo(a)}`); return b.includes(a); }
      if (Array.isArray(b)) return b.some(x => eq(x, a));
      if (b && b[RANGO]) return esNum(a) && Number.isInteger(num(a)) && [...b].includes(num(a));
      if (b && typeof b === "object") return Object.keys(b).includes(a);
      throw err("TypeError", `argument of type '${tipo(b)}' is not iterable`);
    }
    function cmp(op, a, b) {
      switch (op) {
        case "==": return eq(a, b);
        case "!=": return !eq(a, b);
        case "is": return nada(a) === nada(b);
        case "is not": return nada(a) !== nada(b);
        case "in": return en(a, b);
        case "not in": return !en(a, b);
        default: return orden(op, a, b);
      }
    }
    const nombreOp = { "+": "+", "-": "-", "*": "*", "/": "/", "//": "//", "%": "%", "**": "** or pow()", "&": "&", "|": "|", "^": "^", "<<": "<<", ">>": ">>" };
    const operando = (op, a, b) => err("TypeError", `unsupported operand type(s) for ${nombreOp[op]}: '${tipo(a)}' and '${tipo(b)}'`);
    function repetir(sec, n, op) {
      if (!esInt(n)) throw err("TypeError", `can't multiply sequence by non-int of type '${tipo(n)}'`);
      n = Math.max(0, num(n));
      if (typeof sec === "string") return sec.repeat(n);
      const r = []; for (let i = 0; i < n; i++) r.push(...sec);
      return esTupla(sec) ? tupla(r) : r;
    }
    function bin(op, a, b) {
      if (esNum(a) && esNum(b)) {
        const x = num(a), y = num(b);
        switch (op) {
          case "+": return x + y;
          case "-": return x - y;
          case "*": return x * y;
          case "/": if (y === 0) throw err("ZeroDivisionError", "division by zero"); return x / y;
          case "//": if (y === 0) throw err("ZeroDivisionError", esInt(a) && esInt(b) ? "integer division or modulo by zero" : "float floor division by zero"); return Math.floor(x / y);
          case "%": { if (y === 0) throw err("ZeroDivisionError", esInt(a) && esInt(b) ? "integer modulo by zero" : "float modulo by zero"); let r = x % y; if (r !== 0 && (r < 0) !== (y < 0)) r += y; return r; }
          case "**": {
            if (x === 0 && y < 0) throw err("ZeroDivisionError", "zero to a negative power");
            if (x < 0 && !Number.isInteger(y)) throw err("ValueError", "el resultado sería un número complejo, que no está en el Python del juego");
            return x ** y;
          }
          default:
            if (!esInt(a) || !esInt(b)) throw operando(op, a, b);
            if ((op === "<<" || op === ">>") && y < 0) throw err("ValueError", "negative shift count");
            return op === "&" ? x & y : op === "|" ? x | y : op === "^" ? x ^ y : op === "<<" ? x * 2 ** y : Math.floor(x / 2 ** y);
        }
      }
      if (op === "+") {
        if (typeof a === "string") { if (typeof b !== "string") throw err("TypeError", `can only concatenate str (not "${tipo(b)}") to str`); return a + b; }
        if (esLista(a)) { if (!esLista(b)) throw err("TypeError", `can only concatenate list (not "${tipo(b)}") to list`); return [...a, ...b]; }
        if (esTupla(a)) { if (!esTupla(b)) throw err("TypeError", `can only concatenate tuple (not "${tipo(b)}") to tuple`); return tupla([...a, ...b]); }
      }
      if (op === "*") {
        if ((typeof a === "string" || Array.isArray(a)) && !Array.isArray(b) && typeof b !== "string") return repetir(a, b);
        if ((typeof b === "string" || Array.isArray(b)) && !Array.isArray(a) && typeof a !== "string") return repetir(b, a);
      }
      if (op === "%" && typeof a === "string") throw err("TypeError", "el formato con % no está en el Python del juego: usa f-strings, como f\"{x}\"");
      throw operando(op, a, b);
    }
    function aug(op, a, b) {
      if (op === "+" && esLista(a)) { a.push(...iter(b)); return a; }
      if (op === "*" && esLista(a)) { const r = repetir(a, b); a.length = 0; a.push(...r); return a; }
      return bin(op, a, b);
    }
    function un(op, x) {
      if (!esNum(x) || (op === "~" && !esInt(x))) throw err("TypeError", `bad operand type for unary ${op}: '${tipo(x)}'`);
      x = num(x);
      return op === "-" ? -x : op === "+" ? x : ~x;
    }
    function tupla(a) { a[TUPLA] = true; return Object.freeze(a); }
    function rango(...args) {
      if (args.length < 1 || args.length > 3) throw err("TypeError", `range expected at least 1 argument, got ${args.length}`);
      for (const a of args) if (!esInt(a)) throw err("TypeError", `'${tipo(a)}' object cannot be interpreted as an integer`);
      let [inicio, fin, paso = 1] = args.length === 1 ? [0, num(args[0])] : args.map(num);
      if (paso === 0) throw err("ValueError", "range() arg 3 must not be zero");
      return { [RANGO]: true, inicio, fin, paso, *[Symbol.iterator]() { for (let i = inicio; paso > 0 ? i < fin : i > fin; i += paso) yield i; } };
    }
    function len(x) {
      if (typeof x === "string" || Array.isArray(x)) return x.length;
      if (x && x[RANGO]) return Math.max(0, Math.ceil((x.fin - x.inicio) / x.paso));
      throw err("TypeError", `object of type '${tipo(x)}' has no len()`);
    }
    function iter(x) {
      if (Array.isArray(x)) return x;
      if (typeof x === "string") return [...x];
      if (x && x[RANGO]) return x;
      throw err("TypeError", `'${tipo(x)}' object is not iterable`);
    }
    function desempacar(x, n) {
      const a = [...iter(x)];
      if (a.length < n) throw err("ValueError", `not enough values to unpack (expected ${n}, got ${a.length})`);
      if (a.length > n) throw err("ValueError", `too many values to unpack (expected ${n})`);
      return a;
    }
    function indice(x, i, que) {
      if (!esInt(i)) throw err("TypeError", `${que} indices must be integers or slices, not ${tipo(i)}`);
      i = num(i);
      const n = len(x), j = i < 0 ? i + n : i;
      return { j, fuera: j < 0 || j >= n };
    }
    function idx(x, i) {
      if (typeof x === "string" || Array.isArray(x) || (x && x[RANGO])) {
        const que = typeof x === "string" ? "string" : esTupla(x) ? "tuple" : x[RANGO] ? "range object" : "list";
        const { j, fuera } = indice(x, i, que);
        if (fuera) throw err("IndexError", `${que} index out of range`);
        return x[RANGO] ? x.inicio + j * x.paso : x[j];
      }
      if (x == null) throw err("TypeError", "'NoneType' object is not subscriptable");
      if (typeof x === "object") { if (typeof i === "string" && i in x) return x[i]; throw err("KeyError", repr(i)); }
      throw err("TypeError", `'${tipo(x)}' object is not subscriptable`);
    }
    function poner(x, i, valor) {
      if (esLista(x)) {
        const { j, fuera } = indice(x, i, "list");
        if (fuera) throw err("IndexError", "list assignment index out of range");
        x[j] = valor; return valor;
      }
      if (x && typeof x === "object" && !Array.isArray(x) && !x[RANGO] && typeof i === "string") { x[i] = valor; return valor; }
      throw err("TypeError", `'${tipo(x)}' object does not support item assignment`);
    }
    function borrar(x, i) {
      if (!esLista(x)) throw err("TypeError", `'${tipo(x)}' object doesn't support item deletion`);
      const { j, fuera } = indice(x, i, "list");
      if (fuera) throw err("IndexError", "list assignment index out of range");
      x.splice(j, 1);
    }
    function corte(x, i, j, k) {
      const sec = typeof x === "string" || Array.isArray(x);
      if (!sec) throw err("TypeError", `'${tipo(x)}' object is not subscriptable`);
      for (const a of [i, j, k]) if (a != null && !esInt(a)) throw err("TypeError", "slice indices must be integers or None or have an __index__ method");
      const n = x.length, paso = k == null ? 1 : num(k);
      if (paso === 0) throw err("ValueError", "slice step cannot be zero");
      const bajo = paso < 0 ? -1 : 0, alto = paso < 0 ? n - 1 : n;
      const lim = (a, def) => a == null ? def : (a = num(a)) < 0 ? Math.max(a + n, bajo) : Math.min(a, alto);
      const ini = lim(i, paso < 0 ? alto : bajo), fin = lim(j, paso < 0 ? bajo : alto);
      const r = [];
      for (let p = ini; paso > 0 ? p < fin : p > fin; p += paso) r.push(x[p]);
      return typeof x === "string" ? r.join("") : esTupla(x) ? tupla(r) : r;
    }
    const ATRIBUTOS = {
      list: ["append", "pop", "insert", "remove", "index", "count", "extend", "clear", "reverse", "sort", "copy"],
      tuple: ["index", "count"],
      str: ["upper", "lower", "strip", "lstrip", "rstrip", "split", "join", "replace", "startswith", "endswith", "find", "count", "index", "isdigit", "isalpha", "capitalize", "title"],
    };
    function clave(kw) {
      const f = kw.key == null ? (x => x) : kw.key;
      return (a, b) => { const x = f(a), y = f(b); return orden("<", x, y) ? -1 : orden("<", y, x) ? 1 : 0; };
    }
    function ordenar(a, kw) {
      const c = clave(kw);
      const r = [...a].map((x, i) => [x, i]).sort((p, q) => c(p[0], q[0]) || p[1] - q[1]).map(p => p[0]);
      if (kw.reverse) { const g = [...a].map((x, i) => [x, i]).sort((p, q) => -c(p[0], q[0]) || p[1] - q[1]).map(p => p[0]); return g; }
      return r;
    }
    function metodo(o, nombre, nombreJS, args) {
      const t = tipo(o);
      if (ATRIBUTOS[t] || o == null || typeof o !== "object" && typeof o !== "function") {
        if (!(ATRIBUTOS[t] || []).includes(nombre)) throw err("AttributeError", `'${t}' object has no attribute '${nombre}'`);
        const kw = quitarKW(nombre, args, nombre === "sort" ? ["key", "reverse"] : nombre === "split" ? ["sep", "maxsplit"] : []);
        const aridad = (min, max) => { if (args.length < min || args.length > max) throw err("TypeError", `${nombre}() takes ${min === max ? (min === 0 ? "no arguments" : `exactly ${min} argument${min === 1 ? "" : "s"}`) : `at most ${max} arguments`} (${args.length} given)`); };
        const str1 = (x, que) => { if (typeof x !== "string") throw err("TypeError", `${que} arg must be None or str`); return x; };
        if (t === "list") switch (nombre) {
          case "append": aridad(1, 1); o.push(args[0]); return null;
          case "pop": {
            aridad(0, 1);
            if (!o.length) throw err("IndexError", "pop from empty list");
            const { j, fuera } = indice(o, args.length ? args[0] : -1, "list");
            if (fuera) throw err("IndexError", "pop index out of range");
            return o.splice(j, 1)[0];
          }
          case "insert": { aridad(2, 2); if (!esInt(args[0])) throw err("TypeError", `'${tipo(args[0])}' object cannot be interpreted as an integer`); let i = num(args[0]); if (i < 0) i = Math.max(0, i + o.length); o.splice(Math.min(i, o.length), 0, args[1]); return null; }
          case "remove": { aridad(1, 1); const i = o.findIndex(x => eq(x, args[0])); if (i < 0) throw err("ValueError", "list.remove(x): x not in list"); o.splice(i, 1); return null; }
          case "extend": aridad(1, 1); o.push(...iter(args[0])); return null;
          case "clear": aridad(0, 0); o.length = 0; return null;
          case "reverse": aridad(0, 0); o.reverse(); return null;
          case "sort": { aridad(0, 0); const r = ordenar(o, kw); o.length = 0; o.push(...r); return null; }
          case "copy": aridad(0, 0); return [...o];
        }
        if (t === "list" || t === "tuple") switch (nombre) {
          case "index": { aridad(1, 1); const i = o.findIndex(x => eq(x, args[0])); if (i < 0) throw err("ValueError", `${t === "list" ? repr(args[0]) + " is not in list" : "tuple.index(x): x not in tuple"}`); return i; }
          case "count": aridad(1, 1); return o.filter(x => eq(x, args[0])).length;
        }
        if (t === "str") switch (nombre) {
          case "upper": aridad(0, 0); return o.toUpperCase();
          case "lower": aridad(0, 0); return o.toLowerCase();
          case "capitalize": aridad(0, 0); return o.charAt(0).toUpperCase() + o.slice(1).toLowerCase();
          case "title": aridad(0, 0); return o.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
          case "strip": case "lstrip": case "rstrip": {
            aridad(0, 1);
            const c = args[0] == null ? null : str1(args[0], nombre);
            const es = ch => c == null ? /\s/.test(ch) : c.includes(ch);
            let a = 0, b = o.length;
            if (nombre !== "rstrip") while (a < b && es(o[a])) a++;
            if (nombre !== "lstrip") while (b > a && es(o[b - 1])) b--;
            return o.slice(a, b);
          }
          case "split": {
            const sep = args.length ? args[0] : kw.sep ?? null, max = args.length > 1 ? num(args[1]) : kw.maxsplit ?? -1;
            if (sep === "") throw err("ValueError", "empty separator");
            if (sep == null) { const p = o.trim().split(/\s+/).filter(Boolean); return max >= 0 && p.length > max + 1 ? [...p.slice(0, max), o.trim().split(/\s+/).slice(max).join(" ")] : p; }
            const p = o.split(str1(sep, "split"));
            return max >= 0 && p.length > max + 1 ? [...p.slice(0, max), p.slice(max).join(sep)] : p;
          }
          case "join": {
            aridad(1, 1);
            const xs = [...iter(args[0])];
            xs.forEach((x, i) => { if (typeof x !== "string") throw err("TypeError", `sequence item ${i}: expected str instance, ${tipo(x)} found`); });
            return xs.join(o);
          }
          case "replace": { aridad(2, 3); const [a, b, c = -1] = args; str1(a, "replace"); str1(b, "replace"); let r = o, n = num(c); if (n < 0) return o.split(a).join(b); const p = o.split(a); return p.length - 1 <= n ? p.join(b) : p.slice(0, n + 1).join(b) + a + p.slice(n + 1).join(a); }
          case "startswith": aridad(1, 1); return o.startsWith(str1(args[0], "startswith"));
          case "endswith": aridad(1, 1); return o.endsWith(str1(args[0], "endswith"));
          case "find": aridad(1, 1); return o.indexOf(str1(args[0], "find"));
          case "index": { aridad(1, 1); const i = o.indexOf(str1(args[0], "index")); if (i < 0) throw err("ValueError", "substring not found"); return i; }
          case "count": aridad(1, 1); return str1(args[0], "count") === "" ? o.length + 1 : o.split(args[0]).length - 1;
          case "isdigit": aridad(0, 0); return o.length > 0 && /^\d+$/.test(o);
          case "isalpha": aridad(0, 0); return o.length > 0 && /^\p{L}+$/u.test(o);
        }
        throw err("AttributeError", `'${t}' object has no attribute '${nombre}'`);
      }
      const f = o[nombreJS] !== undefined ? o[nombreJS] : o[nombre];
      if (typeof f !== "function") throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
      if (args.length && args[args.length - 1] instanceof KW) throw err("TypeError", `${nombre}() no acepta argumentos con nombre`);
      return f.apply(o, args);
    }
    function attr(o, nombre, nombreJS) {
      if (o == null || typeof o !== "object" || Array.isArray(o)) {
        if (o != null && ATRIBUTOS[tipo(o)] && ATRIBUTOS[tipo(o)].includes(nombre)) return (...a) => metodo(o, nombre, nombre, a);
        throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
      }
      if (nombreJS in o) return o[nombreJS];
      if (nombre in o) return o[nombre];
      throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
    }
    const kw = o => new KW(o);
    function entero(x, base) {
      if (base !== undefined) {
        if (typeof x !== "string") throw err("TypeError", "int() can't convert non-string with explicit base");
        const t = x.trim().replace(/_/g, ""), n = parseInt(t, num(base));
        if (!t || Number.isNaN(n) || !new RegExp(`^[+-]?[0-9a-z]+$`, "i").test(t)) throw err("ValueError", `invalid literal for int() with base ${base}: ${repr(x)}`);
        return n;
      }
      if (esNum(x)) { if (!Number.isFinite(num(x))) throw err(Number.isNaN(x) ? "ValueError" : "OverflowError", Number.isNaN(x) ? "cannot convert float NaN to integer" : "cannot convert float infinity to integer"); return Math.trunc(num(x)); }
      if (typeof x === "string") {
        const t = x.trim();
        if (!/^[+-]?\d(_?\d)*$/.test(t)) throw err("ValueError", `invalid literal for int() with base 10: ${repr(x)}`);
        return parseInt(t.replace(/_/g, ""), 10);
      }
      throw err("TypeError", `int() argument must be a string, a bytes-like object or a real number, not '${tipo(x)}'`);
    }
    function flotante(x) {
      if (esNum(x)) return num(x);
      if (typeof x === "string") {
        const t = x.trim().toLowerCase();
        if (/^[+-]?(inf|infinity)$/.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
        if (/^[+-]?nan$/.test(t)) return NaN;
        if (!/^[+-]?(\d(_?\d)*(\.(\d(_?\d)*)?)?|\.\d(_?\d)*)(e[+-]?\d+)?$/.test(t)) throw err("ValueError", `could not convert string to float: ${repr(x)}`);
        return parseFloat(t.replace(/_/g, ""));
      }
      throw err("TypeError", `float() argument must be a string or a real number, not '${tipo(x)}'`);
    }
    function extremo(nombre, menor, args) {
      const k = quitarKW(nombre, args, ["key", "default"]);
      const xs = args.length === 1 ? [...iter(args[0])] : args;
      if (!xs.length) { if ("default" in k) return k.default; throw err("ValueError", `${nombre}() iterable argument is empty`); }
      const f = k.key == null ? (x => x) : k.key;
      let mejor = xs[0], fm = f(mejor);
      for (const x of xs.slice(1)) { const fx = f(x); if (menor ? orden("<", fx, fm) : orden(">", fx, fm)) { mejor = x; fm = fx; } }
      return mejor;
    }
    const sinKW = (nombre, args) => { quitarKW(nombre, args); return args; };
    const B = {
      len: (...a) => { sinKW("len", a); if (a.length !== 1) throw err("TypeError", `len() takes exactly one argument (${a.length} given)`); return len(a[0]); },
      range: (...a) => rango(...sinKW("range", a)),
      str: (...a) => { sinKW("str", a); return a.length ? str(a[0]) : ""; },
      int: (...a) => { sinKW("int", a); return a.length ? entero(a[0], a[1]) : 0; },
      float: (...a) => { sinKW("float", a); return a.length ? flotante(a[0]) : 0; },
      bool: (...a) => { sinKW("bool", a); return a.length ? v(a[0]) : false; },
      abs: (...a) => { sinKW("abs", a); if (!esNum(a[0])) throw err("TypeError", `bad operand type for abs(): '${tipo(a[0])}'`); return Math.abs(num(a[0])); },
      min: (...a) => extremo("min", true, a),
      max: (...a) => extremo("max", false, a),
      round: (...a) => {
        sinKW("round", a);
        if (!esNum(a[0])) throw err("TypeError", `type ${tipo(a[0])} doesn't define __round__ method`);
        return a.length > 1 && a[1] != null ? redondear(num(a[0]), num(a[1])) : redondear(num(a[0]), 0);
      },
      sum: (...a) => { const k = quitarKW("sum", a, ["start"]); let s = a.length > 1 ? a[1] : k.start ?? 0; if (typeof s === "string") throw err("TypeError", "sum() can't sum strings [use ''.join(seq) instead]"); for (const x of iter(a[0])) s = bin("+", s, x); return s; },
      enumerate: (...a) => { const k = quitarKW("enumerate", a, ["start"]); const ini = a.length > 1 ? num(a[1]) : num(k.start ?? 0); return [...iter(a[0])].map((x, i) => tupla([ini + i, x])); },
      list: (...a) => { sinKW("list", a); return a.length ? [...iter(a[0])] : []; },
      sorted: (...a) => { const k = quitarKW("sorted", a, ["key", "reverse"]); return ordenar([...iter(a[0])], k); },
      reversed: (...a) => { sinKW("reversed", a); return [...iter(a[0])].reverse(); },
      any: (...a) => { sinKW("any", a); return [...iter(a[0])].some(v); },
      all: (...a) => { sinKW("all", a); return [...iter(a[0])].every(v); },
      repr: (...a) => { sinKW("repr", a); return repr(a[0]); },
    };
    for (const [k, f] of Object.entries(B)) /** @type {any} */ (f).__nombre = k;
    // Mensajes de error al estilo de Python para lo que lanza el propio JS.
    function mensaje(e) {
      const m = String((e && e.message) || e).replace(/\$(?=[A-Za-z_])/g, "");
      if (e instanceof ErrorPython) return m;
      if (e && e.__linea !== undefined) return m;
      let r;
      if ((r = m.match(/^(\S+) is not defined$/))) return `NameError: name '${r[1]}' is not defined`;
      if ((r = m.match(/^Cannot read properties of (null|undefined) \(reading '([^']*)'\)$/))) return `AttributeError: 'NoneType' object has no attribute '${r[2]}'`;
      if ((r = m.match(/^(.+) is not a function$/))) return `TypeError: '${r[1].replace(/^__py\./, "")}' is not callable`;
      if ((r = m.match(/^Cannot access '([^']*)' before initialization$/))) return `UnboundLocalError: cannot access local variable '${r[1]}' where it is not associated with a value`;
      if (/Maximum call stack size exceeded/.test(m)) return "RecursionError: maximum recursion depth exceeded";
      return m;
    }
    return { v, bin, aug, un, cmp, idx, poner, borrar, corte, metodo, attr, iter, desempacar, tupla, def, kw, imprimir, formato, mensaje, ...B };
  }

