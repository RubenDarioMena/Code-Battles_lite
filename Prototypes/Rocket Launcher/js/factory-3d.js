/* Escenario 3D de logística: edificios con primitivas y el transporte T1 (modelos/t1.glb) como R1.
 * La cámara, la selección y las etiquetas son las de la vista 3D común (vistas.js); aquí solo el contenido.
 * Solo dibujo: lee el mundo y nunca lo cambia. */
(() => {
  "use strict";
  const MODELO = "modelos/t1.glb?v=1";
  // Cargador glTF de la misma versión que three.min.js (r128). Solo lo descarga Factory, al abrir el 3D.
  const CARGADOR = "../../shared/vendor/GLTFLoader-r128.js";
  const ESCALA = .8;  // el T1 mide ~1 m de largo: cabe en su casilla con margen
  // LOD por tamaño en pantalla (px que ocupa el robot), no por distancia: así el teléfono, con menos
  // píxeles por metro, baja de nivel a la misma distancia aparente que el PC. Margen para no parpadear.
  const LOD_PX = [110, 45], MARGEN = .12;
  // Brazo (en metros del modelo, ejes de Three.js con el robot mirando a -Z): pivote de la torreta
  // y del hombro, largo de los dos tramos y de la muñeca a la carga.
  const TORRETA = { x: 0, z: .19 }, HOMBRO_Y = .643, L1 = .44, L2 = .38, PINZA = .19;
  const MATERIAL = { cobre: "#d9924c", silicio: "#65b7cf" };
  const rad = (g) => g * Math.PI / 180;
  // Pose de transporte (la del ciclo del modelo): carga sobre la trasera.
  const POSE_LLEVAR = { giro: 0, a1: rad(28), a2: rad(74), a3: rad(78), pinza: 0 };
  const POSE_VACIO = { giro: 0, a1: rad(12), a2: rad(118), a3: rad(50), pinza: rad(16) };

  let cargando = null;
  function cargar() {
    if (cargando) return cargando;
    const leer = (ok) => new THREE.GLTFLoader().load(MODELO, ok, undefined, () => ok(null));
    cargando = new Promise((ok) => {
      if (THREE.GLTFLoader) return leer(ok);
      const s = document.createElement("script");
      s.src = CARGADOR; s.onload = () => (THREE.GLTFLoader ? leer(ok) : ok(null)); s.onerror = () => ok(null);
      document.head.append(s);
    });
    return cargando;
  }

  // El modelo trae materiales PBR lineales; el resto del escenario usa Lambert con colores sRGB.
  function adaptarMateriales(raiz, propios) {
    raiz.traverse((o) => {
      if (!o.isMesh) return;
      const lista = Array.isArray(o.material) ? o.material : [o.material];
      const nuevos = lista.map((m) => {
        const clave = m.name;
        if (!propios[clave]) {
          const color = m.color.clone().convertLinearToSRGB(), luz = m.emissive && m.emissive.getHex() !== 0;
          propios[clave] = new THREE.MeshLambertMaterial({ color, emissive: luz ? m.emissive.clone().convertLinearToSRGB() : 0x000000, name: clave });
        }
        return propios[clave];
      });
      o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
      o.castShadow = o.receiveShadow = false;
    });
  }

  // Dos tramos en el plano del brazo: h horizontal hacia el objetivo y v vertical desde el hombro.
  // a1 y a2 se miden desde la vertical hacia el objetivo; a3 deja la pinza mirando al suelo.
  function ik(h, v) {
    const d = Math.min(L1 + L2 - 1e-3, Math.max(.08, Math.hypot(h, v)));
    const a2 = Math.PI - Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
    const a1 = Math.atan2(h, v) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
    return { a1, a2, a3: Math.PI - a1 - a2 };
  }

  function construir(ctx) {
    const { estado, fijo, movil, objetos, M, mesh, G, lineas, L, leerVar } = ctx;
    const mundo = estado.mundo;
    const caja = (w, h, d, mat, x, y, z) => { const o = mesh(G.caja(w, h, d), mat); o.position.set(x, y, z); return o; };
    const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    const mats = { cobre: lam(MATERIAL.cobre), silicio: lam(MATERIAL.silicio), progreso: new THREE.MeshBasicMaterial({ color: 0xffffff }) };
    const rol = M["rol-fabrica"];
    const piezas = (n, mat) => Array.from({ length: n }, () => { const o = caja(.16, .16, .16, mat, 0, 0, 0); o.visible = false; return o; });

    // Puertas: un cuadro discontinuo en el suelo, como en el plano.
    const pts = [];
    for (const e of mundo.entidades) {
      const x0 = e.puerta.x + .22, x1 = e.puerta.x + .78, z0 = e.puerta.y + .22, z1 = e.puerta.y + .78;
      pts.push([x0, .02, z0], [x1, .02, z0], [x1, .02, z0], [x1, .02, z1], [x1, .02, z1], [x0, .02, z1], [x0, .02, z1], [x0, .02, z0]);
    }
    const puertas = lineas(pts, L.miraAlt); puertas.computeLineDistances(); puertas.raycast = () => {}; fijo.add(puertas);

    const edificios = new Map();
    for (const e of mundo.entidades) {
      const g = new THREE.Group(); g.position.set(e.cx, 0, e.cy); g.userData.id = e.id;
      // El frente mira a la puerta.
      g.rotation.y = Math.atan2(-(e.puerta.x - e.x), -(e.puerta.y - e.y));
      const o = { grupo: g, alto: .9 };
      if (e.tipo === "bodega") {
        g.add(caja(.86, .42, .86, M.edificio, 0, .21, 0), caja(.9, .05, .9, M.techo, 0, .445, 0), caja(.9, .06, .05, rol, 0, .36, -.43));
        // Hasta nueve cajas por material sobre la cubierta, en dos pilas.
        o.pilas = Object.keys(e.stock).map((mat, k, todas) => {
          const p = piezas(9, mats[mat] || M.borde), dx = todas.length > 1 ? (k ? .2 : -.2) : 0;
          p.forEach((c, i) => { c.position.set(dx + ((i % 3) - 1) * .1 * (todas.length > 1 ? .6 : 1.6), .56 + Math.floor(i / 3) * .17, ((i % 3) - 1) * .12); g.add(c); });
          return { mat, p };
        });
      } else {
        g.add(caja(.86, .55, .86, M.edificio, 0, .275, 0), caja(.9, .05, .9, M.techo, 0, .575, 0));
        // Tolva hacia la puerta, chimenea y franja con el color del material que acepta.
        g.add(caja(.5, .16, .22, M.borde, 0, .5, -.5), caja(.88, .05, .05, mats[e.acepta] || rol, 0, .42, -.43));
        const chim = mesh(new THREE.CylinderGeometry(.08, .1, .45, 12), M.borde); chim.position.set(.24, .8, .2); g.add(chim);
        // Engranaje que gira mientras procesa y barra de progreso.
        const eng = mesh(new THREE.CylinderGeometry(.16, .16, .05, 8), rol); eng.rotation.z = Math.PI / 2; eng.position.set(-.45, .3, 0); g.add(eng);
        const barra = caja(.6, .04, .04, mats.progreso, 0, .64, -.3); barra.visible = false; g.add(barra);
        const cola = piezas(Math.min(6, e.cap), mats[e.acepta] || M.borde);
        cola.forEach((c, i) => { c.position.set(-.16 + (i % 3) * .16, .66 + Math.floor(i / 3) * .17, -.52); c.scale.setScalar(.8); g.add(c); });
        Object.assign(o, { eng, barra, cola });
      }
      fijo.add(g); objetos.set(e.id, o); edificios.set(e.id, o);
    }

    // R1: el T1 cuando haya cargado el modelo; mientras tanto, un bloque del mismo tamaño.
    const r = mundo.robot, robot = { grupo: new THREE.Group(), niveles: [], nivel: -1, rumbo: Math.PI, ultimo: { x: r.cx, y: r.cy }, pose: { ...POSE_VACIO }, carga: [] };
    robot.grupo.userData.id = "R1";
    const provisional = caja(.6, .45, .8, M.borde, 0, .25, 0); robot.grupo.add(provisional);
    movil.add(robot.grupo); objetos.set("R1", { grupo: robot.grupo, alto: .9 });
    const propios = {};
    cargar().then((g) => {
      if (!g || !robot.grupo.parent) return;
      robot.grupo.remove(provisional);
      for (let n = 0; n < 3; n++) {
        const raiz = g.scene.getObjectByName(`L${n}_RobotTransporte`);
        if (!raiz) continue;
        const copia = raiz.clone(true);
        adaptarMateriales(copia, propios);
        copia.position.set(0, 0, 0); copia.scale.setScalar(ESCALA); copia.visible = false;
        const nodo = (k) => copia.getObjectByName(`L${n}_${k}`);
        robot.niveles.push({ raiz: copia, torreta: nodo("torreta"), hombro: nodo("hombro"), codo: nodo("codo"), muneca: nodo("muneca"), dedoI: nodo("dedo_i"), dedoD: nodo("dedo_d"), carga: nodo("carga") });
        robot.grupo.add(copia);
      }
      // La carga se tiñe con el material que lleva; el turquesa del modelo es el de su función.
      for (const k of ["naranja", "naranja_oscuro"]) if (propios[k]) robot.carga.push({ m: propios[k], oscuro: k === "naranja_oscuro" });
      robot.rol = propios.rol;
      colores();
      robot.nivel = -1;
    });
    function colores() {
      const c = leerVar("rol-utilitaria");
      if (robot.rol && c) robot.rol.color.set(c);
      mats.progreso.color.set(leerVar("accent") || "#7fa3ff");
    }
    return { edificios, robot, mats, colores };
  }

  function elegirNivel(robot, camara, altoPx) {
    if (!robot.niveles.length) return;
    const d = camara.position.distanceTo(robot.grupo.position);
    const px = 1.2 * ESCALA * altoPx / (2 * d * Math.tan(camara.fov * Math.PI / 360));
    let n = robot.nivel < 0 ? (px >= LOD_PX[0] ? 0 : px >= LOD_PX[1] ? 1 : 2) : robot.nivel;
    // Subir de detalle pide superar el umbral con margen; bajar, quedar por debajo con margen.
    if (n > 0 && px >= LOD_PX[n - 1] * (1 + MARGEN)) n--;
    else if (n < 2 && px < LOD_PX[n] * (1 - MARGEN)) n++;
    if (n !== robot.nivel) { robot.niveles.forEach((l, i) => { l.raiz.visible = i === n; }); robot.nivel = n; }
    robot.px = px;
  }

  // Pose objetivo: alcanzar el edificio durante la operación de recoger o entregar; si no, plegado.
  function poseObjetivo(robot, mundo) {
    const r = mundo.robot, t = r.tarea, base = r.carga ? POSE_LLEVAR : POSE_VACIO;
    if (!t || t.wps.length || !(t.verbo === "recoger" || t.verbo === "entregar")) return base;
    const e = mundo.porId[t.lugar];
    if (!e) return base;
    // Borde del edificio, a la altura de su cubierta, en coordenadas del robot.
    const dx = e.cx - r.cx, dz = e.cy - r.cy, l = Math.hypot(dx, dz) || 1;
    const p = robot.grupo.worldToLocal(new THREE.Vector3(r.cx + dx / l * .5, (e.tipo === "bodega" ? .62 : .7) + PINZA, r.cy + dz / l * .5));
    const giro = Math.atan2(p.x - TORRETA.x, p.z - TORRETA.z), h = Math.hypot(p.x - TORRETA.x, p.z - TORRETA.z);
    const a = ik(h, p.y - HOMBRO_Y);
    // Durante la operación la pinza se cierra al recoger y se abre al entregar.
    const u = 1 - Math.max(0, t.op) / (t.op0 || .5);
    return { giro, ...a, pinza: t.verbo === "recoger" ? rad(16) * (1 - u) : rad(16) * u };
  }

  function actualizar(c, ctx, dtReal) {
    const { estado, camara, altoPx } = ctx, mundo = estado.mundo, r = mundo.robot, robot = c.robot;
    for (const e of mundo.entidades) {
      const o = c.edificios.get(e.id);
      if (o.pilas) for (const { mat, p } of o.pilas) { const n = e.stock[mat] || 0; p.forEach((cj, i) => { cj.visible = i < n; }); }
      if (o.cola) {
        o.cola.forEach((cj, i) => { cj.visible = i < e.entrada; });
        o.barra.visible = e.procesando;
        if (e.procesando) o.barra.scale.x = Math.max(.02, Math.min(1, e.progreso / e.tProceso));
        if (e.procesando) o.eng.rotation.x = mundo.t * 4;
      }
    }
    // Rumbo del robot: el de su último desplazamiento, suavizado.
    const mx = r.cx - robot.ultimo.x, mz = r.cy - robot.ultimo.y;
    if (Math.hypot(mx, mz) > 1e-4) robot.objetivoRumbo = Math.atan2(-mx, -mz);
    robot.ultimo = { x: r.cx, y: r.cy };
    const k = 1 - Math.exp(-dtReal / .09);
    if (robot.objetivoRumbo != null) {
      const da = Math.atan2(Math.sin(robot.objetivoRumbo - robot.rumbo), Math.cos(robot.objetivoRumbo - robot.rumbo));
      robot.rumbo += da * k;
    }
    robot.grupo.position.set(r.cx, 0, r.cy);
    robot.grupo.rotation.y = robot.rumbo;
    robot.grupo.updateMatrixWorld();
    elegirNivel(robot, camara, altoPx());
    // Pose suavizada en tiempo real: a 4× la operación dura un instante y aun así se ve el gesto.
    const obj = poseObjetivo(robot, mundo), p = robot.pose, kb = 1 - Math.exp(-dtReal / .11);
    for (const key of ["a1", "a2", "a3", "pinza"]) p[key] += (obj[key] - p[key]) * kb;
    p.giro += Math.atan2(Math.sin(obj.giro - p.giro), Math.cos(obj.giro - p.giro)) * kb;
    for (const l of robot.niveles) {
      l.torreta.rotation.y = p.giro; l.hombro.rotation.x = p.a1; l.codo.rotation.x = p.a2; l.muneca.rotation.x = p.a3;
      l.dedoI.rotation.z = p.pinza; l.dedoD.rotation.z = -p.pinza;
      l.carga.visible = !!r.carga;
    }
    if (r.carga && robot.carga.length) {
      const base = new THREE.Color(MATERIAL[r.carga] || "#d35c38");
      for (const { m, oscuro } of robot.carga) m.color.copy(base).multiplyScalar(oscuro ? .62 : 1);
    }
  }

  window.FACTORY_3D = { construir, actualizar, cargar, ik };
})();

