import { analizar, CLAVES, LOGICOS, COMPARA, DE_LINEA, CONTENEDORES, HOJAS } from './estructura-analisis.js';
  // ---------- Consultas ----------
  const buscar = (lista, pos) => {
    let lo = 0, hi = lista.length - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1, f = lista[m];
      if (pos < f.a) hi = m - 1; else if (pos >= f.b) lo = m + 1; else return m;
    }
    return -1;
  };
  const fichaEn = (est, pos) => est.todas[buscar(est.todas, pos)] || null;
  const seleccionable = (n) => { while (n && n.sel === false) n = n.padre; return n; };
  function lineaDe(est, pos) {
    let lo = 0, hi = est.lineas.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (est.lineas[m] <= pos) lo = m; else hi = m - 1; }
    return lo;
  }
  const inicioLinea = (est, l) => est.lineas[l];
  const finLinea = (est, l) => l + 1 < est.lineas.length ? est.lineas[l + 1] - 1 : est.src.length;   // sin el salto

  // Las consultas que dependen de las palabras del lenguaje (palabras clave, operadores lógicos y de
  // comparación, nombre de un hueco) se crean por lenguaje; JS usa los conjuntos de este archivo.
  // Python (shared/editor/estructura-python.js) construye un árbol con los mismos tipos de nodo.
  function consultas({ claves = CLAVES, logicos = LOGICOS, compara = COMPARA, huecoNombre = t => t.slice(2, -2).trim() } = {}) {
    // Lo que elige un toque: un valor entero (texto con sus comillas, comentario, número o nombre)
    // o la construcción a la que pertenece una palabra clave, un operador o un delimitador.
    function atomo(est, pos) {
      const t = fichaEn(est, pos);
      if (!t || t.k === "esp" || t.k === "nl") return null;
      if (t.k === "com" || t.k === "str" || t.k === "num") return [t.a, t.b];
      const i = buscar(est.sig, pos);
      if (i < 0) return [t.a, t.b];
      const f = est.sig[i];
      if (f.k === "id" && !claves.has(f.v)) return [f.a, f.b];
      const n = seleccionable(est.duenos.get(i));
      return n ? [n.a, n.b] : [f.a, f.b];
    }

    // Siguiente límite semántico: la construcción más pequeña que contiene la selección y es mayor que ella.
    // Ejemplo con «if (true) { yo.entregar("oro") }»: "oro" → entregar("oro") → yo.entregar("oro") → if entero.
    function ampliar(est, a, b) {
      if (a === b) { const t = atomo(est, a) || (a > 0 ? atomo(est, a - 1) : null); if (t) return t; }
      let mejor = null;
      for (const n of est.nodos) {
        if (n.sel === false || n.a > a || n.b < b || n.b - n.a <= b - a) continue;
        if (!mejor || n.b - n.a < mejor.b - mejor.a) mejor = n;
      }
      // Una línea con varias sentencias es un nivel propio entre la sentencia y lo que la contiene.
      const [ua, ub] = recortar(est.src, unidadLinea(est, lineaDe(est, a)));
      if (ua <= a && ub >= b && ub - ua > b - a && (!mejor || ub - ua < mejor.b - mejor.a)) return [ua, ub];
      return mejor ? [mejor.a, mejor.b] : null;
    }
    // [a, b) sin los espacios ni saltos de los extremos.
    /** @param {string} src @param {number[]} rango */
    function recortar(src, [a, b]) {
      while (a < b && /\s/.test(src[a])) a++;
      while (b > a && /\s/.test(src[b - 1])) b--;
      return [a, b];
    }

    // Líneas completas (con su salto) de la sentencia que empieza en la línea l. Una línea que empieza
    // cerrando llaves pertenece a la sentencia que cierra; una vacía o de comentario es solo ella.
    function unidadLinea(est, l) {
      const ini = inicioLinea(est, l), fin = finLinea(est, l);
      const lineaCompleta = (desde, hasta) => {
        const l1 = lineaDe(est, hasta);
        return [inicioLinea(est, lineaDe(est, desde)), l1 + 1 < est.lineas.length ? est.lineas[l1 + 1] : est.src.length];
      };
      let i = -1;
      for (let j = 0; j < est.sig.length; j++) if (est.sig[j].a >= ini && est.sig[j].a < Math.max(fin, ini + 1)) { i = j; break; }
      if (i < 0 || est.sig[i].a > fin) return lineaCompleta(ini, ini);
      const f = est.sig[i];
      // Una unidad empieza en la primera ficha de su línea: «} else {» no se mueve sin su if.
      const unidad = (x) => DE_LINEA.has(x.k) && x.sel !== false && est.sig[buscar(est.sig, x.a)].nl;
      let n = null;
      if (!(f.k === "p" && (f.v === "}" || f.v === ")" || f.v === "]"))) {
        for (const x of est.nodos) if (x.a === f.a && unidad(x) && (!n || x.b - x.a > n.b - n.a)) n = x;
      }
      if (!n) {
        n = est.duenos.get(i) || est.hojas.get(i) || null;
        while (n && n.k !== "programa" && !unidad(n)) n = n.padre;
      }
      if (!n || n.k === "programa") return lineaCompleta(ini, ini);
      return lineaCompleta(n.a, Math.max(n.a, n.b - 1));
    }

    // ¿Se puede soltar una línea en la frontera anterior a la línea l sin partir otra construcción?
    function fronteraValida(est, l) {
      if (l <= 0 || l >= est.lineas.length) return true;
      const pos = est.lineas[l];
      if (est.todas.some(t => t.a < pos && t.b > pos)) return false;   // dentro de un comentario o texto de varias líneas
      let menor = null;
      for (const n of est.nodos) if (n.a < pos && n.b > pos && (!menor || n.b - n.a < menor.b - menor.a)) menor = n;
      return !menor || CONTENEDORES.has(menor.k);
    }

    const texto = (est, n) => est.src.slice(n.a, n.b);
    function enCondicion(n) {
      let x = n;
      while (x.padre && ((x.padre.k === "binaria" && logicos.has(x.padre.op)) || (x.padre.k === "unaria" && x.padre.op === "!") || x.padre.k === "grupo")) x = x.padre;
      return !!x.padre && x.padre.cond === x;
    }
    const llamadaDe = (n) => !n || !n.padre ? null : n.padre.k === "llamada" ? n.padre : n.padre.k === "metodo" ? n.padre.llamada : null;

    // Qué es lo seleccionado: argumento de una llamada (con su función y posición), condición,
    // operando de una comparación o hueco suelto. Sirve para proponer valores.
    function contexto(est, a, b) {
      let n = null;
      if (a === b) n = est.nodos.find(x => x.k === "vacio" && x.a <= a && a <= x.b) || null;
      else n = est.nodos.find(x => x.a === a && x.b === b && x.k !== "vacio" && x.k !== "programa") || null;
      if (!n) return null;
      const r = { nodo: n, tipo: null, funcion: null, objeto: null, indice: -1, total: 0, hueco: null, vacio: n.k === "vacio", hoja: HOJAS.has(n.k) };
      if (n.k === "hueco") r.hueco = huecoNombre(est.src.slice(n.a, n.b));
      const pa = n.padre, ll = llamadaDe(n);
      if (ll && ll.args.includes(n)) {
        r.tipo = "argumento";
        r.indice = ll.args.indexOf(n);
        r.total = ll.args.length;
        r.funcion = ll.nombre ? texto(est, ll.nombre) : null;
        const callee = ll.h[0];
        if (pa.k === "metodo") r.objeto = texto(est, callee);
        else if (callee && callee.k === "miembro" && callee.h[0]) r.objeto = texto(est, callee.h[0]);
      } else if (pa && pa.k === "lista" && pa.args.includes(n)) r.tipo = "elemento";
      else if (pa && pa.cond === n) r.tipo = "condicion";
      // Operando de &&, || o ??: es condición solo si la expresión lógica entera es la condición de un if/while.
      else if (pa && ((pa.k === "binaria" && logicos.has(pa.op)) || (pa.k === "unaria" && pa.op === "!"))) r.tipo = enCondicion(n) ? "condicion" : "valor";
      else if (pa && pa.k === "binaria" && compara.has(pa.op)) r.tipo = "valor";
      else if (r.hueco) r.tipo = "hueco";
      // Operando de una operación binaria completa: borrarlo quita también el operador y deja el otro.
      if (pa && pa.k === "binaria" && pa.h.length === 2 && pa.h.includes(n)) r.binaria = pa;
      return r;
    }

    // Dónde cae un valor arrastrado: sustituye un hueco o un argumento, rellena un argumento vacío
    // o se inserta entre los valores de unos paréntesis o corchetes.
    function destino(est, pos) {
      const i = buscar(est.sig, pos);
      if (i >= 0) {
        const n = est.hojas.get(i);
        if (n && (n.k === "hueco" || (llamadaDe(n) && llamadaDe(n).args.includes(n)) || (n.padre && n.padre.k === "lista"))) return { tipo: "reemplazar", a: n.a, b: n.b };
      }
      const v = est.nodos.find(x => x.k === "vacio" && x.a <= pos && pos <= x.b);
      if (v) return { tipo: "insertar", a: v.a, b: v.b, vacio: true };
      // Dentro de unos paréntesis o corchetes: se inserta como un valor más de la lista.
      const dentro = est.sig.some((f, j) => f.k === "p" && (f.v === "(" || f.v === "[") && est.par[j] > j && f.b <= pos && est.sig[est.par[j]].a >= pos);
      return dentro ? { tipo: "insertar", a: pos, b: pos, lista: true } : null;
    }

    // Texto que se inserta entre los valores de una lista: añade la coma que falte a cada lado.
    function enLista(src, a, b, valor) {
      let i = a - 1; while (i >= 0 && /\s/.test(src[i])) i--;
      let j = b; while (j < src.length && /\s/.test(src[j])) j++;
      const antes = src[i], despues = src[j];
      let t = valor;
      if (antes === ",") t = (a > 0 && /\s/.test(src[a - 1]) ? "" : " ") + t;
      else if (antes !== "(" && antes !== "[") t = ", " + t;
      if (despues !== ")" && despues !== "]" && despues !== ",") t += ", ";
      return t;
    }
    return { atomo, ampliar, unidadLinea, fronteraValida, contexto, destino, enLista };
  }
  const JS = consultas();
  const { atomo, ampliar, unidadLinea, fronteraValida, contexto, destino, enLista } = JS;

  // Desenvolver: quita el if/while/for/do más cercano que contiene [a, b) y deja su contenido con un
  // nivel menos de sangría. Un else con código no se descarta: sin cambio posible devuelve un motivo.
  const ENVOLTURAS = new Set(["si", "mientras", "para", "hacer"]);
  // ¿Solo plantilla? Huecos, comentarios, llaves y else/if vacíos (lo que añaden los atajos If / else).
  const sinCodigo = (t) => !t.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|\b(?:if|else)\b|[\s{}();]/g, "");
  function desenvolver(est, a, b) {
    const src = est.src;
    let n = null;
    for (const x of est.nodos) if (ENVOLTURAS.has(x.k) && x.a <= a && x.b >= b && (!n || x.b - x.a < n.b - n.a)) n = x;
    if (!n) return { motivo: "Elige algo dentro de un if, while, for o do." };
    // El cuerpo: lo que sigue a la cabecera «( … )» (do: lo que sigue a la palabra).
    let ini = n.ia + 1;
    if (n.k !== "hacer" && est.sig[ini] && est.sig[ini].v === "(" && est.par[ini] > ini) ini = est.par[ini] + 1;
    const cuerpo = n.h.find(c => c.ia === ini && c.k !== "sino");
    const alt = n.h.find(c => c.k === "sino");
    if (alt && !sinCodigo(src.slice(alt.a + 4, alt.b))) return { motivo: "El else tiene código: bórralo o muévelo antes de desenvolver." };
    let dentro = !cuerpo ? "" : cuerpo.k === "bloque" ? src.slice(cuerpo.a + 1, src[cuerpo.b - 1] === "}" ? cuerpo.b - 1 : cuerpo.b) : src.slice(cuerpo.a, cuerpo.b);
    const lineas = dentro.split("\n");
    while (lineas.length && !lineas[0].trim()) lineas.shift();
    while (lineas.length && !lineas[lineas.length - 1].trim()) lineas.pop();
    // Líneas enteras si la construcción ocupa sus líneas; si no, solo su tramo.
    const li = src.lastIndexOf("\n", n.a - 1) + 1, lf = src.indexOf("\n", n.b) < 0 ? src.length : src.indexOf("\n", n.b);
    const solaIni = !src.slice(li, n.a).trim(), solaFin = !src.slice(n.b, lf).trim();
    const desde = solaIni ? li : n.a, hasta = solaFin ? Math.min(src.length, lf + 1) : n.b;
    const sangria = src.slice(li, n.a).match(/^[ \t]*/)[0];
    const utiles = lineas.filter(l => l.trim());
    const margen = utiles.length ? Math.min(...utiles.map(l => l.match(/^[ \t]*/)[0].length)) : 0;
    const cuerpoTxt = lineas.map((l, i) => !l.trim() ? "" : (i === 0 && !solaIni ? "" : sangria) + l.slice(margen)).join("\n");
    const salto = solaFin && hasta > lf && cuerpoTxt ? "\n" : "";
    const texto = cuerpoTxt + salto;
    const selA = desde + (cuerpoTxt && solaIni ? sangria.length : 0);
    return { a: desde, b: hasta, texto, sel: [selA, desde + cuerpoTxt.length] };
  }


export const ESTRUCTURA = { analizar, atomo, ampliar, unidadLinea, fronteraValida, contexto, destino, enLista, lineaDe, inicioLinea, finLinea, fichaEn, desenvolver, consultas };
