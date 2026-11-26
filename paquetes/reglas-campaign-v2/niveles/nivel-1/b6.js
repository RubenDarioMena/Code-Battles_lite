import { ficha as veh } from '../../mecanicas/vehiculo/ficha.js';
import { ficha as tir } from '../../mecanicas/tirador/ficha.js';
// Las dos torretas y el sensor de la B5: los programas del jugador siguen valiendo de una Batalla a otra.
const torretas = [{ id: 'LAU-01', x: 6, y: 5 }, { id: 'LAU-02', x: 6, y: 13 }];
const torreta = ['while (true) {', '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");',
  '  regularShoot(pos);', '  await esperar(0.5);', '}'];

// B6 · Fuera de la muralla: el vehículo sale por la puerta y caza drones lejos de la muralla mientras las torretas paran las
// orugas. Fuera espera el tirador: si el vehículo se pone a su alcance (7 m), lo va desgastando.
// Puestos en casillas locales; el programa del vehículo, en metros.
export default {
  clave: 'b6', titulo: 'cv2.b6.titulo', objetivo: 'cv2.b6.objetivo', leccion: 'cv2.b6.leccion', pista: 'cv2.b6.pista',
  lanzadores: torretas, sensores: [{ id: 'VIB-01', x: 17, y: 9, alcance: 8 }], reparadores: 1, cargador: 10, suministro: 1.5, niebla: false,
  unidades: [{ id: 'VEH-01', tipo: veh.id, home: { x: 1.5, y: 6.5 }, ...veh.experimental }],
  hostiles: [{ id: 'TIR-01', tipo: tir.id, home: { x: 23, y: 12 }, ...tir.experimental }],
  oleadas: [
    { tipo: /** @type {const} */ ('crawler'), n: 6, t: 2, cada: 3, carriles: [5, 13, 9, 11, 7, 9], hp: 2 },
    { tipo: /** @type {const} */ ('drone'), n: 20, t: 8, cada: .4, carriles: [8, 9, 10, 7, 11, 9, 8], vel: 2 },
  ],
  // Afinado en Node: las torretas solas dejan pasar orugas (persiguen drones); con el vehículo cazando drones, o con
  // las torretas a por las orugas y el vehículo a por los drones, se gana con margen.
  metas: { brechasMax: 2, derribosMin: 14 },
  inicial: {
    'LAU-01': torreta, 'LAU-02': torreta,
    'VEH-01': [
      '// Sal por la puerta hasta un puesto lejos del tirador (está hacia x 227, y 84).',
      'moveTo({x: 214, y: 79.5});', 'await arrive();', 'while (true) {',
      '  const objetivo = autoTarget("drone", "visual");', '  regularShoot(objetivo);', '  await esperar(0.2);', '}',
    ],
  },
  inicialPython: {
    'VEH-01': [
      '# Sal por la puerta hasta un puesto lejos del tirador (está hacia x 227, y 84).',
      'puesto = home', 'puesto.x = 214', 'puesto.y = 79.5', 'move_to(puesto)', 'await arrive()', 'while True:',
      '    objetivo = auto_target("drone", "visual")', '    regular_shoot(objetivo)', '    await wait(0.2)',
    ],
  },
};
