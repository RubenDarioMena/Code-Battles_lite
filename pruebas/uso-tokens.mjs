// Contadores reales del proveedor; no estima tokens a partir del texto visible.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export async function leerUsoCodex(archivo) {
  let ultimo = null;
  const entrada = createReadStream(archivo, { encoding: 'utf8' });
  const lineas = createInterface({ input: entrada, crlfDelay: Infinity });
  try {
    for await (const linea of lineas) {
      let evento;
      try { evento = JSON.parse(linea); } catch { continue; } // Puede estar escribiéndose la última línea.
      if (evento.type !== 'event_msg' || evento.payload?.type !== 'token_count') continue;
      const uso = evento.payload.info?.total_token_usage;
      if (uso) ultimo = { fuente: 'codex-rollout', marca: evento.timestamp, ...uso };
    }
  } finally { lineas.close(); entrada.destroy(); }
  return ultimo;
}

export function diferenciaUso(inicio, fin) {
  if (!inicio || !fin || inicio.fuente !== fin.fuente || inicio.marca === fin.marca) return null;
  const campos = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'];
  const delta = {};
  for (const campo of campos) {
    if (inicio[campo] == null || fin[campo] == null) continue;
    const n = fin[campo] - inicio[campo];
    if (!Number.isFinite(n) || n < 0) return null;
    delta[campo] = n;
  }
  if (delta.total_tokens == null) return null;
  return { fuente: inicio.fuente, desde: inicio.marca, hasta: fin.marca, alcance: 'intervalo observado; puede llegar con retraso', ...delta };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Uso: node pruebas/uso-tokens.mjs /ruta/al/rollout.jsonl');
  console.log(JSON.stringify(await leerUsoCodex(process.argv[2]), null, 2));
}
