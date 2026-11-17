import { readFileSync } from 'node:fs';
import { traducir } from '../herramientas/partida/diagnosticos.mjs';

/** Los índices históricos son 0–6; la herramienta pública usa 1–7.
 * @param {any} caso */
export function opcionesFactory(caso) {
  return { reglas: 'factory', reto: caso.reto + 1, intento: caso.intento,
    escenario: caso.escenario, programas: { R1: caso.codigo } };
}

/** No pertenece a las 41 referencias históricas; hoy se comprueba con presupuesto determinista.
 * @param {any} caso @returns {string|null} */
export function exclusionFactory(caso) {
  return caso.id === 'bucle-sin-await'
    ? 'Fuera de la selección histórica de 41; comprobado en partida-factory y partida-interprete.' : null;
}

/** Carga el oráculo y sus deltas explícitos sin alterar los originales. */
export function casosFactory() {
  const oraculo = JSON.parse(readFileSync(new URL('./factory-oraculo.json', import.meta.url), 'utf8'));
  const deltas = JSON.parse(readFileSync(new URL('./factory-deltas.json', import.meta.url), 'utf8'));
  return oraculo.casos.map(caso => ({ ...caso, delta: deltas.casos[caso.id] ?? null,
    esperado: { ...caso.resultado, ...deltas.casos[caso.id]?.cambios,
      ...(caso.id === 'bucle-sin-await' ? { mensaje: traducir('partida.presupuesto.factory', { unidad: 'R1' }), linea: 1 } : {}) } }));
}
