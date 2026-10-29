import assert from 'node:assert/strict';
export async function probarEntrada(page, origen = 'http://127.0.0.1:8771/dist') {
  let checks = 0;
  const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); console.log(`OK ${++checks}: ${msg}`); };
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await page.goto(`${origen}/`);
  eq(await page.evaluate(() => [...document.querySelectorAll('.cuadro h2')].map(x => x.textContent.replace('↗', '').trim())), ['Factory', 'War', 'Campaign'], 'el paquete ofrece los tres destinos de la entrada');
  await page.click('.factory');
  await page.waitForFunction(() => !!window.cmg?.edicion && !!window.ESTRUCTURA && !!window.acorn);
  eq(await page.evaluate(() => document.title.includes('Factory')), true, 'Factory arranca con los módulos del paquete');
  await page.click('a[aria-label="Volver al inicio"]');
  await page.waitForSelector('.war'); await page.click('.war');
  await page.waitForFunction(() => !!window.cmg?.edicion && !!window.cmg?.seudo && !!window.THREE && !!window.acorn);
  eq(await page.evaluate(() => document.title.includes('War')), true, 'War arranca con los módulos del paquete');
  await page.click('a[aria-label="Volver al inicio"]');
  await page.waitForSelector('.campaign'); await page.click('.campaign');
  eq(await page.evaluate(() => document.querySelector('h1').textContent), 'Próximamente.', 'Campaign muestra próximamente');
  await page.click('.volver');
  await page.waitForSelector('.factory');
  for (const width of [320, 393, 768]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 852, deviceScaleFactor: 1, mobile: true });
    eq(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && [...document.querySelectorAll('.cuadro')].every(x => x.getBoundingClientRect().width > 200)), true, `portada legible sin desborde a ${width}px`);
  }
  await page.click('.factory');
  await page.waitForFunction(() => !!window.cmg?.edicion);
  await page.click('#b-ajustes'); await page.click('#ajustes a[href="../../index.html"]');
  await page.waitForSelector('.modos');
  eq(await page.evaluate(() => document.querySelectorAll('.cuadro').length), 3, 'desde Ajustes se vuelve a la entrada en móvil');
  await page.cdp('Emulation.clearDeviceMetricsOverride');
  console.log(`${checks} comprobaciones de entrada y paquete correctas`);
  return checks;
}
