import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { casosReferencia } from './partida/casos.mjs';
import { ejecutarReferencia } from './partida/referencias.mjs';

try {
  const { values } = parseArgs({ options: { forzar: { type: 'boolean', default: false } } });
  const destino = new URL('../pruebas/referencias/partidas.json', import.meta.url);
  if (existsSync(destino)) {
    if (!values.forzar) throw new Error('Las referencias ya existen; se exige --forzar.');
    console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n'
      + 'Regrabar referencias rompe la red de paridad: solo con decisión del autor\n'
      + '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' }).trim();
  const casos = casosReferencia().map(c => ejecutarReferencia(c));
  const datos = { version: 1, generado: { commit, fecha: new Date().toISOString() }, casos };
  mkdirSync(new URL('../pruebas/referencias/', import.meta.url), { recursive: true });
  writeFileSync(destino, JSON.stringify(datos, null, 2) + '\n', { flag: values.forzar ? 'w' : 'wx' });
  console.log(`${casos.length} referencias grabadas en pruebas/referencias/partidas.json`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
