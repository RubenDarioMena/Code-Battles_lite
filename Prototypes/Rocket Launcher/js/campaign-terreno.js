/* Campaign · relieve del mapa. Determinista (sin Math.random): sale del boceto guardado en campaign-nivel.js.
 * Lo usan la vista 3D y el plano; no toca las reglas. Alturas en metros; x hacia el este, y hacia el sur. */
(() => {
  "use strict";
  function crear(mapa) {
    const { cols, rows, losa, muralla, camino, montes, rio, carriles } = mapa;
    const hash = (i, j, s = 0) => { const n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
    function ruido(x, y, paso, s = 0) {
      const i = Math.floor(x / paso), j = Math.floor(y / paso), u = x / paso - i, v = y / paso - j;
      const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
      return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
    }
    const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // Distancia a una polilínea y de qué lado queda el punto (signo del producto cruzado con el tramo más cercano).
    function aLinea(pts, x, y) {
      let mejor = Infinity, lado = 0, u = 0, largo = 0, uMejor = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (L * L))), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
        if (d < mejor) { mejor = d; lado = dx * (y - ay) - dy * (x - ax); uMejor = largo + t * L; }
        largo += L;
      }
      u = uMejor / largo;
      return { d: mejor, lado, u };
    }
    const enLosa = (x, y, m = 0) => x >= losa.x0 - m && x <= losa.x1 + m && y >= losa.y0 - m && y <= losa.y1 + m;
    // Dentro de la muralla (lado de la fábrica): al oeste del tramo recto y al norte de la curva.
    const dentro = (x, y) => aLinea(muralla, x, y).lado > 0;
    function monte(x, y) {
      let h = 0, nieve = 0;
      for (const m of montes) {
        const d = Math.hypot((x - m.x) / m.rx, (y - m.y) / m.ry), t = 1 - d;
        if (t <= 0) continue;
        const cresta = .68 + .5 * ruido(x, y, 9, m.semilla) + .22 * ruido(x, y, 3.5, m.semilla + 1);
        const a = m.alto * Math.pow(suave(0, 1, t), 1.25) * cresta;
        if (a > h) { h = a; nieve = a / m.alto; }
      }
      return { h, nieve };
    }
    function altura(x, y) {
      const m = monte(x, y);
      const bat = !dentro(x, y);
      // Llanura: la fábrica es casi plana; el campo de batalla ondula un poco más.
      let h = (bat ? .9 : .5) * ruido(x, y, 14, 5) + (bat ? .35 : .2) * ruido(x, y, 5, 6);
      h += m.h;
      const dm = aLinea(muralla, x, y).d;
      h *= .25 + .75 * suave(1.5, 7, dm);                                   // la muralla pisa suelo llano
      for (const c of carriles) { const d = aLinea(c, x, y).d; h *= .35 + .65 * suave(2.5, 7, d); }
      const dc = aLinea(camino, x, y).d;
      if (!bat) h *= .15 + .85 * suave(1.6, 5, dc);
      if (enLosa(x, y, 6)) { const b = Math.min(x - (losa.x0 - 6), (losa.x1 + 6) - x, y - (losa.y0 - 6), (losa.y1 + 6) - y); h *= 1 - suave(0, 5, b); }
      const r = aLinea(rio, x, y), ancho = 1.6 + 2.4 * r.u;
      if (r.d < ancho + 3) h = h * suave(ancho, ancho + 3, r.d) - 1.1 * (1 - suave(ancho * .5, ancho + .6, r.d));
      return h;
    }
    const rgb = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
    const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const C = { pasto: rgb(0x5f9440), pasto2: rgb(0x4a7d34), seco: rgb(0xb09650), seco2: rgb(0x97803f), tierra: rgb(0x86694a), carril: rgb(0x8c744c),
      roca: rgb(0x7d6f5f), roca2: rgb(0x655c51), nieve: rgb(0xe6ecef), agua: rgb(0x3493c4), orilla: rgb(0xa9a279), corte: rgb(0x6d543d), corte2: rgb(0x5d4633) };
    // Color del paisaje en un punto, a partir de su zona y su pendiente.
    function color(x, y, h = altura(x, y), pendiente = 0) {
      const r = aLinea(rio, x, y), ancho = 1.6 + 2.4 * r.u;
      if (r.d < ancho && h < -.25) return C.agua;
      const m = monte(x, y), bat = !dentro(x, y), v = ruido(x, y, 6, 9);
      let c = bat ? mezcla(C.seco, C.seco2, v) : mezcla(C.pasto, C.pasto2, v);
      if (r.d < ancho + 1.8) c = mezcla(C.orilla, c, suave(ancho, ancho + 1.8, r.d));
      if (!bat) { const dc = aLinea(camino, x, y).d; if (dc < 2.4) c = mezcla(C.tierra, c, suave(1.3, 2.4, dc)); }
      else for (const k of carriles) { const d = aLinea(k, x, y).d; if (d < 5.5) c = mezcla(C.carril, c, suave(2.5, 5.5, d)); }
      if (m.h > 1.5) {
        const roca = mezcla(C.roca, C.roca2, ruido(x, y, 4, 12));
        c = mezcla(c, roca, Math.min(1, suave(1.5, 6, m.h) * (.55 + pendiente * .9)));
        if (m.nieve > .5) c = mezcla(c, C.nieve, suave(.5, .68, m.nieve + (v - .5) * .12));
      }
      return c;
    }
    // Puntos de la muralla cada `paso` metros, con su rumbo.
    function tramosMuralla(paso = 2) {
      const out = [];
      for (let k = 0; k < muralla.length - 1; k++) {
        const [ax, ay] = muralla[k], [bx, by] = muralla[k + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / paso));
        for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; out.push({ x0: ax + (bx - ax) * t0, y0: ay + (by - ay) * t0, x1: ax + (bx - ax) * t1, y1: ay + (by - ay) * t1 }); }
      }
      return out;
    }
    // ¿Hay sitio para un árbol? Pasto llano, lejos de la losa, del camino, del río y de la muralla.
    function arboles() {
      const out = [];
      for (let i = 0; i < cols; i += 3) for (let j = 0; j < rows; j += 3) {
        const x = i + 3 * hash(i, j, 31), y = j + 3 * hash(i, j, 32), bat = !dentro(x, y);
        if (hash(i, j, 33) > (bat ? .1 : .5) || enLosa(x, y, 7)) continue;
        if (aLinea(camino, x, y).d < 4 || aLinea(rio, x, y).d < 5 || aLinea(muralla, x, y).d < 6) continue;
        if (bat && carriles.some(c => aLinea(c, x, y).d < 9)) continue;
        const h = altura(x, y), m = monte(x, y);
        if (h < 0 || m.h > 7) continue;
        out.push({ x, y, h, s: .8 + .9 * hash(i, j, 34) });
      }
      return out;
    }
    return { cols, rows, altura, color, dentro, monte, aLinea, tramosMuralla, arboles, ruido, hash, C, mezcla, rgb };
  }
  window.CAMPAIGN_TERRENO = { crear };
})();
