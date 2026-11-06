// Prueba de la interfaz del modo revisión en Chromium (PC 1280×800 y teléfono 390×844).
// node educational-animation/revision/pruebas/interfaz.mjs
// Usa un servidor propio en el puerto 8793. Recorre los tres ejemplos y «tu código»: pasos, la pareja
// código↔fila con el mismo color, tocar y señalar, la franja de tiempo, el idioma y el avance solo.
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
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const navegador = await chromium.launch();
try {
  for (const [nombre, ctx] of [['PC', { viewport: { width: 1280, height: 800 } }], ['teléfono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const contexto = await navegador.newContext(ctx);
    await contexto.addInitScript(() => localStorage.setItem('cmg-interfaz-idioma', 'es'));
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    const abrir = async (ej) => { await page.goto(`http://127.0.0.1:8793/educational-animation/revision/?ej=${ej}`); await page.waitForFunction(() => window.__revision && document.querySelector('.rv-rejilla .rv-nodo')); };
    const est = () => page.evaluate(() => window.__revision.estado);
    // La fila activa y su fragmento de código llevan el mismo color.
    const pareja = () => page.evaluate(() => {
      const fila = document.querySelector('.rv-fila[data-activa], .rv-lado[data-activa]');
      const anillo = document.querySelector('.rv-pre .rv-anillo');
      return { num: fila && fila.querySelector('.rv-num').textContent, fila: fila && fila.style.getPropertyValue('--c'), codigo: anillo && anillo.style.getPropertyValue('--c'), margen: [...document.querySelectorAll('.rv-num-margen[data-activa]')].map(x => x.textContent) };
    });
    const etiqueta = (num) => page.evaluate((num) => { const x = [...document.querySelectorAll('.rv-nodo')].find(b => b.querySelector('.rv-num').textContent === String(num)); return x && x.querySelector('.rv-et').textContent; }, num);

    // ---------- Seis cafés ----------
    await abrir('cafes');
    eq(await page.locator('.rv-rejilla .rv-nodo').count(), 8, `${nombre}: los cafés tienen 8 filas (6 en la columna y 2 al lado)`);
    eq(await page.locator('.rv-num-margen').count(), 8, `${nombre}: cada fila tiene su número en el margen del código`);
    eq(await etiqueta(4), '¿drinkCoffee vale 8?', `${nombre}: la fila 4 pregunta «¿vale 8?»`);
    eq(await page.locator('.rv-caja-fin').count(), 1, `${nombre}: el while sale a «Fin del bucle»`);
    ok(await page.evaluate(() => document.querySelector('.rv-riel').getAttribute('d').split('M').length - 1 === 2), `${nombre}: dos flechas de vuelta al while`);
    await page.click('[data-accion="despues"]');
    eq((await est()).paso, 1, `${nombre}: › avanza un paso`);
    let pa = await pareja();
    ok(pa.num === '2' && pa.fila && pa.fila === pa.codigo && pa.margen.includes('2'), `${nombre}: la fila 2, su código y su número del margen se iluminan con el mismo color`);
    await page.keyboard.press('ArrowRight');
    eq((await est()).paso, 2, `${nombre}: la flecha derecha avanza`);
    await page.evaluate(() => window.__revision.ir(31));
    ok((await page.locator('.rv-narra').innerText()).includes('Entra en la vuelta 7'), `${nombre}: la narración cuenta la vuelta con sus valores`);
    eq(await page.locator('.rv-donde').innerText(), 'vuelta 7 de 8', `${nombre}: dónde está, bajo la franja de tiempo`);
    ok(await page.evaluate(() => document.querySelectorAll('.rv-fila[data-vista]').length === 1), `${nombre}: al empezar la vuelta solo está encendida su primera fila`);
    // Tocar el código ilumina su fila y dice qué es; otro toque sube.
    await page.locator('.rv-pre .kw', { hasText: 'break' }).click();
    eq(await page.evaluate(() => { const x = document.querySelector('.rv-lado[data-foco]'); return x && x.querySelector('.rv-num').textContent; }), '5', `${nombre}: tocar break ilumina la fila 5`);
    ok((await page.locator('.rv-narra').innerText()).includes('Sale del bucle'), `${nombre}: y explica qué hace break`);
    await page.keyboard.press('Escape');
    eq(await page.locator('[data-foco]:not(.rv-narra)').count(), 0, `${nombre}: Esc quita el foco`);
    await page.locator('.rv-pre .var', { hasText: 'drinkCoffee' }).nth(1).click();
    ok((await page.locator('.rv-narra').innerText()).includes('variable'), `${nombre}: tocar una variable la explica`);
    await page.locator('.rv-pre .var', { hasText: 'drinkCoffee' }).nth(1).click();
    ok((await page.locator('.rv-narra .rv-narra-tipo').innerText()) === 'comparación', `${nombre}: otro toque sube a la comparación que la contiene`);
    // Tocar una fila ilumina su código.
    await page.locator('.rv-fila[data-fila] > .rv-nodo').filter({ hasText: 'Suma 1' }).click();
    eq(await page.evaluate(() => document.querySelector('.rv-pre .rv-sel').textContent.trim()), 'drinkCoffee = drinkCoffee + 1', `${nombre}: tocar «Suma 1» ilumina su línea de código`);
    ok((await page.locator('.rv-narra').innerText()).includes('Se ejecutó 8 veces'), `${nombre}: y dice cuántas veces se ejecutó`);
    await page.locator('.rv-cerrar').click();
    // Franja de tiempo: tocar salta a esa vuelta.
    const caja = await page.locator('.rv-tramos').boundingBox();
    await page.mouse.click(caja.x + caja.width * 0.62, caja.y + caja.height / 2);
    const v = await page.evaluate(() => window.__revision.paso().vuelta);
    ok(v >= 4 && v <= 6, `${nombre}: tocar la franja lleva a una vuelta de en medio (${v})`);
    eq(await page.evaluate(() => window.__revision.datos.programa.F.filas[window.__revision.paso().fila].num), 2, `${nombre}: y empieza esa vuelta por su condición`);
    // Idioma: cambia al momento.
    await page.click('[data-idioma-interfaz="en"]');
    eq(await etiqueta(2), 'Is drinkCoffee less than 10?', `${nombre}: en inglés, la fila 2 pregunta en inglés`);
    ok((await page.locator('.rv-narra').innerText()).includes('Starts pass'), `${nombre}: y la narración también`);
    await page.click('[data-idioma-interfaz="es"]');
    eq(await etiqueta(2), '¿drinkCoffee es menor que 10?', `${nombre}: de vuelta al español`);
    // Avance solo.
    await page.evaluate(() => window.__revision.ir(0));
    await page.click('[data-accion="auto"]');
    await page.waitForTimeout(2600);
    ok((await est()).paso >= 2, `${nombre}: ▶ avanza solo`);
    await page.click('[data-accion="auto"]');
    eq((await est()).auto, false, `${nombre}: y se pausa`);
    eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${nombre}: sin desplazamiento horizontal`);

    // ---------- Reto 5 ----------
    await abrir('reto-5');
    eq(await etiqueta(3), '¿LAU-02 está atascado?', `${nombre}: reto 5, LAU-01 pregunta por LAU-02`);
    await page.evaluate(() => window.__revision.ir(600));
    const t1 = await page.evaluate(() => window.__revision.paso().t);
    await page.click('[data-prog="LAU-02"]');
    eq((await est()).prog, 'LAU-02', `${nombre}: cambia al programa de LAU-02`);
    const t2 = await page.evaluate(() => window.__revision.paso().t);
    ok(Math.abs(t2 - t1) <= 0.25, `${nombre}: en el mismo momento de la partida (${t1} → ${t2} s)`);
    eq(await etiqueta(3), '¿LAU-01 está atascado?', `${nombre}: LAU-02 pregunta por LAU-01`);
    await page.locator('.rv-pre .prop', { hasText: 'jammed' }).click();
    ok((await page.locator('.rv-narra').innerText()).includes('otra máquina'), `${nombre}: tocar jammed explica que es de otra máquina`);
    eq(await page.evaluate(() => document.querySelector('.rv-pre .rv-sel').textContent), 'LAU_01.jammed', `${nombre}: y señala LAU_01.jammed entero`);
    eq(await page.locator('.rv-hito').count(), 4, `${nombre}: la franja marca 2 atascos y 2 reparaciones`);
    if (nombre === 'PC') {
      await page.keyboard.press('Escape');
      await page.locator('.rv-pre .fn', { hasText: 'burstFire' }).hover();
      eq(await page.evaluate(() => { const x = document.querySelector('[data-señal] .rv-num'); return x && x.textContent; }), '6', 'PC: señalar burstFire con el ratón ilumina su fila');
      await page.locator('.rv-nodo').filter({ hasText: 'Espera 0,25 s' }).hover();
      eq(await page.evaluate(() => document.querySelector('.rv-pre .rv-señal').textContent), 'await esperar(0.25)', 'PC: señalar una fila ilumina su código');
    }

    // ---------- Tu código ----------
    await page.selectOption('.rv-ejemplos', 'tuyo');
    await page.waitForSelector('dialog.tuyo[open]');
    await page.fill('dialog.tuyo textarea', 'let x = 3\nwhile (x > 0) {\n  x = x - 1\n}\nconsole.log("listo")');
    await page.click('dialog.tuyo button[value="ok"]');
    await page.waitForFunction(() => window.__revision && window.__revision.datos.programa && window.__revision.datos.programa.P.fuente.startsWith('let x = 3'));
    eq(await etiqueta(3), 'Resta 1 a x', `${nombre}: tu código se explica solo («Resta 1 a x»)`);
    eq(await page.evaluate(() => window.__revision.datos.programa.R.vueltas.length), 3, `${nombre}: con sus 3 vueltas`);
    await page.selectOption('.rv-ejemplos', 'tuyo');
    await page.fill('dialog.tuyo textarea', 'if (');
    await page.click('dialog.tuyo button[value="ok"]');
    await page.waitForFunction(() => { const x = document.querySelector('dialog.tuyo[open] .error'); return !!x && x.textContent.length > 0; });
    ok((await page.locator('dialog.tuyo .error').innerText()).startsWith('No se puede leer el programa'), `${nombre}: un error de sintaxis se avisa sin romper nada`);
    await page.click('dialog.tuyo button[value="no"]');

    eq(errores, [], `${nombre}: sin errores en la página`);
    await contexto.close();
  }
  console.log(`interfaz: ${n} comprobaciones`);
} finally {
  await navegador.close();
  servidor.close();
}
