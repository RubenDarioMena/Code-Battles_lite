// Verificación estática del traslado: sin Chromium ni servidor y sin tocar localStorage.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const raiz = new URL('../../../', import.meta.url);
let rutas = 0;
for (const pagina of ['index.html', 'Prototypes/Rocket Launcher/index.html', 'paquetes/editor/demo/demo.html']) {
  const url = new URL(pagina, raiz), html = await readFile(url, 'utf8');
  for (const [, referencia] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(referencia)) continue;
    const local = new URL(referencia, url); local.search = ''; local.hash = '';
    assert((await stat(local)).isFile(), `${pagina}: ${referencia}`); rutas++;
  }
  if (pagina === 'index.html') {
    assert(html.includes('paquetes/editor/demo/demo.html'), 'enlace de la portada a la demo');
    continue;
  }
  const scripts = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)]
    .map(([, atributos, src]) => ({ atributos, src: src.split('?')[0] }));
  const puente = scripts.findIndex(s => s.src.endsWith(pagina.startsWith('Prototypes/') ? 'juego.js' : 'demo.js'));
  assert(puente >= 0 && /type="module"/.test(scripts[puente].atributos));
  for (const consumidor of scripts.slice(puente + 1)) {
    assert(/\bdefer\b|type="module"/.test(consumidor.atributos), consumidor.src);
    assert(!/\basync\b/.test(consumidor.atributos), consumidor.src);
  }
  if (pagina.startsWith('Prototypes/')) {
    const factory = scripts.findIndex(s => s.src.endsWith('factory-iconos.js'));
    assert.equal(factory, -1, 'iconos Factory se registran por import antes del editor');
  }
  const estilos = [...html.matchAll(/<link\b[^>]*href="([^"]+)"/g)]
    .map(([, href]) => href.split('?')[0]).filter(href => href.includes('/estilos/'))
    .map(href => href.split('/').at(-1));
  assert.deepEqual(estilos, pagina.startsWith('Prototypes/')
    ? ['tema.css', 'editor.css', 'edicion.css', 'codemirror.css']
    : ['tema.css', 'editor.css', 'edicion.css', 'autonomo.css', 'codemirror.css']);  // CodeMirror, siempre al final de la cascada
}
console.log(`editor: ${rutas} rutas de script/link existentes; puente anterior a consumidores e iconos y orden CSS conservados.`);
