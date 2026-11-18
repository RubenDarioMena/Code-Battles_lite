// Las mismas 41 fuentes, semillas y referencias; no graba ni modifica referencias.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { referencias } from '../herramientas/espina-interprete/corpus.mjs';
import { ejecutarWar } from '../herramientas/partida/anfitrion-war.mjs';
import { ejecutarFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { ejecutarCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';
import { crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const ejecutar = { war: ejecutarWar, factory: ejecutarFactory, campaign: ejecutarCampaign };
const datos = r => ({ hash: r.hash, pasos: r.metricas.pasos, t: r.metricas.t,
  mensajes: r.metricas.mensajes, resultado: r.resultado, ...(r.tramos ? { tramos: r.tramos } : {}) });
let lineas = 0;
const casos = [];
for (const caso of referencias) {
  const trazas = [[], []];
  const correr = async pasoAPaso => {
    const crear = crearTrabajadorInterprete({ acorn, depurar: pasoAPaso });
    return ejecutar[caso.reglas]({ ...caso.parametros, pasoAPaso,
      alLinea() { lineas++; },
      crearPrograma(fuente, unidad, recibir, max) {
        return crear(fuente, unidad, m => {
          trazas[+pasoAPaso].push({ unidad, mensaje: structuredClone(m) }); recibir(m);
        }, max);
      } });
  };
  const antes = lineas;
  const normal = await correr(false), depurado = await correr(true);
  assert.deepEqual(datos(depurado), datos(normal), `${caso.id}: partida completa`);
  assert.equal(depurado.hash, caso.hash, `${caso.id}: huella grabada`);
  assert.equal(depurado.metricas.pasos, caso.pasos, `${caso.id}: pasos grabados`);
  assert.deepEqual(trazas[1], trazas[0], `${caso.id}: secuencia íntegra de mensajes`);
  casos.push({ id: caso.id, reglas: caso.reglas, hash: depurado.hash, pasos: depurado.metricas.pasos,
    lineas: lineas - antes, mensajes: trazas[1].length, normalMs: normal.metricas.ms, pasoAPasoMs: depurado.metricas.ms });
}
console.log(`Paso a paso: 41/41 referencias idénticas, mensajes completos en orden; ${lineas} sentencias.`);

const informe = process.argv.indexOf('--informe');
if (informe >= 0) writeFileSync(process.argv[informe + 1], JSON.stringify({
  node: process.version, plataforma: `${process.platform}/${process.arch}`,
  criterio: 'Huella grabada y pasos; resultado completo, tiempo y secuencia íntegra de mensajes iguales a ejecución sin pausas.',
  casos, lineas,
}, null, 2) + '\n');
