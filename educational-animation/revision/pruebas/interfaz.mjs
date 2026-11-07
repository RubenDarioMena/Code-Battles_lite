// Prueba de la interfaz del modo revisión en Chromium (PC 1280×800 y teléfono 390×844).
// node educational-animation/revision/pruebas/interfaz.mjs
// Usa un servidor propio en el puerto 8793. Primero el recorrido de lectura (por defecto): una frase por fila,
// el tiempo de lectura de cada paso, las velocidades, ✕ que oculta el texto y deja la selección, y la tarjeta
// corta en el teléfono. Después la traza (?modo=traza) con los tres ejemplos y «tu código»: pasos, la pareja
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
    const abrir = async (ej, modo = 'traza') => { await page.goto(`http://127.0.0.1:8793/educational-animation/revision/?ej=${ej}${modo === 'traza' ? '&modo=traza' : ''}`); await page.waitForFunction(() => window.__revision && document.querySelector('.rv-rejilla .rv-nodo')); };
    const est = () => page.evaluate(() => window.__revision.estado);
    // La fila activa y su fragmento de código llevan el mismo color.
    const pareja = () => page.evaluate(() => {
      const fila = document.querySelector('.rv-fila[data-activa], .rv-lado[data-activa]');
      const anillo = document.querySelector('.rv-pre .rv-anillo');
      return { num: fila && fila.querySelector('.rv-num').textContent, fila: fila && fila.style.getPropertyValue('--c'), codigo: anillo && anillo.style.getPropertyValue('--c'), margen: [...document.querySelectorAll('.rv-num-margen[data-activa]')].map(x => x.textContent) };
    });
    const etiqueta = (num) => page.evaluate((num) => { const x = [...document.querySelectorAll('.rv-nodo')].find(b => b.querySelector('.rv-num').textContent === String(num)); return x && x.querySelector('.rv-et').textContent; }, num);

    // ---------- Recorrido de lectura (por defecto): el código explicado fila a fila, sin ejecutarlo ----------
    await abrir('reto-5', 'lectura');
    let e = await est();
    eq([e.modo, e.total, e.paso, e.vel, e.texto], ['lectura', 9, 0, 1, true], `${nombre}: lectura del reto 5: 8 filas y el final, a 1× y con texto`);
    ok((await page.locator('.rv-narra-txt').innerText()).includes('Repite las filas 2 a 8 sin fin'), `${nombre}: la fila 1 dice qué repite`);
    eq(await page.locator('.rv-donde').innerText(), 'paso 1 de 9', `${nombre}: dónde está`);
    eq(await page.locator('.rv-tramo').count(), 8, `${nombre}: un tramo por fila en la franja`);
    eq(await page.evaluate(() => [...document.querySelectorAll('.rv-tramo')].map(x => x.style.getPropertyValue('--c')).join()), await page.evaluate(() => window.__revision.datos['LAU-01'].F.filas.map(f => f.color).join()), `${nombre}: cada tramo con el color de su fila`);
    await page.click('[data-accion="despues"]');
    ok((await page.locator('.rv-narra-txt').innerText()).includes('Guarda en pos lo primero que no sea null'), `${nombre}: la fila 2 dice qué guarda`);
    await page.evaluate(() => window.__revision.ir(2));
    ok((await page.locator('.rv-narra-txt').innerText()).includes('Si LAU-02 está atascado, sigue en 4; si no, prueba 5.'), `${nombre}: la decisión dice adónde va con true y con false`);
    await page.evaluate(() => window.__revision.ir(8));
    ok((await page.locator('.rv-narra-txt').innerText()).includes('mientras dure la partida'), `${nombre}: el final explica que el bucle no acaba solo`);
    // Tiempo de lectura: ≈ 21,8 caracteres por segundo y un 15 % más (mínimo 1,2 s), dividido por la velocidad.
    const esperado = await page.evaluate(() => Math.max(1.2, document.querySelector('.rv-narra-txt').textContent.replace(/\s+/g, ' ').trim().length / (238 * 5.5 / 60)) * 1.15 * 1000);
    ok(Math.abs(await page.evaluate(() => window.__revision.duracion()) - esperado) < 1, `${nombre}: a 1×, el paso dura su tiempo de lectura (${Math.round(esperado)} ms)`);
    const velocidades = [];
    for (let k = 0; k < 7; k++) { await page.click('[data-accion="vel"]'); velocidades.push(await page.locator('.rv-vel').innerText()); }
    eq(velocidades, ['1,25×', '1,5×', '2×', '4×', '0,5×', '0,75×', '1×'], `${nombre}: velocidades 0,5× 0,75× 1× 1,25× 1,5× 2× 4×`);
    await page.evaluate(() => window.__revision.cambiarVelocidad(1)); await page.evaluate(() => window.__revision.cambiarVelocidad(1)); await page.evaluate(() => window.__revision.cambiarVelocidad(1));
    eq((await est()).vel, 2, `${nombre}: a 2×`);
    ok(Math.abs(await page.evaluate(() => window.__revision.duracion()) - esperado / 2) < 1, `${nombre}: a 2×, la mitad`);
    await page.evaluate(() => { window.__revision.cambiarVelocidad(-1); window.__revision.cambiarVelocidad(-1); window.__revision.cambiarVelocidad(-1); });
    // Una tarjeta del juego: lo secundario plegado, sin cuentas de ejecución.
    await page.evaluate(() => window.__revision.ir(3));
    await page.locator('.rv-pre .fn', { hasText: 'regularShoot' }).first().click();
    eq(await page.locator('.rv-narra .rv-mas:not([open])').count(), 1, `${nombre}: la tarjeta de regularShoot pliega sus detalles`);
    ok(!(await page.locator('.rv-narra').innerText()).includes('Se ejecutó'), `${nombre}: sin cuentas: no se ejecutó nada`);
    const alto = (await page.locator('.rv-narra').boundingBox()).height;
    ok(alto < 150, `${nombre}: la tarjeta es corta (${Math.round(alto)} px)`);
    await page.locator('.rv-narra .rv-mas summary').click();
    ok((await page.locator('.rv-narra .rv-mas').innerText()).includes('Puede devolver'), `${nombre}: y al abrirla, lo que puede devolver`);
    // ✕ oculta el texto pero deja la selección en el código y en el diagrama.
    await page.locator('.rv-narra .rv-cerrar').click();
    eq([await page.locator('.rv-narra').isVisible(), (await est()).texto], [false, false], `${nombre}: ✕ oculta el texto`);
    ok(await page.locator('.rv-pre .rv-sel').count() === 1 && await page.locator('.rv-flujo [data-foco]').count() >= 1, `${nombre}: la selección se queda en los dos lados`);
    eq(await page.locator('.rv-texto').getAttribute('aria-pressed'), 'false', `${nombre}: el botón del texto queda apagado`);
    await page.locator('.rv-pre .fn', { hasText: 'burstFire' }).click();
    ok(await page.evaluate(() => document.querySelector('.rv-pre .rv-sel').textContent.startsWith('burstFire')) && !(await page.locator('.rv-narra').isVisible()), `${nombre}: sin texto, tocar solo selecciona`);
    eq(await page.evaluate(() => window.__revision.duracion()), 1.2 * 1.15 * 1000, `${nombre}: sin texto, el paso dura el mínimo`);
    await page.click('[data-accion="texto"]');
    ok((await page.locator('.rv-narra').innerText()).includes('burstFire'), `${nombre}: el botón vuelve a mostrar el texto, con la tarjeta de lo seleccionado`);
    await page.keyboard.press('Escape');
    eq(await page.locator('.rv-pre .rv-sel').count(), 0, `${nombre}: Esc quita la selección`);
    // ▶ avanza solo (a 4×, para no esperar).
    await page.evaluate(() => { window.__revision.ir(0); for (let k = 0; k < 3; k++) window.__revision.cambiarVelocidad(-1); });
    eq((await est()).vel, 4, `${nombre}: a 4×`);
    await page.click('[data-accion="auto"]');
    await page.waitForTimeout(3400);
    ok((await est()).paso >= 2, `${nombre}: ▶ avanza solo al ritmo de lectura`);
    await page.click('[data-accion="auto"]');
    await page.evaluate(() => { window.__revision.cambiarVelocidad(1); window.__revision.cambiarVelocidad(1); window.__revision.cambiarVelocidad(1); });
    eq((await est()).vel, 1, `${nombre}: de vuelta a 1×`);
    // Tu código: se lee sin ejecutarse (un bucle sin fin no cuelga nada).
    await page.selectOption('.rv-ejemplos', 'tuyo');
    await page.waitForSelector('dialog.tuyo[open]');
    eq(await page.locator('dialog.tuyo button[value="ok"]').innerText(), 'Revisar', `${nombre}: tu código: «Revisar», sin ejecutar`);
    await page.fill('dialog.tuyo textarea', 'while (true) {\n  console.log("hola")\n}');
    await page.click('dialog.tuyo button[value="ok"]');
    await page.waitForFunction(() => window.__revision && window.__revision.datos.programa && window.__revision.datos.programa.P.fuente.startsWith('while (true)'));
    eq((await est()).total, 3, `${nombre}: un bucle sin fin se lee en 3 pasos`);

    // ---------- Seis cafés (traza) ----------
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
    await page.keyboard.press('Escape');
    // Franja de tiempo: tocar salta a esa vuelta.
    const caja = await page.locator('.rv-tramos').boundingBox();
    await page.mouse.click(caja.x + caja.width * 0.62, caja.y + caja.height / 2);
    const v = await page.evaluate(() => window.__revision.paso().vuelta);
    ok(v >= 4 && v <= 6, `${nombre}: tocar la franja lleva a una vuelta de en medio (${v})`);
    eq(await page.evaluate(() => window.__revision.datos.programa.F.filas[window.__revision.paso().fila].num), 2, `${nombre}: y empieza esa vuelta por su condición`);
    // Idioma: cambia al momento.
    eq(await page.locator('[data-idioma-interfaz]').count(), 0, `${nombre}: sin selector ES/EN; el idioma es el de la interfaz del juego`);
    await page.evaluate(() => CMGI18n.cambiarIdioma('en'));
    eq(await etiqueta(2), 'Is drinkCoffee less than 10?', `${nombre}: en inglés, la fila 2 pregunta en inglés`);
    ok((await page.locator('.rv-narra').innerText()).includes('Starts pass'), `${nombre}: y la narración también`);
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
    eq(await etiqueta(2), '¿drinkCoffee es menor que 10?', `${nombre}: de vuelta al español`);
    // Avance solo (a 2×; las vueltas que repiten camino pasan de corrido).
    await page.evaluate(() => { window.__revision.ir(0); window.__revision.cambiarVelocidad(1); window.__revision.cambiarVelocidad(1); window.__revision.cambiarVelocidad(1); });
    await page.click('[data-accion="auto"]');
    await page.waitForTimeout(2600);
    ok((await est()).paso >= 2, `${nombre}: ▶ avanza solo`);
    await page.click('[data-accion="auto"]');
    await page.evaluate(() => { window.__revision.cambiarVelocidad(-1); window.__revision.cambiarVelocidad(-1); window.__revision.cambiarVelocidad(-1); });
    eq((await est()).auto, false, `${nombre}: y se pausa`);
    eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${nombre}: sin desplazamiento horizontal`);

    // Barra: los símbolos del juego (mapa y </>), como en las otras pantallas.
    eq(await page.locator('.rv-barra [data-accion="mapa"] svg').count(), 1, `${nombre}: botón del mundo (montaña)`);
    eq(await page.locator('.rv-barra [data-accion="codigo"]').innerText(), '</>', `${nombre}: botón </> del código normal`);
    // Disposición: en PC, código a la izquierda y diagrama a la derecha; en el teléfono, apilados.
    const lado = nombre === 'PC';
    eq((await est()).disposicion, lado ? 'lado' : 'apilado', `${nombre}: disposición ${lado ? 'código | diagrama' : 'código sobre diagrama'}`);
    const [bc, bf] = await Promise.all([page.locator('.rv-codigo').boundingBox(), page.locator('.rv-flujo').boundingBox()]);
    ok(lado ? bc.x + bc.width <= bf.x + 1 && Math.abs(bc.y - bf.y) < 2 : bc.y + bc.height <= bf.y + 1, `${nombre}: el diagrama está ${lado ? 'a la derecha' : 'debajo'} del código`);
    eq(await page.locator('.rv-junto').count(), 0, `${nombre}: sin botón «junto» (el modo mapa/código/diagrama se quitó)`);
    // Asa: arrastrar hasta el extremo deja el diagrama a pantalla completa; doble clic vuelve.
    const asa = await page.locator('.rv-asa').boundingBox();
    const tamFlujo = async () => { const b = await page.locator('.rv-flujo').boundingBox(); return lado ? b.width : b.height; };
    const tamCodigo = async () => { const b = await page.locator('.rv-codigo').boundingBox(); return lado ? b.width : b.height; };
    const arrastrar = async (de, dx, dy) => { await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2); await page.mouse.down(); await page.mouse.move(de.x + de.width / 2 + dx, de.y + de.height / 2 + dy, { steps: 6 }); await page.mouse.up(); };
    const antesFlujo = await tamFlujo();
    await arrastrar(asa, lado ? 60 : 0, lado ? 0 : 60);
    ok(await tamFlujo() < antesFlujo - 40, `${nombre}: mover el asa hacia el diagrama da más espacio al código`);
    const asa2 = await page.locator('.rv-asa').boundingBox();
    await arrastrar(asa2, lado ? -asa2.x + 4 : 0, lado ? 0 : -asa2.y + 20);
    eq((await est()).pleno, true, `${nombre}: en el extremo, el diagrama ocupa toda la pantalla`);
    eq(Math.round(await tamCodigo()), 0, `${nombre}: y el código no ocupa nada`);
    ok(await tamFlujo() > antesFlujo + 100, `${nombre}: el diagrama crece`);
    await page.reload();
    await page.waitForFunction(() => window.__revision && document.querySelector('.rv-rejilla .rv-nodo'));
    eq((await est()).pleno, true, `${nombre}: el reparto se recuerda al volver`);
    await page.locator('.rv-asa').dblclick();
    ok(!(await est()).pleno && await tamCodigo() > 100, `${nombre}: doble clic en el asa devuelve el código`);
    await page.evaluate(() => window.__revision.fijarReparto(null));

    // Mantener pulsado 1,2 s en el diagrama abre la documentación, tapando el código.
    const pulsar = async (loc, ms) => { const b = await loc.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };
    const fila4 = page.locator('.rv-fila[data-fila] > .rv-nodo').filter({ hasText: 'vale 8' });
    await pulsar(fila4, 500);
    eq(await page.locator('.rv-doc').isVisible(), false, `${nombre}: una pulsación corta no abre la documentación`);
    await page.keyboard.press('Escape');
    await pulsar(fila4, 1350);
    ok(await page.locator('.rv-doc').isVisible(), `${nombre}: mantener pulsado 1,2 s abre la documentación`);
    eq(await page.locator('.rv-doc-texto').innerText(), 'IF: PLACEHOLDER', `${nombre}: de un if, «IF: PLACEHOLDER»`);
    eq(await page.locator('.rv-narra[data-foco]').count(), 0, `${nombre}: soltar no abre además la tarjeta de la fila`);
    const [doc, cod] = await Promise.all([page.locator('.rv-doc').boundingBox(), page.locator('.rv-codigo').boundingBox()]);
    ok(doc.y <= cod.y + 1 && doc.y + doc.height >= cod.y + cod.height - 1, `${nombre}: la documentación tapa el código`);
    await page.keyboard.press('Escape');
    eq(await page.locator('.rv-doc').isVisible(), false, `${nombre}: Esc la cierra`);
    await pulsar(page.locator('.rv-lado .rv-nodo').filter({ hasText: 'break' }), 1350);
    eq(await page.locator('.rv-doc-titulo').innerText(), 'BREAK', `${nombre}: la de break`);
    await page.evaluate(() => CMGI18n.cambiarIdioma('en'));
    eq(await page.locator('.rv-doc-texto').innerText(), 'BREAK: PLACEHOLDER', `${nombre}: y cambia de idioma abierta`);
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
    await page.locator('.rv-doc .rv-cerrar').click();
    eq(await page.locator('.rv-doc').isVisible(), false, `${nombre}: ✕ la cierra`);

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
    await page.locator('.rv-narra .rv-mas summary').click();
    ok((await page.locator('.rv-narra').innerText()).includes('otra máquina'), `${nombre}: tocar jammed explica (en «Más detalles») que es de otra máquina`);
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
