// Definiciones exclusivas del banco: nunca se registran como retos ni se normalizan.
import war, { retos } from '../../paquetes/reglas-war/index.js';
import campaign, { nivel } from '../../paquetes/reglas-campaign/index.js';

/** @returns {{serie: string, unidades: number, semilla: number, reglas: any, escenario: any, programas: Record<string, string>}} */
export function crearEscenario(serie, unidades, semilla = 7) {
  if (!['war', 'campaign'].includes(serie)) throw Error('Serie admitida: war|campaign (Factory solo programa R1)');
  if (!Number.isInteger(unidades) || unidades < 1 || unidades > 500) throw Error('Unidades: entero entre 1 y 500');
  /** @type {Record<string, string[]>} */
  const inicial = {};
  /** @type {any} */
  let reto;
  if (serie === 'war') {
    reto = structuredClone(retos.normalizar(retos.RETOS[1]));
    reto.mapa = { cols: 32, rows: 18 };
    // 504 casillas distintas, todas dentro del mapa y del rango del formulario.
    reto.lanzadores = Array.from({ length: unidades }, (_, i) => ({ id: `LAU-${String(i + 1).padStart(3, '0')}`, x: 3 + i % 28, y: Math.floor(i / 28) }));
    reto.oleadas = Array.from({ length: 12 }, (_, i) => ({ tipo: ['crawler', 'drone', 'stealth'][i % 3], n: 40,
      t: i * 12, cada: .3, carriles: [2, 5, 8, 11, 14, 16], hp: 9, vel: .8 }));
    reto.metas = { brechasMax: 999 }; // Mayor que los 480 enemigos, dentro del límite del formulario.
    for (const [i, u] of reto.lanzadores.entries()) inicial[u.id] = [
      `await esperar(${((i % 10) + 1) * .05});`, 'while (true) {',
      '  const p = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual") ?? autoTarget("stealth", "visual");',
      '  regularShoot(p);', `  await esperar(${((i % 5) + 1) / 10});`, '}',
    ];
  } else {
    reto = structuredClone(nivel.NIVEL);
    // El motor no impone ocupación/colisiones ni máximo de robots. Todo cabe en el pasillo original.
    const robots = Array.from({ length: unidades }, (_, i) => ({ id: `BOT-${String(i + 101).padStart(3, '0')}`,
      clase: 'obrero', cx: 73.4 + (i % 50) * .56, cy: 49.3 + Math.floor(i / 50) * .44, desde: 0 }));
    const lugares = Array.from({ length: 20 }, (_, i) => ({ id: `BAN-${i}`, clase: 'lugar', tipo: 'sup',
      cx: i % 2 ? 102 : 72.8, cy: 49.3 + Math.floor(i / 2) * .44,
      ax: i % 2 ? 102 : 72.8, ay: 49.3 + Math.floor(i / 2) * .44 }));
    reto.unidades.push(...robots, ...lugares);
    reto.robots = robots.map(({ id }) => ({ id }));
    reto.vivos = robots.map(({ id }) => id);
    for (const [i, u] of robots.entries()) {
      const fila = Math.floor(i / 50) * 2, pausa = ((i % 5) + 1) / 10;
      inicial[u.id] = [`await wait(${((i % 10) + 1) * .05});`, 'while (true) {',
        `  await Promise.all([goTo(BAN_${fila}), wait(${pausa})]);`,
        `  await Promise.all([goTo(BAN_${fila + 1}), wait(${pausa})]);`, '}',
      ];
    }
    // H0 permanece abierto: los viajes no trasladan acero a SUP-1.
  }
  reto.inicial = inicial;
  const programas = Object.fromEntries(Object.entries(inicial).map(([id, lineas]) => [id, lineas.join('\n')]));
  return { serie, unidades, semilla, reglas: serie === 'war' ? war : campaign, escenario: { reto }, programas };
}
