// E4 · Python en el editor, sin DOM: node pruebas/editor-python.cjs
// Léxico, árbol (lezer → nodos del editor), niveles de sangría, «pass» en bloques vacíos,
// desenvolver y plantillas. Las pruebas de significado comparan la forma del programa
// (qué sentencia queda dentro de qué bloque, según lezer) antes y después de cada operación.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ctx = vm.createContext({ console, window: {} });
for (const archivo of ['shared/vendor/lezer-python-1.1.19.js', 'shared/js/estructura.js', 'shared/editor/lenguajes.js', 'shared/editor/catalogo.js', 'shared/editor/python.js', 'shared/editor/estructura-python.js', 'shared/editor/adaptador-python.js'])
  vm.runInContext(readFileSync(path.join(__dirname, '..', archivo), 'utf8') + (archivo.includes('lezer') ? ';window.LezerPython = LezerPython;' : ''), ctx, { filename: archivo });
const { CMGEditorPython: P, ESTRUCTURA_PYTHON: E, CMGAdaptadorPython: A, LezerPython } = ctx.window;
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m); checks++; };

// Forma del programa: una línea por sentencia, sangrada por bloque, con su cabecera normalizada.
function forma(src) {
  const t = LezerPython.parser.parse(src), out = [];
  const errores = [];
  t.iterate({ enter: n => { if (n.type.isError && n.to > n.from) errores.push(n.from); } });
  const rec = (n, d) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.name === 'Comment' || c.name === ':' ) continue;
      if (c.name === 'Body') { rec(c, d + 1); continue; }
      if (/Statement$|Definition$/.test(c.name)) {
        let fin = c.to; for (let h = c.firstChild; h; h = h.nextSibling) if (h.name === 'Body') { fin = h.from; break; }
        out.push('  '.repeat(d) + src.slice(c.from, fin).replace(/\s+/g, ' ').trim());
        for (let h = c.firstChild; h; h = h.nextSibling) {
          if (h.name === 'Body') rec(h, d + 1);
          else if (h.name === 'elif' || h.name === 'else') out.push('  '.repeat(d) + '·' + h.name);
        }
      } else if (c.type.isError) errores.push(c.from);
    }
  };
  rec(t.topNode, 0);
  return errores.length ? ['ERROR', ...out] : out;
}

// Léxico: reproduce el texto y reconoce textos, f-strings, comentarios y huecos.
const muestra = 'x = f"a{b}" + r\'\\d\'  # c\ns = """uno\ndos"""\nif __condicion__:\n    pass\n';
eq(P.lexico(muestra).map(t => t[1]).join(''), muestra, 'el léxico reproduce el texto');
eq(P.lexico(muestra).filter(t => t[0] === 'str').map(t => t[1]), ['f"a{b}"', "r'\\d'", '"""uno\ndos"""'], 'textos con prefijo y de varias líneas');
eq([P.nombreDe('__condicion__'), P.nombreDe('__tipo_de_enemigo__'), P.nombreDe('__name__'), P.aHueco('tipo de enemigo'), P.aHueco('condición')],
  ['condición', 'tipo de enemigo', null, '__tipo_de_enemigo__', '__condicion__'], 'huecos __nombre__ (D4) y sus nombres con espacios y tildes');
eq([P.RE_HUECO.test('if __name__ == "__main__":'), P.RE_HUECO.exec('fire(__lugar__)').index], [false, 5], 'los nombres especiales de Python no son huecos');
eq(A.llamada({ nombre: 'pickUp', nombres: { python: 'pick_up' }, objeto: 'yo', firma: ['lugar', 'material'], await: true }).texto, 'await yo.pick_up(__lugar__, __material__)', 'llamada con el nombre Python del proveedor (D1) y await (D2)');

// Árbol: los mismos nodos que JS.
const prog = 'x = 1\nif x > 0 and not y:\n    await yo.fire(__lugar__)\n    print("a", end="")\nelif x:\n    pass\nelse:\n    x += 1\nf(1, )\n';
const est = E.analizar(prog);
const tipos = n => [n.k, ...n.h.map(tipos)];
eq(est.raiz.h.map(n => n.k), ['decl', 'si', 'sentencia'], 'sentencias de primer nivel');
eq(est.raiz.h[1].h.map(n => n.k), ['binaria', 'bloque', 'rama', 'rama'], 'if con su condición, cuerpo, elif y else');
eq(tipos(est.raiz.h[1].h[1]), ['bloque', ['cuerpo', ['sentencia', ['unaria', ['llamada', ['id'], ['metodo', ['id'], ['hueco']]]]], ['sentencia', ['llamada', ['id'], ['str'], ['nombrado', ['id'], ['str']]]]]], 'await, método con hueco y argumento con nombre');
const fl = est.raiz.h[2].h[0];
eq([fl.k, fl.args.map(a => a.k)], ['llamada', ['num', 'vacio']], 'un argumento vacío tras la coma');
const ctxHueco = E.contexto(est, prog.indexOf('__lugar__'), prog.indexOf('__lugar__') + 9);
eq([ctxHueco.tipo, ctxHueco.funcion, ctxHueco.objeto, ctxHueco.indice, ctxHueco.hueco], ['argumento', 'fire', 'yo', 0, 'lugar'], 'contexto de un hueco en una llamada');
const ctxCond = E.contexto(est, prog.indexOf('not y'), prog.indexOf('not y') + 5);
eq(ctxCond.tipo, 'condicion', 'operando de and en la condición del if');
const lineaElif = prog.split('\n').findIndex(l => l.startsWith('elif'));
eq([E.fronteraValida(est, lineaElif), E.fronteraValida(est, lineaElif + 1), E.fronteraValida(est, 2)], [false, true, true], 'no se suelta entre un cuerpo y su elif; sí dentro de los cuerpos');
eq(prog.slice(...E.unidadLinea(est, lineaElif)).split('\n')[0], 'if x > 0 and not y:', 'la línea del elif mueve el if entero');
eq(prog.slice(...E.atomo(est, prog.indexOf('and'))), 'x > 0 and not y', 'tocar «and» elige la operación');
eq(prog.slice(...E.ampliar(est, prog.indexOf('__lugar__'), prog.indexOf('__lugar__') + 9)), 'fire(__lugar__)', 'ampliar desde el hueco');

// Niveles de sangría válidos entre líneas (del más profundo al menos).
const nv = 'if x:\n    a()\n    if y:\n        b()\nc()\nif z:\n    d()\nelse:\n    e()\n';
const inicio = l => nv.split('\n').slice(0, l).reduce((s, x) => s + x.length + 1, 0);
eq(P.niveles(nv, inicio(1)), ['    '], 'tras una cabecera, solo dentro del bloque');
eq(P.niveles(nv, inicio(4)), ['        ', '    ', ''], 'al final de bloques anidados, cualquiera de sus niveles');
eq(P.niveles(nv, inicio(7)), ['    '], 'antes de else, dentro del cuerpo');
eq(P.niveles('f(1,\n  2)\n', 5), [], 'dentro de una línea lógica no se inserta');
eq([P.alPartirLinea('    if x:'), P.alPartirLinea('    return 1'), P.alPartirLinea('    a = 1')], ['        ', '', '    '], 'Enter sangra tras «:» y retrocede tras return');
const r1 = P.rellenar('if x:\nb()\n', 6);
eq([r1.texto, forma(r1.texto)], ['if x:\n    pass\nb()\n', ['if x', '  pass', 'b()']], 'un bloque vacío recibe pass');
eq(P.rellenar('if x:\n    a()\n', 6).crece, 0, 'un bloque con cuerpo no cambia');

// Desenvolver conserva el cuerpo un nivel menos sangrado.
const dv = (src, sub) => { const e = E.analizar(src), a = src.indexOf(sub), r = E.desenvolver(e, a, a + sub.length); return r.motivo || src.slice(0, r.a) + r.texto + src.slice(r.b); };
eq(forma(dv('while True:\n    a()\n    if x:\n        b()\nc()\n', 'b()')), ['while True', '  a()', '  b()', 'c()'], 'desenvolver el if interior');
eq(forma(dv('if x:\n    a()\nelse:\n    pass\n', 'a()')), ['a()'], 'un else solo con pass se descarta');
eq(dv('if x:\n    a()\nelse:\n    b()\n', 'a()'), 'El elif o else tiene código: bórralo o muévelo antes de desenvolver.', 'un else con código no se pierde');
eq(forma(dv('while x:\n    if y:\n        pass\n', 'pass')), ['while x', '  pass'], 'desenvolver lo único de un bloque deja pass');

// Plantillas y operadores con un puerto de texto como el del juego.
const puerto = { value: '', readOnly: false, selectionStart: 0, selectionEnd: 0, setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; } };
function insertar(t, sa, sb) { const a = puerto.selectionStart, b = puerto.selectionEnd; puerto.value = puerto.value.slice(0, a) + t + puerto.value.slice(b); puerto.setSelectionRange(a + (sa ?? t.length), a + (sb ?? sa ?? t.length)); return true; }
let aviso = '';
const ed = P.crearEdicion({ codigo: puerto, insertar, aviso: h => { aviso = h; }, escapar: s => s, estructura: () => A.estructura });
const plant = Object.fromEntries(P.plantillas().atajos.flatMap(a => a === '|' ? [] : [a, ...(a.variantes || [])]).map(a => [a.ico, a]));
const usar = (texto, a, b, f) => { puerto.value = texto; puerto.setSelectionRange(a, b ?? a); f(); return [puerto.value, puerto.value.slice(puerto.selectionStart, puerto.selectionEnd)]; };
let [txt, elegido] = usar('a()\n', 3, 3, () => ed.insertarBloque(plant.si.b));
eq([forma(txt.replace(/:\n( +)(?=\n|$)/, ':\n$1pass')), elegido], [['a()', 'if __condicion__', '  pass'], '__condicion__'], 'if tras una línea, con la condición elegida');
[txt] = usar('if x:\n    a()\n', 9, 12, () => ed.insertarBloque(plant.mientras.b, plant.mientras.envolvente));
eq(forma(txt), ['if x', '  while __condicion__', '    a()'], 'while envuelve las líneas elegidas dentro del bloque');
[txt] = usar('a()\nb()\n', 0, 8, () => ed.insertarBloque(plant.siNo.b, plant.siNo.envolvente));
eq(forma(txt), ['if __condicion__', '  a()', '  b()', '·else', '  pass'], 'if / else envuelve dos líneas');
[txt, elegido] = usar('if x:\n    a()\n\n', 14, 14, () => ed.insertarBloque(plant.registro.b));
eq([forma(txt), elegido], [['if x', '  a()', '  print(__mensaje__)'], '__mensaje__'], 'en una línea vacía tras un bloque, dentro del bloque (el nivel más profundo)');
[txt, elegido] = usar('if x:\n    a()\n', 9, 12, () => ed.insertarOperador(plant.yPy));
eq([txt, elegido], ['if x:\n    a() and __condicion__\n', '__condicion__'], 'and toma la expresión elegida');
[txt] = usar('if x or y:\n    pass\n', 3, 9, () => ed.insertarOperador(plant.noPy));
eq(txt, 'if not (x or y):\n    pass\n', 'not pone paréntesis a una operación');
[txt] = usar('a = b\n', 4, 5, () => ed.insertarOperador(plant.esNone));
eq(txt, 'a = b is None\n', 'is None se añade detrás');
eq(usar('print("a(b)")', 8, 8, () => {})[0] && ed.rangoCodigo(8, false), [6, 12], 'doble clic dentro de un texto elige el texto');

console.log(checks + ' comprobaciones de Python correctas');
