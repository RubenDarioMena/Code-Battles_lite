import { apuntar } from './punteria.js';
import { crearMundo, definirRobot, FISICA } from '../../paquetes/destruccion/index.js';
const crema = '#E7DFCE', turquesa = '#2E8C93', grafito = '#464B53', amarillo = '#EAA937';
const caja = (...medidas) => ({ tipo: 'caja', medidas });
const cilindro = (radio, alto, eje = 'z') => ({ tipo: 'cilindro', radio, alto, eje });
const zona = (pos, radio) => ({ tipo: 'esfera', pos, radio });
/** @returns {import('../../paquetes/destruccion/index.js').Pieza} */
function pieza(id, forma, pos, padre, color, mezcla, resistencia, funcion = null, zonaFuncion = null) {
  return {
    id, forma, pos, padre, color, rot: [0, 0, 0, 1], aguante: 1, union: { resistencia }, funcion, zonaFuncion,
    materiales: Object.entries(mezcla).map(([material, cantidad]) => ({ material, cantidad }))
  };
}
const cabeza = () => pieza('cabeza', caja(.44, .32, .28), [0, 0, .82], 'torso', crema,
  { acero: 2, cristal: .4, circuito: .3 }, 5, 'sensor', zona([0, -.10, 0], .053));
export const andador = definirRobot({
  id: 'Andador', piezas: [
    pieza('chasis', caja(.76, .56, .28), [0, 0, .14], null, grafito, { acero: 5, cobre: .5 }, 25),
    pieza('torso', caja(.48, .40, .40), [0, 0, .48], 'chasis', turquesa, { acero: 3, bateria: 1 }, 7, 'energia', zona([0, 0, 0], .055)),
    cabeza(),
  ]
});
function torre(sensor) {
  const cima = sensor ? { ...cabeza(), padre: 'cuerpo' } :
    pieza('cañón', cilindro(.135, .88, 'x'), [.18, 0, .82], 'cuerpo', amarillo, { acero: 3, cobre: 1 }, 6, 'arma', zona([-.28, 0, 0], .06));
  return definirRobot({
    id: 'Torreta', piezas: [
      pieza('base', cilindro(.42, .22), [0, 0, .11], null, grafito, { acero: 5 }, 24),
      pieza('cuerpo', cilindro(.25, .46), [0, 0, .45], 'base', crema, { acero: 3, cobre: 1 }, 9, 'motor', zona([0, 0, 0], .08)),
      cima,
    ]
  });
}
export const torreta = torre(false), torretaSensora = torre(true);
export const oruga = definirRobot({
  id: 'Oruga', piezas: [
    pieza('bloque', caja(.90, .46, .22), [0, 0, .11], null, grafito, { acero: 6 }, 25),
    pieza('cabina', caja(.56, .40, .36), [0, 0, .40], 'bloque', amarillo, { acero: 3, bateria: 1 }, 8, 'energia', zona([0, 0, 0], .065)),
    pieza('antena', cilindro(.095, .44), [.23, -.23, .80], 'cabina', turquesa, { cobre: 1, circuito: .5 }, 4, 'sensor', zona([0, 0, .15], .065)),
  ]
});
export const tanque = definirRobot({
  id: 'Tanque', piezas: [
    pieza('casco', { ...caja(1.30, .62, .36), hueco: .04 }, [0, 0, .18], null, turquesa, { acero: 8 }, 28),
    pieza('motor', caja(.28, .28, .16), [-.42, 0, .13], 'casco', '#ce7849',
      { acero: 2, cobre: 1 }, 5, 'motor', zona([0, 0, 0], .07)),
    pieza('municion', caja(.20, .24, .12), [-.13, 0, .11], 'casco', amarillo,
      { acero: 1, cobre: .5 }, 4, 'arma', zona([0, 0, 0], .065)),
    pieza('bateria', caja(.24, .24, .16), [.37, -.04, .13], 'casco', '#8ebc66',
      { bateria: 2, circuito: .4 }, 5, 'energia', zona([0, 0, 0], .07)),
    pieza('torreta', cilindro(.18, .16), [-.29, 0, .44], 'casco', grafito, { acero: 2 }, 9),
    pieza('cañón', cilindro(.075, .72, 'x'), [.12, 0, .52], 'torreta', crema,
      { acero: 1.5 }, 5, 'arma', zona([-.25, 0, 0], .065))
  ]
});
// El emisor queda a 6 m delante del robot: el mismo rayo que a 2 m, pero el haz cruza el plano en vez de nacer junto a la cámara.
const tiro = (paso, arma, x, z, potencia = 1, opciones = {}) => ({ paso, orden: { arma, potencia, ...opciones, origen: [x, -6, z], direccion: [0, 1, 0] } });
const balistico = (paso, arma, blanco, viento = 0) => ({
  paso, orden: apuntar(arma, [blanco[0], blanco[1] - 6, 1], blanco, 1, viento)
});
export const vientoDemo = 2;
const guiones = {
  granada: [balistico(6, 'granada', [-.75, -.2, .5]), balistico(88, 'granada', [.75, -.34, 0])],
  chorro: [balistico(6, 'chorro', [0, -.24, .52])],
  'chorro-caotico': [balistico(6, 'chorro-caotico', [0, -.24, .52], vientoDemo)],
  cinetico: [tiro(6, 'cinetico', 0, .82, 1.2)],
  laser: [tiro(6, 'laser', 0, .82)],
  acido: [tiro(6, 'acido', .23, .605, 1.5)],
  corte: [.70, .78, .86, .94].map((z, i) => tiro(6 + i * 8, 'laser', .36, z)),
  puente: [tiro(6, 'acido', .24, .82, 1.45, { duracionAcido: 12 })],
  tanque: [tiro(6, 'acido', .09, .18, 3.8),
    { paso: 6, orden: { arma: 'acido', potencia: 3.8, origen: [.09, 6, .18], direccion: [0, -1, 0] } }],
  comparar: [tiro(6, 'cinetico', -1.5, .48, 1.15), tiro(16, 'laser', 0, .48), tiro(26, 'acido', 1.5, .48, 2.3)],
};
export const demos = Object.keys(guiones);
export function escenario(demo, leerViento = () => vientoDemo) {
  const mundo = crearMundo({ semilla: 129 });
  const modelos = { chorro: torreta, 'chorro-caotico': torreta, cinetico: andador, laser: torretaSensora, acido: oruga, corte: torreta, puente: torreta, tanque };
  const lista = demo === 'granada' ? [andador, oruga] : demo === 'comparar' ? [andador, andador, andador] : modelos[demo] ? [modelos[demo]] : [andador, torreta, oruga];
  lista.forEach((def, i) => mundo.agregarRobot(def, { pos: [(i - (lista.length - 1) / 2) * 1.5, 0, 0], rumbo: 0 }));
  let paso = 0, indice = 0, terminada = false;
  const tiros = guiones[demo] ?? [];
  return {
    mundo, paso: () => paso,
    avanzar(alDisparo = (_orden, _informe) => { }, antes = (_orden) => { }) {
      if (terminada) return;
      while (indice < tiros.length && tiros[indice].paso === paso) {
        const tiro = tiros[indice++].orden;
        const orden = tiro.modo === 'caotico' ? { ...tiro, viento: [leerViento(), 0, 0] } : tiro;
        antes(orden);
        alDisparo(orden, mundo.disparar(orden));
      }
      mundo.avanzar(FISICA.dt); paso++;
      if (demo === 'comparar' && paso === 420) { mundo.terminarBatalla(); terminada = true; }
    },
    finSecuencia: demo === 'puente' ? 820 : demo === 'comparar' ? 420 : Math.max(300, (tiros.at(-1)?.paso ?? 0) + 270),
  };
}
