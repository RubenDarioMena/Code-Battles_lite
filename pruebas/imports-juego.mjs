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
        && nodo.object.name === 'ctx' && !nodo.computed)
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
    const modulo = await import(destino.href);
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
const puente = indice('compat-paquetes'), principal = indice('juego');
assert(puente >= 0 && principal > puente);
assert(/type="module"/.test(scripts[principal].atributos));
assert(!/\basync\b/.test(scripts[principal].atributos));
for (const nombre of ['campaign-ui', 'factory-form', 'proveedor', 'programas', 'paleta', 'pulsos']) {
  assert(indice(nombre) > puente && indice(nombre) < principal, `${nombre}: dependencia anterior al módulo`);
  assert(/\bdefer\b/.test(scripts[indice(nombre)].atributos));
}
for (const nombre of ['layout', 'remota', 'revision-juego']) {
  assert(indice(nombre) > principal, `${nombre}: cmg se publica antes del consumidor`);
  assert(/\bdefer\b/.test(scripts[indice(nombre)].atributos));
}
const fuenteJuego = await readFile(juego, 'utf8');
const arbolJuego = acorn.parse(fuenteJuego, { ecmaVersion: 2022, sourceType: 'module' });
const contexto = arbolJuego.body.flatMap(n => n.declarations || []).find(d => d.id.name === 'ctx').init;
const clavesContexto = new Set(contexto.properties.map(p => p.key.name));
for (const { nombre, archivo } of usosContexto)
  assert(clavesContexto.has(nombre), `${archivo}: ctx.${nombre} tiene un accesor en la composición`);
for (const nodo of arbolJuego.body) {
  for (const decl of nodo.declarations || []) {
    if (decl.init?.type !== 'CallExpression' || !instaladores.has(decl.init.callee.name)) continue;
    assert.equal(decl.id.type, 'ObjectPattern');
    for (const prop of decl.id.properties)
      assert(instaladores.get(decl.init.callee.name).has(prop.key.name), `${decl.init.callee.name}: devuelve ${prop.key.name}`);
  }
}
for (const nombre of ['__banco', 'cmg', '__juegoListo'])
  assert(fuenteJuego.includes(`window.${nombre} =`), `${nombre}: publicación explícita`);
console.log(`carga del juego: ${vistos.size} módulos y ${enlaces} imports/reexports locales con archivos y nombres existentes; orden module/defer conservado.`);
