import { ficha as veh } from '../mecanicas/vehiculo/ficha.js';
import { ficha as tir } from '../mecanicas/tirador/ficha.js';

// Puestos del nivel en casillas locales. El programa recibe posiciones en metros.
export default {
  clave: 'salida', titulo: 'cv2.salida.titulo', objetivo: 'cv2.salida.objetivo',
  leccion: 'cv2.salida.leccion', pista: 'cv2.salida.pista',
  lanzadores: [{ id: 'LAU-01', x: 6, y: 5 }], sensores: [], reparadores: 0,
  cargador: 8, suministro: 1, niebla: false,
  unidades: [{ id: 'VEH-01', tipo: veh.id, home: { x: 1.5, y: 6.5 }, ...veh.experimental }],
  hostiles: [{ id: 'TIR-01', tipo: tir.id, home: { x: 23, y: 10 }, ...tir.experimental }],
  oleadas: [{ tipo: /** @type {const} */ ('drone'), n: 4, t: 3, cada: 5, carriles: [9], vel: 1.2, hp: 1 }],
  metas: { brechasMax: 2, derribosMin: 2 },
  inicialPython: { 'VEH-01': [
    'puesto = home', 'puesto.x = 222', 'puesto.y = 81.5', 'move_to(puesto)', 'await arrive()',
    'while True:', '    objetivo = auto_target("drone", "visual")', '    regular_shoot(objetivo)', '    await wait(0.2)',
  ] },
  inicial: { 'LAU-01': [], 'VEH-01': [
    'moveTo({x: 222, y: 81.5});', 'await arrive();', 'while (true) {',
    '  const objetivo = autoTarget("drone", "visual");', '  regularShoot(objetivo);', '  await esperar(0.2);', '}',
  ] },
};
