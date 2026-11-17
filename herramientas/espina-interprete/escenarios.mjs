import { cargar } from '../partida/cargar.mjs';
import { crearInstrumentador } from '../partida/instrumentar.mjs';
import { crearPartida } from '../../paquetes/nucleo/index.js';
import war, { retos } from '../../paquetes/reglas-war/index.js';
import campaign, { nivel } from '../../paquetes/reglas-campaign/index.js';
import factory, { retos as retosFactory } from '../../paquetes/reglas-factory/index.js';
export function escenario(serie = 'war') {
  const sesion = cargar(), reglas = { war, campaign, factory }[serie];
  const reto = serie === 'war' ? retos.normalizar(retos.RETOS[1]) : serie === 'factory' ? retosFactory.RETOS[0] : nivel.NIVEL;
  const partida = crearPartida({ reglas, escenario: { reto, intento: 1 }, semilla: 7 });
  const mundo = partida.mundo, snap = partida.instantanea();
  const propia = mundo.programables[0].id;
  const nombres = (serie === 'campaign' ? mundo.unidades : serie === 'factory' ? mundo.maquinas : [...mundo.programables, ...mundo.sensores]).map(x => x.id);
  const lenguaje = crearInstrumentador(sesion.contexto, mundo, serie);
  return { fuente: sesion.fuenteWorker, snap, propia, lenguaje,
    mensaje(codigo) { return { type: 'run', serie, lenguaje: 'js', propia, nombres,
      tipos: Object.keys(war.api.tipos), sensores: Object.keys(war.api.sensores), conf: war.api.conf,
      snap, codigo: lenguaje.instrumentar(codigo) }; } };
}
export const programaWar = pausa => `while (true) {
  const objetivo = autoTarget("crawler", "visual");
  regularShoot(objetivo);
  await esperar(${pausa});
}`;
export const programaCampaign = `while (true) {
  await Promise.all([pickUp(BAY_1), wait(0.2)]);
  await deliver(SUP_1);
}`;
