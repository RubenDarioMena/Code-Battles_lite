// Laboratorio de batalla en el navegador: arranque, clics reales sobre el campo, elección de unidades,
// reprogramar en caliente, pausa, repetición y teléfono. Las reglas se prueban sin navegador en lab-batalla.cjs.
import assert from 'node:assert/strict';
export async function probarLabBatalla(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`OK ${++checks}: ${msg}`); };
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK ${++checks}: ${msg}`); };
  const url = `${origen}/laboratorio/batalla/`;
  const listo = () => page.waitForFunction(() => window.__labListo === true);
  // Punto de pantalla de una casilla del mundo, según la cámara del plano.
  const pantalla = (x, y) => page.evaluate(([x, y]) => {
    const r = document.getElementById('lienzo').getBoundingClientRect(), v = window.__lab.vista, a = v.aMundo(0, 0), T = v.escala;
    return { x: r.left + (x - a.x) * T, y: r.top + (y - a.y) * T };
  }, [x, y]);
  const clicMundo = async (x, y) => { const p = await pantalla(x, y); await page.mouse.click(p.x, p.y); };
  const hasta = (t) => page.waitForFunction((t) => window.__lab.mundo.t >= t || !!window.__lab.mundo.fin, t, { timeout: 60000 });
  const escribir = (texto) => page.evaluate((texto) => { const c = document.querySelector('#editor-raiz textarea'); c.value = texto; c.dispatchEvent(new Event('input', { bubbles: true })); }, texto);

  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await page.goto(url + '?prueba=4'); await listo();
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('cbl-lab-batalla:')) localStorage.removeItem(k); });
  await page.reload(); await listo();
  eq(await page.evaluate(() => [document.querySelectorAll('#escenario option').length, document.querySelector('#p-titulo').textContent]), [5, '4 · Órdenes'], 'el laboratorio ofrece cinco pruebas y abre la pedida en la URL');
  ok(await page.evaluate(() => document.querySelector('#editor-raiz textarea').value.includes('terrain.onClick') && document.querySelectorAll('#editor-raiz .paleta .atajo').length > 12), 'el editor compartido muestra el programa de la unidad y la paleta con las órdenes del laboratorio');
  eq(await page.evaluate(() => [...document.querySelectorAll('#pestanas .pestana')].map(b => b.textContent)), ['TUR-01', 'TUR-02', 'VEH-01', 'VEH-02', 'WHL-01', 'WHL-02'], 'cada unidad programable tiene su pestaña (el radar no)');

  // Sin ejecutar, un clic en el terreno no es una orden.
  await clicMundo(20, 6);
  eq(await page.evaluate(() => [window.__lab.mundo.nClics, document.getElementById('aviso-campo').hidden]), [0, false], 'antes de ejecutar, tocar el campo solo avisa');

  // Batalla: clic real en el terreno → los vehículos que escuchan ponen rumbo allí.
  await page.click('#b-ejecutar');
  await page.waitForFunction(() => window.__lab.rt && window.__lab.rt.oyen('click').length === 4);
  eq(await page.evaluate(() => [...document.querySelectorAll('#destinatarios .chip[data-oye="true"]')].map(b => b.dataset.id)), ['VEH-01', 'VEH-02', 'WHL-01', 'WHL-02'], 'las unidades cuyo programa escucha clics se señalan en la fila de destinatarios');
  await clicMundo(20, 6);
  await page.waitForFunction(() => window.__lab.mundo.porId['VEH-01'].moviendo && window.__lab.mundo.porId['VEH-02'].moviendo);
  eq(await page.evaluate(() => { const m = window.__lab.mundo, d = m.porId['VEH-01'].destino; return [m.nClics, Math.round(d.x), Math.round(d.y)]; }), [1, 20, 6], 'un clic real en el terreno llega a los programas y mueve los vehículos a ese punto');

  // Tocar una unidad propia la elige: el siguiente clic solo llega a ella.
  await page.click('#b-pausa');
  const v2 = await page.evaluate(() => { const u = window.__lab.mundo.porId['VEH-02']; return { x: u.cx, y: u.cy }; });
  await clicMundo(v2.x, v2.y);
  eq(await page.evaluate(() => [[...window.__lab.seleccion], document.querySelector('.pestana[aria-selected="true"]').dataset.id, window.__lab.mundo.nClics]), [['VEH-02'], 'VEH-02', 1], 'tocar una unidad propia la elige y abre su programa, sin contar como orden');
  const tPausa = await page.evaluate(() => window.__lab.mundo.t);
  await clicMundo(30, 22);
  await page.waitForTimeout(300);
  eq(await page.evaluate((t) => [window.__lab.mundo.t === t, window.__lab.mundo.nClics], tPausa), [true, 1], 'en pausa el mundo no avanza y el clic queda en espera');
  await page.click('#b-pausa');
  await page.waitForFunction(() => window.__lab.mundo.nClics === 2);
  await page.waitForTimeout(250);
  eq(await page.evaluate(() => { const m = window.__lab.mundo, a = m.porId['VEH-01'].destino, b = m.porId['VEH-02'].destino; return [Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y)]; }), [20, 6, 30, 22], 'al reanudar, el clic llega solo a la unidad elegida');

  // Clic sobre un enemigo: queda marcado.
  await page.click('#destinatarios .chip[data-id=""]');
  await page.waitForFunction(() => window.__lab.mundo.enemigos.some(e => e.x < 44));
  await page.click('#b-pausa');
  const en = await page.evaluate(() => { const e = window.__lab.mundo.enemigos.find(e => e.x < 44); return { id: e.id, x: e.x, y: e.y }; });
  await clicMundo(en.x, en.y);
  await page.click('#b-pausa');
  await page.waitForFunction(() => window.__lab.mundo.nClics === 3);
  eq(await page.evaluate((id) => [window.__lab.sim.marcado(window.__lab.mundo.enemigos.find(e => e.id === id)), window.__lab.mundo.entradas[2].clic.enemigo], en.id), [true, en.id], 'un clic real sobre un enemigo lo marca y se graba');

  // Reprogramar en caliente desde el editor.
  await page.click('.pestana[data-id="TUR-01"]');
  await escribir('console.log("hola desde la torreta");\nwhile (true) {\n  regularShoot(autoTarget());\n  await wait(0.4);\n}\n');
  await page.click('#b-aplicar');
  await page.waitForFunction(() => [...document.querySelectorAll('#consola .linea .texto')].some(n => n.textContent.includes('hola desde la torreta')));
  ok(await page.evaluate(() => window.__lab.mundo.entradas.some(e => e.programa && e.programa.id === 'TUR-01') && !window.__lab.mundo.fin), '«Aplicar ahora» reinicia solo esa unidad con el código del editor, sin parar la batalla');

  // Un error se enseña en la pestaña y no detiene la batalla.
  await escribir('await wait(0.2);\nmoveTo({ x: 9, y: 9 });\n');
  await page.click('#b-aplicar');
  await page.waitForFunction(() => document.querySelector('.pestana[data-id="TUR-01"]').dataset.estado === 'error');
  ok(await page.evaluate(() => /línea 2/.test(document.getElementById('prog-de').textContent) && !window.__lab.mundo.fin && window.__lab.rt.progs.get('VEH-01').estado === 'vivo'), 'el error de un programa aparece con su línea y las demás unidades siguen');
  await page.click('#b-restaurar');
  ok(await page.evaluate(() => document.querySelector('#editor-raiz textarea').value.startsWith('// Torreta del muro')), '«Restaurar» devuelve el programa de partida');

  // Detener y repetir los mismos clics.
  const grabadas = await page.evaluate(() => window.__lab.mundo.entradas.length);
  await page.click('#b-ejecutar');
  eq(await page.evaluate(() => [window.__lab.mundo.t, window.__lab.mundo.activo, document.getElementById('b-repetir').hidden]), [0, false, false], 'detener deja el campo como al principio y ofrece repetir los clics');
  await page.evaluate(() => window.__lab.velocidad(4));
  await page.click('#b-repetir');
  await page.waitForFunction((n) => window.__lab.mundo.entradas.length === n, grabadas, { timeout: 60000 });
  ok(await page.evaluate(() => window.__lab.mundo.nClics === 3), 'la repetición vuelve a mandar los mismos clics en los mismos pasos');
  await page.click('#b-ejecutar');

  // Una prueba completa a 4×: Rueda kamikaze se gana sola.
  await page.selectOption('#escenario', '1');
  await page.click('#b-ejecutar');
  await page.waitForFunction(() => !!window.__lab.mundo.fin, null, { timeout: 120000 });
  eq(await page.evaluate(() => [window.__lab.mundo.fin.resultado, document.getElementById('banner').hidden, document.querySelector('#banner h2').textContent]), ['victoria', false, 'Muro en pie'], 'la prueba de la rueda kamikaze termina en victoria y muestra el resumen');
  await page.evaluate(() => window.__lab.velocidad(1));

  // Lo escrito se conserva al recargar.
  await page.click('#banner [data-accion="cerrar"]');
  await page.click('.pestana[data-id="WHL-01"]');
  await escribir('// mi rueda\n');
  await page.goto(url); await listo();
  eq(await page.evaluate(() => [document.querySelector('#p-titulo').textContent, window.__lab.programas['WHL-01']]), ['2 · Rueda kamikaze', '// mi rueda\n'], 'la prueba elegida y los programas escritos se conservan al recargar');
  await page.click('.pestana[data-id="WHL-01"]'); await page.click('#b-restaurar');

  // Teléfono: sin desborde, un panel cada vez y toque en el campo.
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  await page.goto(url + '?prueba=3'); await listo();
  eq(await page.evaluate(() => [document.documentElement.scrollWidth <= innerWidth, getComputedStyle(document.querySelector('.panel-codigo')).display, getComputedStyle(document.querySelector('.paneles')).display !== 'none']), [true, 'none', true], 'en el teléfono no hay desborde y se ve un panel cada vez');
  ok(await page.evaluate(() => { const r = document.getElementById('lienzo').getBoundingClientRect(); return r.width > 340 && Math.abs(r.width / r.height - 48 / 27) < .05; }), 'en vertical el campo toma la forma del mapa');
  await page.click('.paneles [data-panel="codigo"]');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.panel-batalla')).display === 'none' && document.querySelector('#editor-raiz textarea').getBoundingClientRect().height > 150), 'el panel de código muestra el editor con sitio para escribir');
  await page.click('#b-ejecutar');
  ok(await page.evaluate(() => document.getElementById('lab').dataset.panel === 'batalla'), 'ejecutar vuelve al campo');
  await page.waitForFunction(() => window.__lab.mundo.enemigos.length > 0 && window.__lab.rt.oyen('click').length === 2);
  const p = await pantalla(24, 8);
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => window.__lab.mundo.nClics === 1);
  await page.waitForFunction(() => window.__lab.mundo.porId['TUR-01'].lugar);
  eq(await page.evaluate(() => { const l = window.__lab.mundo.porId['TUR-01'].lugar; return [Math.round(l.x), Math.round(l.y)]; }), [24, 8], 'un toque en el campo pide fuego a ese punto');
  await page.click('#b-ejecutar');
  await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log(`${checks} comprobaciones del laboratorio de batalla en navegador correctas`);
  return checks;
}
