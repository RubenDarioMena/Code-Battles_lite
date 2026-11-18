import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ejecutarWar } from './partida/anfitrion-war.mjs';
import { ejecutarCampaign } from './partida/anfitrion-campaign.mjs';
import { ejecutarFactory } from './partida/anfitrion-factory.mjs';

try {
  const { values: v } = parseArgs({ options: {
    reglas: { type: 'string' }, reto: { type: 'string' }, semilla: { type: 'string' },
    lenguaje: { type: 'string' }, intento: { type: 'string' }, escenario: { type: 'string' },
    programas: { type: 'string' }, json: { type: 'boolean', default: false },
    motor: { type: 'string', default: 'interprete' },
    'max-pasos': { type: 'string' },
    'paso-a-paso': { type: 'boolean', default: false }, 'max-lineas': { type: 'string' },
  } });
  if (!['war', 'factory', 'campaign'].includes(v.reglas) || (v.reglas !== 'campaign' && (!v.reto || !(v.semilla || (v.reglas === 'factory' && v.intento)))))
    throw new Error('Uso: --reglas war|factory --reto N (--semilla S | --intento K), o --reglas campaign [--lenguaje js|python]; [--programas archivo.json] [--json] [--max-pasos N] [--motor vm|interprete] [--paso-a-paso] [--max-lineas N].');
  if (!['vm', 'interprete'].includes(v.motor)) throw new Error('--motor debe ser vm|interprete.');
  if (v['max-lineas'] && !v['paso-a-paso']) throw new Error('--max-lineas requiere --paso-a-paso.');
  if (v['max-lineas'] != null && (!Number.isSafeInteger(Number(v['max-lineas'])) || Number(v['max-lineas']) < 1)) throw new Error('--max-lineas debe ser un entero positivo.');
  const programas = v.programas ? JSON.parse(readFileSync(v.programas, 'utf8')) : undefined;
  if (v.reglas !== 'campaign' && v.programas && (!programas || typeof programas !== 'object' || Array.isArray(programas)))
    throw new Error('--programas requiere un objeto JSON por unidad.');
  if (v.reglas === 'war' && (v.intento || v.escenario)) throw new Error('--intento y --escenario son exclusivos de Factory.');
  if (v.reglas === 'campaign' && (v.reto || v.semilla || v.intento || v.escenario)) throw new Error('Campaign usa un solo nivel continuo, sin reto, semilla, intento ni escenario.');
  if (v.lenguaje && (v.reglas !== 'campaign' || !['js', 'python'].includes(v.lenguaje))) throw new Error('--lenguaje js|python es exclusivo de Campaign.');
  const ejecutar = v.reglas === 'campaign' ? ejecutarCampaign : v.reglas === 'factory' ? ejecutarFactory : ejecutarWar;
  const { instantanea, ...salida } = await ejecutar(/** @type {any} */ ({ lenguaje: v.lenguaje, reto: Number(v.reto), semilla: v.semilla == null ? undefined : Number(v.semilla),
    intento: v.intento == null ? undefined : Number(v.intento),
    escenario: v.escenario ? JSON.parse(readFileSync(v.escenario, 'utf8')) : undefined,
    programas, motor: v.motor, pasoAPaso: v['paso-a-paso'],
    maxLineas: v['max-lineas'] == null ? undefined : Number(v['max-lineas']),
    alLinea: ({ unidad, t, linea }) => (v.json ? console.error : console.log)(`${unidad} t=${t.toFixed(2)} línea=${linea}`), maxPasos: v['max-pasos'] == null ? undefined : Number(v['max-pasos']) }));
  if (v.json) console.log(JSON.stringify(salida));
  else {
    console.log('tramos' in salida ? 'Campaign · H0–H5' : `${v.reglas === 'factory' ? 'Factory' : 'War'} · reto ${salida.reto} · semilla ${salida.semilla}`);
    if ('tramos' in salida) console.log(`Tramos: ${JSON.stringify(salida.tramos)}`);
    console.log(`Resultado: ${JSON.stringify(salida.resultado)}`);
    console.log(`Métricas: ${JSON.stringify(salida.metricas)}`);
    console.log(`SHA-256: ${salida.hash}`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
