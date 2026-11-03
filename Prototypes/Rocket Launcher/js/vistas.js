/* Visores de la aplicación: código trasladado de juego.js. Estado de lectura explícito. */
(() => {
  "use strict";
  function crear3D(estado, { $, ES_FACTORY, ARCO, FR, FUNCIONES, HALO, INTENSIDAD, LINEA_BASE, LUCES, MISIL, TIPOS, alcance, direccionDe, funcionDe, leerVar, radioDe, visual }) {
    if (ES_FACTORY || typeof THREE === "undefined") return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: $("c3d"), antialias: true }); } catch { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const escena = new THREE.Scene();
    // Bruma del horizonte: solo toca lo que queda más allá del campo, para que el terreno se pierda a lo lejos.
    const horizonte = new THREE.Fog(0xffffff, 60, 140);
    const camara = new THREE.PerspectiveCamera(38, 1.6, 0.1, 500);
    // Una cámara por postura de la pantalla (horizontal, vertical y vertical con el campo girado 90°, la de
    // pantalla completa): cada una recuerda durante la sesión dónde la dejó el jugador.
    const camaras = {};
    let camActual = null, cam = null, cam0 = null, anchoCampo = 1, altoCampo = 1;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9488, 0.85);
    const sol = new THREE.DirectionalLight(0xffffff, 0.55); sol.position.set(-12, 30, 18);
    escena.add(hemi, sol);
    const lam = (k, extra = {}) => { const { hacia, u, ...resto } = extra; return new THREE.MeshLambertMaterial({ color: 0xffffff, ...resto, userData: { k, hacia, u } }); };
    const bas = (k, extra) => new THREE.MeshBasicMaterial({ color: 0xffffff, ...extra, userData: { k } });
    const M = {
      suelo: lam("suelo"), base: bas("accent", { transparent: true, opacity: .1, depthWrite: false }),
      // Terreno de alrededor: el suelo sigue más allá del campo, algo más oscuro, y las montañas son columnas de casillas.
      afuera: lam("suelo", { hacia: "bg", u: .45 }),
      edificio: lam("building"), techo: lam("building-top"), borde: lam("edge"), acento: lam("accent"), mal: lam("bad"),
      enemigo: lam("enemigo"), frio: lam("enemigo-frio", { transparent: true, opacity: .72 }), golpe: lam("bad"),
      misil: bas("misil"), explosion: bas("explosion", { transparent: true, opacity: .4, depthWrite: false }),
      humo: bas("edge", { transparent: true, opacity: .5, depthWrite: false }),
      sombra: bas("ink", { transparent: true, opacity: .16, depthWrite: false }), mira: bas("accent"),
      rVisual: bas("s-visual", { transparent: true, opacity: .75, side: THREE.DoubleSide }), rTermico: bas("s-termico", { transparent: true, opacity: .75, side: THREE.DoubleSide }),
      rVibra: bas("s-vibra", { transparent: true, opacity: .75, side: THREE.DoubleSide }), sel: bas("sel", { side: THREE.DoubleSide }),
      ...Object.fromEntries(Object.keys(FUNCIONES).map(f => [`rol-${f}`, lam(`rol-${f}`)])),
    };
    const rolM = (e) => M[`rol-${funcionDe(e).principal}`];
    const L = {
      grid: new THREE.LineBasicMaterial({ color: 0xffffff, userData: { k: "grid" } }),
      grid2: new THREE.LineBasicMaterial({ color: 0xffffff, userData: { k: "grid-2" } }),
      gridFuera: new THREE.LineBasicMaterial({ color: 0xffffff, userData: { k: "grid", hacia: "bg", u: .25 } }),
      brecha: new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .4, gapSize: .25, userData: { k: "bad" } }),
      altura: new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .12, gapSize: .1, transparent: true, opacity: .55, userData: { k: "ink" } }),
      estela: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7, userData: { k: "misil" } }),
      miraAlt: new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .15, gapSize: .1, userData: { k: "accent" } }),
    };
    const blanco = new THREE.Color(0xffffff);
    function aplicarColores() {
      for (const m of [...Object.values(M), ...Object.values(L), ...Object.values(D)]) {
        m.color.set(leerVar(m.userData.k) || "#888");
        if (m.userData.claro) m.color.lerp(blanco, m.userData.claro);
        if (m.userData.hacia) m.color.lerp(new THREE.Color(leerVar(m.userData.hacia) || "#888"), m.userData.u);
      }
      escena.background = new THREE.Color(leerVar("bg") || "#e9ece6");
      if (escena.fog) escena.fog.color.copy(escena.background);
      horizonte.color.copy(escena.background);
      pintarMontes();
    }
    const G = {
      caja: (w, h, d) => new THREE.BoxGeometry(w, h, d),
      esfera: new THREE.SphereGeometry(1, 16, 12), disco: new THREE.CircleGeometry(1, 24),
      rotor: new THREE.CylinderGeometry(.15, .15, .025, 12), toro: new THREE.TorusGeometry(.48, .045, 6, 28),
      plano: new THREE.PlaneGeometry(1, 1),
    };
    // Halo y brillo son calcos aditivos sobre el suelo, pintados una vez en un canvas: no hay luces simuladas.
    function textura(pintar, n = 128) {
      const cv = document.createElement("canvas"); cv.width = cv.height = n;
      pintar(cv.getContext("2d"), n / 2);
      return new THREE.CanvasTexture(cv);
    }
    const blancoA = (a) => `rgba(255,255,255,${a})`;
    const tex = {
      punto: textura((c, h) => {
        const g = c.createRadialGradient(h, h, 0, h, h, h);
        g.addColorStop(0, blancoA(1)); g.addColorStop(.35, blancoA(.42)); g.addColorStop(1, blancoA(0));
        c.fillStyle = g; c.fillRect(0, 0, 2 * h, 2 * h);
      }),
      // Cono de faro con el vértice en el centro y apuntando a la derecha (+x).
      cono: textura((c, h) => {
        const g = c.createRadialGradient(h, h, 0, h, h, h);
        g.addColorStop(0, blancoA(.9)); g.addColorStop(.45, blancoA(.35)); g.addColorStop(1, blancoA(0));
        c.fillStyle = g;
        for (const [a, alfa] of [[.5, .35], [.34, .5], [.2, .6]]) { c.globalAlpha = alfa; c.beginPath(); c.moveTo(h, h); c.arc(h, h, h, -a, a); c.closePath(); c.fill(); }
      }),
      halo: null,
    };
    let D = {};
    const decal = (k, map, alfa) => new THREE.MeshBasicMaterial({ color: 0xffffff, map, transparent: true, opacity: Math.min(1, alfa), depthWrite: false, blending: THREE.AdditiveBlending, userData: { k } });
    function prepararVisual() {
      for (const m of Object.values(D)) m.dispose();
      if (tex.halo) tex.halo.dispose();
      const paradas = HALO[visual.halo] || HALO.medio;
      tex.halo = textura((c, h) => {
        const g = c.createRadialGradient(h, h, 0, h, h, h);
        for (const [d, a] of paradas) g.addColorStop(FR + d, blancoA(a));
        c.fillStyle = g; c.fillRect(0, 0, 2 * h, 2 * h);
      }, 256);
      const k = INTENSIDAD[visual.intensidad];
      D = {};
      for (const f of [...Object.keys(FUNCIONES), "mal"]) {
        const c = f === "mal" ? "bad" : `rol-${f}`;
        D[`halo-${f}`] = decal(c, tex.halo, .85 * k);
        D[`punto-${f}`] = decal(c, tex.punto, .4 * k);
        D[`cono-${f}`] = decal(c, tex.cono, .32 * k);
        D[`aura-${f}`] = decal(c, tex.punto, .24 * k);
        D[`luz-${f}`] = new THREE.MeshBasicMaterial({ color: 0xffffff, userData: { k: c, claro: .55 } });
      }
    }
    // Los calcos no cuentan al elegir con el puntero: tocar su brillo es tocar el suelo.
    const calco = (g, m) => { const o = mesh(g, m); o.raycast = () => {}; o.renderOrder = 1; return o; };
    function halo(e) {
      const f = funcionDe(e), R = radioDe(e) / FR, g = new THREE.Group();
      // RingGeometry proyecta la textura en planta respecto al radio exterior: los sectores encajan.
      const sector = (mat, t0, dt) => { const m = calco(new THREE.RingGeometry(R * .4, R, 48, 1, t0, dt), mat); m.rotation.x = -Math.PI / 2; g.add(m); return m; };
      const sec = f.secundaria;
      const principal = sector(D[`halo-${f.principal}`], sec ? ARCO[1] : 0, Math.PI * 2 - (sec ? ARCO[1] - ARCO[0] : 0));
      const secundaria = sec ? sector(D[`halo-${sec}`], ARCO[0], ARCO[1] - ARCO[0]) : null;
      g.position.y = .025;
      return { g, principal, secundaria, mat: principal.material };
    }
    // Brillo: pilotos (luces y charcos pequeños), faros (cono en el suelo) o aura (charco amplio).
    function brillo(e, g) {
      const f = funcionDe(e).principal, r = radioDe(e), out = { luces: [], suelo: null };
      if (visual.brillo === "no") return out;
      const plano = (mat, x, z, s) => { const m = calco(G.plano, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, .02, z); m.scale.setScalar(s); return m; };
      for (const [x, y, z] of LUCES[e.clase] || []) {
        const luz = calco(G.esfera, D[`luz-${f}`]); luz.scale.setScalar(.055); luz.position.set(x, y, z); g.add(luz); out.luces.push(luz);
        if (visual.brillo === "pilotos") g.add(plano(D[`punto-${f}`], x * 1.15, z * 1.15, r * 1.1));
      }
      if (visual.brillo === "aura") g.add(plano(D[`aura-${f}`], 0, 0, r * 3.4));
      if (visual.brillo === "faros") { out.suelo = new THREE.Group(); out.suelo.add(plano(D[`cono-${f}`], 0, 0, r * 5)); g.add(out.suelo); }
      return out;
    }
    const fijo = new THREE.Group(), movil = new THREE.Group();
    escena.add(fijo, movil);
    const objetos = new Map();  // id → { grupo, ... }
    const misiles = new Map(), efectos = new Map();
    let anillos = null;
    const mesh = (g, m) => new THREE.Mesh(g, m);
    function lineas(puntos, mat) {
      const g = new THREE.BufferGeometry().setFromPoints(puntos.map(p => new THREE.Vector3(...p)));
      const l = new THREE.LineSegments(g, mat); return l;
    }
    function limpiar(grupo) { while (grupo.children.length) { const c = grupo.children.pop(); c.traverse(o => { if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); }); } }

    // ---------- Terreno de alrededor ----------
    // El campo de 32 × 18 sigue siendo el único sitio jugable; alrededor, el suelo y su cuadrícula continúan
    // hasta perderse en la bruma del horizonte, y detrás (al norte) hay una cordillera escalonada.
    // Las montañas son columnas de casillas de 1 m con alturas de 0,5 en 0,5 m: la misma cuadrícula que el
    // campo, baratas de pintar (una sola malla instanciada) y fáciles de usar para colisiones en retos futuros.
    const TERRENO = { x0: -48, x1: estado.cols + 48, z0: -40, z1: estado.rows + 34 };
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
    function construirTerreno() {
      const { x0, x1, z0, z1 } = TERRENO;
      const afuera = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.afuera);
      afuera.rotation.x = -Math.PI / 2; afuera.position.set((x0 + x1) / 2, -.02, (z0 + z1) / 2); afuera.raycast = () => {};
      const p = [];
      for (let i = x0; i <= x1; i++) p.push([i, -.01, z0], [i, -.01, z1]);
      for (let j = z0; j <= z1; j++) p.push([x0, -.01, j], [x1, -.01, j]);
      const red = lineas(p, L.gridFuera); red.raycast = () => {};
      montes = new THREE.InstancedMesh(G.caja(1, 1, 1), matMonte, celdasMonte.length);
      const m = new THREE.Matrix4();
      celdasMonte.forEach(([i, j, h], n) => { m.makeScale(1, h, 1); m.setPosition(i + .5, h / 2 - .02, j + .5); montes.setMatrixAt(n, m); });
      montes.raycast = () => {};
      pintarMontes();
      fijo.add(afuera, red, montes);
    }

    function construir() {
      limpiar(fijo); limpiar(movil); objetos.clear(); misiles.clear(); efectos.clear(); anillos = null;
      prepararVisual();
      const suelo = mesh(new THREE.PlaneGeometry(estado.cols, estado.rows), M.suelo); suelo.rotation.x = -Math.PI / 2; suelo.position.set(estado.cols / 2, 0, estado.rows / 2); fijo.add(suelo);
      construirTerreno();
      const p1 = [], p2 = [];
      for (let i = 0; i <= estado.cols; i++) (i % 4 ? p1 : p2).push([i, .01, 0], [i, .01, estado.rows]);
      for (let j = 0; j <= estado.rows; j++) (j % 3 ? p1 : p2).push([0, .01, j], [estado.cols, .01, j]);
      fijo.add(lineas(p1, L.grid), lineas(p2, L.grid2));
      const zona = mesh(new THREE.PlaneGeometry(LINEA_BASE, estado.rows), M.base); zona.rotation.x = -Math.PI / 2; zona.position.set(LINEA_BASE / 2, .015, estado.rows / 2); fijo.add(zona);
      const br = lineas([[LINEA_BASE, .03, 0], [LINEA_BASE, .03, estado.rows]], L.brecha); br.computeLineDistances(); fijo.add(br);
      escena.fog = estado.mundo.def.niebla ? new THREE.Fog(0xffffff, 10, 34) : horizonte;
      for (const l of estado.mundo.lanzadores) {
        const g = new THREE.Group(); g.position.set(l.cx, 0, l.cy); g.userData.id = l.id;
        const base = mesh(G.caja(1.1, .45, 1.1), M.edificio); base.position.y = .225;
        const tapa = mesh(G.caja(.92, .06, .92), rolM(l)); tapa.position.y = .48;
        const torre = new THREE.Group(); torre.position.y = .55;
        const pod = mesh(G.caja(.8, .38, .6), M.borde); pod.position.set(.1, .24, 0); pod.rotation.z = .5;
        const frente = mesh(G.caja(.05, .3, .5), rolM(l)); frente.position.set(.5, .45, 0); frente.rotation.z = .5;
        torre.add(pod, frente);
        g.add(base, tapa, torre); fijo.add(g);
        objetos.set(l.id, { grupo: g, torre, pod, alto: 1.4 });
      }
      for (const s of estado.mundo.sensores) {
        const g = new THREE.Group(); g.position.set(s.cx, 0, s.cy); g.userData.id = s.id;
        const poste = mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 8), M.borde); poste.position.y = .65;
        const cabeza = mesh(new THREE.CylinderGeometry(.28, .28, .1, 16), rolM(s)); cabeza.position.y = 1.3;
        const pie = mesh(new THREE.CylinderGeometry(.35, .4, .08, 16), M.edificio); pie.position.y = .04;
        g.add(poste, cabeza, pie); fijo.add(g);
        objetos.set(s.id, { grupo: g, alto: 1.6 });
      }
      { const d = estado.mundo.deposito, g = new THREE.Group(); g.position.set(d.cx, 0, d.cy); g.userData.id = d.id;
        const c = mesh(G.caja(1.4, .7, 1.7), M.edificio); c.position.y = .35;
        const t = mesh(G.caja(1.2, .05, 1.5), rolM(d)); t.position.y = .72;
        const m1 = mesh(G.caja(.9, .14, .14), M.misil); m1.position.set(0, .82, -.3);
        const m2 = m1.clone(); m2.position.z = .3;
        g.add(c, t, m1, m2); fijo.add(g); objetos.set(d.id, { grupo: g, alto: 1.1 }); }
      for (const r of estado.mundo.reparadores) {
        const g = new THREE.Group(); g.userData.id = r.id;
        const c = mesh(G.caja(.46, .32, .46), rolM(r)); c.position.y = .2;
        const a = mesh(G.caja(.04, .35, .04), M.borde); a.position.set(.12, .5, .12);
        g.add(c, a); movil.add(g); objetos.set(r.id, { grupo: g, alto: .9 });
      }
      for (const e of estado.mundo.maquinas) {
        const o = objetos.get(e.id);
        if (visual.halo !== "no") { o.halo = halo(e); o.grupo.add(o.halo.g); }
        o.brillo = brillo(e, o.grupo);
      }
      for (const l of estado.mundo.lanzadores) {
        const mira = mesh(G.toro, M.mira); mira.rotation.x = Math.PI / 2; mira.visible = false;
        const alt = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), L.miraAlt); alt.visible = false;
        movil.add(mira, alt); objetos.get(l.id).mira = mira; objetos.get(l.id).miraAlt = alt;
      }
      aplicarColores();
      anillosDe(estado.seleccion);
    }

    function enemigoMesh(e) {
      const g = new THREE.Group(); g.userData.id = e.id;
      const tp = TIPOS[e.tipo], mat = tp.frio ? M.frio : M.enemigo;
      if (tp.suelo) {
        const cuerpo = mesh(G.caja(.82, .4, .6), mat); cuerpo.position.y = .3;
        const o1 = mesh(G.caja(.9, .2, .14), M.borde); o1.position.set(0, .1, .3);
        const o2 = o1.clone(); o2.position.z = -.3;
        g.add(cuerpo, o1, o2);
        return { grupo: g, cuerpo, mat };
      }
      const cuerpo = mesh(G.esfera, mat); cuerpo.scale.setScalar(.22);
      const brazo1 = mesh(G.caja(.85, .04, .06), M.borde), brazo2 = brazo1.clone(); brazo2.rotation.y = Math.PI / 2;
      const rotores = [[.4, 0], [-.4, 0], [0, .4], [0, -.4]].map(([x, z]) => { const r = mesh(G.rotor, M.borde); r.position.set(x, .06, z); return r; });
      const cuerpoG = new THREE.Group(); cuerpoG.add(cuerpo, brazo1, brazo2, ...rotores);
      const sombra = mesh(G.disco, M.sombra); sombra.rotation.x = -Math.PI / 2; sombra.scale.setScalar(.36); sombra.position.y = .02;
      const alt = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]), L.altura);
      alt.computeLineDistances();
      g.add(cuerpoG, sombra, alt);
      return { grupo: g, cuerpo, cuerpoG, sombra, alt, rotores, mat };
    }

    // Retrato de un tipo de enemigo con su modelo actual (placeholder de las fichas de información).
    // Se usa una vez para generar img/enemigos/*.png: window.cmg.retrato("crawler") devuelve un PNG en data URL.
    function retrato(tipo, w = 288, h = 216) {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      r.setPixelRatio(1); r.setSize(w, h, false);
      const esc = new THREE.Scene(); esc.background = new THREE.Color(leerVar("bg") || "#0B0F13");
      esc.add(hemi.clone(), sol.clone());
      const piso = mesh(new THREE.PlaneGeometry(6, 6), M.suelo); piso.rotation.x = -Math.PI / 2;
      const p = []; for (let i = -3; i <= 3; i++) p.push([i, .01, -3], [i, .01, 3], [-3, .01, i], [3, .01, i]);
      const o = enemigoMesh({ id: "retrato", tipo }), aire = !TIPOS[tipo].suelo;
      if (o.cuerpoG) { o.cuerpoG.position.y = 1.15; o.alt.scale.set(1, 1.15, 1); for (const rr of o.rotores) rr.rotation.y = .6; }
      o.grupo.rotation.y = .35;
      esc.add(piso, lineas(p, L.grid), o.grupo);
      const c = new THREE.PerspectiveCamera(30, w / h, .1, 50);
      c.position.set(-1.6, aire ? 2.2 : 1.55, aire ? 2.8 : 2.5); c.lookAt(0, aire ? .78 : .24, 0);
      r.render(esc, c);
      const url = r.domElement.toDataURL("image/png");
      r.dispose(); r.forceContextLoss();
      return url;
    }

    function anillosDe(id) {
      if (anillos) { movil.remove(anillos); anillos.traverse(o => o.geometry && o.geometry.dispose()); anillos = null; }
      if (!estado.mundo || !id) return;
      const e = estado.mundo.porId[id];
      const grupo = new THREE.Group();
      // La selección es el mismo círculo del halo, pero nítido y claro.
      const anillo = (r, mat, x, z, w = .05) => { const a = mesh(new THREE.RingGeometry(r - w, r + w, 96), mat); a.rotation.x = -Math.PI / 2; a.position.set(x, .04, z); grupo.add(a); };
      if (e && e.clase === "lanzador") { anillo(alcance("visual"), M.rVisual, e.cx, e.cy); anillo(alcance("thermal"), M.rTermico, e.cx, e.cy); }
      else if (e && e.clase === "vibracion") anillo(e.alcance, M.rVibra, e.cx, e.cy);
      if (e) anillo(radioDe(e), M.sel, e.cx, e.cy, .06);
      else { const en = estado.mundo.enemigos.find(x => x.id === id); if (!en) return; anillo(.6, M.sel, 0, 0, .06); grupo.userData.sigue = id; }
      anillos = grupo; movil.add(grupo);
      for (const otro of estado.seleccionadas) {
        if (otro === id) continue;
        const u = estado.mundo.porId[otro] || estado.mundo.enemigos.find(e => e.id === otro);
        if (!u) continue;
        const r = u.clase ? radioDe(u) : .6;
        const a = mesh(new THREE.RingGeometry(r - .06, r + .06, 64), M.sel);
        a.rotation.x = -Math.PI / 2;
        a.userData.unidad = otro;
        grupo.add(a);
      }
    }

    function posMisil(mi, t) {
      const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
      return [mi.x0 + (mi.x1 - mi.x0) * u, mi.z0 + (mi.z1 - mi.z0) * u + mi.arco * 4 * u * (1 - u), mi.y0 + (mi.y1 - mi.y0) * u];
    }

    function actualizar(off, ahora) {
      const t = estado.mundo.t + off;
      for (const l of estado.mundo.lanzadores) {
        const o = objetos.get(l.id);
        o.torre.rotation.y = -l.yaw;
        o.pod.material = l.atascado ? M.mal : M.borde;
        if (l.lugar && !l.atascado && l.modo !== "idle") {
          o.mira.visible = true; o.mira.position.set(l.lugar.x, (l.lugar.z || 0) + .03, l.lugar.y);
          const z = l.lugar.z || 0;
          o.miraAlt.visible = z > 0.05;
          if (z > .05) { o.miraAlt.position.set(l.lugar.x, 0, l.lugar.y); o.miraAlt.scale.set(1, z, 1); o.miraAlt.computeLineDistances(); }
        } else { o.mira.visible = false; o.miraAlt.visible = false; }
      }
      for (const r of estado.mundo.reparadores) { const o = objetos.get(r.id); o.grupo.position.set(r.cx, 0, r.cy); o.grupo.rotation.y = r.estado === "reparar" ? ahora / 160 : 0; }
      for (const e of estado.mundo.maquinas) {
        const o = objetos.get(e.id), mal = e.clase === "lanzador" && e.atascado;
        if (o.halo) {
          o.halo.g.visible = !estado.seleccionadas.has(e.id);
          o.halo.principal.material = mal ? D["halo-mal"] : o.halo.mat;
          if (o.halo.secundaria) o.halo.secundaria.visible = !mal;
          o.halo.g.rotation.y = -o.grupo.rotation.y;
        }
        const b = o.brillo;
        if (b.suelo) b.suelo.rotation.y = -direccionDe(e, ahora) - o.grupo.rotation.y;
        // Las luces de sensores y reparadores parpadean; las de los lanzadores se apagan al atascarse.
        const on = mal ? false : e.clase === "vibracion" ? ahora % 1600 < 1100 : e.clase === "reparador" && e.estado !== "base" ? ahora % 500 < 300 : true;
        for (const luz of b.luces) luz.visible = on;
      }
      const vivos = new Set();
      for (const e of estado.mundo.enemigos) {
        vivos.add(e.id);
        let o = objetos.get(e.id);
        if (!o) { o = enemigoMesh(e); objetos.set(e.id, o); movil.add(o.grupo); }
        const x = e.x + e.vx * off, y = e.y + e.vy * off;
        o.grupo.position.set(x, 0, y);
        o.cuerpo.material = estado.mundo.t - e.golpeT < .25 ? M.golpe : o.mat;
        if (o.cuerpoG) {
          o.cuerpoG.position.y = e.z;
          o.alt.scale.set(1, e.z, 1);
          for (const r of o.rotores) r.rotation.y = ahora / 40;
        }
      }
      for (const [id, o] of objetos) if (o.mat && !vivos.has(id)) { movil.remove(o.grupo); objetos.delete(id); }
      const enVuelo = new Set();
      for (const mi of estado.mundo.misiles) {
        enVuelo.add(mi.id);
        let o = misiles.get(mi.id);
        if (!o) {
          const bola = mesh(G.esfera, M.misil); bola.scale.setScalar(.12);
          const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(30), 3));
          const estela = new THREE.Line(g, L.estela); estela.frustumCulled = false;
          o = { bola, estela }; misiles.set(mi.id, o); movil.add(bola, estela);
        }
        const p = posMisil(mi, t); o.bola.position.set(...p);
        const arr = o.estela.geometry.attributes.position.array;
        for (let k = 0; k < 10; k++) { const q = posMisil(mi, t - k * .03); arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; }
        o.estela.geometry.attributes.position.needsUpdate = true;
      }
      for (const [id, o] of misiles) if (!enVuelo.has(id)) { movil.remove(o.bola, o.estela); o.estela.geometry.dispose(); misiles.delete(id); }
      const vistos = new Set();
      for (const x of estado.mundo.explosiones) {
        const k = `${x.t0}|${x.x}|${x.y}`; vistos.add(k);
        let o = efectos.get(k);
        if (!o) { o = mesh(G.esfera, (x.atasco ? M.humo : M.explosion).clone()); efectos.set(k, o); movil.add(o); }
        const u = Math.min(1, (t - x.t0) / (x.atasco ? .8 : .35));
        o.position.set(x.x, x.atasco ? 1 + u * .8 : x.z, x.y);
        o.scale.setScalar((x.atasco ? .5 : MISIL.radio) * (.25 + .75 * Math.min(1, u * 1.4)));
        o.material.opacity = (x.atasco ? .55 : .42) * (1 - Math.max(0, (t - x.t0 - .25) / .5));
      }
      for (const [k, o] of efectos) if (!vistos.has(k)) { movil.remove(o); o.material.dispose(); efectos.delete(k); }
      if (anillos && anillos.userData.sigue) {
        const en = estado.mundo.enemigos.find(x => x.id === anillos.userData.sigue);
        if (en) anillos.position.set(en.x + en.vx * off, en.z, en.y); else anillos.visible = false;
      }
      if (anillos) for (const a of anillos.children) {
        if (!a.userData.unidad) continue;
        const u = estado.mundo.porId[a.userData.unidad] || estado.mundo.enemigos.find(e => e.id === a.userData.unidad);
        a.visible = !!u;
        if (u) a.position.set((u.cx ?? u.x) - anillos.position.x, .04 - anillos.position.y, (u.cy ?? u.y) - anillos.position.z);
      }
    }

    function colocarCamara(c = cam) {
      const cp = Math.cos(c.pitch);
      camara.position.set(c.x + c.dist * cp * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.z + c.dist * cp * Math.cos(c.yaw));
      camara.lookAt(c.x, 0, c.z);
      camara.updateMatrixWorld();
    }
    // Campo girado 90°: la base queda abajo y los enemigos llegan desde arriba. Se usa en pantalla completa
    // con la pantalla en vertical (se puede desactivar en Ajustes); al girar a horizontal vuelve la normal.
    const app = $("app");
    function claveCamara() {
      if (innerHeight <= innerWidth) return "horizontal";
      const girar = app.dataset.pantallaCompleta === "true" && app.dataset.girarCampo !== "false" && altoCampo > anchoCampo;
      return girar ? "girada" : "vertical";
    }
    // Distancia mínima para que las cuatro esquinas del campo quepan en pantalla (con margen para el HUD).
    function encuadrar(c, mx, my) {
      const esquinas = [[0, 0], [estado.cols, 0], [0, estado.rows], [estado.cols, estado.rows]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      let lo = 6, hi = 160;
      for (let k = 0; k < 24; k++) {
        c.dist = (lo + hi) / 2; colocarCamara(c);
        const cabe = esquinas.every(e => { const q = e.clone().project(camara); return Math.abs(q.x) <= mx && Math.abs(q.y) <= my && q.z < 1; });
        if (cabe) hi = c.dist; else lo = c.dist;
      }
      c.dist = hi;
      return c;
    }
    function camaraInicial(k) {
      // En pantallas estrechas la cámara se aleja para que quepan las 32 columnas.
      // Algo inclinada y mirando un poco más al norte: deja ver la cordillera detrás del campo.
      if (k !== "girada") return { yaw: 0, pitch: .93, dist: camara.aspect < 1.5 ? 33 * 1.5 / camara.aspect : 33, x: estado.cols / 2, z: estado.rows / 2 - .8 };
      return encuadrar({ yaw: -Math.PI / 2, pitch: .98, dist: 30, x: estado.cols / 2 - .6, z: estado.rows / 2 }, .98, .8);
    }
    function elegirCamara() {
      const k = claveCamara();
      const c = camaras[k] || (camaras[k] = { k, cam: null, movida: false });
      c.cam0 = camaraInicial(k);
      if (!c.cam) c.cam = { ...c.cam0 };
      else if (!c.movida) Object.assign(c.cam, c.cam0);
      camActual = c; cam = c.cam; cam0 = c.cam0;
    }
    const moverCamara = () => { if (camActual) camActual.movida = true; };
    function tamano(w, h) {
      anchoCampo = w; altoCampo = h;
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
      elegirCamara();
    }
    // Activar o salir de pantalla completa, o cambiar el ajuste, cambia de cámara sin cambiar de tamaño.
    new MutationObserver(() => { if (cam) elegirCamara(); }).observe(app, { attributes: true, attributeFilter: ["data-pantalla-completa", "data-girar-campo"] });
    function render() {
      if (!cam) elegirCamara();
      colocarCamara();
      if (escena.fog === horizonte) { horizonte.near = cam.dist + 24; horizonte.far = cam.dist + 110; }
      else if (escena.fog) { escena.fog.near = cam.dist * .55; escena.fog.far = cam.dist * 1.75; }
      renderer.render(escena, camara);
    }
    const v = new THREE.Vector3();
    function proyectar(x, alto, y, w, h) {
      v.set(x, alto, y).project(camara);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 && v.z > -1 };
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function elegir(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
      ray.setFromCamera(ndc, camara);
      const hits = ray.intersectObjects([...fijo.children, ...movil.children], true);
      for (const hit of hits) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) return o.userData.id; }
      return null;
    }
    function suelo(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
      ray.setFromCamera(ndc, camara);
      const punto = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      return punto ? { x: punto.x, y: punto.z, z: 0 } : null;
    }
    function centrar(x, y) {
      // Acerca la cámara a la unidad un poco hacia el lado desde el que mira.
      cam.x = x + Math.sin(cam.yaw); cam.z = y + Math.cos(cam.yaw); cam.dist = Math.min(cam.dist, 22); moverCamara();
    }
    function recentrar() { Object.assign(cam, cam0); camActual.movida = false; }

    // Cámara: rueda presionada = orbitar · botón derecho o dos dedos = desplazar.
    // El botón izquierdo y la selección táctil se manejan juntos en el campo.
    const canvas = $("c3d"), punteros = new Map();
    let gesto = null;
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
    canvas.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "touch" && ev.button !== 1 && ev.button !== 2) return;
      canvas.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      gesto = { movido: 0, desplazar: ev.button === 2, tactil: ev.pointerType === "touch", dist0: null, ang0: null, giro: 0, girando: false };
    });
    canvas.addEventListener("pointermove", (ev) => {
      const p = punteros.get(ev.pointerId); if (!p || !gesto) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      gesto.movido += Math.abs(dx) + Math.abs(dy);
      if (dx || dy) moverCamara();
      if (punteros.size >= 2) {
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (gesto.dist0) cam.dist = Math.min(70, Math.max(8, cam.dist * gesto.dist0 / d));
        gesto.dist0 = d;
        desplazar(dx / 2, dy / 2);
        // Girar dos dedos gira el escenario alrededor del punto entre ellos. Un umbral pequeño evita
        // girar sin querer al pellizcar para acercar.
        if (gesto.ang0 != null) {
          const da = Math.atan2(Math.sin(ang - gesto.ang0), Math.cos(ang - gesto.ang0));
          gesto.giro += da;
          if (gesto.girando || Math.abs(gesto.giro) > .12) {
            const r = canvas.getBoundingClientRect();
            girar(gesto.girando ? da : gesto.giro, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, r.width, r.height);
            gesto.girando = true;
          }
        }
        gesto.ang0 = ang;
      } else if (gesto.tactil && estado.arrastreCampo && estado.arrastreCampo.cajaTactil) return;
      else if (gesto.desplazar || gesto.tactil) desplazar(dx, dy);
      else { cam.yaw -= dx * .006; cam.pitch = Math.min(1.5, Math.max(.28, cam.pitch + dy * .005)); }
    });
    const soltar = (ev) => {
      punteros.delete(ev.pointerId);
      if (gesto && punteros.size === 0) {
        gesto = null;
      } else if (gesto) { gesto.dist0 = null; gesto.ang0 = null; }
    };
    canvas.addEventListener("pointerup", soltar);
    canvas.addEventListener("pointercancel", (ev) => { punteros.delete(ev.pointerId); gesto = null; });
    canvas.addEventListener("wheel", (ev) => { ev.preventDefault(); moverCamara(); cam.dist = Math.min(70, Math.max(8, cam.dist * Math.exp(ev.deltaY * .0012))); }, { passive: false });
    const limitar = () => { cam.x = Math.min(estado.cols + 4, Math.max(-4, cam.x)); cam.z = Math.min(estado.rows + 4, Math.max(-6, cam.z)); };
    function desplazar(dx, dy) {
      const k = cam.dist * .0022;
      const sx = Math.cos(cam.yaw), sz = -Math.sin(cam.yaw);
      cam.x -= (dx * sx + dy * Math.sin(cam.yaw)) * k;
      cam.z -= (dx * sz + dy * Math.cos(cam.yaw)) * k;
      limitar();
    }
    // El giro mantiene fijo el punto del suelo que queda entre los dedos.
    function girar(da, px, py, w, h) {
      colocarCamara();
      const antes = suelo(px, py, w, h);
      cam.yaw = Math.atan2(Math.sin(cam.yaw + da), Math.cos(cam.yaw + da));
      colocarCamara();
      const despues = suelo(px, py, w, h);
      if (antes && despues) { cam.x += antes.x - despues.x; cam.z += antes.y - despues.y; limitar(); }
    }
    return { construir, actualizar, render, tamano, proyectar, elegir, suelo, centrar, recentrar, anillosDe, aplicarColores, girar, retrato, camara: () => ({ clave: camActual && camActual.k, ...cam }) };
  }
  function crearPlano(estado, { $c2d, ctx2, ES_FACTORY, LINEA_BASE, TIPOS, MISIL, SENSOR, LAU, FUNCIONES, FR, HALO, INTENSIDAD, ARCO, LUCES, visual, funcionDe, radioDe, direccionDe, alcance, rgba, mezclaBlanco, r2 }) {
  function dibujar2D(off) {
    const dpr = window.devicePixelRatio || 1, W = $c2d.clientWidth, H = $c2d.clientHeight;
    if (!W || !H) return;
    if ($c2d.width !== Math.round(W * dpr) || $c2d.height !== Math.round(H * dpr)) { $c2d.width = Math.round(W * dpr); $c2d.height = Math.round(H * dpr); }
    const T = Math.min(W / estado.cols, (H - 40) / estado.rows), ox = (W - T * estado.cols) / 2, oy = Math.max(36, (H - T * estado.rows) / 2);
    estado.geo2 = { T, ox, oy };
    const c = ctx2, P = (x) => ox + x * T, Q = (y) => oy + y * T;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = estado.col.bg; c.fillRect(0, 0, W, H);
    if (ES_FACTORY) { window.FACTORY_VISTA.dibujar(c, estado.mundo, { ...estado.col, surface: estado.col.surface, cobre: "#d9924c", silicio: "#65b7cf", "bad-soft": estado.col.bad }, estado.seleccion, estado.geo2); return; }
    // El suelo sigue más allá del campo: la cuadrícula continúa, tenue, hasta los bordes.
    c.strokeStyle = estado.col.grid; c.globalAlpha = .45; c.lineWidth = 1; c.beginPath();
    for (let x = ox - Math.floor(ox / T) * T; x <= W; x += T) { c.moveTo(Math.round(x) + .5, 0); c.lineTo(Math.round(x) + .5, H); }
    for (let y = oy - Math.floor(oy / T) * T; y <= H; y += T) { c.moveTo(0, Math.round(y) + .5); c.lineTo(W, Math.round(y) + .5); }
    c.stroke(); c.globalAlpha = 1;
    c.fillStyle = estado.col.suelo; c.fillRect(ox, oy, estado.cols * T, estado.rows * T);
    c.fillStyle = estado.col.base; c.fillRect(ox, oy, LINEA_BASE * T, estado.rows * T);
    c.lineWidth = 1;
    for (const [paso2, color] of [[1, estado.col.grid], [4, estado.col["grid-2"]]]) {
      c.strokeStyle = color; c.beginPath();
      for (let i = 0; i <= estado.cols; i += paso2) { c.moveTo(Math.round(P(i)) + .5, oy); c.lineTo(Math.round(P(i)) + .5, oy + estado.rows * T); }
      for (let j = 0; j <= estado.rows; j += paso2 === 4 ? 3 : 1) { c.moveTo(ox, Math.round(Q(j)) + .5); c.lineTo(ox + estado.cols * T, Math.round(Q(j)) + .5); }
      c.stroke();
    }
    c.fillStyle = estado.col.muted; c.font = `500 ${Math.max(8, T * .38)}px "JetBrains Mono", monospace`; c.textAlign = "center"; c.textBaseline = "bottom";
    for (let i = 0; i <= estado.cols; i += 4) c.fillText(i, P(i), oy - 2);
    c.strokeStyle = estado.col.bad; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); c.moveTo(P(LINEA_BASE), oy); c.lineTo(P(LINEA_BASE), oy + estado.rows * T); c.stroke(); c.setLineDash([]);
    if (estado.mundo.def.niebla) { c.fillStyle = estado.col.surface; c.globalAlpha = .28; c.fillRect(ox, oy, estado.cols * T, estado.rows * T); c.globalAlpha = 1; }
    // Alcances de la máquina elegida
    const sel = estado.seleccion && estado.mundo.porId[estado.seleccion];
    const aro = (x, y, r, color, dash) => { c.strokeStyle = color; c.lineWidth = 1.5; c.setLineDash(dash || []); c.beginPath(); c.arc(P(x), Q(y), r * T, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); };
    if (sel && sel.clase === "lanzador") { aro(sel.cx, sel.cy, alcance("visual"), estado.col["s-visual"]); aro(sel.cx, sel.cy, alcance("thermal"), estado.col["s-termico"], [6, 4]); }
    if (sel && sel.clase === "vibracion") aro(sel.cx, sel.cy, sel.alcance, estado.col["s-vibra"], [3, 3]);
    // Halo y brillo bajo las máquinas: calcos aditivos con las mismas medidas que en 3D.
    const rol = (e) => estado.col[`rol-${funcionDe(e).principal}`];
    const ahora = performance.now(), k = INTENSIDAD[visual.intensidad];
    c.globalCompositeOperation = "lighter";
    const charco = (x, y, r, color, alfa) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, Math.min(1, alfa))); g.addColorStop(.35, rgba(color, Math.min(1, alfa * .42))); g.addColorStop(1, rgba(color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    };
    for (const e of estado.mundo.maquinas) {
      const x = P(e.cx), y = Q(e.cy), r = radioDe(e), f = funcionDe(e), mal = e.clase === "lanzador" && e.atascado;
      const paradas = HALO[visual.halo];
      if (paradas && !estado.seleccionadas.has(e.id)) {
        const R = r / FR * T;
        const sector = (color, a0, a1) => {
          const g = c.createRadialGradient(x, y, 0, x, y, R);
          for (const [dd, a] of paradas) g.addColorStop(FR + dd, rgba(color, Math.min(1, a * .85 * k)));
          c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.arc(x, y, R, a0, a1); c.closePath(); c.fill();
        };
        const sec = !mal && f.secundaria;
        // En pantalla el ángulo va al revés que en 3D (y hacia abajo).
        sector(mal ? estado.col.bad : rol(e), sec ? -ARCO[0] - Math.PI * 2 : 0, sec ? -ARCO[1] : Math.PI * 2);
        if (sec) sector(estado.col[`rol-${sec}`], -ARCO[1], -ARCO[0]);
      }
      if (visual.brillo === "aura") charco(x, y, r * 1.7 * T, rol(e), .24 * k);
      else if (visual.brillo === "pilotos" && !mal) for (const [lx, , lz] of LUCES[e.clase] || []) charco(P(e.cx + lx * 1.15), Q(e.cy + lz * 1.15), r * .55 * T, rol(e), .4 * k);
      else if (visual.brillo === "faros") {
        const a = direccionDe(e, ahora), L = r * 2.5 * T, g = c.createRadialGradient(x, y, 0, x, y, L);
        g.addColorStop(0, rgba(rol(e), Math.min(1, .5 * k))); g.addColorStop(.45, rgba(rol(e), Math.min(1, .2 * k))); g.addColorStop(1, rgba(rol(e), 0));
        c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.arc(x, y, L, a - .42, a + .42); c.closePath(); c.fill();
      }
    }
    c.globalCompositeOperation = "source-over";
    // Edificios
    const caja = (x, y, w, h, relleno, borde) => { c.fillStyle = relleno; c.strokeStyle = borde; c.lineWidth = 1.5; c.beginPath(); c.roundRect(P(x - w / 2), Q(y - h / 2), w * T, h * T, T * .18); c.fill(); c.stroke(); };
    const d = estado.mundo.deposito; caja(d.cx, d.cy, 1.4, 1.7, estado.col.building, rol(d));
    c.fillStyle = estado.col.misil; c.fillRect(P(d.cx - .45), Q(d.cy - .35), .9 * T, .14 * T); c.fillRect(P(d.cx - .45), Q(d.cy + .2), .9 * T, .14 * T);
    for (const s of estado.mundo.sensores) {
      c.fillStyle = rol(s); c.beginPath(); c.arc(P(s.cx), Q(s.cy), T * .32, 0, Math.PI * 2); c.fill();
    }
    for (const l of estado.mundo.lanzadores) {
      caja(l.cx, l.cy, 1.1, 1.1, estado.col.building, l.atascado ? estado.col.bad : rol(l));
      c.strokeStyle = l.atascado ? estado.col.bad : estado.col.ink; c.lineWidth = Math.max(2, T * .18); c.lineCap = "round";
      c.beginPath(); c.moveTo(P(l.cx), Q(l.cy)); c.lineTo(P(l.cx + Math.cos(l.yaw) * .7), Q(l.cy + Math.sin(l.yaw) * .7)); c.stroke(); c.lineCap = "butt";
      if (l.lugar && !l.atascado && l.modo !== "idle") {
        const x = P(l.lugar.x), y = Q(l.lugar.y), r = T * .45;
        c.strokeStyle = estado.col.accent; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.moveTo(x - r * 1.4, y); c.lineTo(x + r * 1.4, y); c.moveTo(x, y - r * 1.4); c.lineTo(x, y + r * 1.4); c.stroke();
        if ((l.lugar.z || 0) > .05) { c.fillStyle = estado.col.accent; c.font = `700 ${Math.max(9, T * .42)}px "JetBrains Mono", monospace`; c.textAlign = "left"; c.textBaseline = "bottom"; c.fillText(`↑${r2(l.lugar.z)}`, x + r, y - r * .6); }
      }
    }
    for (const r of estado.mundo.reparadores) { c.fillStyle = rol(r); c.fillRect(P(r.cx) - T * .23, Q(r.cy) - T * .23, T * .46, T * .46); }
    // Luces: puntos claros encima de cada máquina (pilotos y faros); se apagan con el atasco.
    if (visual.brillo === "pilotos" || visual.brillo === "faros") for (const e of estado.mundo.maquinas) {
      if (e.clase === "lanzador" && e.atascado) continue;
      if (e.clase === "vibracion" && ahora % 1600 >= 1100) continue;
      c.fillStyle = mezclaBlanco(rol(e), .55);
      for (const [lx, , lz] of LUCES[e.clase] || []) { c.beginPath(); c.arc(P(e.cx + lx), Q(e.cy + lz), Math.max(1.5, T * .07), 0, Math.PI * 2); c.fill(); }
    }
    // Selección: el mismo círculo del halo, nítido y claro, con un filo oscuro para leerse sobre cualquier color.
    for (const e of estado.mundo.maquinas) {
      if (!estado.seleccionadas.has(e.id)) continue;
      c.beginPath(); c.arc(P(e.cx), Q(e.cy), radioDe(e) * T, 0, Math.PI * 2);
      c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 4; c.stroke(); c.strokeStyle = estado.col.sel; c.lineWidth = 2; c.stroke();
    }
    // Enemigos: la sombra desplazada indica la altura.
    for (const e of estado.mundo.enemigos) {
      const x = P(e.x + e.vx * off), y = Q(e.y + e.vy * off), tp = TIPOS[e.tipo], golpe = estado.mundo.t - e.golpeT < .25;
      const color = golpe ? estado.col.bad : tp.frio ? estado.col["enemigo-frio"] : estado.col.enemigo;
      if (tp.suelo) {
        c.fillStyle = color; c.beginPath(); c.roundRect(x - T * .4, y - T * .3, T * .8, T * .6, T * .1); c.fill();
        for (let k = 0; k < e.hpMax; k++) { c.fillStyle = k < e.hp ? estado.col.surface : estado.col.edge; c.fillRect(x - T * .3 + k * T * .22, y - T * .06, T * .14, T * .12); }
      } else {
        const sx = x + e.z * T * .28, sy = y + e.z * T * .28;
        c.fillStyle = estado.col.ink; c.globalAlpha = .16; c.beginPath(); c.ellipse(sx, sy, T * .32, T * .2, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        c.strokeStyle = color; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x, y); c.lineTo(sx, sy); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.moveTo(x, y - T * .36); c.lineTo(x + T * .36, y); c.lineTo(x, y + T * .36); c.lineTo(x - T * .36, y); c.closePath();
        if (tp.frio) { c.strokeStyle = color; c.lineWidth = 2; c.stroke(); } else { c.fillStyle = color; c.fill(); }
      }
      if (estado.seleccionadas.has(e.id)) { c.beginPath(); c.arc(x, y, T * .62, 0, Math.PI * 2); c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 4; c.stroke(); c.strokeStyle = estado.col.sel; c.lineWidth = 2; c.stroke(); }
    }
    const t = estado.mundo.t + off;
    for (const mi of estado.mundo.misiles) {
      const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
      const x = P(mi.x0 + (mi.x1 - mi.x0) * u), y = Q(mi.y0 + (mi.y1 - mi.y0) * u);
      c.strokeStyle = estado.col.misil; c.lineWidth = 1.5; c.beginPath(); c.moveTo(P(mi.x0 + (mi.x1 - mi.x0) * Math.max(0, u - .18)), Q(mi.y0 + (mi.y1 - mi.y0) * Math.max(0, u - .18))); c.lineTo(x, y); c.stroke();
      c.fillStyle = estado.col.misil; c.beginPath(); c.arc(x, y, T * .14, 0, Math.PI * 2); c.fill();
    }
    // Explosiones: llena = en el suelo, con borde discontinuo y altura = en el aire.
    for (const x of estado.mundo.explosiones) {
      const u = Math.min(1, (t - x.t0) / .35), a = 1 - Math.max(0, (t - x.t0 - .25) / .5);
      if (x.atasco) { c.fillStyle = estado.col.edge; c.globalAlpha = .5 * a; c.beginPath(); c.arc(P(x.x), Q(x.y), T * .7 * u, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; continue; }
      const r = MISIL.radio * T * (.25 + .75 * Math.min(1, u * 1.4));
      c.globalAlpha = .38 * a; c.fillStyle = estado.col.explosion; c.beginPath(); c.arc(P(x.x), Q(x.y), r, 0, Math.PI * 2); c.fill(); c.globalAlpha = Math.max(0, a);
      if (x.z > .05) {
        c.strokeStyle = estado.col.explosion; c.setLineDash([4, 3]); c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
        c.fillStyle = estado.col.ink; c.font = `600 ${Math.max(8, T * .36)}px "JetBrains Mono", monospace`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`↑${r2(x.z)}`, P(x.x), Q(x.y));
      }
      c.globalAlpha = 1;
    }
  }
    return dibujar2D;
  }
  window.VISTAS = { crear3D, crearPlano };
})();
