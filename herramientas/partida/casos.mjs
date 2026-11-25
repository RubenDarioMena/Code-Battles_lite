// Única selección para referencias sin pantalla y contraste con el juego real.
import { casosFactory, opcionesFactory, exclusionFactory } from '../../pruebas/partida-factory-casos.mjs';

/** @returns {any[]} Casos nuevos en cada llamada para evitar mutaciones compartidas. */
export function casosReferencia() {
  const casos = [];
  for (let reto = 1; reto <= 5; reto++) for (const semilla of [1, 7])
    casos.push({ id: `war-${reto}-${semilla}`, nombre: `War ${reto}/${semilla}`, reglas: 'war', reto, semilla });
  for (const c of casosFactory()) if (!exclusionFactory(c))
    casos.push({ id: `factory-${c.id}`, nombre: `Factory ${c.id}`, ...opcionesFactory(c) });
  for (const lenguaje of ['js', 'python'])
    casos.push({ id: `campaign-${lenguaje}`, nombre: `Campaign ${lenguaje}`, reglas: 'campaign', lenguaje });
  // Escritos a mano: inicial de War 2 y reto-1-victoria del oráculo de Factory.
  casos.push({ id: 'war-2-7-python', nombre: 'War 2/7 Python', reglas: 'war', reto: 2, semilla: 7,
    programas: { 'LAU-01': { lenguaje: 'python', codigo:
      'while True:\n    pos = auto_target("crawler", "visual")\n    regular_shoot(pos)\n    await wait(0.5)' } } });
  const factory = casos.find(c => c.id === 'factory-reto-1-victoria');
  casos.push({ ...factory, id: 'factory-reto-1-victoria-python', nombre: 'Factory reto-1-victoria Python',
    programas: { R1: { lenguaje: 'python', codigo:
      'for i in range(3):\n    await pick_up("ENT-1", "cobre")\n    await deliver("FUN")\n\nfor i in range(3):\n    await pick_up("ENT-1", "silicio")\n    await deliver("ENS")' } } });
  casos.push({ id: 'war-1-victoria', nombre: 'war-1-victoria', reglas: 'war', reto: 1, semilla: 13,
    programas: { 'LAU-01': 'while (true) {\n  regularShoot(autoTarget("crawler", "visual"));\n  await esperar(0.5);\n}' } });
  casos.push({ id: 'war-4-atascos', nombre: 'war-4-atascos', reglas: 'war', reto: 4, semilla: 13,
    programas: { 'LAU-01': 'while (true) {\n  burstFire(autoTarget("drone", "visual") ?? autoTarget("crawler", "visual"));\n  await esperar(0.4);\n}' } });
  return casos;
}

/** Parámetros persistibles; no guarda etiquetas, callbacks ni undefined.
 * @param {any} caso */
export function parametrosCaso({ id, nombre, reglas, ...parametros }) {
  return JSON.parse(JSON.stringify(parametros));
}
