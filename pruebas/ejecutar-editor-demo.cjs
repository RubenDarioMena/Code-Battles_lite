// Prueba de frontera 4 de la fase 2: el editor montado solo, fuera del juego (paquetes/editor/demo/demo.html).
// Adaptador de Playwright para editor-demo.mjs. Con el servidor dedicado 8771 activo:
// node pruebas/ejecutar-editor-demo.cjs
const { existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

async function ejecutar() {
  const { chromium } = require('playwright');
  const executablePath = process.env.CBL_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const origen = process.env.CBL_QA_ORIGIN || 'http://127.0.0.1:8771';
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const contexto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    const salida = console.log;
    console.log = () => {};  // editor-demo anuncia cada comprobación; aquí solo el resumen.
    let checks;
    try {
      const modulo = await import(pathToFileURL(path.join(__dirname, 'editor-demo.mjs')).href);
      checks = await modulo.probarEditorDemo(page, origen);
    } catch (error) {
      const captura = path.join(os.tmpdir(), 'cbl-editor-demo-error.png');
      await page.screenshot({ path: captura }).then(() => console.error(`Captura de fallo: ${captura}`), () => {});
      throw error;
    } finally { console.log = salida; }
    if (!(checks > 0)) throw new Error('editor-demo no ejecutó comprobaciones');
    if (errores.length) throw new Error(`Errores de página: ${errores.slice(0, 3).join(' | ')}`);
    console.log(`Editor montado solo (demo, sin el juego): ${checks} comprobaciones correctas, sin errores de página.`);
  } finally { await browser.close(); }
}

ejecutar().catch(error => { console.error(error); process.exitCode = 1; });
