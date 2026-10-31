// Diagnóstico dirigido, externo al juego. Solo localhost:8771, modifica su localStorage.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const url = 'http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=escritorio';
async function abrir(page) {
  await page.goto(url);
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.waitForFunction(() => !!window.cmg?.edicion);
  await page.click('loc=role:tab[name="PROGRAMA"]');
  await page.click('.modos-codigo [data-modo-codigo="js"]');
  if (await page.evaluate(() => cmg.edicion.activo)) await page.click('#b-teclado');
}

export async function diagnosticarSeleccion(page, directorio, caso) {
  await mkdir(directorio, { recursive: true });
  const fuente = JSON.parse(await readFile(caso, 'utf8'));
  const resultados = [];
  for (const [id, espera] of [['rapido-1', 0], ['rapido-2', 0], ['pausado', 450]]) {
    await abrir(page);
    await page.fill('#codigo', fuente.objetivo.codigo);
    await page.click('#b-teclado');
    await page.click('#bloques-texto span[data-a="0"]');
    await page.waitForTimeout(450);
    const previa = await page.evaluate(() => [cmg.codigo.selectionStart, cmg.codigo.selectionEnd]);
    const selector = '#bloques-texto span:text-is("console")';
    await page.click(selector);
    if (espera) await page.waitForTimeout(espera);
    const antesBoton = await page.evaluate(() => [cmg.codigo.selectionStart, cmg.codigo.selectionEnd]);
    await page.click('#paleta button[data-i="10"]');
    await page.waitForTimeout(450);
    const despues = await page.evaluate(() => ({ codigo: cmg.codigo.value, seleccion: [cmg.codigo.selectionStart, cmg.codigo.selectionEnd] }));
    await page.screenshot({ path: join(directorio, 'seleccion-' + id + '.png') });
    resultados.push({ id, espera, previa, antesBoton, ...despues });
  }
  const resultado = { reproduccionesRapidas: resultados.slice(0, 2).filter(r => r.codigo.startsWith('burstFire(while')).length,
    controlPausadoEnvuelveTodo: resultados[2].codigo.startsWith('burstFire(while'), resultados };
  await writeFile(join(directorio, 'seleccion-dirigida.json'), JSON.stringify(resultado, null, 2) + '\n');
  return resultado;
}
