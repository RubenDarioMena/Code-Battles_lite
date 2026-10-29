// Pruebas de lógica sin DOM ni dependencias: node pruebas/interaccion.cjs
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const src = readFileSync(require('node:path').join(__dirname, '../Prototypes/Rocket Launcher/js/juego.js'), 'utf8');
const bloque = (inicio, fin) => src.slice(src.indexOf(inicio), src.indexOf(fin, src.indexOf(inicio)));
const ctx = vm.createContext({ console, Set, Map, Object, Promise });
vm.runInContext(`
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
${bloque('  const ATAJOS =', '  const textoAtajo =')}
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
  const atajo = ico => run(`{const a=ATAJOS.find(a=>a.ico===${JSON.stringify(ico)}); insertarBloque(a.b,a.envolvente);}`);
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
  console.log(`${checks} comprobaciones correctas`);
})().catch(e => { console.error(e); process.exitCode=1; });
