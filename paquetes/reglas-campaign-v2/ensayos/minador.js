import { ficha as min } from '../mecanicas/minador/ficha.js';

// Ensayo del minador: sale por la puerta, siembra sus cuatro cargas en el carril de las orugas y avisa cada vez que una
// estalla (onDetonation). Puestos en casillas locales; el programa, en metros.
export default {
  clave: 'minador', titulo: 'cv2.minador.titulo', objetivo: 'cv2.minador.objetivo',
  leccion: 'cv2.minador.leccion', pista: 'cv2.minador.pista',
  lanzadores: [{ id: 'LAU-01', x: 6, y: 5 }], sensores: [], reparadores: 0,
  cargador: 8, suministro: 1, niebla: false,
  unidades: [{ id: 'MIN-01', tipo: min.id, home: { x: 1.5, y: 9.5 }, ...min.experimental }],
  oleadas: [{ tipo: /** @type {const} */ ('crawler'), n: 6, t: 14, cada: 3, carriles: [9], vel: 1, hp: 3 }],
  metas: { brechasMax: 3, derribosMin: 3 },
  inicialPython: { 'MIN-01': [
    'def avisar(carga):', '    print("¡Carga!", carga.enemigos, "enemigos")', 'on_detonation(avisar)',
    'puesto = home', 'puesto.y = 81.5',
    'for x in [222, 220, 218, 216]:', '    puesto.x = x', '    move_to(puesto)', '    await arrive()', '    drop()',
    'puesto.x = 205.5', 'move_to(puesto)',
  ] },
  inicial: { 'LAU-01': [], 'MIN-01': [
    'onDetonation(carga => log("¡Carga!", carga.enemigos, "enemigos"));',
    'for (const x of [222, 220, 218, 216]) {', '  moveTo({x, y: 81.5});', '  await arrive();', '  drop();', '}',
    '// Vuelve detrás de la muralla mientras estallan.', 'moveTo({x: 205.5, y: 81.5});',
  ] },
};
