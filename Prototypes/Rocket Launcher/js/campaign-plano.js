/* Campaign · plano 2D del mapa, con zoom y desplazamiento propios (el mapa es mucho mayor que la pantalla).
 * Publica su geometría en estado.geo2 para que la selección y las etiquetas comunes sigan funcionando.
 * Solo dibujo: lee el mundo y nunca lo cambia. */
(() => {
  "use strict";
  const PIEZA = { steel: "#9fb2c0", polymer: "#e6d79a", nose: "#e2704c", base: "#5fa06a", charge: "#b884e0", motor: "#e0a04e", missile: "#eef2f4" };
  const LUZ = { green: "#4be38a", amber: "#ffc247", red: "#ff5a4f" };
  function crear(estado, { $c2d, ctx2: g, funcionDe, radioDe, rgba }) {
    const mapa = window.CAMPAIGN_NIVEL.MAPA, T = window.CAMPAIGN_TERRENO.crear(mapa), C = window.CAMPAIGN;
    const ESC = 2;  // píxeles por metro de la imagen del relieve
    let fondo = null, fondoBatalla = null, claveFondo = "";
    let vista = null, w = 1, h = 1, dpr = 1;   // vista: { T (px por metro), cx, cy (centro en metros) }
    function pintarFondo(batalla) {
      const cv = document.createElement("canvas"); cv.width = T.cols * ESC; cv.height = T.rows * ESC;
      const c = cv.getContext("2d"), img = c.createImageData(cv.width, cv.height), col = estado.col;
      const hex = (x) => { const n = parseInt(String(x || "#1F2B35").replace("#", ""), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
      const suelo = hex(col.suelo), alto = hex(col.edge), nieve = hex(col.ink), acento = hex(col.accent);
      for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) {
        const x = (i + .5) / ESC, y = (j + .5) / ESC, a = T.altura(x, y);
        let k;
        if (!batalla) { const s = .82 + .18 * Math.min(1, Math.max(0, (T.altura(x - 1, y - 1) - a) * .25 + .7)); k = T.color(x, y, a, Math.min(1, a / 30)).map(v => v * s); }
        else { k = T.mezcla(suelo, alto, Math.min(1, Math.max(0, a) / 16) * .85); if (T.monte(x, y).nieve > .62) k = T.mezcla(k, nieve, .45); if (a < -.3) k = T.mezcla(suelo, acento, .2); }
        const p = (j * cv.width + i) * 4; img.data[p] = k[0] * 255; img.data[p + 1] = k[1] * 255; img.data[p + 2] = k[2] * 255; img.data[p + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      return cv;
    }
    function inicial() { const l = mapa.losa; return { T: Math.min(w / (l.x1 - l.x0 + 8), h / (l.y1 - l.y0 + 10)), cx: (l.x0 + l.x1) / 2, cy: (l.y0 + l.y1) / 2 }; }
    const limitar = () => { const min = Math.min(w / T.cols, h / T.rows) * .9; vista.T = Math.min(60, Math.max(min, vista.T)); vista.cx = Math.min(T.cols, Math.max(0, vista.cx)); vista.cy = Math.min(T.rows, Math.max(0, vista.cy)); };
    // Gestos: rueda o pellizco acercan; botón derecho, central o un dedo desplazan. El izquierdo selecciona (campo común).
    const punteros = new Map(); let dist0 = null;
    $c2d.addEventListener("contextmenu", ev => ev.preventDefault());
    $c2d.addEventListener("wheel", ev => {
      if (!vista) return; ev.preventDefault();
      const r = $c2d.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, antes = aMundo(mx, my);
      vista.T *= Math.exp(-ev.deltaY * .0012); limitar();
      const des = aMundo(mx, my); vista.cx += antes.x - des.x; vista.cy += antes.y - des.y; limitar();
    }, { passive: false });
    $c2d.addEventListener("pointerdown", ev => { if (ev.pointerType !== "touch" && ev.button !== 1 && ev.button !== 2) return; $c2d.setPointerCapture(ev.pointerId); punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); });
    $c2d.addEventListener("pointermove", ev => {
      const p = punteros.get(ev.pointerId); if (!p || !vista) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      if (punteros.size >= 2) { const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (dist0) vista.T *= d / dist0; dist0 = d; }
      else if (ev.pointerType === "touch" && estado.arrastreCampo && estado.arrastreCampo.cajaTactil) return;
      vista.cx -= dx / vista.T / (punteros.size >= 2 ? 2 : 1); vista.cy -= dy / vista.T / (punteros.size >= 2 ? 2 : 1); limitar();
    });
    for (const k of ["pointerup", "pointercancel"]) $c2d.addEventListener(k, ev => { punteros.delete(ev.pointerId); dist0 = null; });
    const aMundo = (px, py) => ({ x: vista.cx + (px - w / 2) / vista.T, y: vista.cy + (py - h / 2) / vista.T });

    function dibujar() {
      const m = estado.mundo; if (!m) return;
      const r = $c2d.getBoundingClientRect(); if (!r.width || !r.height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if ($c2d.width !== Math.round(r.width * dpr) || $c2d.height !== Math.round(r.height * dpr)) { $c2d.width = Math.round(r.width * dpr); $c2d.height = Math.round(r.height * dpr); }
      w = r.width; h = r.height;
      if (!vista) vista = inicial();
      const col = estado.col, clave = `${col.suelo}|${col.edge}|${col.ink}`;
      if (!fondo) fondo = pintarFondo(false);
      if (!fondoBatalla || clave !== claveFondo) { fondoBatalla = pintarFondo(true); claveFondo = clave; }
      const batalla = !!(window.__banco && document.getElementById("b-piel") && document.getElementById("b-piel").getAttribute("aria-pressed") === "true");
      const S = vista.T, ox = w / 2 - vista.cx * S, oy = h / 2 - vista.cy * S;
      estado.geo2 = { T: S, ox, oy };
      const X = x => ox + x * S, Y = y => oy + y * S;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = col.bg || "#0B0F13"; g.fillRect(0, 0, w, h);
      g.imageSmoothingEnabled = S < ESC * 3;
      g.drawImage(batalla ? fondoBatalla : fondo, ox, oy, T.cols * S, T.rows * S);
      // Cuadrícula: en batalla, o de cerca.
      if (batalla || S > 9) {
        const paso = S > 9 ? 1 : S > 4 ? 2 : 10, x0 = Math.max(0, Math.floor(-ox / S / paso) * paso), x1 = Math.min(T.cols, (w - ox) / S), y0 = Math.max(0, Math.floor(-oy / S / paso) * paso), y1 = Math.min(T.rows, (h - oy) / S);
        g.lineWidth = 1; g.strokeStyle = rgba(batalla ? col.grid : "#000000", batalla ? .9 : .13); g.beginPath();
        for (let x = x0; x <= x1; x += paso) { g.moveTo(X(x), Y(Math.max(0, y0))); g.lineTo(X(x), Y(y1)); }
        for (let y = y0; y <= y1; y += paso) { g.moveTo(X(Math.max(0, x0)), Y(y)); g.lineTo(X(x1), Y(y)); }
        g.stroke();
      }
      // Losa y pasillo.
      const l = mapa.losa, p = mapa.pasillo;
      g.fillStyle = batalla ? rgba(col.suelo, .9) : "rgba(107,118,125,.95)"; g.fillRect(X(l.x0), Y(l.y0), (l.x1 - l.x0) * S, (l.y1 - l.y0) * S);
      g.strokeStyle = rgba(col.accent, .5); g.lineWidth = 1; g.setLineDash([6, 5]); g.strokeRect(X(p.x0), Y(p.y0), (p.x1 - p.x0) * S, (p.y1 - p.y0) * S); g.setLineDash([]);
      // Muralla.
      g.strokeStyle = batalla ? col.edge : "#6e706c"; g.lineWidth = Math.max(2, 1.5 * S); g.lineJoin = "round"; g.beginPath();
      mapa.muralla.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.stroke();
      if (m.hito >= 5 || batalla) { g.strokeStyle = rgba(col.bad, .8); g.lineWidth = 1.5; for (const d of mapa.dianas) { g.beginPath(); g.arc(X(d.x), Y(d.y), Math.max(3, S), 0, 7); g.stroke(); } }
      const rol = e => col[`rol-${funcionDe(e).principal}`] || col.edge;
      const cuadro = (x, y, a, b, relleno, borde) => { g.fillStyle = relleno; g.fillRect(X(x - a / 2), Y(y - b / 2), a * S, b * S); if (borde) { g.strokeStyle = borde; g.lineWidth = 1.2; g.strokeRect(X(x - a / 2), Y(y - b / 2), a * S, b * S); } };
      const tarima = (ta, x, y) => {
        cuadro(x, y, 1.25, 1.25, "#b08a55", "#7a5f3a");
        ta.piezas.forEach((pz, i) => { g.fillStyle = PIEZA[pz]; g.fillRect(X(x - .52 + (i % 4) * .27), Y(y - .42 + Math.floor(i / 4) * .3), .2 * S, .2 * S); });
      };
      for (const e of m.maquinas) {
        if (e.clase === "lugar" || e.clase === "bahia" || e.clase === "pad" || e.clase === "pila") {
          const a = e.clase === "pad" ? 2.6 : e.clase === "bahia" ? 2.6 : 1.7, b = e.clase === "bahia" ? 3.4 : a;
          g.setLineDash(e.clase === "pad" ? [4, 4] : []); cuadro(e.cx, e.cy, a, b, rgba(e.tipo === "sup" || e.clase === "bahia" ? col.accent : col.edge, .14), rgba(e.tipo === "sup" || e.clase === "bahia" ? col.accent : col.edge, .8)); g.setLineDash([]);
          if (e.clase === "pila") cuadro(e.cx, e.cy, 1.25, 1.25, "#b08a55", "#7a5f3a");
        } else if (e.clase === "banda") {
          g.strokeStyle = col.edge; g.lineWidth = .9 * S; g.beginPath(); g.moveTo(X(e.x0), Y(e.y0)); g.lineTo(X(e.x1), Y(e.y1)); g.stroke();
          g.strokeStyle = e.marcha ? rol(e) : rgba(col.ink, .3); g.lineWidth = 1.5; g.setLineDash([S * .4, S * .4]); g.lineDashOffset = e.marcha && m.activo ? -(m.t * C.BANDA.vel * S) : 0; g.beginPath(); g.moveTo(X(e.x0), Y(e.y0)); g.lineTo(X(e.x1), Y(e.y1)); g.stroke(); g.setLineDash([]);
          const ux = (e.x1 - e.x0) / e.largo, uy = (e.y1 - e.y0) / e.largo;
          for (const x of e.piezas) { g.fillStyle = PIEZA[x.pieza]; g.beginPath(); g.arc(X(e.x0 + ux * x.s), Y(e.y0 + uy * x.s), .28 * S, 0, 7); g.fill(); }
        } else if (C.esMaquina(e)) {
          const lado = e.clase === "ensambladora" ? 3 : 2.2, est = C.estadoMaquina(e);
          cuadro(e.cx, e.cy, lado, lado, e.encendida ? col.building : "#1b242b", e.encendida ? rol(e) : rgba(col.edge, .6));
          if (e.proceso) { const R = C.RECETAS[e.proceso.receta]; g.fillStyle = col.ink; g.fillRect(X(e.cx - lado / 2 + .15), Y(e.cy + lado / 2 - .4), (lado - .3) * S * Math.min(1, e.proceso.prog / R.t), .22 * S); }
          const luz = !e.encendida ? null : e.luz && e.luz !== "off" ? LUZ[e.luz] : est === "blocked" ? LUZ.red : null;
          if (luz) { g.fillStyle = luz; g.beginPath(); g.arc(X(e.cx), Y(e.cy - lado / 2 + .45), .26 * S, 0, 7); g.fill(); }
          e.salida.forEach((pz, i) => { g.fillStyle = PIEZA[pz]; g.fillRect(X(e.cx + lado / 2 - .4 - i * .34), Y(e.cy - .15), .28 * S, .28 * S); });
        } else if (e.clase === "arsenal" || e.clase === "control" || e.clase === "torreta") {
          const a = e.clase === "arsenal" ? 2 : 1.1, b = e.clase === "arsenal" ? 3 : 1.1;
          cuadro(e.cx, e.cy, a, b, col.building, rol(e));
          if (e.clase === "torreta") { g.strokeStyle = rol(e); g.lineWidth = 2; g.beginPath(); g.moveTo(X(e.cx), Y(e.cy)); g.lineTo(X(e.cx + Math.cos(e.yaw) * .9), Y(e.cy + Math.sin(e.yaw) * .9)); g.stroke(); }
        }
      }
      for (const ta of m.tarimas) { const en = m.porId[ta.en]; if (!en) continue; if (C.esRobot(en)) tarima(ta, en.cx + Math.cos(en.rumbo) * 1.1, en.cy + Math.sin(en.rumbo) * 1.1); else tarima(ta, en.cx, en.cy); }
      for (const e of m.robots) {
        const rr = e.clase === "obrero" ? .5 : .75;
        g.fillStyle = rol(e); g.strokeStyle = col.bg; g.lineWidth = 1.5; g.beginPath(); g.arc(X(e.cx), Y(e.cy), rr * S, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = col.ink; g.beginPath(); g.moveTo(X(e.cx), Y(e.cy)); g.lineTo(X(e.cx + Math.cos(e.rumbo) * rr), Y(e.cy + Math.sin(e.rumbo) * rr)); g.stroke();
        if (e.clase === "obrero" && e.carga) { g.fillStyle = PIEZA[e.carga]; g.fillRect(X(e.cx - .16), Y(e.cy - .16), .32 * S, .32 * S); }
        if (e.tarea && e.tarea.fase === "ir") { g.strokeStyle = rgba(col.ink, .35); g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(e.cx), Y(e.cy)); g.lineTo(X(e.tarea.x), Y(e.tarea.y)); g.stroke(); g.setLineDash([]); }
      }
      const tt = m.t;
      for (const mi of m.misiles) { const u = Math.min(1, Math.max(0, (tt - mi.t0) / mi.dur)); g.fillStyle = col.misil; g.beginPath(); g.arc(X(mi.x0 + (mi.x1 - mi.x0) * u), Y(mi.y0 + (mi.y1 - mi.y0) * u), Math.max(2, .25 * S), 0, 7); g.fill(); }
      for (const x of m.explosiones) { g.fillStyle = rgba(col.explosion, .45 * (1 - Math.min(1, (tt - x.t0) / .8))); g.beginPath(); g.arc(X(x.x), Y(x.y), 2 * S, 0, 7); g.fill(); }
      for (const id of estado.seleccionadas) { const e = m.porId[id]; if (!e || !e.presente) continue; g.strokeStyle = col.sel; g.lineWidth = 2; g.beginPath(); g.arc(X(e.cx), Y(e.cy), radioDe(e) * S, 0, 7); g.stroke(); }
    }
    dibujar.recentrar = () => { vista = null; };
    return dibujar;
  }
  window.CAMPAIGN_PLANO = { crear };
})();
