// Adaptador Playwright de la regresión completa del informe de revisión (laboratorio y juego).
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

async function ejecutar() {
  const { chromium } = require('playwright');
  const executablePath = process.env.CBL_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 844 }, acceptDownloads: true });
    const page = await contexto.newPage();
    const cdp = await contexto.newCDPSession(page);
    page.cdp = (metodo, parametros) => cdp.send(metodo, parametros);
    // Cuentan los errores de las páginas del juego. El laboratorio de revisión (otro proyecto, sin cambios
    // desde 0da745d) da dos «showModal … not in a Document» en Chromium sin pantalla: se informan, no fallan.
    const errores = [], laboratorio = [];
    page.on('pageerror', e => (page.url().includes('/Prototypes/') ? errores : laboratorio).push(e.message));
    const { probarDepuracion } = await import(pathToFileURL(path.join(__dirname,
      '../educational-animation/revision/pruebas/depuracion.mjs')).href);
    let resultado;
    try { resultado = await probarDepuracion(page); }
    catch (error) {
      const captura = path.join(os.tmpdir(), 'cbl-depuracion-error.png');
      await page.screenshot({ path: captura }).then(() => console.error(`Captura de fallo: ${captura}`), () => {});
      throw error;
    }
    if (!(resultado.comprobaciones > 0)) throw new Error('depuracion no ejecutó comprobaciones');
    if (errores.length) throw new Error(`Errores de página: ${errores.slice(0, 3).join(' | ')}`);
    console.log(`Depuración de revisión: ${resultado.comprobaciones} comprobaciones correctas, sin errores en el juego`
      + (laboratorio.length ? ` (laboratorio: ${laboratorio.length} avisos conocidos).` : '.'));
  } finally { await browser.close(); }
}
ejecutar().catch(error => { console.error(error); process.exitCode = 1; });
