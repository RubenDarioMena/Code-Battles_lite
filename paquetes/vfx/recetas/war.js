/** Recetas finitas: ≤1,6 s, destellos ≤0,2 s y humo con alfa ≤0,24.
 * El radio viene de MISIL.radio por composición, nunca por import de reglas.
 * `radioCarga` es el aro de las detonaciones de Campaign-V2 (rueda y cargas del minador, 1,5–2,5 m).
 * @param {{radioDanio: number, radioCarga?: number}} opciones
 * @returns {Record<string, import('../index.js').Receta>} */
export function crearRecetasWar({ radioDanio, radioCarga = 2 }) {
  if (!Number.isFinite(radioDanio) || radioDanio <= 0) throw new Error('radioDanio debe ser positivo y finito');
  /** @returns {import('../index.js').Capa} */
  const humo = (alto = .3) => ({ forma: 'humo', mezcla: 'normal', n: 5,
    retraso: [.04, .1], vida: [.7, 1.2], alto, dir: 'hemisferio', vel: [.2, .6], arrastre: 3,
    deriva: [.08, 0, .45], tam: [.35, 1.2], alfa: [.2, .12, 0], color: ['edge', 'grid-2'] });
  /** @returns {import('../index.js').Capa} */
  const chispas = color => ({ forma: 'brillo', mezcla: 'suma', n: 16,
    vida: [.25, .6], dir: 'hemisferio', vel: [3, 7], arrastre: 3.5,
    grav: -9.8, suelo: true, alto: .35, tam: [.11, .03], alfa: [.9, 0], color: ['#fff4dc', color], estela: 2 });
  /** @returns {import('../index.js').Capa} */
  const aro = (color, alfa, radio) => ({ forma: 'brillo', mezcla: 'suma', n: 64,
    vida: .5, dir: 'anillo', radioFinal: radio, alto: .045,
    tam: [.09, .14, .07], alfa: [alfa, alfa * .6, 0], color: [color] });
  /** @returns {import('../index.js').Capa} */
  const restos = color => ({ forma: 'disco', mezcla: 'normal', n: 12,
    vida: [.7, 1.35], alto: .15, dir: 'hemisferio', vel: [1, 4],
    arrastre: 1.8, grav: -9.8, suelo: true, tam: [.13, .07], alfa: [.85, .7, 0], color: [color, 'edge'] });
  // Los ayudantes solo construyen datos; no son parte del esquema de receta.
  return {
    disparo: { capas: [
      { forma: 'brillo', mezcla: 'suma', n: 1, destello: true, vida: .12, alto: .05, adelante: .65,
        tam: [.9, .2], alfa: [.9, 0], color: ['#fff4dc', 'misil'] },
      { ...chispas('misil'), dir: 'cono', n: 9, vida: [.12, .3], alto: .05, adelante: .65, vel: [3, 6] },
      { ...humo(.08), n: 3, vida: [.35, .65], adelante: .65, dir: 'cono', tam: [.18, .6] },
    ] },
    impacto: { capas: [
      { forma: 'brillo', mezcla: 'suma', n: 1, destello: true, vida: .16, alto: .45,
        tam: [2.5, .8], alfa: [.95, 0], color: ['#fff4dc', 'explosion'] },
      { forma: 'brillo', mezcla: 'suma', n: 7, vida: [.2, .45], alto: .4, dir: 'hemisferio',
        vel: [.3, 1.8], arrastre: 3, tam: [.5, .8, .1], alfa: [.65, .35, 0], color: ['explosion', 'misil'] },
      chispas('misil'), aro('explosion', .7, radioDanio), humo(.5),
    ] },
    fallo: { capas: [
      { ...humo(.1), n: 5, vida: [.45, .85], tam: [.2, 1], color: ['edge', 'grid-2'] },
      aro('edge', .28, radioDanio),
    ] },
    // Detonación de una carga o de la rueda: destello ancho, bola de fuego baja, aro del radio de daño y columna de humo.
    detonacion: { capas: [
      { forma: 'brillo', mezcla: 'suma', n: 1, destello: true, vida: .2, alto: .6,
        tam: [4.5, 1.2], alfa: [1, 0], color: ['#fff4dc', 'explosion'] },
      { forma: 'brillo', mezcla: 'suma', n: 14, vida: [.3, .7], alto: .45, dir: 'hemisferio',
        vel: [.6, 2.6], arrastre: 2.6, tam: [.6, .85, .2], alfa: [.75, .4, 0], color: ['explosion', 'misil'] },
      { ...chispas('misil'), n: 28, vel: [4, 9] }, restos('edge'), aro('explosion', .8, radioCarga),
      { ...humo(.8), n: 9, vida: [.9, 1.4], tam: [.5, 1.8] },
    ] },
    'derribo-oruga': { capas: [restos('enemigo'), chispas('enemigo'), humo(.2)] },
    'derribo-dron': { capas: [restos('enemigo'), { ...chispas('enemigo'), dir: 'esfera' }, humo(0)] },
    'derribo-dron-frio': { capas: [restos('enemigo-frio'), { ...chispas('enemigo-frio'), dir: 'esfera' }, humo(0)] },
    atasco: { capas: [
      { ...chispas('bad'), dir: 'cono', n: 8, vida: [.15, .35], vel: [1, 3] },
      { ...humo(.2), n: 3, vida: [.3, .65], tam: [.2, .65], color: ['grid-2'] },
    ] },
    reparado: { capas: [
      { forma: 'brillo', mezcla: 'suma', n: 14, vida: [.35, .85], retraso: [0, .15],
        alto: .2, dir: 'hemisferio', vel: [.3, .9], deriva: [0, 0, .8],
        tam: [.1, .045], alfa: [.8, 0], color: ['ok'], estela: 1 },
    ] },
    brecha: { capas: [aro('bad', .65, .65)] },
  };
}

/** Selección sobre sucesos del protocolo; el origen se enriquece en la vista.
 * @param {import('../../protocolo/index.js').Suceso} suceso @returns {string | null} */
export function recetaWar(suceso) {
  const d = suceso.datos || {};
  if (suceso.tipo === 'explosion') return d.carga ? 'detonacion' : d.misil === null ? null : (d.golpe ? 'impacto' : 'fallo');
  if (suceso.tipo === 'derribo') return ({ crawler: 'derribo-oruga', drone: 'derribo-dron', stealth: 'derribo-dron-frio' })[String(d.tipo)] || null;
  return ['disparo', 'atasco', 'reparado', 'brecha'].includes(suceso.tipo) ? suceso.tipo : null;
}
