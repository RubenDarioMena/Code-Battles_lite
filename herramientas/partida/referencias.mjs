import { ejecutarWar } from './anfitrion-war.mjs';
import { ejecutarFactory } from './anfitrion-factory.mjs';
import { ejecutarCampaign } from './anfitrion-campaign.mjs';
import { parametrosCaso } from './casos.mjs';

/** Ejecuta y conserva solo datos deterministas, sin normalizar ni recortar resultados.
 * @param {any} caso @param {((paso: number, snap: any) => void)} [alPaso] */
export async function ejecutarReferencia(caso, alPaso) {
  const parametros = parametrosCaso(caso);
  const ejecutar = { war: ejecutarWar, factory: ejecutarFactory, campaign: ejecutarCampaign }[caso.reglas];
  if (!ejecutar) throw new Error(`Reglas desconocidas: ${caso.reglas}`);
  const r = await ejecutar({ ...parametros, alPaso });
  return { id: caso.id, reglas: caso.reglas, parametros, hash: r.hash,
    pasos: r.metricas.pasos, resultado: r.resultado, ...('tramos' in r ? { tramos: r.tramos } : {}) };
}
