import { ejecutarWar } from '../partida/anfitrion-war.mjs';
import { ejecutarFactory } from '../partida/anfitrion-factory.mjs';
import { ejecutarCampaign } from '../partida/anfitrion-campaign.mjs';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
export const referencias = JSON.parse(readFileSync(new URL('../../pruebas/referencias/partidas.json', import.meta.url))).casos;
export async function ejecutarCaso(caso, crearPrograma) {
  const fn = { war: ejecutarWar, factory: ejecutarFactory, campaign: ejecutarCampaign }[caso.reglas];
  const r = await fn({ ...caso.parametros, crearPrograma });
  return { hash: r.hash, pasos: r.metricas.pasos, resultado: r.resultado, ...(r.tramos ? { tramos: r.tramos } : {}) };
}
export function diferencias(caso, r) {
  return ['hash', 'pasos', 'resultado', ...(caso.tramos ? ['tramos'] : [])]
    .filter(k => !isDeepStrictEqual(caso[k], r[k]));
}
