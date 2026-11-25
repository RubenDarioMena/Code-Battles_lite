import { crearSolver } from '../rig/index.js';

/** Conecta una instancia (también una copia del GLB) por nombre dentro del nivel. */
export function conectarRig(THREE, raizObject3D, rig, nivel) {
  const solver = crearSolver(rig, nivel);
  const nodos = rig.niveles[nivel].orden.map(nombre => {
    const nodo = raizObject3D.getObjectByName(`L${nivel}_${nombre}`);
    if (!nodo) throw Error('Falta el pivote del rig: '+nombre);
    return {nombre, nodo};
  });
  for (const {nodo} of nodos) nodo.matrixAutoUpdate = false;
  function aplicar(valores) {
    const pose = solver.evaluar(valores);
    for (let i=0; i<nodos.length; i++) {
      const {nombre, nodo} = nodos[i];
      nodo.matrix.fromArray(pose.locales[nombre]);
      nodo.matrixWorldNeedsUpdate = true;
    }
    return pose;
  }
  aplicar(undefined);
  return {controles: solver.controles, aplicar};
}
