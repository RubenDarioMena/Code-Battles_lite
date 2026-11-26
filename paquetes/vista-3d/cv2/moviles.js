// Modelos de las unidades móviles de Campaign-V2 sin GLB todavía: la rueda kamikaze (WHL) y el minador (MIN).
// Geometría sencilla de colores planos, como el resto de piezas sueltas (maquinas-war.js), en metros con el origen en
// el suelo. Cada montaje devuelve `mover(e, t)`, que la vista llama en cada fotograma con la entidad de la escena.

const ROJO = 0xd8433a, AMBAR = 0xf6b817, NEUMATICO = 0x2f3437, LLANTA = 0xc9d1d4, OLIVA = 0x8a8f3c;

/** Rueda kamikaze: un neumático grueso con buje rojo y un piloto que parpadea. Rueda sobre su eje al avanzar y
 * mira hacia donde va. */
export function montarRueda(THREE, g) {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const radio = .42;
  const rueda = new THREE.Group();
  rueda.position.y = radio;
  const llanta = new THREE.Mesh(new THREE.TorusGeometry(radio - .1, .11, 10, 28), mat(NEUMATICO));
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(radio - .14, radio - .14, .16, 20), mat(LLANTA));
  disco.rotation.x = Math.PI / 2;
  const buje = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .26, 12), mat(ROJO));
  buje.rotation.x = Math.PI / 2;
  // Radios en cruz: así se ve girar.
  const radios = [0, Math.PI / 2].map(a => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(.06, (radio - .14) * 2, .2), mat(ROJO));
    r.rotation.z = a;
    return r;
  });
  rueda.add(llanta, disco, buje, ...radios);
  const piloto = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: AMBAR }));
  piloto.position.y = radio * 2 + .04;
  const rumbo = new THREE.Group();
  rumbo.add(rueda, piloto);
  g.add(rumbo);
  let previo = null, giro = 0;
  return function mover(e, t) {
    if (previo) {
      const dx = e.cx - previo.x, dz = e.cy - previo.y, paso = Math.hypot(dx, dz);
      if (paso > 1e-4) {
        rumbo.rotation.y = Math.atan2(-dz, dx);
        giro -= paso / radio;
      }
    }
    previo = { x: e.cx, y: e.cy };
    rueda.rotation.z = giro;
    piloto.visible = Math.sin(t * 9) > 0;
  };
}

/** Minador: chasis de orugas oliva con una tolva que enseña las cargas que le quedan (discos rojos). Mira hacia donde
 * va. */
export function montarMinador(THREE, g, cargasMax = 4) {
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const rumbo = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1, .34, .66), mat(OLIVA));
  cuerpo.position.y = .33;
  const orugas = [-.38, .38].map(z => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(1.1, .26, .16), mat(NEUMATICO));
    o.position.set(0, .13, z);
    return o;
  });
  const tolva = new THREE.Mesh(new THREE.BoxGeometry(.48, .22, .5), mat(0x5c6127));
  tolva.position.set(-.18, .61, 0);
  const franja = new THREE.Mesh(new THREE.BoxGeometry(.06, .2, .68), mat(AMBAR));
  franja.position.set(.48, .33, 0);
  const cargas = Array.from({ length: cargasMax }, (_, i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .06, 12), mat(ROJO));
    c.position.set(-.18 + (i % 2 ? .1 : -.1), .74 + Math.floor(i / 2) * .07, i < 2 ? -.1 : .1);
    return c;
  });
  rumbo.add(cuerpo, ...orugas, tolva, franja, ...cargas);
  g.add(rumbo);
  let previo = null;
  return function mover(e) {
    if (previo) {
      const dx = e.cx - previo.x, dz = e.cy - previo.y;
      if (Math.hypot(dx, dz) > 1e-4) rumbo.rotation.y = Math.atan2(-dz, dx);
    }
    previo = { x: e.cx, y: e.cy };
    const quedan = e.cargas ?? cargasMax;
    cargas.forEach((c, i) => { c.visible = i < quedan; });
  };
}
