// Campaign-V2 · B6–B8, las Batallas propias que estrenan las unidades móviles tras H5. Con el intérprete, el anfitrión
// y el conductor de la aplicación, y los programas de partida de cada Batalla:
// - las torretas solas pierden: cada Batalla necesita su unidad nueva;
// - con la unidad, se gana sin errores de programa;
// - en la B6, repartir el trabajo (torretas a por las orugas, vehículo a por los drones) también gana.
import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';
import { tituloBatalla, avisoMunicion, componerCampaignV2 } from '../paquetes/app/juego/campaign-v2.js';

const nivel = niveles['nivel-1'];
const { hitos } = nivel.default;
assert.deepEqual(hitos.slice(hitos.indexOf('h5'), hitos.indexOf('h5') + 5), ['h5', 'b6', 'b7', 'b8', 'h6'], 'tras H5, las tres Batallas propias y el taller de H6');
async function jugar(clave, textos) {
  const { partida, conductor, avisos } = await montar({ consulta: 'ensayo=' + clave, textos });
  while (!partida.evaluar() && partida.pasoActual < 6000) await conductor.avanzar(1);
  const fin = partida.evaluar(), b = partida.mundo.batalla;
  conductor.cerrar();
  assert.deepEqual(avisos.filter(m => m.type === 'errorUnidad'), [], clave);
  return { fin: fin?.fin, derribos: b.derribos, brechas: b.brechas };
}
assert.equal(tituloBatalla(k => k, { titulo: 'Primer blanco' }, 'b1'), 'Primer blanco', 'las Batallas de War traen el texto');
// Aviso de bodega de las tarjetas: cuenta puntos de vida, no enemigos. En el QA del 26-nov, B6 gastó 37 misiles y B8 50
// (17 y 30 más allá de los cargadores), y la tarjeta decía «unos 12» y «unos 2»; la de H4 no avisaba para B5 con 22 (O5).
{
  const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
  const reto = h => config.retos[config.batallas.indexOf(h)];
  for (const [h, bodega, gastoReal] of [['b5', 22, 19], ['b6', 6, 17], ['b8', 0, 30]]) {
    const aviso = avisoMunicion(bodega, reto(h));
    assert.equal(aviso?.k, 'cv2.fin.escasa', `${h} con ${bodega} en la bodega avisa`);
    assert.ok(aviso.falta >= gastoReal * 0.8, `${h}: estima ${aviso.falta}, se gastaron ${gastoReal} de la bodega`);
  }
  assert.equal(avisoMunicion(60, reto('b8')), null, 'con la bodega llena no avisa');
}
const resumen = [];
for (const clave of ['b6', 'b7', 'b8']) {
  const def = nivel[clave], unidad = def.unidades[0].id;
  for (const k of ['titulo', 'objetivo', 'leccion', 'pista']) assert.ok(catalogo.es[def[k]] && catalogo.en[def[k]], def[k]);
  // Las tarjetas entre etapas traducen la clave del título (antes salía «cv2.b6.titulo» crudo).
  assert.equal(tituloBatalla(k => catalogo.es[k] ?? k, def, clave), catalogo.es[def.titulo], clave + ' · título en la tarjeta');
  // El arnés solo carga los programas guardados de las unidades móviles: las torretas llevan el suyo de partida.
  const torretas = { 'LAU-01': def.inicial['LAU-01'].join('\n'), 'LAU-02': def.inicial['LAU-02'].join('\n') };
  const solas = await jugar(clave, { ...torretas, [unidad]: '' });
  assert.equal(solas.fin, 'fallo', `${clave} sin ${unidad}: ${JSON.stringify(solas)}`);
  const con = await jugar(clave, torretas);
  assert.equal(con.fin, 'victoria', `${clave} con ${unidad}: ${JSON.stringify(con)}`);
  assert.ok(con.derribos >= def.metas.derribosMin && con.brechas < def.metas.brechasMax + 1);
  resumen.push(`${clave} ${unidad}: ${solas.brechas} brechas sin ella, ${con.brechas} con ella`);
}
const b6 = nivel.b6, reparto = b6.inicial['LAU-01'].join('\n')
  .replace('autoTarget("drone", "visual") ?? autoTarget("crawler", "visual")', 'autoTarget("crawler", "visual") ?? autoTarget("drone", "visual")');
assert.notEqual(reparto, b6.inicial['LAU-01'].join('\n'));
assert.equal((await jugar('b6', { 'LAU-01': reparto, 'LAU-02': reparto })).fin, 'victoria', 'repartir el trabajo gana la B6');
console.log(`Batallas propias: ${resumen.join('; ')}; repartir el trabajo gana la B6.`);
