import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { crearAnfitrion, crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { componerCampaignV2, jugarPartida } from '../paquetes/app/index.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { resultadoWar } from '../herramientas/partida/anfitrion-war.mjs';

const { casos } = JSON.parse(await readFile(new URL('./referencias/partidas.json', import.meta.url)));
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const seleccion = casos.filter(c => c.reglas === 'war' && !c.id.endsWith('-python'));
assert.equal(seleccion.length, 12);
for (const caso of seleccion) {
  const { id, parametros: { reto: n, semilla, programas } } = caso;
  const hito = `b${n}`;
  const config = componerCampaignV2(new URLSearchParams({ serie: 'campaign-v2', modo: 'paridad', batalla: hito }));
  const { reglas, reglasProgramas } = config;
  const escenario = config.escenario(config.indiceInicial);
  const partida = crearPartida({ reglas, escenario, semilla });
  assert.deepEqual([partida.serializar().reglas, partida.mundo.hito, partida.mundo.modo], ['campaign-v2', hito, 'paridad']);
  const mundo = config.mundoPantalla(partida.mundo);
  const { instrumentar } = crearInstrumentador({ acorn }, mundo, reglasProgramas.id);
  const anfitrion = crearAnfitrion({ reglas: reglasProgramas, crearTrabajador: crearTrabajadorInterprete({ acorn }),
    contexto: { nombres: [...mundo.programables, ...mundo.sensores].map(u => u.id) } });
  for (const { id } of mundo.programables)
    await anfitrion.cargar(id, instrumentar(programas?.[id] ?? escenario.reto.inicial[id].join('\n')));
  const huella = crearHuella();
  const r = await jugarPartida({ reglas, partida, escenario, semilla, anfitrion, alPaso: (_, foto) => huella.paso(foto) });
  assert.equal(r.error, null, id);
  assert.equal(r.limite, false, id);
  assert.equal(huella.terminar().hash, caso.hash, id);
  assert.equal(r.pasos, caso.pasos, id);
  const { fin, motivo, mensaje } = r.evaluacion;
  assert.deepEqual(resultadoWar(mundo, fin, motivo, mensaje), caso.resultado, id);
}
console.log('Campaign-V2 en paridad: las 12 partidas coinciden en huella, pasos y resultado completo.');
