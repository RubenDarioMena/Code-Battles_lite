// Pruebas de lógica sin DOM ni dependencias: node pruebas/interaccion.cjs
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ctx = vm.createContext({ console, Set, Map, Object, Promise, window: {} });
for (const archivo of [
  'shared/js/estructura.js', 'shared/editor/javascript.js',
  'Prototypes/Rocket Launcher/js/paleta.js', 'Prototypes/Rocket Launcher/js/programas.js',
]) vm.runInContext(readFileSync(path.join(__dirname, '..', archivo), 'utf8'), ctx, { filename: archivo });
vm.runInContext(`
var lexico = window.CMGEditorJS.lexico;
const RE_HUECO = window.CMGEditorJS.RE_HUECO;
let $codigo = {value:'', readOnly:false, setSelectionRange(a,b) { this.selectionStart=a; this.selectionEnd=b; }};
function insertar(texto, desde, hasta) {
  if ($codigo.readOnly) return false;
  const a = $codigo.selectionStart, b = $codigo.selectionEnd;
  $codigo.value = $codigo.value.slice(0,a) + texto + $codigo.value.slice(b);
  $codigo.setSelectionRange(a + (desde ?? texto.length), a + (hasta ?? desde ?? texto.length));
  return true;
}
let avisado = '';
const { rangoCodigo, envolver, insertarBloque, insertarOperador } = window.CMGEditorJS.crearEdicion({
  codigo: $codigo, insertar, aviso: html => { avisado = html; }, escapar: s => String(s),
  estructura: () => window.ESTRUCTURA,
});
const { atajos: ATAJOS, textoAtajo } = window.CMGPaleta.crear();
let ejec = null, edicion = {ids:['A','B'],mixto:true}, programas = {A:'uno();',B:'dos();'};
const borradoresMulti = new Map();
const claveEdicion = ids => [...ids].sort().join('|');
let aceptado = true, guardados = 0, refrescos = 0;
const aplicarMulti = window.CMGProgramas.crearAplicador({
  estado: () => ({ ejec, edicion, programas, texto: $codigo.value }),
  confirmarReemplazo: async () => aceptado,
  alAplicar(ids) { borradoresMulti.delete(claveEdicion(ids)); guardados++; refrescos++; },
});
`, ctx);
const run = code => vm.runInContext(code, ctx);
const selection = (text, pos, triple) => {
  ctx.textoPrueba = text;
  return JSON.parse(run(`$codigo.value=textoPrueba; JSON.stringify(rangoCodigo(${pos},${triple}))`));
};
let checks = 0;
function eq(actual, expected) { assert.deepEqual(actual, expected); checks++; }
(async () => {
  const text = 'fn({a: [1, (2)], b: "]" /* } */})';
  for (const [a,b] of [[0,text.length-1],[3,text.length-2],[7,14],[11,13]]) {
    // El par exterior de fn empieza después del identificador.
    const apertura = a === 0 ? 2 : a;
    eq(selection(text, apertura, true), [apertura+1,b]);
    eq(selection(text,b,true), [apertura+1,b]);
  }
  eq(selection('fn("crawler", "visual")', 6, false), [3,12]);
  eq(selection("fn('a\\'b')", 6, false), [3,9]);
  eq(selection('fn("", `x`)', 3, false), [3,5]);
  eq(selection('/* [ ] */ x', 3, true), null);
  for (const comentario of ['/* ejemplo */', '/* varias\nlíneas "citadas" */', '/* sin cierre']) {
    for (const pos of [0, 3, comentario.length-1]) eq(selection(comentario + (comentario.endsWith('*/') ? ' x' : ''), pos, false), [0,comentario.length]);
  }
  eq(selection('// palabra', 4, false), null);
  const editar = (texto, a=0, b=texto.length) => {
    ctx.textoPrueba = texto;
    run(`$codigo.value=textoPrueba; $codigo.setSelectionRange(${a},${b})`);
  };
  // Las variantes (while, for, if…) cuelgan de su atajo principal en la paleta.
  const atajo = ico => run(`{const a=ATAJOS.flatMap(a=>a==="|"?[]:[a,...(a.variantes||[])]).find(a=>a.ico===${JSON.stringify(ico)}); insertarBloque(textoAtajo(a),a.envolvente);}`);
  const elegido = () => run('$codigo.value.slice($codigo.selectionStart,$codigo.selectionEnd)');
  const codigo = 'const pos = autoTarget("crawler", "visual");\nregularShoot(pos);';
  editar(codigo); atajo('whileTrue');
  eq(run('$codigo.value'), 'while (true) {\n  const pos = autoTarget("crawler", "visual");\n  regularShoot(pos);\n}');
  eq(elegido(), '  const pos = autoTarget("crawler", "visual");\n  regularShoot(pos);');
  editar('  uno();\n    dos();'); atajo('whileTrue');
  eq(run('$codigo.value'), '  while (true) {\n    uno();\n      dos();\n  }');
  // Al seleccionar desde el principio de una línea, también se conserva su margen.
  editar('  uno();\n    dos();', 2); atajo('whileTrue');
  eq(run('$codigo.value'), '  while (true) {\n    uno();\n      dos();\n  }');
  editar('uno();\ndos();',0,7); atajo('whileTrue');
  eq(run('$codigo.value'), 'while (true) {\n  uno();\n}\ndos();');
  editar('uno();'); atajo('mientras');
  eq(run('$codigo.value'), 'while (/* condición */) {\n  uno();\n}');
  editar('uno();'); atajo('siNo');
  eq(run('$codigo.value'), 'if (/* condición */) {\n  uno();\n} else {\n  \n}');
  editar('pos'); atajo('disparo'); eq(run('$codigo.value'), 'regularShoot(pos);');
  editar('"crawler"'); atajo('apuntar'); eq(run('$codigo.value'), 'const pos = autoTarget("crawler", /* sensor */);');
  // Con un hueco elegido, «Apuntar» lo rellena con su valor; no abre otra línea con un segundo «const pos».
  editar('const pos = autoTarget("crawler", "visual") ?? /* valor */;', 47, 58); atajo('apuntar');
  eq(run('$codigo.value'), 'const pos = autoTarget("crawler", "visual") ?? autoTarget(/* tipo de enemigo */, /* sensor */);');
  eq(elegido(), '/* tipo de enemigo */');
  // «??» se ajusta a la estructura: nunca tras el «;» ni partiendo una llamada.
  const operador = (ico, texto, a, b = a) => { editar(texto, a, b); run(`{const a=ATAJOS.flatMap(a=>a==="|"?[]:[a,...(a.variantes||[])]).find(a=>a.ico===${JSON.stringify(ico)}); insertarOperador(a);}`); return run('$codigo.value'); };
  const linea = 'const pos = autoTarget("crawler", "visual");';
  for (const [a, b] of [[linea.length], [linea.length + 3], [12, 22], [6, 9], [0, linea.length], [12, 42], [linea.length - 1]]) {
    eq(operador('plan', linea + '   ', a, b), 'const pos = autoTarget("crawler", "visual") ?? /* valor */;   ');
    eq(elegido(), '/* valor */');
  }
  eq(operador('plan', 'regularShoot(pos);', 16), 'regularShoot(pos ?? /* valor */);');
  eq(operador('plan', 'const p = s1.detect("crawler");', 13, 19), 'const p = s1.detect("crawler") ?? /* valor */;');
  eq(operador('plan', 'f("a", "b");', 7, 10), 'f("a", "b" ?? /* valor */);');
  eq(operador('plan', 'if (a || b) {}', 4, 10), 'if ((a || b) ?? /* valor */) {}');
  eq(operador('y', 'if (a ?? b) {}', 4, 10), 'if ((a ?? b) && /* condición */) {}');
  eq(operador('y', 'if (a && b) {}', 4, 10), 'if (a && b && /* condición */) {}');
  eq(operador('no', 'if (listo) {}', 4, 9), 'if (!listo) {}');
  eq(operador('plan', '', 0), '/* valor */ ?? /* valor */'); eq(elegido(), '/* valor */');
  run("avisado=''"); eq(operador('plan', 'while (true) {\n  x();\n}', 0, 5), 'while (true) {\n  x();\n}'); eq(run('avisado.includes("??")'), true);
  for (const [a,b] of [['(',')'],['[',']'],['{','}'],['"','"']]) {
    editar('pos'); ctx.apertura=a; ctx.cierre=b;
    run('envolver(apertura,cierre)'); eq(run('$codigo.value'),a+'pos'+b); eq(elegido(),'pos');
  }
  editar(''); atajo('whileTrue');
  eq(run('$codigo.value'), 'while (true) {\n  \n  await esperar(0.5);\n}');
  editar('pos'); run('$codigo.readOnly=true');
  eq(run('envolver("(",")")'),false); eq(run('$codigo.value'),'pos');
  run('$codigo.readOnly=false');
  run('$codigo.value="nuevo();"');
  run('borradoresMulti.set(claveEdicion(edicion.ids), $codigo.value)');
  await run('aplicarMulti(false)');
  eq(JSON.parse(run('JSON.stringify(programas)')), {A:'uno();\nnuevo();',B:'dos();\nnuevo();'});
  eq(run('guardados'), 1);
  eq(run('borradoresMulti.size'), 0);
  run('aceptado=false; $codigo.value="reemplazo();"');
  await run('aplicarMulti(true)');
  eq(run('programas.A'), 'uno();\nnuevo();');
  eq(run('guardados'), 1);
  run('aceptado=true'); await run('aplicarMulti(true)');
  eq(JSON.parse(run('JSON.stringify(programas)')), {A:'reemplazo();',B:'reemplazo();'});
  run('ejec={}; $codigo.value="no"'); await run('aplicarMulti(false)');
  eq(run('programas.A'), 'reemplazo();');
  run('ejec=null; edicion.mixto=false'); await run('aplicarMulti(true)');
  eq(run('programas.A'), 'reemplazo();');
  // Variantes y línea vacía: la sangría sale de la línea anterior.
  eq(JSON.parse(run('JSON.stringify(ATAJOS.filter(a=>a.variantes).map(a=>[a.ico,a.variantes.map(v=>v.ico)]))')), [['whileTrue',['mientras','para','hacer','salir']],['siNo',['si','siSino']],['plan',['y','o','no','igual','distinto','mayor','menor']],['variable',['variableLet','asignar']],['aviso',['registro','info','errorCons']]]);
  editar('if (/* condición */) {\n  \n}', 25, 25); atajo('si');
  eq(run('$codigo.value'), 'if (/* condición */) {\n  if (/* condición */) {\n    \n  }\n}');
  editar('while (true) {\n\n}', 15, 15); atajo('disparo');
  eq(run('$codigo.value'), 'while (true) {\n  regularShoot(/* lugar */);\n}');
  eq(elegido(), '/* lugar */');
  // ED-06: una plantilla de sentencia envuelve solo la expresión de una sentencia y no repite el «;».
  for (const [a, b] of [[0, 17], [0, 18]]) { editar('regularShoot(pos);', a, b); atajo('rafaga'); eq(run('$codigo.value'), 'burstFire(regularShoot(pos));'); }
  editar('await esperar(0.5);', 0, 18); atajo('rafaga'); eq(run('$codigo.value'), 'burstFire(await esperar(0.5));');
  // Un nombre de función, un argumento o un bloque no se envuelven: la plantilla va en una línea nueva.
  editar('regularShoot(pos);', 0, 12); atajo('rafaga'); eq(run('$codigo.value'), 'regularShoot(pos);\nburstFire(/* lugar */);');
  editar('regularShoot(pos);', 13, 16); atajo('disparo'); eq(run('$codigo.value'), 'regularShoot(pos);\nregularShoot(/* lugar */);');
  editar('if (pos) {\n  burstFire(pos);\n}', 0, 30); atajo('disparo'); eq(run('$codigo.value'), 'if (pos) {\n  burstFire(pos);\n}\nregularShoot(/* lugar */);');
  // Un bloque envuelve sentencias completas aunque se elija solo un nombre.
  editar('const pos = autoTarget("crawler", "visual");', 12, 22); atajo('si');
  eq(run('$codigo.value'), 'if (/* condición */) {\n  const pos = autoTarget("crawler", "visual");\n}');
  editar('regularShoot(pos);', 0, 17); atajo('siNo'); eq(run('$codigo.value'), 'if (/* condición */) {\n  regularShoot(pos);\n} else {\n  \n}');
  // ED-02: un operando de ?? solo es condición dentro de la condición de un if/while.
  const tipoOperando = (texto, a, b) => { ctx.textoPrueba = texto; return JSON.parse(run(`{const E=window.ESTRUCTURA, e=E.analizar(textoPrueba, lexico(textoPrueba)), c=E.contexto(e, ${a}, ${b}); JSON.stringify(c && [c.tipo, !!c.binaria])}`)); };
  eq(tipoOperando('if (pos ?? /* valor */) {}', 11, 22), ['condicion', true]);
  eq(tipoOperando('const x = pos ?? /* valor */;', 17, 28), ['valor', true]);
  eq(tipoOperando('if (/* condición */) {}', 4, 19), ['condicion', false]);
  // ED-09: con dos sentencias en una línea, ampliar pasa por la línea antes que por el programa.
  ctx.textoPrueba = 'const pos = 1;\nburstFire(regularShoot);(pos);';
  eq(JSON.parse(run('{const E=window.ESTRUCTURA, e=E.analizar(textoPrueba, lexico(textoPrueba)); JSON.stringify(E.ampliar(e, 15, 39))}')), [15, 45]);
  eq(run('RE_HUECO.test("/* segundos */") && RE_HUECO.test("/* tipo de enemigo */") && !RE_HUECO.test("/* nota */")'), true);

  // Estructura para el modo sin teclado (js/estructura.js).
  const E = ctx.window.ESTRUCTURA;
  const est = (t) => E.analizar(t, ctx.lexico(t));
  const j = (x) => x == null ? x : JSON.parse(JSON.stringify(x));   // objetos de otro contexto vm
  const cadena = (t, sub, n = 6) => {
    const e = est(t); let a = t.indexOf(sub), b = a + sub.length; const out = [t.slice(a, b)];
    for (let i = 0; i < n; i++) { const r = E.ampliar(e, a, b); if (!r) break; [a, b] = r; out.push(t.slice(a, b)); }
    return out;
  };
  // El ejemplo del modo sin teclado: "oro" → entregar("oro") → yo.entregar("oro") → el if entero.
  eq(cadena('if (true){\nyo.entregar("oro")\n}', '"oro"'), ['"oro"', 'entregar("oro")', 'yo.entregar("oro")', 'if (true){\nyo.entregar("oro")\n}']);
  eq(cadena('const pos = autoTarget("crawler", "visual");', '"visual"', 3), ['"visual"', 'autoTarget("crawler", "visual")', 'const pos = autoTarget("crawler", "visual");']);
  eq(cadena('if (failureRate >= 0.35 && !jammed) {\n  stopFire();\n}', '0.35', 3), ['0.35', 'failureRate >= 0.35', 'failureRate >= 0.35 && !jammed', 'if (failureRate >= 0.35 && !jammed) {\n  stopFire();\n}']);
  // Un toque: textos con sus comillas, comentarios enteros, palabras clave y signos eligen su construcción.
  const t1 = 'const pos = autoTarget("crawler", /* sensor */); // fin';
  const e1 = est(t1), atomo = (sub, d = 0) => { const r = E.atomo(e1, t1.indexOf(sub) + d); return r && t1.slice(...r); };
  eq([atomo('"crawler"', 3), atomo('/* sensor */', 4), atomo('// fin', 3), atomo('const'), atomo('('), atomo(','), atomo(';'), atomo('autoTarget', 2)],
    ['"crawler"', '/* sensor */', '// fin', 'const pos = autoTarget("crawler", /* sensor */);', 'autoTarget("crawler", /* sensor */)', 'autoTarget("crawler", /* sensor */)', 'const pos = autoTarget("crawler", /* sensor */);', 'autoTarget']);
  eq(E.atomo(e1, t1.indexOf(' = ')), null);
  // Argumentos, condiciones y huecos vacíos se reconocen para proponer valores.
  const ctxDe = (t, sub, vacio) => { const e = est(t), a = t.indexOf(sub) + (vacio ? 1 : 0), c = E.contexto(e, a, vacio ? a : a + sub.length); return c && [c.tipo, c.funcion, c.objeto, c.indice, c.hueco, c.vacio]; };
  eq(ctxDe(t1, '/* sensor */'), ['argumento', 'autoTarget', null, 1, 'sensor', false]);
  eq(ctxDe('VIB_01.detect(/* tipo de enemigo */);', '/* tipo de enemigo */'), ['argumento', 'detect', 'VIB_01', 0, 'tipo de enemigo', false]);
  eq(ctxDe('while (/* condición */) {}', '/* condición */'), ['condicion', null, null, -1, 'condición', false]);
  eq(ctxDe('if (pos && /* condición */) {}', '/* condición */'), ['condicion', null, null, -1, 'condición', false]);
  eq(ctxDe('if (missiles > /* valor */) {}', '/* valor */'), ['valor', null, null, -1, 'valor', false]);
  eq(ctxDe('regularShoot();', '(', true), ['argumento', 'regularShoot', null, 0, null, true]);
  // Destinos al soltar: hueco o argumento se sustituyen; ( ) y [ ] reciben el valor con sus comas.
  const t2 = 'regularShoot(/* lugar */);\nstopFire();\nlog("a");';
  const e2 = est(t2);
  eq(j(E.destino(e2, t2.indexOf('lugar'))), { tipo: 'reemplazar', a: 13, b: 24 });
  eq(j(E.destino(e2, t2.indexOf(')', 30))), { tipo: 'insertar', a: 36, b: 36, vacio: true });
  eq(j(E.destino(e2, t2.indexOf('"a"') + 1)), { tipo: 'reemplazar', a: 43, b: 46 });
  eq(j(E.destino(e2, t2.indexOf('stopFire') + 2)), null);
  eq([E.enLista('f(a)', 3, 3, 'x'), E.enLista('f()', 2, 2, 'x'), E.enLista('f(a, b)', 5, 5, 'x'), E.enLista('f(a, )', 4, 5, 'x')], [', x', 'x', 'x, ', ' x']);
  // Asas de línea: una línea que abre o cierra un bloque agarra la sentencia entera.
  const t3 = 'while (true) {\n  if (pos) {\n    regularShoot(pos);\n  } else {\n    stopFire();\n  }\n}\n// nota\n';
  const e3 = est(t3), unidad = l => t3.slice(...E.unidadLinea(e3, l));
  const si = '  if (pos) {\n    regularShoot(pos);\n  } else {\n    stopFire();\n  }\n';
  eq([unidad(1), unidad(2), unidad(3), unidad(5), unidad(7)], [si, '    regularShoot(pos);\n', si, si, '// nota\n']);
  eq(unidad(6), t3.slice(0, t3.indexOf('// nota')));
  const t4 = 'regularShoot(\n  pos\n);\nfoo();';
  eq([0, 1, 2, 3].map(l => E.fronteraValida(est(t4), l)), [true, false, false, true]);
  // Desenvolver: quita la construcción más cercana y conserva su contenido un nivel menos sangrado.
  const desenv = (t, sub) => {
    const a = t.indexOf(sub), r = j(E.desenvolver(est(t), a, a + sub.length));
    if (r.motivo) return r.motivo;
    const nuevo = t.slice(0, r.a) + r.texto + t.slice(r.b);
    return [nuevo, nuevo.slice(r.sel[0], r.sel[1])];
  };
  eq(desenv('const x = 1;\nwhile (true) {\n  regularShoot(pos);\n  stopFire();\n}\nfoo();', 'stopFire();'), ['const x = 1;\nregularShoot(pos);\nstopFire();\nfoo();', 'regularShoot(pos);\nstopFire();']);
  eq(desenv('while (true) {\n  if (/* condición */) {\n    a();\n  } else {\n    \n  }\n}', 'a();'), ['while (true) {\n  a();\n}', 'a();']);
  eq(desenv('if (/* condición */) {\n  a();\n} else if (/* condición */) {\n  \n} else {\n  \n}\n', 'a()'), ['a();\n', 'a();']);
  eq(desenv('if (x) {\n  a();\n} else {\n  b();\n}', 'a();'), 'El else tiene código: bórralo o muévelo antes de desenvolver.');
  eq(desenv('do {\n  a();\n} while (/* condición */);', 'do'), ['a();', 'a();']);
  eq(desenv('for (let i = 0; i < 3; i++) {\n  a();\n}', 'i < 3'), ['a();', 'a();']);
  eq(desenv('if (x) a();\nb();', 'a();'), ['a();\nb();', 'a();']);
  eq(desenv('while (true) {\n}\nb();', 'while'), ['b();', '']);
  eq(desenv('a();', 'a();'), 'Elige algo dentro de un if, while, for o do.');
  // Código roto o a medio escribir: el análisis no se rompe.
  for (const t of ['', '(', '}', 'if (', 'foo(, "a"', 'const = ;', '{ x: 1, ', '/* sin cierre', '"sin cierre', '} else {', '[1, , 3]', 'a +', 'new Foo(1']) {
    const e = est(t);
    for (let p = 0; p <= t.length; p++) { E.atomo(e, p); E.ampliar(e, p, p); E.destino(e, p); E.contexto(e, p, p); E.desenvolver(e, p, p); }
    for (let l = 0; l < e.lineas.length; l++) { E.unidadLinea(e, l); E.fronteraValida(e, l); }
  }
  checks++;
  console.log(`${checks} comprobaciones correctas`);
})().catch(e => { console.error(e); process.exitCode=1; });

