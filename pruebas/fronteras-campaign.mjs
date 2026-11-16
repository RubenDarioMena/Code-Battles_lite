// Campaign por la composición compartida y las entradas públicas, con repetición por tramo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import reglas, { nivel, quieto } from '../paquetes/reglas-campaign/index.js';
import { crearPartida, restaurar } from '../paquetes/nucleo/index.js';
import { canonico } from '../paquetes/protocolo/index.js';
import { jugar } from '../herramientas/partida/jugar.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { ejecutarCampaign, programasCampaign, resultadoCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';

const referencias = JSON.parse(readFileSync(new URL('referencias/partidas.json', import.meta.url), 'utf8')).casos
  .filter(c => c.reglas === 'campaign');
assert.equal(referencias.length, 2);
const digest = snap => createHash('sha256').update(canonico(snap)).digest('hex');
let diferencias = 0, iguales = 0, repeticiones = 0;
for (const caso of referencias) {
  const lenguaje = caso.parametros.lenguaje, esperados = [], actuales = [];
  const anterior = await ejecutarCampaign({ lenguaje, alPaso: (_paso, snap) => esperados.push(digest(snap)) });
  assert.equal(anterior.hash, caso.hash, `${caso.id}: la referencia antigua sigue vigente`);
  const partida = crearPartida({ reglas, escenario: { reto: nivel.NIVEL }, semilla: 1 });
  const mundo = partida.mundo, total = crearHuella(), tramos = [];
  const consolas = { log: 0, info: 0, warn: 0, error: 0 };
  const comprobar = (actual, esperado, campo) => {
    if (canonico(actual) === canonico(esperado)) return true;
    diferencias++;
    console.error(`${caso.id}: ${campo} distinto`);
    return false;
  };
  for (const fuentes of programasCampaign(lenguaje)) {
    const desde = mundo.hito, huella = crearHuella();
    const r = await jugar({ reglas, partida, escenario: { reto: nivel.NIVEL }, semilla: 1, programas: fuentes,
      maxPasos: 30000,
      detener: (p, anfitrion) => p.mundo.hito !== desde || p.mundo.completado ||
        (mundo.programables.every(u => anfitrion.estado(u.id) === 'fin') && quieto(p.mundo)),
      alPaso: (_n, snap) => { huella.paso(snap); total.paso(snap); actuales.push(digest(snap)); } });
    const anfitrion = r.anfitrion;
    assert.equal(r.error, null, `${caso.id}, H${desde}: error de programa`);
    assert.equal(r.limite, false, `${caso.id}, H${desde}: límite`);
    const h = huella.terminar();
    const motivo = mundo.hito !== desde || mundo.completado ? 'detenido' : 'quieto';
    const registro = anfitrion.registro();
    // El ciclo reinicia eventos y uso por tramo, pero acumula consolas durante la sesión.
    for (const nivel of Object.keys(consolas)) consolas[nivel] += registro.consolas[nivel];
    const resultado = resultadoCampaign({ ...mundo, ...registro, consolas }, 'detenido', motivo, null);
    const tramo = { desde, hito: resultado.hito, completado: resultado.completado, pasos: r.pasos,
      t: mundo.t, hash: h.hash, resultado };
    const esperado = caso.tramos[tramos.length];
    const coincidencias = ['pasos', 't', 'hash', 'resultado'].filter(c => comprobar(tramo[c], esperado[c], `H${desde}.${c}`));
    console.log(`${caso.id} H${desde}: coinciden ${coincidencias.join(', ')}`);
    if (!coincidencias.includes('resultado')) {
      const a = resultado.eventos, b = esperado.resultado.eventos;
      const indice = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i)
        .find(i => canonico(a[i]) !== canonico(b[i]));
      console.error(`H${desde}: primer evento distinto (índice base 0) ${indice}; actual ${JSON.stringify(a[indice])}; referencia ${JSON.stringify(b[indice])}`);
      comprobar({ ...resultado, eventos: [] }, { ...esperado.resultado, eventos: [] }, `H${desde}.resultado sin eventos`);
    }
    tramos.push(tramo);
    partida.ordenar({ paso: partida.pasoActual, origen: 'sistema', unidad: 'campaign', verbo: 'fin-tramo', args: [] });
    partida.aplicarOrdenes();
    const repetida = restaurar(JSON.parse(JSON.stringify(partida.serializar())), reglas);
    repetida.aplicarOrdenes();
    assert.equal(canonico(repetida.instantanea()), canonico(partida.instantanea()), `${caso.id} H${desde}: repetición`);
    assert.deepEqual(repetida.evaluar(), partida.evaluar());
    assert.equal(repetida.pasoActual, partida.pasoActual);
    repeticiones++;
    if (mundo.completado || mundo.hito === desde) break;
  }
  const h = total.terminar();
  const camposIguales = [comprobar(h.hash, caso.hash, 'hash total'), comprobar(h.pasos, caso.pasos, 'pasos totales'),
    comprobar(tramos.at(-1).resultado, caso.resultado, 'resultado final')];
  const primerPaso = actuales.findIndex((h, i) => h !== esperados[i]);
  assert.equal(primerPaso, -1, `${caso.id}: primer paso distinto ${primerPaso + 1}`);
  assert.equal(actuales.length, esperados.length, `${caso.id}: longitud de secuencia`);
  console.log(`${caso.id}: secuencia paso a paso ${actuales.length}/${esperados.length} idéntica`);
  if (camposIguales.every(Boolean) && canonico(tramos) === canonico(caso.tramos)) iguales++;
}
console.log(`Fronteras Campaign: ${iguales}/2 iguales; repetición exacta ${repeticiones}/12; diferencias ${diferencias}.`);
if (diferencias) process.exitCode = 1;
