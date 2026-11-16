import { liberarEscena } from './recursos.js';
/* Visor 3D común de War y Factory, antes en js/vistas.js. Solo lee estado.escena. */
import { factory3d } from './factory.js';
import { crearCamara3D } from './camara.js';
import { crearTerreno3D } from './terreno.js';

/** @param {import('./index.js').EstadoVista} estado @param {import('./index.js').DependenciasWar} deps
 * @returns {import('./index.js').Vista3D | null} */
export function crear3D(estado, { THREE, $, ES_FACTORY, ARCO, FR, FUNCIONES, HALO, INTENSIDAD, LINEA_BASE, LUCES, MISIL, TIPOS, alcance, direccionDe, funcionDe, leerVar, radioDe, visual, terreno, terrenoEditor = null }) {
    if (typeof THREE === "undefined") return null;
    // Factory usa el mismo visor con su propio contenido (factory.js) y un mapa más pequeño.
    let factory = null, ahoraPrevio = null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: $("c3d"), antialias: true }); } catch { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const escena = new THREE.Scene();
    // Bruma del horizonte: solo toca lo que queda más allá del campo, para que el terreno se pierda a lo lejos.
    const horizonte = new THREE.Fog(0xffffff, 60, 140);
    const camara = new THREE.PerspectiveCamera(38, 1.6, 0.1, 500);
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
      if (factory) factory.colores();
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

    const { construirTerreno, pintarMontes } = crearTerreno3D({ THREE, estado, terreno, terrenoEditor, M, G, L, mesh, lineas, fijo, leerVar });

    function construir() {
      limpiar(fijo); limpiar(movil); objetos.clear(); misiles.clear(); efectos.clear(); anillos = null;
      prepararVisual();
      if (!terrenoEditor) {
        const suelo = mesh(new THREE.PlaneGeometry(estado.cols, estado.rows), M.suelo); suelo.rotation.x = -Math.PI / 2; suelo.position.set(estado.cols / 2, 0, estado.rows / 2); fijo.add(suelo);
      }
      construirTerreno(!ES_FACTORY);
      const p1 = [], p2 = [];
      for (let i = 0; i <= estado.cols; i++) (i % 4 ? p1 : p2).push([i, .01, 0], [i, .01, estado.rows]);
      for (let j = 0; j <= estado.rows; j++) (j % 3 ? p1 : p2).push([0, .01, j], [estado.cols, .01, j]);
      fijo.add(lineas(p1, L.grid), lineas(p2, L.grid2));
      if (ES_FACTORY) {
        escena.fog = horizonte;
        factory = factory3d.construir({ THREE, estado, fijo, movil, objetos, M, mesh, G, lineas, L, leerVar });
        factory3d.ultimo = factory;
        aplicarColores(); anillosDe(estado.seleccion);
        return;
      }
      const zona = mesh(new THREE.PlaneGeometry(LINEA_BASE, estado.rows), M.base); zona.rotation.x = -Math.PI / 2; zona.position.set(LINEA_BASE / 2, .015, estado.rows / 2); fijo.add(zona);
      const br = lineas([[LINEA_BASE, .03, 0], [LINEA_BASE, .03, estado.rows]], L.brecha); br.computeLineDistances(); fijo.add(br);
      escena.fog = estado.escena.def.niebla ? new THREE.Fog(0xffffff, 10, 34) : horizonte;
      for (const l of estado.escena.lanzadores) {
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
      for (const s of estado.escena.sensores) {
        const g = new THREE.Group(); g.position.set(s.cx, 0, s.cy); g.userData.id = s.id;
        const poste = mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 8), M.borde); poste.position.y = .65;
        const cabeza = mesh(new THREE.CylinderGeometry(.28, .28, .1, 16), rolM(s)); cabeza.position.y = 1.3;
        const pie = mesh(new THREE.CylinderGeometry(.35, .4, .08, 16), M.edificio); pie.position.y = .04;
        g.add(poste, cabeza, pie); fijo.add(g);
        objetos.set(s.id, { grupo: g, alto: 1.6 });
      }
      { const d = estado.escena.deposito, g = new THREE.Group(); g.position.set(d.cx, 0, d.cy); g.userData.id = d.id;
        const c = mesh(G.caja(1.4, .7, 1.7), M.edificio); c.position.y = .35;
        const t = mesh(G.caja(1.2, .05, 1.5), rolM(d)); t.position.y = .72;
        const m1 = mesh(G.caja(.9, .14, .14), M.misil); m1.position.set(0, .82, -.3);
        const m2 = m1.clone(); m2.position.z = .3;
        g.add(c, t, m1, m2); fijo.add(g); objetos.set(d.id, { grupo: g, alto: 1.1 }); }
      for (const r of estado.escena.reparadores) {
        const g = new THREE.Group(); g.userData.id = r.id;
        const c = mesh(G.caja(.46, .32, .46), rolM(r)); c.position.y = .2;
        const a = mesh(G.caja(.04, .35, .04), M.borde); a.position.set(.12, .5, .12);
        g.add(c, a); movil.add(g); objetos.set(r.id, { grupo: g, alto: .9 });
      }
      for (const e of estado.escena.maquinas) {
        const o = objetos.get(e.id);
        if (visual.halo !== "no") { o.halo = halo(e); o.grupo.add(o.halo.g); }
        o.brillo = brillo(e, o.grupo);
      }
      for (const l of estado.escena.lanzadores) {
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
      if (!estado.escena || !id) return;
      const e = estado.escena.porId[id];
      const grupo = new THREE.Group();
      // La selección es el mismo círculo del halo, pero nítido y claro.
      const anillo = (r, mat, x, z, w = .05) => { const a = mesh(new THREE.RingGeometry(r - w, r + w, 96), mat); a.rotation.x = -Math.PI / 2; a.position.set(x, .04, z); grupo.add(a); };
      if (e && e.clase === "lanzador") { anillo(alcance("visual"), M.rVisual, e.cx, e.cy); anillo(alcance("thermal"), M.rTermico, e.cx, e.cy); }
      else if (e && e.clase === "vibracion") anillo(e.alcance, M.rVibra, e.cx, e.cy);
      // El robot de carga se mueve: su anillo lo sigue (ver actualizar).
      if (e && e.clase === "robot") { anillo(radioDe(e), M.sel, 0, 0, .06); grupo.userData.sigueMaquina = id; }
      else if (e) anillo(radioDe(e), M.sel, e.cx, e.cy, .06);
      else { const en = estado.escena.enemigos.find(x => x.id === id); if (!en) return; anillo(.6, M.sel, 0, 0, .06); grupo.userData.sigue = id; }
      anillos = grupo; movil.add(grupo);
      for (const otro of estado.seleccionadas) {
        if (otro === id) continue;
        const u = estado.escena.porId[otro] || estado.escena.enemigos.find(e => e.id === otro);
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
      if (factory) {
        const dt = ahoraPrevio == null ? 0 : Math.min(.1, Math.max(0, (ahora - ahoraPrevio) / 1000)); ahoraPrevio = ahora;
        factory3d.actualizar(factory, { THREE, estado, camara, altoPx }, dt);
        if (anillos && anillos.userData.sigueMaquina) { const u = estado.escena.porId[anillos.userData.sigueMaquina]; if (u) anillos.position.set(u.cx, 0, u.cy); }
        return;
      }
      const t = estado.escena.t + off;
      for (const l of estado.escena.lanzadores) {
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
      for (const r of estado.escena.reparadores) { const o = objetos.get(r.id); o.grupo.position.set(r.cx, 0, r.cy); o.grupo.rotation.y = r.estado === "reparar" ? ahora / 160 : 0; }
      for (const e of estado.escena.maquinas) {
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
      for (const e of estado.escena.enemigos) {
        vivos.add(e.id);
        let o = objetos.get(e.id);
        if (!o) { o = enemigoMesh(e); objetos.set(e.id, o); movil.add(o.grupo); }
        const x = e.x + e.vx * off, y = e.y + e.vy * off;
        o.grupo.position.set(x, 0, y);
        o.cuerpo.material = estado.escena.t - e.golpeT < .25 ? M.golpe : o.mat;
        if (o.cuerpoG) {
          o.cuerpoG.position.y = e.z;
          o.alt.scale.set(1, e.z, 1);
          for (const r of o.rotores) r.rotation.y = ahora / 40;
        }
      }
      for (const [id, o] of objetos) if (o.mat && !vivos.has(id)) { movil.remove(o.grupo); objetos.delete(id); }
      const enVuelo = new Set();
      for (const mi of estado.escena.misiles) {
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
      for (const x of estado.escena.explosiones) {
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
        const en = estado.escena.enemigos.find(x => x.id === anillos.userData.sigue);
        if (en) anillos.position.set(en.x + en.vx * off, en.z, en.y); else anillos.visible = false;
      }
      if (anillos) for (const a of anillos.children) {
        if (!a.userData.unidad) continue;
        const u = estado.escena.porId[a.userData.unidad] || estado.escena.enemigos.find(e => e.id === a.userData.unidad);
        a.visible = !!u;
        if (u) a.position.set((u.cx ?? u.x) - anillos.position.x, .04 - anillos.position.y, (u.cy ?? u.y) - anillos.position.z);
      }
    }


      const { altoPx, ...controles } = crearCamara3D({ THREE, estado, $, ES_FACTORY, renderer, escena, camara, horizonte, fijo, movil, get factory() { return factory; } });
    return { construir, actualizar, ...controles,
      destruir() { controles.destruir(); liberarEscena(escena, renderer, [...Object.values(G), ...Object.values(M), ...Object.values(D), ...Object.values(tex)]); }, anillosDe, aplicarColores, retrato };
}
