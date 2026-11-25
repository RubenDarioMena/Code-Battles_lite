// Página real y sus dos entradas JS, con almacenamiento observado y DOM/GPU emulados.
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';
import { cargar, habilitarVM } from './juego-dom.mjs';
habilitarVM(import.meta.url);

const pagina = new URL('../Prototypes/Campaign-V2/index.html', import.meta.url);
const html = await readFile(pagina, 'utf8');
for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g))
  assert.equal(new URL(href, pagina).pathname, new URL('./', pagina).pathname);
assert.doesNotMatch(html, /data-serie="(?:war|factory|campaign)"|[?&]serie=|id="(?:hoja-reto|b-reto|retos|b-probar|t-escenario|esc-form)"|Probar en dispositivos|herramientas\/terreno/i);
for (const [, ruta] of html.matchAll(/<(?:link|script)\b[^>]*\b(?:src|href)="([^"]+)"/g))
  await access(new URL(ruta, pagina));

const raiz = new URL('../../', pagina);
for (const carpeta of ['Prototypes/Campaign-V2', 'paquetes/reglas-campaign-v2', 'paquetes/vista-3d/cv2', 'paquetes/app']) {
  const base = new URL(carpeta + '/', raiz);
  for (const nombre of await readdir(base, { recursive: true })) {
    if (!/\.(?:js|ts)$/.test(nombre)) continue;
    if (carpeta === 'paquetes/app' && !/(?:-v2|gestos-clic|repetir-intento)\.js$/.test(nombre)) continue;
    const fuente = await readFile(new URL(nombre, base), 'utf8');
    assert.doesNotMatch(fuente, /['"][^'"]*reglas-campaign(?:\/|['"])/, carpeta + '/' + nombre);
  }
}

const plataforma = crearPlataformaMemoria();
const claves = new Set();
for (const almacen of [plataforma.almacen, plataforma.sesion]) {
  for (const metodo of ['leer', 'escribir', 'borrar']) {
    const original = almacen[metodo];
    almacen[metodo] = (k, ...args) => { claves.add(k); return original(k, ...args); };
  }
}
const etapas = ['h0', 'b1', 'b2', 'b3', 'b4', 'b5', 'salida'];
let vioH0 = false, destinoEnsayo;
await cargar('campaign-v2', '2d', false, false, null, 'movil', '', { plataforma, i18n: true,
  alNavegar(url) { destinoEnsayo = url; },
  enH0($) {
    vioH0 = true;
    assert.equal($('fabrica-v2').hidden, false);
    assert.equal($('app').hidden, true);
    assert.match($('meta-h0').textContent, /0\/4/);
    $('cv2-opciones').click();
    assert.deepEqual([...$('cv2-checkpoints').children].map(op => op.value), etapas);
    $('cv2-idioma').click();
    $('cv2-checkpoints').value = 'salida';
    $('cv2-volver').click();
  },
});
assert(vioH0);
assert.equal(destinoEnsayo.pathname, '/Prototypes/Campaign-V2/');
assert.equal(destinoEnsayo.searchParams.get('ensayo'), 'salida');
assert.equal(destinoEnsayo.searchParams.get('forma'), 'movil');
for (const h of ['b1', 'salida']) {
  const banco = await cargar('campaign-v2', '2d', false, false, null, 'escritorio',
    '&ensayo=' + h + '&serie=factory', { plataforma, i18n: true });
  assert.equal(banco.partida.mundo.hito, h);
  assert.equal(banco.partida.mundo.modo, 'ensayo');
  if (h === 'b1') {
    let ui;
    banco.medirUnidades(ctx => { ui = ctx; });
    let almacenRevision;
    ui.servicios.cargarRevision = async () => ({
      trazador: ui.servicios.CMGTrazador,
      revision: { montar(_raiz, _programas, opciones) { almacenRevision = opciones.almacen; } },
    });
    await ui.cmg.revisionJuego.abrir();
    assert.equal(almacenRevision, ui.plataforma.almacen);
    almacenRevision.escribir('cmg-revision-vel', '2');
    assert.equal(plataforma.almacen.leer('campaign-v2:cmg-revision-vel'), '2');
  }
}
assert(claves.has('campaign-v2:idioma'));
assert(claves.has('campaign-v2-nivel-1'));
for (const k of claves) assert.match(k, /^campaign-v2(?::|-nivel-1(?:-programas)?$)/);

const rocket = await readFile(new URL('../Rocket Launcher/index.html', pagina), 'utf8');
const redireccion = rocket.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const serie of ['war', 'factory', 'campaign', 'campaign-v2']) {
  const url = new URL('https://qa.invalid/Prototypes/Rocket%20Launcher/');
  url.search = '?serie=' + serie + '&ensayo=salida&forma=movil';
  url.hash = '#editor';
  let destino;
  vm.runInNewContext(redireccion, { URL, location: { href: url.href, replace: ruta => { destino = new URL(ruta, url); } } });
  if (serie === 'campaign-v2') assert.equal(destino.pathname + destino.search + destino.hash,
    '/Prototypes/Campaign-V2/?ensayo=salida&forma=movil#editor');
  else assert.equal(destino, undefined);
}
console.log('Página propia, grafo de módulos, H0, B1, Salida, selector, almacenamiento y redirección verificados.');
