// Calibración del arnés, NO piloto del agente ni validación del modo sin teclado.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conectarCiclo, reproducirCaso } from './recuperacion-editor.mjs';
import { diferenciaUso, leerUsoCodex } from './uso-tokens.mjs';

export async function probarArnes(page) {
  const directorio = await mkdtemp(join(tmpdir(), 'cbl-recuperacion-'));
  let checks = 0;
  const eq = (actual, esperado) => { assert.deepEqual(actual, esperado); checks++; };
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=escritorio');
  await page.waitForFunction(() => !!window.cmg);
  const original = 'const pos = autoTarget("crawler", "visual");\nregularShoot(pos);';
  await page.fill('#codigo', original);
  const config = { modalidad: 'calibracion', intentos: 4 };
  const ciclo = await conectarCiclo(page, { directorio, config });
  await page.evaluate(() => {
    for (const [i, nombre] of ['Copiar', 'Pegar', 'Paste'].entries()) {
      const b = document.createElement('button'); b.className = 'atajo'; b.dataset.i = 100 + i;
      b.setAttribute('aria-label', nombre); document.querySelector('#paleta').append(b);
    }
  });
  eq(await page.evaluate(() => window.__qaRecuperacion.botones().some(b => /Copiar|Pegar|Paste/.test(b.nombre))), false);
  await assert.rejects(ciclo.iniciar('doble inicio').then(() => ciclo.iniciar('no permitido')), /Cierra/); checks++;
  const umbral = (await ciclo.estado()).intento.umbral;
  assert.ok(umbral >= 1 && umbral <= 4); checks++;
  for (let i = 0; i < umbral; i++) await ciclo.click('#codigo');
  const estado = await ciclo.estado();
  eq(estado.intento.fase, 'reparacion'); eq(estado.intento.clicsPrevios, umbral);
  const punto = estado.intento.perturbacion.punto;
  eq(original.slice(punto.offset, punto.offset + punto.caracter.length), punto.caracter);
  eq(await page.evaluate(() => document.querySelector('#codigo').value !== window.__qaRecuperacion.actual.objetivo.codigo), true);
  await ciclo.click('#codigo');
  eq((await ciclo.estado()).intento.perturbacion, estado.intento.perturbacion); // No vuelve a inyectar al reparar.
  // Restauración de fixture para probar el verificador. Está prohibida en el piloto real.
  await page.fill('#codigo', original);
  const sano = await ciclo.cerrar({ nota: 'Restauración sintética de fixture; no demuestra recuperación por UI.' });
  eq(sano.resultado, 'recuperado'); eq(sano.recompensa, null); eq(sano.detalle, null);
  eq(await readdir(directorio), ['resumen.json']);

  await ciclo.iniciar('incidencia sintética, sin reparar');
  const n = (await ciclo.estado()).intento.umbral;
  for (let i = 0; i < n; i++) await ciclo.click('#codigo');
  const incidente = await ciclo.cerrar({ clasificacion: 'fallo-agente', nota: 'Caso de calibración, no bug del juego.' });
  eq(incidente.resultado, 'no-recuperado');
  const rutaCaso = join(directorio, incidente.detalle), caso = JSON.parse(await readFile(rutaCaso, 'utf8'));
  eq(caso.objetivo.codigo, original);
  eq(caso.trasPerturbacion.codigo, caso.final.codigo);
  assert.ok(caso.traza.some(e => e.tipo === 'tras-caracter')); checks++;
  await page.fill('#codigo', caso.objetivo.codigo);
  await page.evaluate(objetivo => {
    const e = document.querySelector('#codigo');
    e.setSelectionRange(...objetivo.seleccion, objetivo.direccion);
    [e.scrollLeft, e.scrollTop] = objetivo.scroll;
  }, caso.objetivo);
  eq((await reproducirCaso(page, rutaCaso)).reproduceTexto, true);

  await page.fill('#codigo', original);
  // Simular un botón que no tiene efecto para comprobar que no se premia como reparación.
  await page.evaluate(() => document.querySelector('#paleta').addEventListener('click', ev => {
    if (window.__qaRecuperacion.actual?.fase === 'inyeccion') ev.stopImmediatePropagation();
  }, true));
  await ciclo.iniciar('inyección sin efecto sintética');
  const k = (await ciclo.estado()).intento.umbral;
  for (let i = 0; i < k; i++) await ciclo.click('#codigo');
  const sinEfecto = await ciclo.cerrar();
  eq(sinEfecto.resultado, 'inconcluso'); eq(sinEfecto.recompensa, null);
  const informe = JSON.parse(await readFile(join(directorio, 'resumen.json'), 'utf8'));
  eq(informe.config.modalidad, 'calibracion'); eq(informe.intentos.length, 3);
  await assert.rejects(conectarCiclo(page, { directorio, config: { semilla: 'otra' } }), /otro ciclo/); checks++;

  // Cambiar de formato entre intentos conserva semilla, numeración y resumen.
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await page.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=movil');
  await page.waitForFunction(() => !!window.cmg);
  const largo = 'const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");\nregularShoot(pos);';
  await page.fill('#codigo', largo);
  await page.evaluate(() => document.querySelector('#codigo').blur());
  await assert.rejects(conectarCiclo(page, { directorio, config }), /otra sesión/); checks++;
  const movil = await conectarCiclo(page, { directorio, config, reanudar: true });
  eq((await movil.estado()).completados, 3);
  eq(await page.evaluate(() => window.__qaRecuperacion.rng), informe.rngSiguiente);
  await movil.iniciar('móvil emulado y auditoría del teclado');
  const m = (await movil.estado()).intento.umbral;
  // Evitar que la simulación de teclado del layout cambie el reparto tras el primer clic.
  for (let i = 0; i < m; i++) await movil.click('#paleta button[data-i="0"]');
  const movilEstado = await movil.estado();
  eq(movilEstado.intento.numero, 4); eq(movilEstado.intento.fase, 'reparacion');
  const objetivoMovil = await page.evaluate(() => window.__qaRecuperacion.actual.objetivo.codigo);
  await page.fill('#codigo', objetivoMovil);
  await page.keyboard.press('ArrowLeft');
  const conTeclado = await movil.cerrar();
  eq(conTeclado.usoTeclado, true); eq(conTeclado.resultado, 'inconcluso'); eq(conTeclado.recompensa, null);
  await assert.rejects(movil.iniciar('excede piloto'), /Piloto terminado/); checks++;

  const tokens = join(directorio, 'uso-fixture.jsonl');
  await writeFile(tokens, [JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: null } }),
    JSON.stringify({ type: 'event_msg', timestamp: 't1', payload: { type: 'token_count', info: { total_token_usage:
      { input_tokens: 100, cached_input_tokens: 80, output_tokens: 10, reasoning_output_tokens: 4, total_tokens: 110 } } } }), '{parcial'].join('\n'));
  const uso = await leerUsoCodex(tokens);
  eq(uso.total_tokens, 110); eq(diferenciaUso(uso, uso), null); eq(diferenciaUso(null, uso), null);
  const delta = diferenciaUso(uso, { ...uso, marca: 't2', input_tokens: 150, cached_input_tokens: 100, output_tokens: 20, reasoning_output_tokens: 6, total_tokens: 170 });
  eq([delta.total_tokens, delta.input_tokens, delta.cached_input_tokens, delta.output_tokens, delta.reasoning_output_tokens], [60, 50, 20, 10, 2]);
  eq(diferenciaUso(uso, { ...uso, marca: 't3', total_tokens: 1 }), null);
  console.log(`${checks} comprobaciones del arnés correctas; calibración sintética, no piloto. Archivos: ${directorio}`);
  return { checks, directorio };
}
