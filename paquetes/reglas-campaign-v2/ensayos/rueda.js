import { ficha as whl } from '../mecanicas/rueda/ficha.js';

// Ensayo de la rueda kamikaze: espera en el carril de las orugas y estalla cuando una llega cerca. Al estallar se
// destruye, reaparece a los 6 s y su programa vuelve a empezar. Puestos en casillas locales; el programa, en metros.
export default {
  clave: 'rueda', titulo: 'cv2.rueda.titulo', objetivo: 'cv2.rueda.objetivo',
  leccion: 'cv2.rueda.leccion', pista: 'cv2.rueda.pista',
  lanzadores: [{ id: 'LAU-01', x: 6, y: 5 }], sensores: [], reparadores: 0,
  cargador: 8, suministro: 1, niebla: false,
  // En el ensayo reaparece en 6 s (la ficha trae 12): así una sola rueda llega a todas las orugas.
  unidades: [{ id: 'WHL-01', tipo: whl.id, home: { x: 1.5, y: 9.5 }, ...whl.experimental, reaparece: 6 }],
  oleadas: [{ tipo: /** @type {const} */ ('crawler'), n: 4, t: 4, cada: 8, carriles: [9], vel: 1, hp: 2 }],
  metas: { brechasMax: 1, derribosMin: 3 },
  inicialPython: { 'WHL-01': [
    'puesto = home', 'puesto.x = 224', 'puesto.y = 81.5', 'move_to(puesto)', 'await arrive()',
    'while nearest is None or nearest > 2:', '    await wait(0.1)', 'detonate()',
  ] },
  inicial: { 'LAU-01': [], 'WHL-01': [
    'moveTo({x: 224, y: 81.5});', 'await arrive();',
    '// nearest: metros hasta el enemigo de suelo más cercano (null si no hay).',
    'while (nearest === null || nearest > 2) {', '  await esperar(0.1);', '}', 'detonate();',
  ] },
};
