// QA del runtime real, incluidos los pulsos de War; lo ejecuta test:navegador.
import assert from 'node:assert/strict';
export async function probarProgramasPresupuesto(page, origen = 'http://127.0.0.1:8771') {
  let comprobaciones = 0;
  // Si el juego volviera a crear un Worker, falla esta suite en su arranque.
  await page.addInitScript(() => {
    window.Worker = class { constructor() { throw new Error('El juego no debe crear Workers'); } };
  });
  for (const serie of ['war', 'factory', 'campaign']) for (const idioma of ['es', 'en']) {
    await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?serie=${serie}`);
    await page.waitForFunction(() => window.__juegoListo);
    const esperado = await page.evaluate(({ serie, idioma }) => {
      CMGI18n.cambiarIdioma(idioma);
      const b = window.__banco;
      if (serie !== 'campaign') b.elegirReto(0);
      const unidad = serie === 'war' ? 'LAU-01' : serie === 'factory' ? 'R1' : 'FRK-01';
      for (const id of Object.keys(b.programas)) { b.programas[id] = ''; delete b.fuentes[id]; }
      b.programas[unidad] = 'const antes = 1;\nwhile(true){}';
      b.abrirPrograma(unidad);
      const clave = serie === 'campaign' ? 'campaign.presupuesto' : `partida.presupuesto.${serie}`;
      const mensaje = CMGI18n.t(clave, { unidad });
      b.ejecutar();
      return { unidad, mensaje };
    }, { serie, idioma });
    await page.waitForFunction(() => __banco.fin === 'error', undefined, { timeout: 30000 });
    const actual = await page.evaluate(() => {
      const t = __banco.telemetria.at(-1);
      return { fin: __banco.fin, motivo: t.motivo, mensaje: t.mensaje, linea: t.linea,
        programa: t.programa, marca: cmg.marcas.err, consola: document.querySelector('#consola').textContent,
        banner: document.querySelector('#banner').textContent, ejecutando: cmg.ejecutando };
    });
    assert.deepEqual([actual.fin, actual.motivo, actual.linea, actual.programa, actual.marca, actual.ejecutando],
      ['error', 'error', 2, esperado.unidad, 2, false]);
    assert.equal(actual.mensaje, esperado.mensaje);
    assert(actual.consola.includes(esperado.mensaje)); assert(actual.banner.includes(esperado.mensaje));
    assert(!/2[.,]5/.test(actual.mensaje));
    comprobaciones += 5;
  }
  return comprobaciones;
}
