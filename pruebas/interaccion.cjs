// Pruebas de lógica sin DOM ni dependencias: node pruebas/interaccion.cjs
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ruta = (archivo) => require('node:path').join(__dirname, '../Prototypes/Rocket Launcher/js', archivo);
const src = readFileSync(ruta('juego.js'), 'utf8');
const bloque = (inicio, fin) => src.slice(src.indexOf(inicio), src.indexOf(fin, src.indexOf(inicio)));
const ctx = vm.createContext({ console, Set, Map, Object, Promise, window: {} });
vm.runInContext(`
${bloque('  const NOMBRES_HUECO =', '  const HUECO =')}
const RE_ID = /[A-Za-z_$][\\w$]*/y, RE_NUM = /0x[0-9a-f]+|\\d*\\.?\\d+(?:e[+-]?\\d+)?/iy;
let $codigo = {value:'', readOnly:false, setSelectionRange(a,b) { this.selectionStart=a; this.selectionEnd=b; }};
${bloque('  function lexico(src)', '  // Vecino significativo')}
${bloque('  function rangoCodigo(pos, triple)', '  $codigo.addEventListener("mousedown"')}
${bloque('  const RE_HUECO =', '  function seleccionarHueco()')}
function insertar(texto, desde, hasta) {
  if ($codigo.readOnly) return false;
  const a = $codigo.selectionStart, b = $codigo.selectionEnd;
  $codigo.value = $codigo.value.slice(0,a) + texto + $codigo.value.slice(b);
  $codigo.setSelectionRange(a + (desde ?? texto.length), a + (hasta ?? desde ?? texto.length));
  return true;
}
${bloque('  function envolver(antes, despues', '  // Comenta o descomenta')}
${bloque('  const ATAJOS =', '  const codAtajo =')}
let ejec = null, edicion = {ids:['A','B'],mixto:true}, programas = {A:'uno();',B:'dos();'}, aplicandoMulti = false;
const borradoresMulti = new Map();
const claveEdicion = ids => [...ids].sort().join('|');
let aceptado = true, guardados = 0, refrescos = 0;
const confirmarReemplazo = async () => aceptado;
const guardarProgramas = () => guardados++;
const configurarEdicion = () => refrescos++;
const pintarInspector = () => {};
${bloque('  async function aplicarMulti(reemplazar)', '  $("b-add").addEventListener')}
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
  eq(run('$codigo.value'), 'while (true) {\n    const pos = autoTarget("crawler", "visual");\n    regularShoot(pos);\n}');
  eq(elegido(), '    const pos = autoTarget("crawler", "visual");\n    regularShoot(pos);');
  editar('  uno();\n    dos();'); atajo('whileTrue');
  eq(run('$codigo.value'), '  while (true) {\n      uno();\n        dos();\n  }');
  // Al seleccionar desde el principio de una línea, también se conserva su margen.
  editar('  uno();\n    dos();', 2); atajo('whileTrue');
  eq(run('$codigo.value'), '  while (true) {\n      uno();\n        dos();\n  }');
  editar('uno();\ndos();',0,7); atajo('whileTrue');
  eq(run('$codigo.value'), 'while (true) {\n    uno();\n}\ndos();');
  editar('uno();'); atajo('mientras');
  eq(run('$codigo.value'), 'while (/* condición */) {\n    uno();\n}');
  editar('uno();'); atajo('siNo');
  eq(run('$codigo.value'), 'if (/* condición */) {\n    uno();\n} else {\n    \n}');
  editar('pos'); atajo('disparo'); eq(run('$codigo.value'), 'regularShoot(pos);');
  editar('"crawler"'); atajo('apuntar'); eq(run('$codigo.value'), 'const pos = autoTarget("crawler", /* sensor */);');
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
  eq(run('RE_HUECO.test("/* segundos */") && RE_HUECO.test("/* tipo de enemigo */") && !RE_HUECO.test("/* nota */")'), true);

  // Estructura para el modo sin teclado (js/estructura.js).
  vm.runInContext(readFileSync(require('node:path').join(__dirname, '../shared/js/estructura.js'), 'utf8'), ctx);
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
  // Código roto o a medio escribir: el análisis no se rompe.
  for (const t of ['', '(', '}', 'if (', 'foo(, "a"', 'const = ;', '{ x: 1, ', '/* sin cierre', '"sin cierre', '} else {', '[1, , 3]', 'a +', 'new Foo(1']) {
    const e = est(t);
    for (let p = 0; p <= t.length; p++) { E.atomo(e, p); E.ampliar(e, p, p); E.destino(e, p); E.contexto(e, p, p); }
    for (let l = 0; l < e.lineas.length; l++) { E.unidadLinea(e, l); E.fronteraValida(e, l); }
  }
  checks++;
  console.log(`${checks} comprobaciones correctas`);
})().catch(e => { console.error(e); process.exitCode=1; });
