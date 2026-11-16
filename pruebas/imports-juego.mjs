// Grafo ES real, nombres exportados y orden de arranque; no abre Chromium.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const raiz = new URL('../', import.meta.url);
const juego = new URL('Prototypes/Rocket Launcher/js/juego.js', raiz);
const vistos = new Set();
let enlaces = 0;
const usosContexto = [], instaladores = new Map();
function visitar(nodo, hacer) {
  if (!nodo || typeof nodo !== 'object') return;
  hacer(nodo);
  for (const valor of Object.values(nodo)) {
    if (Array.isArray(valor)) for (const hijo of valor) visitar(hijo, hacer);
    else if (valor && typeof valor === 'object') visitar(valor, hacer);
  }
}

function parsearExports(fuente) {
  const arbol = acorn.parse(fuente, { ecmaVersion: 2022, sourceType: 'module' });
  return arbol.body.filter(n => n.type === 'ExportNamedDeclaration')
    .flatMap(n => n.declaration?.declarations?.map(d => [d.id.name, true]) || []);
}

async function recorrer(url) {
  if (vistos.has(url.href)) return;
  vistos.add(url.href);
  assert((await stat(url)).isFile(), url.href);
  const fuente = await readFile(url, 'utf8');
  const arbol = acorn.parse(fuente, { ecmaVersion: 2022, sourceType: 'module' });
  if (/\/paquetes\/(?:interfaz|app\/juego)\/[^/]+\.js$/.test(url.pathname)) {
    assert(fuente.split('\n').length <= 501, `${url.pathname}: máximo 500 líneas`);
    visitar(arbol, nodo => {
      if (nodo.type === 'MemberExpression' && nodo.object.type === 'Identifier'
        && nodo.object.name === 'ctx' && !nodo.computed
        && arbol.body.some(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'FunctionDeclaration'
          && /^(instalar|crearEstadoJuego)/.test(n.declaration.id.name)))
        usosContexto.push({ nombre: nodo.property.name, archivo: url.pathname });
    });
    for (const nodo of arbol.body) {
      const fn = nodo.type === 'ExportNamedDeclaration' && nodo.declaration;
      if (fn?.type !== 'FunctionDeclaration') continue;
      const resultado = fn.body.body.at(-1);
      if (resultado?.type === 'ReturnStatement' && resultado.argument?.type === 'ObjectExpression')
        instaladores.set(fn.id.name, new Set(resultado.argument.properties.map(p => p.key.name)));
    }
  }
  for (const nodo of arbol.body) {
    if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(nodo.type)
      || !nodo.source?.value.startsWith('.')) continue;
    const destino = new URL(nodo.source.value, url);
    assert((await stat(destino)).isFile(), `${url.pathname}: ${nodo.source.value}`);
    // La entrada de servicios lee el navegador al evaluarse: resolver sus exports por AST.
    // Los paquetes siguen importándose realmente en Node (sin window).
    const esEntrada = destino.pathname.endsWith('/js/servicios.js');
    const modulo = esEntrada ? Object.fromEntries(parsearExports(await readFile(destino, 'utf8')))
      : await import(destino.href);
    for (const spec of nodo.specifiers || []) {
      const nombre = spec.type === 'ImportDefaultSpecifier' ? 'default'
        : spec.type === 'ImportSpecifier' ? spec.imported.name : spec.local?.name;
      if (spec.type !== 'ImportNamespaceSpecifier')
        assert(Object.hasOwn(modulo, nombre), `${destino.pathname}: export ${nombre}`);
    }
    enlaces++;
    await recorrer(destino);
  }
}
await recorrer(juego);

const html = await readFile(new URL('Prototypes/Rocket Launcher/index.html', raiz), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)]
  .map(([, atributos, src]) => ({ atributos, src: src.split('?')[0] }));
const indice = nombre => scripts.findIndex(s => s.src === `js/${nombre}.js`);
const principal = indice('juego');
assert(principal >= 0);
assert(/type="module"/.test(scripts[principal].atributos));
assert(!/\basync\b/.test(scripts[principal].atributos));
for (const nombre of ['compat-paquetes', 'campaign-ui', 'factory-form', 'factory-iconos',
  'proveedor', 'programas', 'paleta', 'pulsos', 'layout', 'remota', 'revision-juego', 'seudo'])
  assert.equal(indice(nombre), -1, `${nombre}: retirado del HTML`);
for (const script of scripts.slice(0, principal))
  assert(!/\basync\b/.test(script.atributos), `${script.src}: dependencia clásica ordenada`);
const fuenteJuego = await readFile(juego, 'utf8');
const arbolJuego = acorn.parse(fuenteJuego, { ecmaVersion: 2022, sourceType: 'module' });
assert.equal(arbolJuego.body.length, 4, 'la entrada solo importa app/plataforma/servicios y arranca');
assert.equal(arbolJuego.body.at(-1).expression.callee.name, 'arrancarJuego');
assert.deepEqual(arbolJuego.body.at(-1).expression.arguments[0].properties.map(p => p.key.name), ['plataforma', 'servicios']);
assert.equal(arbolJuego.body.at(-1).expression.arguments[0].properties[0].value.callee.name, 'crearPlataformaWeb');
const estado = acorn.parse(await readFile(new URL('paquetes/app/juego/estado.js', raiz), 'utf8'),
  { ecmaVersion: 2022, sourceType: 'module' });
const clavesContexto = new Set();
visitar(estado, nodo => {
  if (nodo.type === 'VariableDeclarator' && nodo.id.name === 'ctx')
    for (const p of nodo.init.properties) clavesContexto.add(p.key.name);
  if (nodo.type === 'CallExpression' && nodo.callee.type === 'MemberExpression'
    && nodo.callee.object.name === 'Object' && nodo.callee.property.name === 'getOwnPropertyDescriptors')
    for (const p of nodo.arguments[0].properties) clavesContexto.add(p.key.name);
});
for (const claves of instaladores.values()) for (const clave of claves) clavesContexto.add(clave);
for (const { nombre, archivo } of usosContexto)
  assert(clavesContexto.has(nombre), `${archivo}: ctx.${nombre} tiene un accesor o servicio instalado`);
const fuenteInicio = await readFile(new URL('paquetes/app/juego/iniciar.js', raiz), 'utf8');
assert(fuenteInicio.includes('window.__juegoListo = true;'));
const inicio = acorn.parse(fuenteInicio,
  { ecmaVersion: 2022, sourceType: 'module' });
visitar(inicio, nodo => {
  if (nodo.type === 'CallExpression' && nodo.callee.name === 'conectar')
    assert(instaladores.has(nodo.arguments[0].name), `${nodo.arguments[0].name}: devuelve los servicios que conecta`);
});
const arranque = await readFile(new URL('paquetes/app/juego/arranque.js', raiz), 'utf8');
for (const nombre of ['__banco', 'cmg'])
  assert(arranque.includes(`window.${nombre} =`), `${nombre}: publicación explícita`);
console.log(`carga del juego: ${vistos.size} módulos y ${enlaces} imports/reexports locales con archivos y nombres existentes; dependencias clásicas anteriores a la composición ES.`);
