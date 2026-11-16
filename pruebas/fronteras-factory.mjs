// Fase 2, paso 7a: Factory por las entradas públicas, con herramientas/partida compartido.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import reglas, { retos as factoryRetos } from '../paquetes/reglas-factory/index.js';
import { restaurar } from '../paquetes/nucleo/index.js';
import { canonico } from '../paquetes/protocolo/index.js';
import { jugar } from '../herramientas/partida/jugar.mjs';
import { resultadoFactory } from '../herramientas/partida/anfitrion-factory.mjs';

const referencias = JSON.parse(readFileSync(new URL('referencias/partidas.json', import.meta.url), 'utf8')).casos
  .filter(c => c.reglas === 'factory');
assert.equal(referencias.length, 28);
let iguales = 0, mismosPasos = 0, mismosResultados = 0, repetidas = 0;
const diferencias = [];
for (const caso of referencias) {
  const { reto, intento = 1, escenario, programas, maxPasos = 10000 } = caso.parametros;
  const def = reto === 7 ? factoryRetos.normalizar(escenario) : factoryRetos.RETOS[reto - 1];
  const r = await jugar({ reglas, escenario: { reto: def, intento }, semilla: intento, programas, maxPasos });
  const final = r.final;
  const resultado = resultadoFactory({ ...r.partida.mundo, ...r.registro }, intento,
    final.fin, final.motivo, final.mensaje, final.linea);
  const comprobar = (actual, esperado, campo) => {
    try { assert.deepEqual(actual, esperado, `${caso.id}: ${campo}`); return true; }
    catch (error) { diferencias.push(error); return false; }
  };
  const hashIgual = comprobar(r.huella.hash, caso.hash, 'hash');
  const pasosIguales = comprobar(r.pasos, caso.pasos, 'pasos');
  const resultadoIgual = comprobar(resultado, caso.resultado, 'resultado completo');
  if (pasosIguales) mismosPasos++;
  if (resultadoIgual) mismosResultados++;
  if (hashIgual && pasosIguales && resultadoIgual) iguales++;
  // Repetición exacta (prueba 2) desde escenario, semilla y órdenes, también si terminó sin avanzar.
  const datos = JSON.parse(JSON.stringify(r.partida.serializar()));
  const repetida = restaurar(datos, reglas);
  repetida.aplicarOrdenes();  // jugarPartida aplica las órdenes del paso actual al llegar
  if (comprobar([repetida.pasoActual, canonico(repetida.instantanea()), repetida.evaluar()],
    [r.pasos, canonico(r.instantanea), r.evaluacion], 'repetición')) repetidas++;
}
if (diferencias.length) {
  for (const error of diferencias) console.error(error.message.includes(': hash')
    ? `${error.message.split('\n')[0]}: actual ${error.actual}; referencia ${error.expected}` : error);
  process.exitCode = 1;
}
console.log(`Fronteras Factory: ${iguales}/28 iguales; pasos ${mismosPasos}/28; resultado completo ${mismosResultados}/28; repetición exacta ${repetidas}/28.`);
