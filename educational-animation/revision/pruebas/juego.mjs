// Prueba del modo revisión dentro del juego (War) en Chromium, puerto 8771 (el de las pruebas del juego).
// node educational-animation/revision/pruebas/juego.mjs
// Juega el reto 5 con la solución de ejemplos/reto-5 y la semilla 1, abre los binoculares y comprueba que:
//   - la repetición con traza da la misma partida que el intento y la misma traza que grabar.mjs;
//   - en PC se ve código | diagrama; «junto» lo apila en el panel del código y el mapa sigue al paso;
//   - en el teléfono se abre a pantalla completa y apilado, sin «junto»;
//   - el mundo vuelve a ser el del intento al salir, y Ejecutar cierra la revisión.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const EJ = join(RAIZ, 'educational-animation/revision/ejemplos/reto-5');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const servidor = createServer(async (q, r) => {
  try { let f = join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); r.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((ok, mal) => servidor.once('error', mal).listen(8771, '127.0.0.1', ok));
const programas = { 'LAU-01': await readFile(join(EJ, 'LAU-01.js'), 'utf8'), 'LAU-02': await readFile(join(EJ, 'LAU-02.js'), 'utf8') };
const ctx = { window: {} }; vm.runInNewContext(await readFile(join(EJ, 'grabacion.js'), 'utf8'), ctx);
const grabada = ctx.window.GRABACIONES_REVISION['reto-5'];
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const navegador = await chromium.launch();
try {
  for (const [nombre, opc, forma] of [['PC', { viewport: { width: 1440, height: 900 } }, 'escritorio'], ['teléfono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'movil']]) {
    const contexto = await navegador.newContext(opc);
    await contexto.addInitScript(() => localStorage.setItem('cmg-interfaz-idioma', 'es'));
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/WebGL|three/i.test(m.text())) errores.push(m.text()); });
    await page.goto(`http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=${forma}`);
    await page.waitForFunction(() => window.__juegoListo && window.__banco);
    await page.evaluate(() => document.querySelector('[data-vista="2d"]')?.click());
    // Sin intento todavía: avisa.
    await page.evaluate(() => window.__banco.elegirReto(4));
    await page.evaluate(() => window.CMGRevisionJuego.abrir());
    ok(await page.locator('.rj-aviso:not([hidden])').innerText().then(t => t.includes('Ejecuta el programa')), `${nombre}: sin intento, los binoculares piden ejecutar primero`);
    // El intento: la solución del reto 5 con la semilla 1.
    const intento = await page.evaluate(async (programas) => {
      const b = window.__banco;
      for (const [id, c] of Object.entries(programas)) b.programas[id] = c;
      b.fijarSemilla(1); b.turbo(20); b.ejecutar();
      while (!b.mundo.fin) await new Promise(r => setTimeout(r, 40));
      b.turbo(1);
      return { fin: b.mundo.fin, t: Math.round(b.mundo.t * 100) / 100, derribos: b.mundo.derribos };
    }, programas);
    eq(intento.fin, 'victoria', `${nombre}: el intento gana`);
    await page.click('#b-revisar');
    await page.waitForFunction(() => window.__revisionJuego && window.__revisionJuego.vista, null, { timeout: 120000 });
    const s = await page.evaluate(() => { const v = window.__revisionJuego.vista, s = window.__revisionJuego.sesion; return { ver: s.G.verificacion, t: s.G.partida.t, derribos: s.G.partida.derribos, fotos: s.fotos.length, eventos: Object.fromEntries(Object.entries(s.G.programas).map(([id, p]) => [id, JSON.stringify(p.eventos)])), estado: v.estado }; });
    ok(s.ver.mismaPartida, `${nombre}: la repetición con traza da la misma partida que el intento`);
    eq([s.t, s.derribos], [intento.t, intento.derribos], `${nombre}: mismo final (${intento.t} s, ${intento.derribos} derribos)`);
    // También la última vuelta, cuyo lote de traza llega justo después de la espera que acaba la partida.
    eq(s.eventos, Object.fromEntries(Object.entries(grabada.programas).map(([id, p]) => [id, JSON.stringify(p.eventos)])), `${nombre}: exactamente la misma traza que grabar.mjs`);
    ok(s.fotos >= Math.floor(intento.t / 0.05), `${nombre}: una foto del mundo por paso de 0,05 s (${s.fotos})`);
    eq(await page.locator('#revision-juego .rv-et').first().innerText(), 'Repite siempre', `${nombre}: el diagrama sale del programa jugado`);
    eq(s.estado.disposicion, nombre === 'PC' ? 'lado' : 'apilado', `${nombre}: ${nombre === 'PC' ? 'código | diagrama' : 'apilado'} a pantalla completa`);
    if (nombre === 'PC') {
      // Junto: código y diagrama en el panel del código; el mapa a la vista y siguiendo al paso.
      await page.click('#revision-juego [data-accion="junto"]');
      eq(await page.evaluate(() => document.getElementById('revision-juego').parentElement.id), 'zona-codigo', 'PC: «junto» pone la revisión en el panel del código');
      eq((await page.evaluate(() => window.__revisionJuego.vista.estado)).disposicion, 'apilado', 'PC: apilada, como en el teléfono');
      const mapa = await page.locator('#zona-mapa').boundingBox(), rev = await page.locator('#revision-juego').boundingBox();
      ok(mapa.width > 300 && (mapa.x + mapa.width <= rev.x + 2 || rev.x + rev.width <= mapa.x + 2), 'PC: el mapa sigue en su sitio, al lado');
      await page.evaluate(() => window.__revisionJuego.vista.ir(400));
      const t400 = await page.evaluate(() => ({ paso: window.__revisionJuego.vista.paso().t, mundo: window.cmg.revision.mundo.t, enemigos: window.cmg.revision.mundo.enemigos.length }));
      ok(Math.abs(t400.mundo - t400.paso) < 0.051, `PC: el mapa muestra el instante del paso (${t400.paso} s → mundo ${t400.mundo} s)`);
      await page.evaluate(() => window.__revisionJuego.vista.ir(50));
      const t50 = await page.evaluate(() => window.cmg.revision.mundo.t);
      ok(t50 < t400.mundo, `PC: al volver atrás, el mapa también vuelve (${t50} s)`);
      // Avance solo: el mundo se mueve mientras el programa espera.
      await page.click('#revision-juego [data-accion="auto"]');
      await page.waitForTimeout(1500);
      const t2 = await page.evaluate(() => window.cmg.revision.mundo.t);
      ok(t2 > t50 + 0.2, `PC: ▶ reproduce el código y el mapa a la vez (${t50} → ${t2} s)`);
      await page.click('#revision-juego [data-accion="auto"]');
      await page.screenshot({ path: process.env.CAPTURA || '/dev/null' }).catch(() => {});
      await page.click('#revision-juego [data-accion="junto"]');
      eq(await page.evaluate(() => document.getElementById('revision-juego').parentElement === document.body), true, 'PC: «junto» otra vez vuelve a pantalla completa');
    } else {
      eq(await page.locator('#revision-juego [data-accion="junto"]').count(), 0, 'teléfono: sin «junto»');
    }
    // Salir por </>: se cierra y el mundo vuelve al final del intento.
    await page.click('#revision-juego [data-accion="codigo"]');
    eq(await page.evaluate(() => !!window.__revisionJuego), false, `${nombre}: </> cierra la revisión`);
    eq(await page.evaluate(() => [window.__banco.mundo.fin, Math.round(window.__banco.mundo.t * 100) / 100]), ['victoria', intento.t], `${nombre}: y el mundo vuelve al final del intento`);
    // Ejecutar con la revisión abierta la cierra.
    await page.click('#b-revisar');
    await page.waitForFunction(() => window.__revisionJuego && window.__revisionJuego.vista, null, { timeout: 120000 });
    await page.evaluate(() => window.__banco.ejecutar());
    eq(await page.evaluate(() => !!window.__revisionJuego), false, `${nombre}: Ejecutar cierra la revisión`);
    eq(errores, [], `${nombre}: sin errores en la página`);
    await contexto.close();
  }
  console.log(`juego: ${n} comprobaciones`);
} finally {
  await navegador.close();
  servidor.close();
}
