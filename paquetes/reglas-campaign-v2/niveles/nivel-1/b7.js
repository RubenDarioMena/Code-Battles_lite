import { ficha as whl } from '../../mecanicas/rueda/ficha.js';
// Las dos torretas y el sensor de la B5: los programas del jugador siguen valiendo de una Batalla a otra.
const torretas = [{ id: 'LAU-01', x: 6, y: 5 }, { id: 'LAU-02', x: 6, y: 13 }];
const torreta = ['while (true) {', '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");',
  '  regularShoot(pos);', '  await esperar(0.5);', '}'];

// B7 · La rueda: llegan orugas blindadas en fila por el carril de la puerta. Las torretas no las tumban a tiempo;
// la rueda kamikaze espera en el carril y estalla cuando una se acerca. Reaparece a los 12 s y su programa vuelve
// a empezar, así que el mismo programa sirve para cada oruga.
export default {
  clave: 'b7', titulo: 'cv2.b7.titulo', objetivo: 'cv2.b7.objetivo', leccion: 'cv2.b7.leccion', pista: 'cv2.b7.pista',
  lanzadores: torretas, sensores: [{ id: 'VIB-01', x: 17, y: 9, alcance: 8 }], reparadores: 1, cargador: 10, suministro: 1.5, niebla: false,
  unidades: [{ id: 'WHL-01', tipo: whl.id, home: { x: 1.5, y: 9.5 }, ...whl.experimental }],
  oleadas: [
    { tipo: /** @type {const} */ ('crawler'), n: 5, t: 4, cada: 13, carriles: [9], vel: .9, hp: 7 },
    { tipo: /** @type {const} */ ('drone'), n: 10, t: 10, cada: 2.5, carriles: [4, 14, 6, 12, 5, 13], vel: 1.6 },
  ],
  metas: { brechasMax: 1, derribosMin: 12 },
  inicial: {
    'LAU-01': torreta, 'LAU-02': torreta,
    'WHL-01': [
      'moveTo({x: 222, y: 81.5});', 'await arrive();',
      '// nearest: metros hasta el enemigo de suelo más cercano (null si no hay).',
      'while (nearest === null || nearest > 2) {', '  await esperar(0.1);', '}', 'detonate();',
    ],
  },
  inicialPython: {
    'WHL-01': [
      'puesto = home', 'puesto.x = 222', 'puesto.y = 81.5', 'move_to(puesto)', 'await arrive()',
      '# nearest: metros hasta el enemigo de suelo más cercano (None si no hay).',
      'while nearest is None or nearest > 2:', '    await wait(0.1)', 'detonate()',
    ],
  },
};
