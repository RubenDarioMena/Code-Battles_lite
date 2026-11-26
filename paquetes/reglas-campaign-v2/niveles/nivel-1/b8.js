import { ficha as min } from '../../mecanicas/minador/ficha.js';
// Las dos torretas y el sensor de la B5: los programas del jugador siguen valiendo de una Batalla a otra.
const torretas = [{ id: 'LAU-01', x: 6, y: 5 }, { id: 'LAU-02', x: 6, y: 13 }];
const torreta = ['while (true) {', '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");',
  '  regularShoot(pos);', '  await esperar(0.5);', '}'];

// B8 · Siembra: una columna de orugas blindadas llega a los 16 s por el carril de la puerta, tan seguida que ni las
// torretas ni una rueda bastan. El minador sale antes, siembra sus cuatro cargas en el carril y vuelve tras la
// muralla; onDetonation avisa de cada carga que estalla. Cierra el nivel.
export default {
  clave: 'b8', titulo: 'cv2.b8.titulo', objetivo: 'cv2.b8.objetivo', leccion: 'cv2.b8.leccion', pista: 'cv2.b8.pista',
  lanzadores: torretas, sensores: [{ id: 'VIB-01', x: 17, y: 9, alcance: 8 }], reparadores: 1, cargador: 10, suministro: 1.5, niebla: false,
  unidades: [{ id: 'MIN-01', tipo: min.id, home: { x: 1.5, y: 9.5 }, ...min.experimental }],
  oleadas: [
    { tipo: /** @type {const} */ ('crawler'), n: 8, t: 16, cada: 2, carriles: [9], vel: 1, hp: 5 },
    { tipo: /** @type {const} */ ('drone'), n: 10, t: 6, cada: 2, carriles: [4, 14, 5, 13, 6, 12], vel: 1.8 },
  ],
  // Afinado en Node: sin el minador pasan cuatro; con sus cuatro cargas, dos.
  metas: { brechasMax: 3, derribosMin: 14 },
  inicial: {
    'LAU-01': torreta, 'LAU-02': torreta,
    'MIN-01': [
      'onDetonation(carga => log("¡Carga!", carga.enemigos, "enemigos"));',
      'for (const x of [222, 220, 218, 216]) {', '  moveTo({x, y: 81.5});', '  await arrive();', '  drop();', '}',
      '// Vuelve detrás de la muralla mientras estallan.', 'moveTo({x: 205.5, y: 81.5});',
    ],
  },
  inicialPython: {
    'MIN-01': [
      'def avisar(carga):', '    print("¡Carga!", carga.enemigos, "enemigos")', 'on_detonation(avisar)',
      'puesto = home', 'puesto.y = 81.5',
      'for x in [222, 220, 218, 216]:', '    puesto.x = x', '    move_to(puesto)', '    await arrive()', '    drop()',
      '# Vuelve detrás de la muralla mientras estallan.', 'puesto.x = 205.5', 'move_to(puesto)',
    ],
  },
};
