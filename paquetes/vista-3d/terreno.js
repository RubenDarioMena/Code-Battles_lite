/* Paisaje de War y marco de Factory, antes en js/vistas.js. */
export function crearTerreno3D({ THREE, estado, terreno: apiTerreno, terrenoEditor, M, G, L, mesh, lineas, fijo, leerVar }) {
    // ---------- Terreno de alrededor ----------
    // El campo de 32 × 18 sigue siendo el único sitio jugable; alrededor, el suelo y su cuadrícula continúan
    // hasta perderse en la bruma del horizonte, y detrás (al norte) hay una cordillera escalonada.
    // Las montañas son columnas de casillas de 1 m con alturas de 0,5 en 0,5 m: la misma cuadrícula que el
    // campo, baratas de pintar (una sola malla instanciada) y fáciles de usar para colisiones en retos futuros.
    const TERRENO = { x0: -48, x1: estado.cols + 48, z0: -40, z1: estado.rows + 34 };
    // La vista previa usa solo datos visuales. El suelo de la simulación sigue siendo plano.
    // El desplazamiento de profundidad evita interferencias con la cuadrícula sobre la malla plana.
    const matTerrenoEditor = terrenoEditor ? new THREE.MeshLambertMaterial({
      color: 0xffffff, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }) : null;
    const matAguaEditor = terrenoEditor ? new THREE.MeshLambertMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide,
    }) : null;
    const materialesBloques = new Map((terrenoEditor?.bloques || []).map(b => [b.id,
      new THREE.MeshPhongMaterial({ color: b.coloresCaras ? 0xffffff : b.color, vertexColors: !!b.coloresCaras, flatShading: true, shininess: 8, side: THREE.DoubleSide }),
    ]));
    const MONTES = { x0: -40, x1: estado.cols + 40, z0: -30, z1: -2 };
    const PICOS = [[-30, -17, 12, 13], [-14, -13, 10, 11], [0, -19, 13, 15], [12, -12, 8, 9], [22, -20, 13, 17], [33, -13, 9, 10], [45, -18, 12, 14], [58, -14, 10, 11], [70, -20, 12, 13]];
    // Ruido suave y fijo por casilla (sin Math.random): el paisaje es siempre el mismo.
    const hash = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
    function ruido(x, z, paso) {
      const i = Math.floor(x / paso), j = Math.floor(z / paso), u = x / paso - i, v = z / paso - j;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
      return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
    }
    function alturaMonte(i, j) {
      const x = i + .5, z = j + .5, lejos = -z - 2;  // casillas detrás del borde norte del campo
      // Laderas: suben desde el borde del campo; picos: conos suaves repartidos a lo largo.
      let h = Math.min(1, lejos / 9) * (2 + 5 * ruido(x, z, 7));
      for (const [cx, cz, r, a] of PICOS) {
        const t = 1 - Math.hypot(x - cx, (z - cz) * 1.3) / r;
        if (t > 0) h = Math.max(h, a * t * t * (3 - 2 * t) * Math.min(1, lejos / 5));
      }
      h += (ruido(x, z, 3) - .5) * 1.6;
      return Math.max(0, Math.round(h));  // terrazas de 1 m
    }
    const celdasMonte = [];
    for (let i = MONTES.x0; i < MONTES.x1; i++) for (let j = MONTES.z0; j < MONTES.z1; j++) {
      const h = alturaMonte(i, j); if (h >= 1) celdasMonte.push([i, j, h]);
    }
    let montes = null;
    const matMonte = new THREE.MeshLambertMaterial({ color: 0xffffff });  // el color va en cada columna
    function pintarMontes() {
      if (!montes) return;
      const bajo = new THREE.Color(leerVar("building") || "#26313A"), alto = new THREE.Color(leerVar("edge") || "#5C6B75");
      const nieve = new THREE.Color(leerVar("ink") || "#DCE3E6"), c = new THREE.Color();
      celdasMonte.forEach(([i, j, h], n) => {
        c.copy(bajo).lerp(alto, Math.min(1, h / 12) * .85);
        if (h >= 12) c.lerp(nieve, .5);
        c.multiplyScalar(h % 2 ? .8 : .88);  // terrazas alternas: se leen las curvas de nivel
        montes.setColorAt(n, c);
      });
      if (montes.instanceColor) montes.instanceColor.needsUpdate = true;
    }
    function construirTerreno(conMontes = true) {
      const { x0, x1, z0, z1 } = TERRENO;
      const afuera = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.afuera);
      afuera.rotation.x = -Math.PI / 2; afuera.position.set((x0 + x1) / 2, terrenoEditor ? -2.02 : -.02, (z0 + z1) / 2); afuera.raycast = () => {};
      if (terrenoEditor) {
        const terreno = mesh(apiTerreno.crearGeometria(THREE, terrenoEditor), matTerrenoEditor);
        terreno.name = "Terreno del editor";
        terreno.raycast = () => {};
        fijo.add(afuera, terreno);
        const agua = mesh(apiTerreno.crearGeometriaAgua(THREE, terrenoEditor), matAguaEditor);
        agua.name = "Agua del editor"; agua.visible = agua.geometry.drawRange.count > 0;
        agua.renderOrder = 1; agua.raycast = () => {}; fijo.add(agua);
        for (const b of terrenoEditor.bloques) {
          const bloque = mesh(apiTerreno.BLOQUES.geometria(THREE, b), materialesBloques.get(b.id));
          bloque.name = `Bloque del editor: ${b.nombre}`;
          bloque.position.fromArray(b.posicion); bloque.rotation.set(...b.rotacion); bloque.scale.fromArray(b.escala);
          bloque.raycast = () => {}; fijo.add(bloque);
        }
        return;
      }
      const p = [];
      for (let i = x0; i <= x1; i++) p.push([i, -.01, z0], [i, -.01, z1]);
      for (let j = z0; j <= z1; j++) p.push([x0, -.01, j], [x1, -.01, j]);
      const red = lineas(p, L.gridFuera); red.raycast = () => {};
      if (!conMontes) { fijo.add(afuera, red); return; }
      montes = new THREE.InstancedMesh(G.caja(1, 1, 1), matMonte, celdasMonte.length);
      const m = new THREE.Matrix4();
      celdasMonte.forEach(([i, j, h], n) => { m.makeScale(1, h, 1); m.setPosition(i + .5, h / 2 - .02, j + .5); montes.setMatrixAt(n, m); });
      montes.raycast = () => {};
      pintarMontes();
      fijo.add(afuera, red, montes);
    }

    return { construirTerreno, pintarMontes };
}
