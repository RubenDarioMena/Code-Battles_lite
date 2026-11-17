import { crearPrograma as nativo } from './nativo.mjs';
import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { guardarMedidas } from './medidas.mjs';
import { crearPrograma as vm } from '../partida/programa.mjs';
import { crearPrograma as propio } from './propio-paquete.mjs';
import { cargarQuickJS, motorQuickJS } from './quickjs.mjs';
import { referencias, ejecutarCaso, diferencias } from './corpus.mjs';
export async function comparar() {
  const Q = await cargarQuickJS(), motores = { vm, ...(Q ? { Q: motorQuickJS(Q) } : {}), P: propio, N: nativo };
  if (!Q) console.warn('Q omitido: falta CBL_QUICKJS (node_modules externo; no se descarga nada).');
  const resultados = {};
  for (const [motor, crearPrograma] of Object.entries(motores)) {
    const casos = []; const t = performance.now();
    for (const caso of referencias) {
      const inicio = performance.now();
      try {
        const actual = await ejecutarCaso(caso, crearPrograma), campos = diferencias(caso, actual);
        casos.push({ id: caso.id, reglas: caso.reglas, ms: performance.now() - inicio, coincide: !campos.length,
          campos, hash: actual.hash, pasos: actual.pasos,
          ...(caso.tramos ? { tramosIguales: caso.tramos.filter((t, i) => isDeepStrictEqual(t, actual.tramos?.[i])).length } : {}),
          ...(campos.length ? { resultado: actual.resultado, tramos: actual.tramos } : {}) });
        if (campos.length) console.log(`${motor} ${caso.id}: distintos ${campos.join(', ')}; ${JSON.stringify(actual.resultado).slice(0, 230)}`);
      } catch (e) { casos.push({ id: caso.id, reglas: caso.reglas, coincide: false, error: e.stack }); console.log(`${motor} ${caso.id}: ${e.stack}`); }
    }
    resultados[motor] = { iguales: casos.filter(c => c.coincide).length, total: casos.length,
      factory: { iguales: casos.filter(c => c.reglas === 'factory' && c.coincide).length, total: 28 },
      campaign: { iguales: casos.filter(c => c.reglas === 'campaign' && c.coincide).length, total: 2,
        tramosIguales: casos.reduce((n, c) => n + (c.tramosIguales ?? 0), 0),
        tramosTotal: referencias.reduce((n, c) => n + (c.tramos?.length ?? 0), 0) },
      ms: performance.now() - t, casos };
    console.log(`${motor}: ${resultados[motor].iguales}/41; Factory ${resultados[motor].factory.iguales}/28; Campaign ${resultados[motor].campaign.iguales}/2; ${Math.round(resultados[motor].ms)} ms`);
  }
  guardarMedidas('paso-4a-compatibilidad', resultados);
  return resultados;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const resultados = await comparar();
  if (Object.values(resultados).some(r => r.iguales !== r.total)) process.exitCode = 1;
}
