import { readFileSync } from 'node:fs';
import { casosReferencia, parametrosCaso } from '../herramientas/partida/casos.mjs';
import { ejecutarReferencia } from '../herramientas/partida/referencias.mjs';
import { primeraDiferencia, diagnosticoPartida } from './partida-diagnostico.mjs';

try {
  const datos = JSON.parse(readFileSync(new URL('./referencias/partidas.json', import.meta.url), 'utf8'));
  if (datos.version !== 1) throw new Error('Versión de referencias desconocida');
  const casos = casosReferencia();
  const seleccion = casos.map(c => ({ id: c.id, reglas: c.reglas, parametros: parametrosCaso(c) }));
  const grabados = datos.casos.map(({ id, reglas, parametros }) => ({ id, reglas, parametros }));
  const cambio = primeraDiferencia(grabados, seleccion);
  if (cambio) throw new Error(`Selección de referencias distinta: ${cambio.ruta}`);
  let diferencias = 0;
  for (const [i, caso] of casos.entries()) {
    const esperado = datos.casos[i], actual = await ejecutarReferencia(caso);
    if (!primeraDiferencia(esperado, actual)) continue;
    diferencias++;
    console.error(`${caso.id} · DIFERENCIA`);
    // El archivo guarda hashes, no instantáneas por paso: no inventa un primer paso.
    for (const linea of diagnosticoPartida({ juego: esperado, sinPantalla: actual })) console.error(linea);
  }
  if (diferencias) process.exitCode = 1;
  else console.log(`${casos.length} referencias de paridad iguales`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
