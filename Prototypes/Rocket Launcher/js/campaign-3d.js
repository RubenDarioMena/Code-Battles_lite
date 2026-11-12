/* Campaign · vista 3D: diorama low-poly del mapa (fábrica, muralla y campo de batalla) y sus unidades.
 * Mismo contrato que el visor común (vistas.js): construir, actualizar, render, proyectar, elegir, suelo…
 * Dos pieles: paisaje y batalla (sin texturas de escenario, con la cuadrícula de War). Solo dibujo: nunca cambia el mundo. */
(() => {
  "use strict";
  const PASO = 2, FALDA = -7, MURO = { alto: 3.4, ancho: 1.5 };
  const PIEZA = { steel: 0x9fb2c0, polymer: 0xe6d79a, nose: 0xe2704c, base: 0x5fa06a, charge: 0xb884e0, motor: 0xe0a04e, missile: 0xeef2f4 };
  const LUZ = { green: 0x4be38a, amber: 0xffc247, red: 0xff5a4f, off: 0x2a343c };

  function crear(estado, { $, FUNCIONES, funcionDe, leerVar, radioDe }) {
    if (typeof THREE === "undefined" || !window.CAMPAIGN_TERRENO) return null;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: $("c3d"), antialias: true }); } catch { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const mapa = window.CAMPAIGN_NIVEL.MAPA, T = window.CAMPAIGN_TERRENO.crear(mapa), C = window.CAMPAIGN;
    const escena = new THREE.Scene(), camara = new THREE.PerspectiveCamera(38, 1.6, 0.5, 900);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9488, 0.82), sol = new THREE.DirectionalLight(0xffffff, 0.62);
    sol.position.set(-60, 120, 50); escena.add(hemi, sol);
    const paisaje = new THREE.Group(), fijo = new THREE.Group(), movil = new THREE.Group();
    escena.add(paisaje, fijo, movil);
    const col = (k, def) => new THREE.Color(leerVar(k) || def);
    const mesh = (g, m) => new THREE.Mesh(g, m);
    const caja = (w, h, d, mat, x = 0, y = 0, z = 0) => { const o = mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); return o; };
    const cil = (r1, r2, h, mat, x = 0, y = 0, z = 0, n = 10) => { const o = mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat); o.position.set(x, y, z); return o; };

    // ---------- Pieles: cada material sabe su color en el paisaje y en batalla ----------
    let piel = 0, pielDestino = 0;                 // 0 paisaje · 1 batalla
    const pieles = [];                             // { mat, a: Color, b: () => Color }
    const conPiel = (mat, a, b) => { pieles.push({ mat, a: new THREE.Color(a), b }); return mat; };
    const lam = (extra = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, ...extra });
    const temas = [];                              // materiales que siguen una variable CSS
    const tema = (k, mat, claro = 0) => { temas.push({ k, mat, claro }); return mat; };
    const M = {
      edificio: tema("building", lam()), techo: tema("building-top", lam()), borde: tema("edge", lam()), mal: tema("bad", lam()), acento: tema("accent", lam()),
      apagado: lam({ color: 0x2c363e }), madera: lam({ color: 0xb08a55 }), metal: lam({ color: 0x5f6d77 }), goma: lam({ color: 0x20272d }),
      sel: tema("sel", new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })),
      misil: tema("misil", new THREE.MeshBasicMaterial({ color: 0xffffff })),
      explosion: tema("explosion", new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .4, depthWrite: false })),
      estela: tema("misil", new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 })),
      placa: tema("accent", new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .13, depthWrite: false })),
      placaPad: tema("edge", new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .16, depthWrite: false })),
      marca: tema("accent", new THREE.LineBasicMaterial({ color: 0xffffff })), marcaPad: tema("edge", new THREE.LineBasicMaterial({ color: 0xffffff })),
      progreso: new THREE.MeshBasicMaterial({ color: 0xffffff }), diana: tema("bad", new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .8 })),
      ...Object.fromEntries(Object.keys(FUNCIONES).map(f => [`rol-${f}`, tema(`rol-${f}`, lam())])),
      ...Object.fromEntries(Object.entries(LUZ).map(([k, c]) => [`luz-${k}`, new THREE.MeshBasicMaterial({ color: c })])),
    };
    const MP = Object.fromEntries(Object.entries(PIEZA).map(([k, c]) => [k, lam({ color: c })]));
    const rolM = e => M[`rol-${funcionDe(e).principal}`];
    const torno = pts => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 8);
    // Siluetas de las piezas: la del misil sale de sumar ojiva, base con aletas y carga.
    const GP = {
      steel: new THREE.BoxGeometry(.5, .07, .36), polymer: new THREE.BoxGeometry(.3, .22, .3),
      nose: torno([[0, .24], [.15, -.1], [.15, -.2], [0, -.2]]), base: torno([[0, .18], [.15, .18], [.15, -.04], [.3, -.18], [0, -.18]]),
      charge: new THREE.CylinderGeometry(.1, .1, .26, 8), motor: torno([[0, .32], [.15, .32], [.15, -.14], [.3, -.3], [0, -.3]]),
      missile: torno([[0, .62], [.15, .28], [.15, -.3], [.3, -.46], [0, -.46]]),
    };
    const ALTO_P = { steel: .035, polymer: .11, nose: .2, base: .18, charge: .13, motor: .3, missile: .46 };
    function ponerPieza(o, tipo) { if (o.userData.tipo !== tipo) { o.geometry = GP[tipo]; o.material = MP[tipo]; o.userData.tipo = tipo; } o.visible = true; }
    function piezas(g, n, lugar) {
      return Array.from({ length: n }, (_, i) => { const o = mesh(GP.steel, MP.steel); o.visible = false; o.userData.base = lugar(i); g.add(o); return o; });
    }
    function pintarPiezas(lista, tipos) {
      for (let i = 0; i < lista.length; i++) {
        const o = lista[i], tipo = tipos[i];
        if (!tipo) { o.visible = false; continue; }
        ponerPieza(o, tipo); const b = o.userData.base; o.position.set(b[0], b[1] + ALTO_P[tipo], b[2]);
      }
    }

    // ---------- Terreno (se construye una vez: no depende de la partida) ----------
    const nx = Math.round(T.cols / PASO), ny = Math.round(T.rows / PASO);
    let terreno, colA, colB, caras = [], rejilla, losa, losaRed, agua, falda, arboles, muro, almenas;
    function construirTerreno() {
      const px = [], py = [], h = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        let x = i * PASO, y = j * PASO;
        const borde = i === 0 || j === 0 || i === nx || j === ny, l = mapa.losa;
        const plano = x > l.x0 - 4 && x < l.x1 + 4 && y > l.y0 - 4 && y < l.y1 + 4;
        if (!borde && !plano) { x += (T.hash(i, j, 41) - .5) * 1.1; y += (T.hash(i, j, 42) - .5) * 1.1; }
        px.push(x); py.push(y); h.push(T.altura(x, y));
      }
      const pos = [], idx = (i, j) => j * (nx + 1) + i;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1);
        // Diagonal alterna: evita el rayado de una malla regular.
        const tris = (i + j) % 2 ? [[a, c, b], [b, c, d]] : [[a, c, d], [a, d, b]];
        for (const t of tris) {
          for (const k of t) pos.push(px[k], h[k], py[k]);
          const [p, q, r] = t, cx = (px[p] + px[q] + px[r]) / 3, cy = (py[p] + py[q] + py[r]) / 3, ch = (h[p] + h[q] + h[r]) / 3;
          const ux = px[q] - px[p], uy = h[q] - h[p], uz = py[q] - py[p], vx = px[r] - px[p], vy = h[r] - h[p], vz = py[r] - py[p];
          const nxx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nzz = ux * vy - uy * vx, pend = 1 - Math.abs(nyy) / Math.hypot(nxx, nyy, nzz);
          caras.push({ x: cx, y: cy, h: ch, pend, nieve: T.monte(cx, cy).nieve, agua: ch < -.3, carril: mapa.carriles.some(k => T.aLinea(k, cx, cy).d < 4) && !T.dentro(cx, cy) });
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      colA = new Float32Array(pos.length); colB = new Float32Array(pos.length);
      caras.forEach((f, n) => { const c = T.color(f.x, f.y, f.h, f.pend), s = .93 + .14 * T.hash(n, 7, 3); for (let k = 0; k < 3; k++) colA.set([c[0] * s, c[1] * s, c[2] * s], n * 9 + k * 3); });
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colA), 3));
      g.computeVertexNormals();
      terreno = mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); terreno.raycast = () => {};
      // Falda: el corte de tierra del diorama.
      const f = [], lado = (lista) => { for (let k = 0; k < lista.length - 1; k++) { const [x0, y0, h0] = lista[k], [x1, y1, h1] = lista[k + 1]; f.push(x0, h0, y0, x1, h1, y1, x0, FALDA, y0, x1, h1, y1, x1, FALDA, y1, x0, FALDA, y0); } };
      const fila = (j, rev) => { const r = []; for (let i = 0; i <= nx; i++) r.push([px[idx(i, j)], py[idx(i, j)], h[idx(i, j)]]); return rev ? r.reverse() : r; };
      const colu = (i, rev) => { const r = []; for (let j = 0; j <= ny; j++) r.push([px[idx(i, j)], py[idx(i, j)], h[idx(i, j)]]); return rev ? r.reverse() : r; };
      lado(fila(ny, false)); lado(fila(0, true)); lado(colu(0, false)); lado(colu(nx, true));
      const gf = new THREE.BufferGeometry(); gf.setAttribute("position", new THREE.BufferAttribute(new Float32Array(f), 3)); gf.computeVertexNormals();
      falda = mesh(gf, conPiel(lam({ side: THREE.DoubleSide }), 0x7b5f44, () => col("building", "#26313A").multiplyScalar(.7))); falda.raycast = () => {};
      // Cuadrícula tendida sobre el relieve (solo en batalla): cada 2 m, y más marcada cada 10 m.
      const fino = [], grueso = [];
      const linea = (x0, y0, x1, y1, dest) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2); let antes = null; for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n, a = T.altura(x, y), p = a > 3.2 || a < -.3 ? null : [x, a + .09, y]; if (antes && p) dest.push(...antes, ...p); antes = p; } };
      for (let i = 0; i <= T.cols; i += 2) linea(i, 0, i, T.rows, i % 10 ? fino : grueso);
      for (let j = 0; j <= T.rows; j += 2) linea(0, j, T.cols, j, j % 10 ? fino : grueso);
      const red = (pts, k) => { const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3)); const l = new THREE.LineSegments(gg, tema(k, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }))); l.raycast = () => {}; return l; };
      rejilla = new THREE.Group(); rejilla.add(red(fino, "grid"), red(grueso, "grid-2")); rejilla.visible = false;
      // Losa de la fábrica, con su propia cuadrícula de 1 m y el pasillo marcado.
      const l = mapa.losa, w = l.x1 - l.x0, d = l.y1 - l.y0;
      losa = mesh(new THREE.PlaneGeometry(w, d), conPiel(lam(), 0x6b767d, () => col("suelo", "#1F2B35"))); losa.rotation.x = -Math.PI / 2; losa.position.set(l.x0 + w / 2, .03, l.y0 + d / 2);
      const lr = [], lr2 = [];
      for (let x = Math.ceil(l.x0); x <= l.x1; x++) (x % 5 ? lr : lr2).push(x, .045, l.y0, x, .045, l.y1);
      for (let y = Math.ceil(l.y0); y <= l.y1; y++) (y % 5 ? lr : lr2).push(l.x0, .045, y, l.x1, .045, y);
      const redLosa = (pts, a, k) => { const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3)); const o = new THREE.LineSegments(gg, conPiel(new THREE.LineBasicMaterial({ color: 0xffffff }), a, () => col(k, "#2A3A46"))); o.raycast = () => {}; return o; };
      losaRed = new THREE.Group(); losaRed.add(redLosa(lr, 0x5d686f, "grid"), redLosa(lr2, 0x515c63, "grid-2"));
      const p = mapa.pasillo, pas = [p.x0, .05, p.y0, p.x1, .05, p.y0, p.x0, .05, p.y1, p.x1, .05, p.y1];
      losaRed.add(redLosa(pas, 0xe8c64a, "accent"));
      // Río.
      const xs = mapa.rio.map(q => q[0]), ys = mapa.rio.map(q => q[1]);
      const ax0 = Math.max(0, Math.min(...xs) - 6), ax1 = Math.min(T.cols, Math.max(...xs) + 6), ay0 = 0, ay1 = Math.min(T.rows, Math.max(...ys) + 7);
      agua = mesh(new THREE.PlaneGeometry(ax1 - ax0, ay1 - ay0), conPiel(lam({ transparent: true, opacity: .88 }), 0x3aa7dc, () => col("suelo", "#1F2B35").lerp(col("accent", "#7FA8FF"), .22)));
      agua.rotation.x = -Math.PI / 2; agua.position.set((ax0 + ax1) / 2, -.34, (ay0 + ay1) / 2); agua.raycast = () => {};
      // Árboles: conos instanciados, solo en el paisaje.
      const lista = T.arboles(), mt = new THREE.Matrix4(), cc = new THREE.Color();
      arboles = new THREE.InstancedMesh(new THREE.ConeGeometry(.8, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), lista.length);
      lista.forEach((a, n) => { mt.makeScale(a.s, a.s, a.s); mt.setPosition(a.x, a.h + 1.1 * a.s, a.y); arboles.setMatrixAt(n, mt); arboles.setColorAt(n, cc.setHex(T.hash(n, 3, 50) > .5 ? 0x356b2f : 0x427a35)); });
      arboles.raycast = () => {};
      // Muralla: tramos de 2 m sobre el trazado del boceto, con almenas hacia el campo de batalla.
      const tramos = T.tramosMuralla(2), piedra = conPiel(lam(), 0x85887f, () => col("edge", "#5C6B75")), q = new THREE.Quaternion(), s1 = new THREE.Vector3(), eje = new THREE.Vector3(0, 1, 0);
      muro = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), piedra, tramos.length); almenas = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), piedra, tramos.length);
      tramos.forEach((t, n) => {
        const dx = t.x1 - t.x0, dy = t.y1 - t.y0, L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), mx = (t.x0 + t.x1) / 2, my = (t.y0 + t.y1) / 2;
        q.setFromAxisAngle(eje, -ang);
        mt.compose(new THREE.Vector3(mx, (MURO.alto - 2) / 2, my), q, s1.set(L + .12, MURO.alto + 2, MURO.ancho)); muro.setMatrixAt(n, mt);
        // El lado de fuera queda a la izquierda del avance (este en el tramo recto).
        const ox = dy / L * .5, oy = -dx / L * .5;
        mt.compose(new THREE.Vector3(mx + ox, MURO.alto + (n % 2 ? .28 : .1), my + oy), q, s1.set(L + .12, n % 2 ? .56 : .2, .42)); almenas.setMatrixAt(n, mt);
      });
      muro.raycast = almenas.raycast = () => {};
      paisaje.add(terreno, falda, rejilla, losa, losaRed, agua, arboles, muro, almenas);
    }
    function coloresBatalla() {
      const suelo = col("suelo", "#1F2B35"), alto = col("edge", "#5C6B75"), nieve = col("ink", "#DCE3E6"), acento = col("accent", "#7FA8FF"), c = new THREE.Color();
      caras.forEach((f, n) => {
        c.copy(suelo).lerp(alto, Math.min(1, Math.max(0, f.h) / 16) * .85);
        if (f.nieve > .62) c.lerp(nieve, .45);
        if (f.agua) c.copy(suelo).lerp(acento, .2);
        else if (f.carril) c.lerp(acento, .07);
        c.multiplyScalar(.94 + .1 * T.hash(n, 9, 4));
        for (let k = 0; k < 3; k++) colB.set([c.r, c.g, c.b], n * 9 + k * 3);
      });
    }
    function aplicarPiel() {
      const u = piel, a = terreno.geometry.attributes.color, arr = a.array;
      for (let i = 0; i < arr.length; i++) arr[i] = colA[i] + (colB[i] - colA[i]) * u;
      a.needsUpdate = true;
      for (const p of pieles) p.mat.color.copy(p.a).lerp(p.b(), u);
      rejilla.visible = u > .01; rejilla.children[0].material.opacity = u * .75; rejilla.children[1].material.opacity = u;
      arboles.visible = u < .98; arboles.scale.y = 1 - u; arboles.position.y = 0;
      const fondo = col("bg", "#0B0F13"), cielo = new THREE.Color(0x1a2c38).lerp(fondo, .35);
      escena.background = cielo.lerp(fondo, u);
    }
    function aplicarColores() {
      for (const t of temas) { t.mat.color.set(leerVar(t.k) || "#888"); }
      if (terreno) { coloresBatalla(); aplicarPiel(); }
    }
    function batalla(si) { pielDestino = si ? 1 : 0; }
    construirTerreno();

    // ---------- Unidades ----------
    const objetos = new Map(), tarimas = new Map(), misiles = new Map(), efectos = new Map(), aros = new Map();
    let camion = null, dianas = null;
    function limpiar(grupo) { while (grupo.children.length) { const c = grupo.children.pop(); c.traverse(o => { if (o.geometry && !Object.values(GP).includes(o.geometry)) o.geometry.dispose(); }); } }
    const marco = (w, d, mat) => { const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]].map(([x, z]) => new THREE.Vector3(x, .06, z)); const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); l.raycast = () => {}; return l; };
    const placa = (w, d, mat) => { const o = mesh(new THREE.PlaneGeometry(w, d), mat); o.rotation.x = -Math.PI / 2; o.position.y = .055; return o; };

    function maquinaObj(e) {
      const g = new THREE.Group(), cuerpo = [], o = { grupo: g, cuerpo };
      const c = (m) => { cuerpo.push(m); m.userData.mat = m.material; return m; };
      g.add(caja(2.3, .3, 2.3, M.edificio, 0, .15, 0));
      if (e.clase === "prensa") {
        g.add(c(caja(.3, 2, .3, M.borde, -.8, 1.3, -.3)), c(caja(.3, 2, .3, M.borde, .8, 1.3, -.3)), c(caja(2.1, .4, .9, M.techo, 0, 2.4, -.3)), c(caja(1.5, .25, 1, M.edificio, 0, .45, -.3)));
        o.ariete = c(caja(1.1, .5, .7, rolM(e), 0, 1.7, -.3)); g.add(o.ariete);
      } else if (e.clase === "moldeadora") {
        g.add(c(caja(2, 1.2, 1.5, M.techo, 0, .9, -.3)), c(caja(2.04, .16, 1.54, rolM(e), 0, 1.3, -.3)));
        o.cil = [c(cil(.28, .28, 1.3, M.borde, -.5, 1.9, -.3)), c(cil(.28, .28, 1.3, M.borde, .5, 1.9, -.3))]; for (const x of o.cil) { x.rotation.x = Math.PI / 2; g.add(x); }
      } else if (e.clase === "mezcladora") {
        g.add(c(cil(.9, .75, 1.7, M.techo, 0, 1.15, -.25, 14)), c(cil(.93, .93, .16, rolM(e), 0, 1.6, -.25, 14)));
        o.pala = c(caja(1.5, .1, .18, M.borde, 0, 2.08, -.25)); g.add(o.pala, c(cil(.1, .1, .5, M.borde, 0, 2.25, -.25)));
      } else {
        // Ensambladora: cerrada en v1; solo se ven su entrada, su salida y su estado.
        g.children[0].scale.set(1.4, 1, 1.4);
        g.add(c(caja(3, 2.3, 2.5, M.techo, 0, 1.45, -.25)), c(caja(3.04, .2, 2.54, rolM(e), 0, 2.2, -.25)), c(caja(.5, .5, .5, M.borde, -.9, 2.85, -.5)), c(caja(.5, .7, .5, M.borde, .9, 2.95, -.5)));
        o.franja = caja(2.2, .12, .06, M["luz-off"], 0, 1.2, 1.02); g.add(o.franja);
      }
      const ancho = e.clase === "ensambladora" ? 1.5 : 1.15, frente = e.clase === "ensambladora" ? 1.35 : 1.0;
      // Tolva de entrada (a la izquierda del frente) y bandeja de salida (a la derecha).
      g.add(caja(.9, .1, .7, M.borde, -ancho + .45, .62, frente), caja(.9, .1, .7, M.metal, ancho - .45, .62, frente));
      o.entrada = piezas(g, 8, i => [-ancho + .2 + (i % 4) * .2, .67 + Math.floor(i / 4) * .25, frente - .15 + (i % 2) * .3]);
      o.salida = piezas(g, 3, i => [ancho - .75 + i * .3, .67, frente]);
      o.luz = mesh(new THREE.SphereGeometry(.16, 10, 8), M["luz-off"]); o.luz.position.set(0, e.clase === "ensambladora" ? 2.75 : 2.78, e.clase === "ensambladora" ? .9 : .35); g.add(o.luz);
      o.barra = caja(1, .09, .09, M.progreso, 0, e.clase === "ensambladora" ? 2.5 : .5, e.clase === "ensambladora" ? 1.04 : 1.18); o.barra.visible = false; g.add(o.barra);
      o.alto = e.clase === "ensambladora" ? 3.4 : 2.7;
      return o;
    }
    function robotObj(e) {
      const g = new THREE.Group(), o = { grupo: g, rumbo: e.rumbo || 0 };
      if (e.clase === "obrero") {
        g.add(caja(.95, .32, .7, M.borde, 0, .33, 0), caja(.6, .1, .6, rolM(e), -.1, .54, 0), caja(.12, .5, .12, M.metal, .3, .78, 0), caja(.5, .08, .1, M.metal, .12, 1.02, 0));
        for (const [x, z] of [[.3, .36], [-.3, .36], [.3, -.36], [-.3, -.36]]) { const r = cil(.16, .16, .12, M.goma, x, .16, z); r.rotation.x = Math.PI / 2; g.add(r); }
        g.add(mesh(new THREE.SphereGeometry(.07, 8, 6), M["luz-green"])); g.children[g.children.length - 1].position.set(.46, .4, 0);
        o.carga = piezas(g, 1, () => [-.1, .6, 0]); o.alto = 1.2;
      } else {
        g.add(caja(1.5, .55, 1.05, rolM(e), -.25, .5, 0), caja(.7, .7, .9, M.borde, -.55, 1.1, 0), caja(.12, 2, .12, M.metal, .55, 1.1, .35), caja(.12, 2, .12, M.metal, .55, 1.1, -.35), caja(.9, .05, .5, M.techo, -.55, 1.5, 0));
        for (const [x, z] of [[.3, .56], [-.7, .56], [.3, -.56], [-.7, -.56]]) { const r = cil(.24, .24, .16, M.goma, x, .24, z); r.rotation.x = Math.PI / 2; g.add(r); }
        o.horquilla = new THREE.Group(); o.horquilla.add(caja(1.1, .06, .14, M.metal, 1.1, 0, .32), caja(1.1, .06, .14, M.metal, 1.1, 0, -.32)); o.horquilla.position.y = .14; g.add(o.horquilla);
        o.alto = 2.1;
      }
      return o;
    }
    function tarimaObj(id) {
      const g = new THREE.Group();
      g.add(caja(1.25, .08, 1.25, M.madera, 0, .1, 0), caja(1.25, .06, .16, M.madera, 0, .03, .45), caja(1.25, .06, .16, M.madera, 0, .03, -.45));
      const o = { grupo: g, firma: null, piezas: piezas(g, C.TARIMA_CAP, i => [-.42 + (i % 4) * .28, .14, -.34 + Math.floor(i / 4) * .34]) };
      movil.add(g); tarimas.set(id, o); return o;
    }
    function construir() {
      limpiar(fijo); limpiar(movil); objetos.clear(); tarimas.clear(); misiles.clear(); efectos.clear(); aros.clear(); camion = null;
      const m = estado.mundo; if (!m) return;
      for (const e of m.maquinas) {
        let o;
        if (C.esMaquina(e)) o = maquinaObj(e);
        else if (C.esRobot(e)) o = robotObj(e);
        else if (e.clase === "lugar") { const g = new THREE.Group(), sup = e.tipo === "sup"; g.add(placa(1.7, 1.7, sup ? M.placa : M.placaPad), marco(1.7, 1.7, sup ? M.marca : M.marcaPad)); o = { grupo: g, alto: 1.4 }; }
        else if (e.clase === "pad") { const g = new THREE.Group(); g.add(placa(2.6, 2.6, M.placaPad), marco(2.6, 2.6, M.marcaPad)); o = { grupo: g, alto: .4 }; }
        else if (e.clase === "pila") { const g = new THREE.Group(); for (let i = 0; i < 6; i++) g.add(caja(1.25, .1, 1.25, M.madera, 0, .08 + i * .15, 0)); g.add(marco(1.7, 1.7, M.marcaPad)); o = { grupo: g, alto: 1.3 }; }
        else if (e.clase === "bahia") {
          const g = new THREE.Group(); g.add(placa(2.6, 3.4, M.placa), marco(2.6, 3.4, M.marca));
          for (const [x, z] of [[-1.2, -1.6], [-1.2, 1.6], [1.2, -1.6], [1.2, 1.6]]) g.add(caja(.14, 2.6, .14, M.borde, x, 1.3, z));
          g.add(caja(2.9, .12, 3.7, rolM(e), 0, 2.66, 0)); o = { grupo: g, alto: 2.9 };
        } else if (e.clase === "banda") {
          const g = new THREE.Group(), L = e.largo, ang = Math.atan2(e.y1 - e.y0, e.x1 - e.x0);
          g.rotation.y = -ang; g.add(caja(L, .3, .9, M.borde, 0, .45, 0), caja(L, .06, .7, M.goma, 0, .63, 0), caja(L, .12, .06, rolM(e), 0, .66, .45), caja(L, .12, .06, rolM(e), 0, .66, -.45));
          for (let x = -L / 2 + .3; x < L / 2; x += 1.2) g.add(caja(.12, .45, .9, M.metal, x, .22, 0));
          o = { grupo: g, alto: 1.2, L, items: piezas(g, 8, () => [0, .66, 0]), listones: [] };
          for (let k = 0; k < Math.floor(L); k++) { const s = caja(.08, .02, .66, M.metal, 0, .67, 0); g.add(s); o.listones.push(s); }
        } else if (e.clase === "arsenal") {
          const g = new THREE.Group(); g.add(caja(2, 2.3, 3, M.edificio, 0, 1.15, 0), caja(2.1, .14, 3.1, rolM(e), 0, 2.37, 0), caja(.1, 1.2, 1, M.borde, -1.02, .7, 0));
          o = { grupo: g, alto: 2.8, stock: piezas(g, 8, i => [-.5 + (i % 4) * .34, 2.44, -.6 + Math.floor(i / 4) * 1.1]) };
        } else if (e.clase === "torreta") {
          const g = new THREE.Group(); g.add(caja(1.3, .4, 1.3, M.edificio, 0, .2, 0), caja(1.1, .06, 1.1, rolM(e), 0, .43, 0));
          const torre = new THREE.Group(); torre.position.y = .5; const pod = caja(.95, .42, .7, M.borde, .12, .28, 0); pod.rotation.z = .5; torre.add(pod, caja(.06, .34, .58, rolM(e), .58, .52, 0)); torre.children[1].rotation.z = .5; g.add(torre);
          o = { grupo: g, alto: 1.4, torre, base: MURO.alto, carga: piezas(g, 4, i => [-.4 + i * .27, .46, -.5]) };
        } else if (e.clase === "control") {
          const g = new THREE.Group(); g.add(caja(1.3, .3, 1.3, M.edificio, 0, .15, 0), caja(.9, 2.8, .9, M.techo, 0, 1.7, 0), caja(.94, .16, .94, rolM(e), 0, 2.6, 0), cil(.03, .03, 1.1, M.metal, 0, 3.65, 0));
          const plato = cil(.45, .1, .16, M.borde, .25, 3.3, 0, 12); plato.rotation.z = -.9; g.add(plato);
          o = { grupo: g, alto: 4.2, plato, luz: mesh(new THREE.SphereGeometry(.1, 8, 6), M["luz-off"]) }; o.luz.position.set(0, 4.25, 0); g.add(o.luz);
        }
        if (!o) continue;
        o.grupo.userData.id = e.id;
        // Las estaciones miran al pasillo: su frente (+z) apunta hacia su punto de trabajo.
        if (C.esMaquina(e) || e.clase === "arsenal") o.mira = true;
        (C.esRobot(e) ? movil : fijo).add(o.grupo); objetos.set(e.id, o);
      }
      // Dianas de la salva de prueba, en el campo de batalla.
      dianas = new THREE.Group();
      for (const d of mapa.dianas) { const a = mesh(new THREE.RingGeometry(.9, 1.15, 28), M.diana), b = mesh(new THREE.RingGeometry(.25, .45, 20), M.diana); for (const r of [a, b]) { r.rotation.x = -Math.PI / 2; r.position.set(d.x, T.altura(d.x, d.y) + .12, d.y); r.raycast = () => {}; dianas.add(r); } }
      fijo.add(dianas);
      camion = new THREE.Group(); camion.add(caja(3.2, 1.5, 1.7, M.techo, -.9, 1.2, 0), caja(1.2, 1.2, 1.6, rolM({ clase: "bahia" }), 1.5, 1, 0));
      for (const [x, z] of [[1.4, .8], [-1.6, .8], [1.4, -.8], [-1.6, -.8], [-.3, .8], [-.3, -.8]]) { const r = cil(.34, .34, .22, M.goma, x, .34, z); r.rotation.x = Math.PI / 2; camion.add(r); }
      camion.visible = false; camion.traverse(x => { x.raycast = () => {}; }); movil.add(camion);
      aplicarColores();
    }

    function posMisil(mi, t) {
      const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
      return [mi.x0 + (mi.x1 - mi.x0) * u, mi.z0 + (mi.z1 - mi.z0) * u + mi.arco * 4 * u * (1 - u), mi.y0 + (mi.y1 - mi.y0) * u];
    }
    const giro = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    function actualizar(off, ahora) {
      const m = estado.mundo; if (!m) return;
      const t = m.t + off, activo = m.activo;
      for (const e of m.maquinas) {
        const o = objetos.get(e.id); if (!o) continue;
        const g = o.grupo;
        if (C.esRobot(e)) {
          g.position.set(e.cx, 0, e.cy);
          o.rumbo = giro(o.rumbo, e.tarea && e.tarea.fase === "op" ? Math.atan2((m.porId[e.tarea.lugar] || e).cy - e.cy, (m.porId[e.tarea.lugar] || e).cx - e.cx) : e.rumbo, .25);
          g.rotation.y = -o.rumbo;
          if (o.carga) pintarPiezas(o.carga, e.carga ? [e.carga] : []);
          if (o.horquilla) o.horquilla.position.y = giro(0, 0, 0) + (e.carga ? .55 : .14);
        } else if (C.esMaquina(e)) {
          const est = C.estadoMaquina(e), enc = e.encendida, pad = e.pad ? m.porId[e.pad] : e;
          g.position.set(e.cx, e.enVilo ? .62 : 0, e.cy);
          if (!e.enVilo) g.rotation.y = (pad.ay ?? e.cy + 1) < e.cy ? Math.PI : 0;
          for (const c of o.cuerpo) c.material = enc ? c.userData.mat : M.apagado;
          pintarPiezas(o.entrada, Object.entries(e.entrada).flatMap(([p, n]) => Array(n).fill(p)));
          pintarPiezas(o.salida, e.salida);
          const luz = !enc ? "off" : e.luz ? e.luz : est === "blocked" ? "red" : "off";
          o.luz.material = M[`luz-${luz}`] || M["luz-off"];
          const R = e.proceso ? C.RECETAS[e.proceso.receta] : null, u = R ? Math.min(1, e.proceso.prog / R.t) : e.cambio ? 1 - e.cambio.falta / e.cambio.total : 0;
          o.barra.visible = u > 0; o.barra.scale.x = Math.max(.02, u * 1.8); o.barra.material = M.progreso;
          const anda = est === "working" && activo;
          if (o.ariete) o.ariete.position.y = anda ? 1.15 + .55 * Math.abs(Math.sin(ahora / 160)) : 1.7;
          if (o.cil) o.cil.forEach((x, i) => x.scale.setScalar(anda ? 1 + .1 * Math.sin(ahora / 180 + i * 2) : 1));
          if (o.pala) o.pala.rotation.y = anda ? ahora / 130 : o.pala.rotation.y;
          if (o.franja) { o.franja.material = M[`luz-${!enc ? "off" : est === "working" ? "green" : est === "changeover" ? "amber" : est === "blocked" ? "red" : "off"}`]; g.position.y += anda ? .015 * Math.sin(ahora / 30) : 0; }
        } else {
          const base = o.base || 0;
          g.position.set(e.cx, base, e.cy);
          if (o.mira) g.rotation.y = e.ax != null && e.ax < e.cx - .5 ? Math.PI / 2 : 0;
          if (e.clase === "banda") {
            g.position.y = 0;
            pintarPiezas(o.items, e.piezas.slice(0, 8).map(x => x.pieza));
            e.piezas.slice(0, 8).forEach((x, i) => { o.items[i].position.set(-o.L / 2 + x.s, .66 + .16, 0); o.items[i].rotation.z = Math.PI / 2; });
            const fase = e.marcha && activo ? (t * C.BANDA.vel) % 1 : 0;
            o.listones.forEach((s, k) => { s.position.x = -o.L / 2 + ((k + fase) % Math.max(1, o.listones.length)); });
          } else if (e.clase === "arsenal") pintarPiezas(o.stock, Array(Math.min(8, e.misiles)).fill("missile")), o.stock.forEach(x => { x.rotation.z = Math.PI / 2; });
          else if (e.clase === "torreta") { o.torre.rotation.y = -e.yaw; pintarPiezas(o.carga, Array(e.misiles).fill("missile")); o.carga.forEach(x => { x.rotation.z = Math.PI / 2; x.scale.setScalar(.6); }); }
          else if (e.clase === "control") { o.luz.material = M[`luz-${e.encendida ? (ahora % 1200 < 700 ? "green" : "off") : "off"}`]; o.plato.rotation.y = e.encendida ? ahora / 1500 : 0; for (const c of [g.children[1]]) c.material = e.encendida ? M.techo : M.apagado; }
        }
      }
      // Tarimas: en su lugar o sobre las horquillas del montacargas.
      const vivas = new Set();
      for (const ta of m.tarimas) {
        vivas.add(ta.id);
        const o = tarimas.get(ta.id) || tarimaObj(ta.id), en = m.porId[ta.en];
        if (!en) { o.grupo.visible = false; continue; }
        o.grupo.visible = true; o.grupo.userData.id = en.id;
        if (C.esRobot(en)) { const ro = objetos.get(en.id), a = ro ? ro.rumbo : 0; o.grupo.position.set(en.cx + Math.cos(a) * 1.15, .58, en.cy + Math.sin(a) * 1.15); o.grupo.rotation.y = -a; }
        else { o.grupo.position.set(en.cx, .04, en.cy); o.grupo.rotation.y = 0; }
        const firma = ta.piezas.join(",");
        if (firma !== o.firma) { o.firma = firma; pintarPiezas(o.piezas, ta.piezas); }
      }
      for (const [id, o] of tarimas) if (!vivas.has(id)) { movil.remove(o.grupo); tarimas.delete(id); }
      // Camión de los proveedores: entra por la carretera cuando falta poco para la entrega.
      const ped = m.bahia.pedidos[0];
      if (camion) {
        const falta = ped ? ped.llega - t : -1, ver = ped && falta < 5;
        camion.visible = !!ver;
        if (ver) { const u = Math.max(0, Math.min(1, 1 - falta / 5)), x = 38 + (67.2 - 38) * u, y = 53.3 + (51.5 - 53.3) * u; camion.position.set(x, T.altura(x, y) * .5, y); camion.rotation.y = -Math.atan2(51.5 - 53.3, 67.2 - 38); }
      }
      // Salva de prueba: misiles y explosiones, como en War.
      const enVuelo = new Set();
      for (const mi of m.misiles) {
        enVuelo.add(mi.id);
        let o = misiles.get(mi.id);
        if (!o) {
          const bola = mesh(new THREE.SphereGeometry(.2, 10, 8), M.misil), gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(30), 3));
          const estela = new THREE.Line(gg, M.estela); estela.frustumCulled = false; o = { bola, estela }; misiles.set(mi.id, o); movil.add(bola, estela);
        }
        o.bola.position.set(...posMisil(mi, t));
        const arr = o.estela.geometry.attributes.position.array;
        for (let k = 0; k < 10; k++) { const q = posMisil(mi, t - k * .04); arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; }
        o.estela.geometry.attributes.position.needsUpdate = true;
      }
      for (const [id, o] of misiles) if (!enVuelo.has(id)) { movil.remove(o.bola, o.estela); o.estela.geometry.dispose(); misiles.delete(id); }
      const vistos = new Set();
      for (const x of m.explosiones) {
        const k = `${x.t0}|${x.x}|${x.y}`; vistos.add(k);
        let o = efectos.get(k);
        if (!o) { o = mesh(new THREE.SphereGeometry(1, 14, 10), M.explosion.clone()); efectos.set(k, o); movil.add(o); }
        const u = Math.min(1, (t - x.t0) / .4);
        o.position.set(x.x, x.z + .3, x.y); o.scale.setScalar(2.2 * (.25 + .75 * Math.min(1, u * 1.4))); o.material.opacity = .45 * (1 - Math.max(0, (t - x.t0 - .25) / .5));
      }
      for (const [k, o] of efectos) if (!vistos.has(k)) { movil.remove(o); o.material.dispose(); efectos.delete(k); }
      // Aros de selección: siguen a su unidad.
      for (const id of estado.seleccionadas) {
        const e = m.porId[id]; if (!e || !e.presente) continue;
        let a = aros.get(id);
        if (!a) { const r = radioDe(e); a = mesh(new THREE.RingGeometry(r - .07, r + .07, 64), M.sel); a.rotation.x = -Math.PI / 2; a.raycast = () => {}; movil.add(a); aros.set(id, a); }
        a.position.set(e.cx, (e.clase === "torreta" ? MURO.alto : 0) + .09, e.cy);
      }
      for (const [id, a] of aros) if (!estado.seleccionadas.has(id) || !m.porId[id] || !m.porId[id].presente) { movil.remove(a); a.geometry.dispose(); aros.delete(id); }
      if (dianas) dianas.visible = m.hito >= 5 || piel > .5;
    }
    function anillosDe() { /* los aros se pintan en actualizar, a partir de la selección */ }

    // ---------- Cámara (mismos gestos que el visor común) ----------
    const ZOOM = [5, 250];
    const camaras = {};
    let camActual = null, cam = null, cam0 = null, anchoCampo = 1, altoCampo = 1;
    function colocarCamara(c = cam) {
      const cp = Math.cos(c.pitch);
      camara.position.set(c.x + c.dist * cp * Math.sin(c.yaw), c.dist * Math.sin(c.pitch), c.z + c.dist * cp * Math.cos(c.yaw));
      camara.lookAt(c.x, 0, c.z); camara.updateMatrixWorld();
    }
    const claveCamara = () => innerHeight <= innerWidth ? "horizontal" : "vertical";
    function camaraInicial() {
      // De entrada, la fábrica inicial con la muralla a la derecha; en pantallas estrechas, más lejos.
      const l = mapa.losa;
      return { yaw: 0, pitch: .88, dist: camara.aspect < 1.25 ? 36 * 1.5 / Math.max(.45, camara.aspect) : 40, x: (l.x0 + l.x1) / 2 + 1, z: (l.y0 + l.y1) / 2 + .5 };
    }
    function elegirCamara() {
      const k = claveCamara(), c = camaras[k] || (camaras[k] = { k, cam: null, movida: false });
      c.cam0 = camaraInicial();
      if (!c.cam) c.cam = { ...c.cam0 }; else if (!c.movida) Object.assign(c.cam, c.cam0);
      camActual = c; cam = c.cam; cam0 = c.cam0;
    }
    const moverCamara = () => { if (camActual) camActual.movida = true; };
    function tamano(w, h) { anchoCampo = w; altoCampo = h; renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); elegirCamara(); }
    let ultimo = 0;
    function render() {
      if (!cam) elegirCamara();
      const ahora = performance.now(), dt = Math.min(.1, (ahora - ultimo) / 1000); ultimo = ahora;
      if (piel !== pielDestino) { piel = pielDestino > piel ? Math.min(pielDestino, piel + dt * 2.2) : Math.max(pielDestino, piel - dt * 2.2); aplicarPiel(); }
      colocarCamara();
      renderer.render(escena, camara);
    }
    const v = new THREE.Vector3();
    function proyectar(x, alto, y, w, h) { v.set(x, alto, y).project(camara); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 && v.z > -1 }; }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function elegir(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1); ray.setFromCamera(ndc, camara);
      for (const hit of ray.intersectObjects([...fijo.children, ...movil.children], true)) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) return o.userData.id; }
      return null;
    }
    function suelo(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1); ray.setFromCamera(ndc, camara);
      const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      return p ? { x: p.x, y: p.z, z: 0 } : null;
    }
    function centrar(x, y) { cam.x = x + Math.sin(cam.yaw); cam.z = y + Math.cos(cam.yaw); cam.dist = Math.min(cam.dist, 16); moverCamara(); }
    function recentrar() { Object.assign(cam, cam0); camActual.movida = false; }
    // Vista general del campo de batalla, con la muralla a la izquierda.
    function verCampo() { Object.assign(cam, { yaw: 0, pitch: .95, dist: camara.aspect < 1.25 ? 150 : 105, x: 138, z: 58 }); moverCamara(); }
    const canvas = $("c3d"), punteros = new Map();
    let gesto = null;
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
    canvas.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "touch" && ev.button !== 1 && ev.button !== 2) return;
      canvas.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      gesto = { desplazar: ev.button === 2, tactil: ev.pointerType === "touch", dist0: null, ang0: null, giro: 0, girando: false };
    });
    canvas.addEventListener("pointermove", (ev) => {
      const p = punteros.get(ev.pointerId); if (!p || !gesto) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      if (dx || dy) moverCamara();
      if (punteros.size >= 2) {
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (gesto.dist0) cam.dist = Math.min(ZOOM[1], Math.max(ZOOM[0], cam.dist * gesto.dist0 / d));
        gesto.dist0 = d; desplazar(dx / 2, dy / 2);
        if (gesto.ang0 != null) {
          const da = Math.atan2(Math.sin(ang - gesto.ang0), Math.cos(ang - gesto.ang0)); gesto.giro += da;
          if (gesto.girando || Math.abs(gesto.giro) > .12) { const r = canvas.getBoundingClientRect(); girar(gesto.girando ? da : gesto.giro, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, r.width, r.height); gesto.girando = true; }
        }
        gesto.ang0 = ang;
      } else if (gesto.tactil && estado.arrastreCampo && estado.arrastreCampo.cajaTactil) return;
      else if (gesto.desplazar || gesto.tactil) desplazar(dx, dy);
      else { cam.yaw -= dx * .006; cam.pitch = Math.min(1.5, Math.max(.3, cam.pitch + dy * .005)); }
    });
    const soltar = (ev) => { punteros.delete(ev.pointerId); if (gesto && punteros.size === 0) gesto = null; else if (gesto) { gesto.dist0 = null; gesto.ang0 = null; } };
    canvas.addEventListener("pointerup", soltar);
    canvas.addEventListener("pointercancel", (ev) => { punteros.delete(ev.pointerId); gesto = null; });
    canvas.addEventListener("wheel", (ev) => { ev.preventDefault(); moverCamara(); cam.dist = Math.min(ZOOM[1], Math.max(ZOOM[0], cam.dist * Math.exp(ev.deltaY * .0012))); }, { passive: false });
    const limitar = () => { cam.x = Math.min(T.cols + 6, Math.max(-6, cam.x)); cam.z = Math.min(T.rows + 6, Math.max(-6, cam.z)); };
    function desplazar(dx, dy) {
      const k = cam.dist * .0022, sx = Math.cos(cam.yaw), sz = -Math.sin(cam.yaw);
      cam.x -= (dx * sx + dy * Math.sin(cam.yaw)) * k; cam.z -= (dx * sz + dy * Math.cos(cam.yaw)) * k; limitar();
    }
    function girar(da, px, py, w, h) {
      colocarCamara(); const antes = suelo(px, py, w, h);
      cam.yaw = Math.atan2(Math.sin(cam.yaw + da), Math.cos(cam.yaw + da));
      colocarCamara(); const despues = suelo(px, py, w, h);
      if (antes && despues) { cam.x += antes.x - despues.x; cam.z += antes.y - despues.y; limitar(); }
    }
    return { construir, actualizar, render, tamano, proyectar, elegir, suelo, centrar, recentrar, anillosDe, aplicarColores, girar, retrato: () => null, batalla, verCampo,
      camara: () => ({ clave: camActual && camActual.k, ...cam, piel }), terreno: T };
  }
  window.CAMPAIGN_3D = { crear };
})();
