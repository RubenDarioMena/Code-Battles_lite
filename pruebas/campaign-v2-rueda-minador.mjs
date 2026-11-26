// P5b · WHL (rueda kamikaze) y minador con los programas de ejemplo de sus ensayos, con el intérprete, el anfitrión y
// el conductor de la aplicación: estallar, reaparecer y volver a empezar; sembrar cargas y recibir onDetonation.
import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';
import { ensayos } from '../paquetes/reglas-campaign-v2/index.js';

async function jugar(clave, cada) {
  const sim = await montar({ consulta: 'ensayo=' + clave });
  const { partida, conductor, avisos } = sim;
  while (!partida.evaluar() && partida.pasoActual < 4000) {
    await conductor.avanzar(1);
    cada?.(sim);
  }
  const derribos = partida.sucesos(0).filter(s => s.tipo === 'derribo');
  conductor.cerrar();
  assert.deepEqual(avisos.filter(m => m.type === 'errorUnidad'), [], clave);
  // Cada estallido deja una explosión marcada como carga: la vista la dibuja con la receta «detonacion».
  const detonaciones = partida.sucesos(0).filter(s => s.tipo === 'explosion' && s.datos.carga);
  return { ...sim, fin: partida.evaluar(), derribos, detonaciones, logs: avisos.filter(m => m.type === 'consola') };
}

// Rueda: espera en el carril, estalla con una oruga a menos de 1,5 m, desaparece, reaparece en casa a los 12 s y su
// programa vuelve a la primera línea (vuelve al carril y estalla otra vez).
const whl = 'WHL-01';
let estallidos = 0, reapariciones = 0, presente = true, casa = null;
const r = await jugar('rueda', ({ partida }) => {
  const c = partida.mundo.campo, u = c.aliados[whl];
  casa ??= { ...u.home };
  if (presente && !u) estallidos++;
  if (!presente && u) {
    reapariciones++;
    assert.deepEqual(u.position, casa, 'reaparece en su casa');
    assert.equal(partida.instantanea().moviles[whl].nearest !== undefined, true, 'la lectura nearest llega al programa');
  }
  presente = !!u;
});
assert.equal(r.fin?.fin, 'victoria', JSON.stringify(r.fin));
assert.ok(estallidos >= 2 && reapariciones >= 1, `estallidos ${estallidos}, reapariciones ${reapariciones}`);
assert.ok(r.derribos.filter(s => s.datos.por === whl).length >= ensayos.rueda.metas.derribosMin);
assert.equal(r.detonaciones.length, estallidos, 'una explosión por estallido');
assert.ok(r.detonaciones.every(s => s.unidad === whl && s.datos.radio === ensayos.rueda.unidades[0].radio));

// Minador: siembra sus cuatro cargas en el carril, vuelve tras la muralla y cada carga que estalla avisa al programa.
const min = 'MIN-01';
let sembradas = 0;
const m = await jugar('minador', ({ partida }) => {
  sembradas = Math.max(sembradas, ensayos.minador.unidades[0].cargas - (partida.mundo.campo.aliados[min]?.charges ?? 0));
});
assert.equal(sembradas, 4);
assert.equal(m.detonaciones.length, 4, 'una explosión por carga');
const avisosCarga = m.logs.filter(l => l.unidad === min && l.texto.startsWith('¡Carga!'));
assert.ok(avisosCarga.length >= 3, JSON.stringify(m.logs));
assert.ok(m.derribos.filter(s => s.datos.por === min).length >= ensayos.minador.metas.derribosMin, JSON.stringify(m.derribos.map(s => s.datos.por)));
assert.equal(m.fin?.fin, 'victoria', JSON.stringify(m.fin));
assert.equal(m.partida.mundo.campo.aliados[min].position.x < m.partida.mundo.campo.limites.muro, true, 'vuelve tras la muralla');
console.log(`P5b · rueda: ${estallidos} estallidos y ${reapariciones} reapariciones con el programa desde el principio; minador: 4 cargas, ${avisosCarga.length} avisos onDetonation; las dos ganan su ensayo.`);
