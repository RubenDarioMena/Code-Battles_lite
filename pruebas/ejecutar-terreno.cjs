// Editor de terreno en el navegador (Playwright, Chromium con SwiftShader). Servidor dedicado en 127.0.0.1:8771.
// Uso: node pruebas/ejecutar-terreno.cjs  (lo ejecuta npm run test:navegador)
const { chromium } = require('playwright');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const suites = [
  ['terreno-navegador.mjs', 'probarTerreno', 'editor'],
  ['terreno-modelado.mjs', 'probarModelado', 'modelado'],
  ['terreno-estudio.mjs', 'probarEstudio', 'estudio'],
];

(async () => {
  // Los mismos ajustes que campaign-juego: WebGPU/WebGL por software, sin GPU física.
  const navegador = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
  const partes = [];
  try {
    for (const [archivo, funcion, nombre] of suites) {
      const modulo = await import(pathToFileURL(path.join(__dirname, archivo)).href);
      const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
      const pagina = await contexto.newPage();
      const errores = [];
      pagina.on('pageerror', e => errores.push(String(e.message).slice(0, 300)));
      try {
        const r = await modulo[funcion](pagina);
        if (errores.length) throw new Error(`${nombre}: errores de página: ${errores.join(' | ')}`);
        partes.push(`${nombre} ${r.comprobaciones}${r.motor ? ` (${r.motor})` : ''}`);
      } finally { await contexto.close(); }
    }
  } finally { await navegador.close(); }
  console.log(`Terreno en el navegador: ${partes.join(', ')} comprobaciones correctas.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
