// Revisión estática del orden clásico/módulos: no abre Chromium.
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';

const raiz = new URL('../../../', import.meta.url);
const retirados = ['shared/editor/javascript.js', 'shared/js/estructura.js',
  'shared/python/traductor.js', 'shared/python/desde-js.js'];
for (const ruta of retirados) await assert.rejects(stat(new URL(ruta, raiz)), { code: 'ENOENT' });
let rutas = 0;
for (const [pagina, puente] of [
  ['Prototypes/Rocket Launcher/index.html', 'js/compat-paquetes.js'],
  ['paquetes/editor/demo/demo.html', 'compat-paquetes.js'],
]) {
  const url = new URL(pagina, raiz), html = await readFile(url, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)]
    .map(([, atributos, ruta]) => ({ atributos, ruta: ruta.split('?')[0] }));
  const indice = scripts.findIndex(s => s.ruta === puente);
  assert(indice >= 0 && /type="module"/.test(scripts[indice].atributos));
  for (const vendor of ['acorn-8.11.3.js', 'lezer-python-1.1.19.js']) {
    const i = scripts.findIndex(s => s.ruta.endsWith(vendor));
    assert(i >= 0 && i < indice, `${vendor} antes del puente en ${pagina}`);
    assert(!/\b(?:async|defer)\b/.test(scripts[i].atributos), `${vendor} disponible al evaluar el puente`);
  }
  for (const script of scripts) {
    assert(!retirados.some(r => script.ruta.endsWith(r.replace(/^shared\//, ''))), script.ruta);
    assert((await stat(new URL(script.ruta, url))).isFile(), script.ruta);
    rutas++;
  }
  for (const script of scripts.slice(indice + 1)) {
    assert(/\bdefer\b|type="module"/.test(script.atributos), `Consumidor sin defer: ${script.ruta}`);
    assert(!/\basync\b/.test(script.atributos), `Consumidor async: ${script.ruta}`);
  }
  const fuente = await readFile(new URL(puente, url), 'utf8');
  for (const nombre of pagina.startsWith('paquetes/editor/demo/')
    ? ['CMGEditorJS', 'ESTRUCTURA', 'CMGPythonJS', 'CMGJSaPython'] : ['ESTRUCTURA']) {
    assert(fuente.includes(`window.${nombre} =`) || fuente.includes(`globales.${nombre} =`)
      || new RegExp(`Object\\.assign\\(window, \\{[^}]*\\b${nombre}\\b`).test(fuente), `${nombre} publicado en ${puente}`);
  }
  if (pagina.startsWith('paquetes/editor/demo/')) {
    assert(fuente.includes('hueco: CMGEditorPython.nombreDe'));
    assert(!/paquetes\/(?:app|reglas-|anfitrion)/.test(fuente));
  } else {
    const juego = await readFile(new URL('js/juego.js', url), 'utf8');
    assert(juego.includes("import * as lenguaje from '../../../paquetes/lenguaje/index.js'"));
    assert(juego.includes('lenguaje.crearPython({ lezer: window.LezerPython, hueco: CMGEditorPython.nombreDe })'));
    assert(juego.includes('lenguaje.crearJSaPython({ acorn: window.acorn })'));
    for (const retirado of ['LENGUAJE', 'CMGEditorJS', 'CMGPythonJS', 'CMGJSaPython'])
      assert(!fuente.includes(`window.${retirado} =`), `${retirado}: el juego importa el paquete`);
  }
}
// El grafo del paquete solo importa archivos propios: Acorn y Lezer son parámetros.
for (const archivo of await readdir(new URL('../', import.meta.url))) {
  if (!archivo.endsWith('.js')) continue;
  const fuente = await readFile(new URL(`../${archivo}`, import.meta.url), 'utf8');
  assert(fuente.split('\n').length <= 501, `${archivo}: máximo 500 líneas`);
  for (const [, ruta] of fuente.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    assert(ruta.startsWith('./'), `${archivo}: dependencia externa ${ruta}`);
    assert((await stat(new URL(`../${ruta}`, import.meta.url))).isFile());
  }
}
console.log(`lenguaje: ${rutas} rutas, puentes del juego y demo en orden, proveedores anteriores, consumidores defer y módulos locales verificados.`);
