// Campaign-V2 · B6–B8, las Batallas propias que estrenan las unidades móviles tras H5. Con el intérprete, el anfitrión
// y el conductor de la aplicación, y los programas de partida de cada Batalla:
// - las torretas solas pierden: cada Batalla necesita su unidad nueva;
// - con la unidad, se gana sin errores de programa;
// - en la B6, repartir el trabajo (torretas a por las orugas, vehículo a por los drones) también gana.
import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';

const nivel = niveles['nivel-1'];
assert.deepEqual(nivel.default.hitos.slice(-4), ['h5', 'b6', 'b7', 'b8'], 'tras H5, las tres Batallas propias');
async function jugar(clave, textos) {
  const { partida, conductor, avisos } = await montar({ consulta: 'ensayo=' + clave, textos });
  while (!partida.evaluar() && partida.pasoActual < 6000) await conductor.avanzar(1);
  const fin = partida.evaluar(), b = partida.mundo.batalla;
  conductor.cerrar();
  assert.deepEqual(avisos.filter(m => m.type === 'errorUnidad'), [], clave);
  return { fin: fin?.fin, derribos: b.derribos, brechas: b.brechas };
}
const resumen = [];
for (const clave of ['b6', 'b7', 'b8']) {
  const def = nivel[clave], unidad = def.unidades[0].id;
  for (const k of ['titulo', 'objetivo', 'leccion', 'pista']) assert.ok(catalogo.es[def[k]] && catalogo.en[def[k]], def[k]);
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
