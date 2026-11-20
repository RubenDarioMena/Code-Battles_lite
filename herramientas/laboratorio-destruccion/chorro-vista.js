import { ARMAS } from '../../paquetes/destruccion/index.js';

// Los índices son los de emisión. Si una gota ya chocó o faltó por el presupuesto,
// la vista deja el hueco aunque en el array sigan apareciendo dos gotas contiguas.
export function crearTramos(T, grupo) {
  const geo = new T.CylinderGeometry(.83, 1, 1, 10);
  const material = new T.MeshStandardMaterial({ color: '#c1f96d', emissive: '#85ed35',
    emissiveIntensity: 1.6, metalness: .08, roughness: .16, transparent: true, opacity: .82, depthWrite: false });
  const lote = new T.InstancedMesh(geo, material, 2 * ARMAS.chorro.gotasMax);
  lote.count = 0; lote.frustumCulled = false; lote.renderOrder = 2; lote.name = 'tramos-chorro'; grupo.add(lote);
  const a = new T.Vector3(), b = new T.Vector3(), dir = new T.Vector3(), eje = new T.Vector3(0, 1, 0);
  const aux = new T.Object3D(), impactos = new Map();
  function tramo(desde, hasta, radio, fraccion = 1, maximo = Infinity) {
    a.fromArray(desde); b.fromArray(hasta);
    dir.subVectors(b, a);
    const largo = Math.min(maximo, dir.length() * fraccion);
    if (largo < .0001) return;
    dir.normalize();
    aux.position.copy(a).addScaledVector(dir, largo / 2);
    aux.quaternion.setFromUnitVectors(eje, dir); aux.scale.set(radio, largo, radio);
    aux.updateMatrix(); lote.setMatrixAt(lote.count++, aux.matrix);
  }
  function limpiar() { lote.count = 0; impactos.clear(); }
  function dibujar(e, sucesos, esfera) {
    lote.count = 0;
    for (const [id, h] of impactos) if (h.paso !== e.paso) impactos.delete(id);
    for (const h of sucesos) if (h.tipo === 'gota' && h.paso === e.paso) impactos.set(h.datos.disparo, h);
    const porEmisor = new Map();
    for (const q of e.proyectiles) if (q.tipo === 'gota') {
      if (!porEmisor.has(q.disparo)) porEmisor.set(q.disparo, []);
      porEmisor.get(q.disparo).push(q);
    }
    for (const [id, gotas] of porEmisor) {
      let anterior = impactos.get(id)?.datos;
      for (let i = 0; i < gotas.length; i++) {
        const q = gotas[i], plena = q.modo === 'directo' && q.presion === 1;
        const radio = .013 + .007 * q.presion;
        let pos = q.pos;
        if (plena) {
          // Filtrar la dispersión angular de tres muestras en el cuerpo líquido.
          // En los extremos y junto a un hueco se conserva la trayectoria real.
          const previa = gotas[i - 1], siguiente = gotas[i + 1];
          if (previa?.indice === q.indice - 1 && siguiente?.indice === q.indice + 1 && siguiente.presion === 1) {
            pos = pos.map((v, k) => (previa.pos[k] + 2 * v + siguiente.pos[k]) / 4);
          }
          const recorrido = Math.hypot(...pos.map((v, k) => v - q.origen[k]));
          const fase = e.tiempo * 9 - recorrido * 5 + id;
          pos = [pos[0] + .004 * Math.sin(fase), pos[1], pos[2] + .003 * Math.cos(fase)];
        }
        if (anterior?.indice === q.indice - 1) {
          if (plena) tramo(pos, anterior.pos, radio);
          else if (q.modo === 'directo' && q.presion > .5 && q.indice % 3 !== 0) {
            tramo(pos, anterior.pos, radio, q.presion ** 2);
          } else if (q.modo === 'caotico' && q.indice % 4 === 0) {
            tramo(pos, anterior.pos, radio, .34 * q.presion, .09);
          }
        }
        esfera(pos, radio, Math.min(.022, radio + Math.hypot(...q.velocidad) * .0004), q.velocidad);
        anterior = { indice: q.indice, pos };
      }
      const em = e.emisores.find(em => em.disparo === id);
      if (em?.modo === 'directo' && em.presion === 1 && anterior.indice === em.indice - 1) {
        tramo(em.origen, anterior.pos, .02);
      }
    }
    lote.instanceMatrix.needsUpdate = true;
  }
  return { dibujar, limpiar };
}
