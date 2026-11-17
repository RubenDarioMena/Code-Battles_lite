import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adaptar } from './juego-adaptador.mjs';
import { casosReferencia } from '../herramientas/partida/casos.mjs';
import { programasCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';
import { canonico } from '../herramientas/partida/huella.mjs';
const referencias = JSON.parse(readFileSync(new URL('referencias/partidas.json', import.meta.url), 'utf8')).casos;

let iguales = 0;
for (const caso of casosReferencia()) {
  const juego = adaptar(caso), referencia = referencias.find(r => r.id === caso.id);
  // La huella la recibe directamente el alPaso del ciclo importado.
  if (caso.reglas !== 'campaign') {
    juego.cargar(caso.programas);
    for (let n = 0; !juego.resultado && n < 10001; n++) await juego.avanzar(1);
    assert.equal(canonico(juego.resultado), canonico(referencia.resultado), caso.id + ': resultado');
    // La lista del panel conserva todos los sucesos y mensajes en orden de llegada.
    if (caso.reglas === 'factory') assert.equal(canonico(juego.eventos), canonico(juego.registro.eventos));
  } else {
    const partida = juego.partida;
    for (const [n, fuentes] of programasCampaign(caso.lenguaje).entries()) {
      juego.cargar(fuentes);
      for (let pasos = 0; !juego.pausa && juego.ejecutando && pasos < 30001; pasos++) await juego.avanzar(1);
      assert.ok(juego.pausa, caso.id + ': pausa exacta H' + n);
      juego.detener();
      assert.equal(juego.partida, partida, 'la planta conserva su partida entre ejecuciones');
      assert.equal(canonico(juego.resultado), canonico(referencia.tramos[n].resultado), caso.id + ': resultado H' + n);
      assert.equal(partida.serializar().ordenes.at(-1).verbo, 'fin-tramo');
    }
  }
  const huella = juego.terminarHuella();
  assert.equal(huella.hash, referencia.hash, caso.id + ": huella de cada paso");
  assert.equal(huella.pasos, referencia.pasos, caso.id + ": pasos");
  iguales++;
}

// Seguir conserva la partida, carga las unidades nuevas y deja atrás el hito procesado.
{
  const juego = adaptar({ reglas: 'campaign' });
  juego.cargar(programasCampaign('js')[0]);
  while (!juego.pausa) await juego.avanzar();
  const partida = juego.partida, paso = partida.pasoActual;
  juego.seguir();
  assert.ok(juego.cargados.includes('PRS-01'), 'cargar incorpora la unidad recién encendida');
  await juego.avanzar(2);
  assert.equal(juego.partida, partida);
  assert.equal(juego.hito, null);
  assert.ok(partida.pasoActual > paso, 'Seguir entrega pendientes y permite nuevos pasos');
  juego.detener();
}
console.log(`Adaptador juego/conductor con intérprete: ${iguales}/41 huellas, pasos y resultados iguales; Campaign conserva partida, pausa y reanuda.`);
