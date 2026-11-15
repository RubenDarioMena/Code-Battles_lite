import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ejecutarWar } from './partida/anfitrion-war.mjs';

try {
  const { values: v } = parseArgs({ options: {
    reglas: { type: 'string' }, reto: { type: 'string' }, semilla: { type: 'string' },
    programas: { type: 'string' }, json: { type: 'boolean', default: false },
    'max-pasos': { type: 'string', default: '10000' },
  } });
  if (v.reglas !== 'war' || !v.reto || !v.semilla)
    throw new Error('Uso: node herramientas/partida.mjs --reglas war --reto N --semilla S [--programas archivo.json] [--json] [--max-pasos N]');
  const programas = v.programas ? JSON.parse(readFileSync(v.programas, 'utf8')) : undefined;
  if (v.programas && (!programas || typeof programas !== 'object' || Array.isArray(programas)))
    throw new Error('--programas requiere un objeto JSON por unidad.');
  const { instantanea, ...salida } = ejecutarWar({ reto: Number(v.reto), semilla: Number(v.semilla),
    programas, maxPasos: Number(v['max-pasos']) });
  if (v.json) console.log(JSON.stringify(salida));
  else {
    console.log(`War · reto ${salida.reto} · semilla ${salida.semilla}`);
    console.log(`Resultado: ${JSON.stringify(salida.resultado)}`);
    console.log(`Métricas: ${JSON.stringify(salida.metricas)}`);
    console.log(`SHA-256: ${salida.hash}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
