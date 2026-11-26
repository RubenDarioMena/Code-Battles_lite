// Campaign-V2 · máquinas del taller de carcasas (P7) en el lenguaje papercraft de la planta: colores planos con
// contorno, bancada sobre la losa y el frente (+z) hacia el punto de trabajo. Cada una añade su cuerpo al grupo y, si
// se mueve al trabajar, deja `o.anima(anda, ahora)`, que fabrica.js llama en cada cuadro.
//   embutidora: cuatro columnas naranjas y un punzón de media esfera que baja sobre la matriz.
//   sierra:     mesa pizarra, disco de acero con dientes marcados y guarda amarilla.
//   laser:      cabina ladrillo, pórtico de acero y un cabezal que recorre la pieza con el haz rojo.
//   fundidora:  horno de ladrillo con crisol de hierro, boca de brasa que se enciende al fundir y chimenea.

/** Altura del rótulo y del anillo de selección de cada máquina del taller. */
export const ALTO_TALLER = { embutidora: 2.9, sierra: 1.7, laser: 2.1, fundidora: 2.4 };

/**
 * @param {object} e unidad de la planta
 * @param {object} g grupo de la máquina (ya lleva la bancada)
 * @param {object} o objeto de vista de la máquina
 * @param {object} k herramientas de fabrica.js: { THREE, P, caja, cil, cilX, c, semiesfera, haz, brasa, mat }
 * @returns {boolean} si la clase es del taller
 */
export function maquinaTaller(e, g, o, k) {
  const { THREE, P, caja, cil, cilX, c } = k;
  if (e.clase === 'embutidora') {
    g.add(c(caja(1.3, .45, 1.0, P.naranja[2], 0, .25, -.1)));
    g.add(cil(.34, .34, .05, P.hierro[2], 0, .7, -.1, 18));
    for (const x of [-.55, .55]) for (const z of [-.5, .3]) g.add(c(caja(.16, 2.1, .16, P.naranja[0], x, .7, z)));
    g.add(c(caja(1.4, .35, 1.1, P.naranja[0], 0, 2.6, -.1)), cil(.2, .2, .4, P.acero[0], 0, 2.95, -.1));
    const punzon = new THREE.Group();
    punzon.add(caja(.7, .14, .7, P.blanco[0], 0, .2, 0), cil(.08, .08, .4, P.acero[0], 0, .34, 0));
    const cabeza = k.semiesfera(.24, P.acero[1]);
    cabeza.rotation.x = Math.PI; cabeza.position.y = .2;
    punzon.add(cabeza);
    punzon.position.set(0, 1.9, -.1); g.add(punzon);
    o.anima = (anda, ahora) => { punzon.position.y = anda ? 1.1 + .8 * Math.abs(Math.sin(ahora / 220)) : 1.9; };
  } else if (e.clase === 'sierra') {
    g.add(c(caja(1.5, .55, 1.0, P.pizarra[0], 0, .25, -.1)), caja(1.6, .05, 1.1, P.pizarra[1], 0, .8, -.1));
    const disco = new THREE.Group();
    disco.add(cilX(.42, .04, P.acero[1], 0, 0, 0), caja(.06, .1, .06, P.hierro[0], 0, .36, 0), caja(.06, .1, .06, P.hierro[0], 0, -.46, 0));
    disco.position.set(0, .98, -.1); g.add(disco);
    g.add(c(caja(.14, .75, .14, P.amarillo[0], 0, .85, -.62)), c(caja(.2, .12, .7, P.amarillo[0], 0, 1.5, -.3)));
    g.add(caja(.42, .32, .36, P.hierro[0], .55, .85, -.45));
    o.anima = (anda, ahora) => { if (anda) disco.rotation.x = -ahora / 45; };
  } else if (e.clase === 'laser') {
    g.add(c(caja(1.6, .6, 1.1, P.ladrillo[0], 0, .25, -.1)), caja(1.5, .03, 1.0, P.hierro[0], 0, .85, -.1));
    for (const x of [-.72, .72]) g.add(c(caja(.14, .9, .14, P.acero[0], x, .85, -.55)));
    g.add(c(caja(1.6, .16, .2, P.acero[0], 0, 1.75, -.55)));
    const cabezal = new THREE.Group(), haz = new THREE.Mesh(k.geo(new THREE.CylinderGeometry(.025, .025, .75, 6)), k.haz);
    cabezal.add(caja(.22, .3, .26, P.blanco[0], 0, -.15, .2));
    haz.position.set(0, -.525, .2); haz.visible = false; cabezal.add(haz);
    cabezal.position.set(0, 1.75, -.55); g.add(cabezal);
    o.anima = (anda, ahora) => { haz.visible = anda; cabezal.position.x = anda ? .5 * Math.sin(ahora / 260) : 0; };
  } else if (e.clase === 'fundidora') {
    g.add(c(caja(1.5, .7, 1.2, P.ladrillo[2], -.1, .25, -.1)), c(cil(.5, .58, .7, P.hierro[0], -.1, .95, -.1, 18)));
    const boca = cil(.42, .42, .04, P.hierro[2], -.1, 1.64, -.1, 18), fria = boca.material;
    g.add(boca, c(cil(.14, .14, 1.6, P.hierro[1], .6, .25, -.55, 10)));
    o.anima = (anda, ahora) => { boca.material = anda ? k.brasa : fria; boca.scale.x = boca.scale.z = anda ? 1 + .05 * Math.sin(ahora / 90) : 1; };
  } else return false;
  return true;
}
