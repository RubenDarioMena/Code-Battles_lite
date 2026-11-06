// Runner opcional: requiere Playwright y Chromium en el entorno de QA, no en el juego.
// Con el servidor dedicado 8771 activo: node pruebas/ejecutar-idiomas.cjs
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

async function ejecutar() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { throw new Error('Este runner necesita Playwright en el entorno de QA. El juego y las pruebas de lógica no lo requieren.'); }
  const executablePath = process.env.CBL_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const origen = process.env.CBL_QA_ORIGIN || 'http://127.0.0.1:8771';
  const browser = await chromium.launch({ executablePath, headless: true });
  let total = 0;
  try {
    for (const [archivo, funcion] of [
      ['idiomas', 'probarIdiomas'],
      ['idiomas-bordes', 'probarIdiomasBordes'],
      ['idiomas-juego', 'probarIdiomasJuego'],
    ]) {
      const contexto = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      // La suite comprueba idioma/edición; el watchdog conocido de 3D se valida por separado.
      await contexto.addInitScript(() => {
        localStorage.setItem('cmg-banco03:vista', JSON.stringify('2d'));
        localStorage.setItem('cmg-banco03:factory-vista', JSON.stringify('2d'));
      });
      const page = await contexto.newPage();
      const cdp = await contexto.newCDPSession(page);
      page.cdp = (metodo, parametros) => cdp.send(metodo, parametros);
      try {
        const modulo = await import(pathToFileURL(path.join(__dirname, `${archivo}.mjs`)).href);
        const ejecutadas = await modulo[funcion](page, origen);
        if (!(ejecutadas > 0)) throw new Error(`${archivo}: no ejecutó comprobaciones`);
        total += ejecutadas;
      } catch (error) {
        const captura = path.join(os.tmpdir(), `cbl-${archivo}-error.png`);
        await page.screenshot({ path: captura }).then(() => console.error(`Captura de fallo: ${captura}`), () => {});
        throw error;
      } finally { await contexto.close(); }
    }
  } finally { await browser.close(); }
  console.log(`${total} comprobaciones de idiomas correctas en contextos aislados (vista Plano).`);
}

ejecutar().catch(error => { console.error(error); process.exitCode = 1; });
