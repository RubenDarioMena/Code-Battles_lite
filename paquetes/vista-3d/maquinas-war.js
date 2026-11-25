export function montarSensor(THREE, g, M, rol) {
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 8), M.borde); poste.position.y = .65;
  const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .1, 16), rol); cabeza.position.y = 1.3;
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, .08, 16), M.edificio); pie.position.y = .04;
  g.add(poste, cabeza, pie);
}

export function montarReparador(THREE, g, M, rol) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(.46, .32, .46), rol); c.position.y = .2;
  const a = new THREE.Mesh(new THREE.BoxGeometry(.04, .35, .04), M.borde); a.position.set(.12, .5, .12);
  g.add(c, a);
}
