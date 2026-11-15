import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ejecutarWar } from './partida/anfitrion-war.mjs';
import { ejecutarFactory } from './partida/anfitrion-factory.mjs';

try {
  const { values: v } = parseArgs({ options: {
    reglas: { type: 'string' }, reto: { type: 'string' }, semilla: { type: 'string' },
    intento: { type: 'string' }, escenario: { type: 'string' },
    programas: { type: 'string' }, json: { type: 'boolean', default: false },
    'max-pasos': { type: 'string', default: '10000' },
  } });
  if (!['war', 'factory'].includes(v.reglas) || !v.reto || !(v.semilla || (v.reglas === 'factory' && v.intento)))
    throw new Error('Uso: node herramientas/partida.mjs --reglas war|factory --reto N (--semilla S | --intento K) [--programas archivo.json] [--escenario archivo.json] [--json] [--max-pasos N]');
  const programas = v.programas ? JSON.parse(readFileSync(v.programas, 'utf8')) : undefined;
  if (v.programas && (!programas || typeof programas !== 'object' || Array.isArray(programas)))
    throw new Error('--programas requiere un objeto JSON por unidad.');
  if (v.reglas === 'war' && (v.intento || v.escenario)) throw new Error('--intento y --escenario son exclusivos de Factory.');
  const ejecutar = v.reglas === 'factory' ? ejecutarFactory : ejecutarWar;
  const { instantanea, ...salida } = ejecutar({ reto: Number(v.reto), semilla: v.semilla == null ? undefined : Number(v.semilla),
    intento: v.intento == null ? undefined : Number(v.intento),
    escenario: v.escenario ? JSON.parse(readFileSync(v.escenario, 'utf8')) : undefined,
    programas, maxPasos: Number(v['max-pasos']) });
  if (v.json) console.log(JSON.stringify(salida));
  else {
    console.log(`${v.reglas === 'factory' ? 'Factory' : 'War'} · reto ${salida.reto} · semilla ${salida.semilla}`);
    console.log(`Resultado: ${JSON.stringify(salida.resultado)}`);
    console.log(`Métricas: ${JSON.stringify(salida.metricas)}`);
    console.log(`SHA-256: ${salida.hash}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
