// Prueba de la interfaz del modo revisión en Chromium (PC 1280×800 y teléfono 390×844).
// node educational-animation/revision/pruebas/interfaz.mjs
// Usa un servidor propio en el puerto 8793: la página no escribe en localStorage ni toca el juego.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const servidor = createServer(async (q, r) => {
  try { let f = join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); r.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise(ok => servidor.listen(8793, '127.0.0.1', ok));
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; console.log(`OK ${n}: ${m}`); };
const ok = (c, m) => { assert.ok(c, m); n++; console.log(`OK ${n}: ${m}`); };
const navegador = await chromium.launch();
try {
  for (const [nombre, ctx] of [['PC', { viewport: { width: 1280, height: 800 } }], ['teléfono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const page = await navegador.newPage(ctx);
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    await page.goto('http://127.0.0.1:8793/educational-animation/revision/');
    await page.waitForFunction(() => window.__revision);
    const est = () => page.evaluate(() => window.__revision.estado);
    const paso = () => page.evaluate(() => { const p = window.__revision.paso(); return { tipo: p.tipo, t: p.t, fase: p.fase }; });

    eq((await est()).paso, 0, `${nombre}: abre en el programa en palabras`);
    eq(await page.locator('.rv-lista li').count(), 9, `${nombre}: el programa en palabras tiene una línea por sentencia`);
    await page.click('[data-accion="despues"]');
    eq((await est()).paso, 1, `${nombre}: › avanza un paso`);
    eq(await page.locator('.rv-pre .rv-anillo').count() > 0, true, `${nombre}: el paso ilumina el código`);
    await page.keyboard.press('ArrowRight');
    eq((await est()).paso, 2, `${nombre}: la flecha derecha avanza`);
    await page.keyboard.press('End');
    eq((await paso()).tipo, 'final', `${nombre}: Fin lleva al resultado`);
    ok((await page.locator('.rv-texto').innerText()).includes('Sin el if de jammed'), `${nombre}: el resultado compara con la variante sin jammed`);
    await page.keyboard.press('Home');

    // Tramo del atasco de LAU-02 en el programa de LAU-01: se ve que lee LAU_02.jammed === true.
    await page.evaluate(() => { const d = window.__revision.datos['LAU-01']; const f = d.fases.find(x => x.tono === 'otra'); document.querySelector(`.rv-tramo[data-fase="${f.i}"]`).click(); });
    const p1 = await paso();
    eq([p1.tipo, p1.t], ['fase', 25], `${nombre}: tocar el tramo cian lleva al resumen de 25 s`);
    const texto = await page.locator('.rv-texto').innerText();
    ok(/LAU-02 está atascado/.test(texto) && /REP-01 repara LAU-02/.test(texto), `${nombre}: el resumen cuenta el atasco y la reparación`);
    ok(/REP-01 reparando LAU-02/i.test(await page.locator('.rv-estado').innerText()), `${nombre}: el estado muestra al reparador ocupado`);

    // Cambiar de programa conserva el momento de la partida.
    await page.click('[data-prog="LAU-02"]');
    const p2 = await paso();
    ok((await est()).prog === 'LAU-02' && p2.t <= 25 && p2.t >= 24, `${nombre}: al pasar a LAU-02 sigue cerca de los 25 s (${p2.t} s)`);
    eq(await page.locator('.rv-pre').innerText().then(t => t.includes('LAU_01.jammed')), true, `${nombre}: el código ahora es el de LAU-02`);
    await page.click('[data-prog="LAU-01"]');

    // Tocar el código explica el fragmento; otra vez, lo que lo contiene.
    const tocar = (txt) => page.evaluate((t) => { const s = [...document.querySelectorAll('.rv-pre [data-n]')].find(x => x.textContent === t); s.querySelector('span:not([data-n])') ? s.querySelector('span:not([data-n])').click() : s.click(); }, txt);
    await tocar('jammed');
    eq(await page.locator('.rv-que-etiqueta').innerText(), 'PROPIEDAD DE OTRA MÁQUINA: LAU-02', `${nombre}: tocar «jammed» explica LAU_02.jammed`);
    ok((await page.locator('.rv-que').innerText()).includes('En este tramo: true'), `${nombre}: con su valor en este tramo`);
    await tocar('jammed');
    eq(await page.locator('.rv-que-etiqueta').innerText(), 'DECISIÓN IF', `${nombre}: otro toque sube al if que lo contiene`);
    await page.keyboard.press('Escape');
    eq(await page.locator('.rv-que').isHidden(), true, `${nombre}: Escape cierra la tarjeta`);
    await tocar('"stealth"');
    ok((await page.locator('.rv-que').innerText()).includes('dron frío'), `${nombre}: un argumento se explica con su significado`);
    await page.click('[data-accion="cerrar-que"]');

    // Un fragmento de la explicación señala su sitio en el código.
    await page.locator('.rv-texto .rv-chip').first().click();
    eq(await page.locator('.rv-pre .rv-ref').count(), 1, `${nombre}: tocar un fragmento de la explicación lo señala en el código`);
    await page.click('[data-accion="cerrar-que"]');

    // Avance automático.
    await page.click('[data-accion="auto"]');
    eq(await page.getAttribute('[data-accion="auto"]', 'data-play'), 'true', `${nombre}: ▶ empieza a avanzar solo`);
    await page.click('[data-accion="auto"]');

    // Sin desplazamiento lateral y sin errores.
    eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${nombre}: sin desplazamiento lateral`);
    eq(errores, [], `${nombre}: sin errores en la consola`);
    await page.close();
  }
  console.log(`interfaz: ${n} comprobaciones`);
} finally {
  await navegador.close();
  servidor.close();
}
