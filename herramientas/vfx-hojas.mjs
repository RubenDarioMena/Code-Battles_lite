// No inicia servidor: servir la raíz en 8771 antes de ejecutar.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export function opcionesHojas(args) {
  const opciones = { origen: 'http://127.0.0.1:8771', salida: 'artifacts/vfx-hojas', calidades: ['alto', 'medio', 'bajo', 'no'] };
  for (let i = 0; i < args.length; i++) {
    const nombre = args[i], valor = args[++i];
    if (!valor || !['--origen', '--salida', '--calidades'].includes(nombre)) throw new Error('Uso: node herramientas/vfx-hojas.mjs [--origen URL] [--salida carpeta] [--calidades alto,medio,bajo,no]');
    if (nombre === '--origen') opciones.origen = new URL(valor).origin;
    if (nombre === '--salida') opciones.salida = valor;
    if (nombre === '--calidades') opciones.calidades = valor.split(',');
  }
  if (!opciones.calidades.length || opciones.calidades.some(c => !['alto', 'medio', 'bajo', 'no'].includes(c))) throw new Error('Calidades válidas: alto,medio,bajo,no');
  return opciones;
}
export async function generarHojas(opciones) {
  const salida = path.resolve(opciones.salida);
  await mkdir(salida, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1640, height: 1100 }, deviceScaleFactor: 1 });
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    // Offline de verdad: únicamente recursos del servidor elegido.
    await page.route('**/*', route => new URL(route.request().url()).origin === opciones.origen ? route.continue() : route.abort());
    await page.goto(`${opciones.origen}/herramientas/laboratorio-vfx/?captura=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(globalThis.laboratorioVfx), undefined, { timeout: 30000 });
    const estado = await page.evaluate(() => ({ listo: globalThis.laboratorioVfx.listo, error: globalThis.laboratorioVfx.error, nombres: globalThis.laboratorioVfx.nombres }));
    if (!estado.listo) throw new Error(`Laboratorio sin WebGL: ${estado.error}`);
    const resultados = [];
    for (const calidad of opciones.calidades) {
      const carpeta = path.join(salida, calidad); await mkdir(carpeta, { recursive: true });
      for (const receta of estado.nombres) {
        const medida = await page.evaluate(({ receta, calidad }) => globalThis.laboratorioVfx.medir(receta, calidad), { receta, calidad });
        await page.locator('#hoja').screenshot({ path: path.join(carpeta, `${receta}.png`) });
        resultados.push({ receta, calidad, ...medida, png: `${calidad}/${receta}.png` });
      }
    }
    if (errores.length) throw new Error(`Errores del laboratorio: ${errores.join('\n')}`);
    const resumen = { origen: opciones.origen, three: 'r128', unidadCPU: 'ms de particulas(); no GPU',
      escala: 'mapa 32x18; cámara 38°, distancia 33m; recortes 1:1', resultados };
    await writeFile(path.join(salida, 'resumen.json'), JSON.stringify(resumen, null, 2) + '\n');
    console.log(`Hojas VFX: ${resultados.length} PNG y resumen.json en ${salida}`);
    return resumen;
  } finally { await browser.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generarHojas(opcionesHojas(process.argv.slice(2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
