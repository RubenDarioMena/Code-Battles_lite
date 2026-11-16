/* Laboratorio de batalla · plano del campo (canvas 2D) y gestos: tocar, arrastrar y ampliar.
 * Solo dibuja y traduce gestos; las reglas viven en mundo.js. */
(() => {
  "use strict";
  const { COLS, ROWS, MURO_X, TIPOS, CLASES, MISIL, MARCA } = window.LAB_MUNDO;
  const TAU = Math.PI * 2;

  function crear({ lienzo, estado, alToque }) {
    const ctx = lienzo.getContext("2d");
    const cam = { z: 1, x: COLS / 2, y: ROWS / 2 };
    let w = 0, h = 0, dpr = 1, T = 10, C = {};
    const css = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim();
    function leerColores() {
      C = {};
      for (const k of ["bg", "suelo", "grid", "grid-2", "building", "building-top", "edge", "enemigo", "enemigo-frio", "misil", "explosion", "s-visual", "s-vibra", "base",
        "rol-ofensiva", "rol-rastreo", "rol-utilitaria", "sel", "accent", "ok", "warn", "bad", "ink", "muted", "metal-hi", "metal", "metal-lo", "metal-negro", "laton"]) C[k] = css(k);
    }
    const rgb = (hex) => { const n = parseInt(String(hex).replace("#", ""), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const rgba = (hex, a) => /^#/.test(hex) ? `rgba(${rgb(hex).join(",")},${a})` : hex;

    // ---------- Cámara ----------
    function ajustar() {
      const r = lienzo.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) { lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr); }
      acotar();
    }
    function acotar() {
      const T0 = Math.min(w / COLS, h / ROWS);
      cam.z = Math.min(5, Math.max(1, cam.z)); T = T0 * cam.z;
      const mx = w / T / 2, my = h / T / 2;
      cam.x = mx >= COLS / 2 ? COLS / 2 : Math.min(COLS - mx, Math.max(mx, cam.x));
      cam.y = my >= ROWS / 2 ? ROWS / 2 : Math.min(ROWS - my, Math.max(my, cam.y));
    }
    const X = (x) => w / 2 + (x - cam.x) * T, Y = (y) => h / 2 + (y - cam.y) * T;
    const aMundo = (px, py) => ({ x: cam.x + (px - w / 2) / T, y: cam.y + (py - h / 2) / T });
    function zoom(factor, px = w / 2, py = h / 2) {
      const antes = aMundo(px, py);
      cam.z *= factor; acotar();
      const despues = aMundo(px, py);
      cam.x += antes.x - despues.x; cam.y += antes.y - despues.y; acotar();
    }

    // ---------- Gestos ----------
    const dedos = new Map(); let arrastre = null, pellizco = 0;
    const local = (ev) => { const r = lienzo.getBoundingClientRect(); return { px: ev.clientX - r.left, py: ev.clientY - r.top }; };
    lienzo.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      lienzo.setPointerCapture(ev.pointerId);
      const p = local(ev); dedos.set(ev.pointerId, p);
      if (dedos.size === 1) arrastre = { ...p, x0: p.px, y0: p.py, movido: false, t0: performance.now() };
      else { arrastre = null; const [a, b] = [...dedos.values()]; pellizco = Math.hypot(a.px - b.px, a.py - b.py); }
    });
    lienzo.addEventListener("pointermove", (ev) => {
      if (!dedos.has(ev.pointerId)) return;
      const p = local(ev); dedos.set(ev.pointerId, p);
      if (dedos.size >= 2) {
        const [a, b] = [...dedos.values()], d = Math.hypot(a.px - b.px, a.py - b.py);
        if (pellizco > 0 && d > 0) zoom(d / pellizco, (a.px + b.px) / 2, (a.py + b.py) / 2);
        pellizco = d; return;
      }
      if (!arrastre) return;
      if (!arrastre.movido && Math.hypot(p.px - arrastre.x0, p.py - arrastre.y0) > 8) arrastre.movido = true;
      if (arrastre.movido) { cam.x -= (p.px - arrastre.px) / T; cam.y -= (p.py - arrastre.py) / T; acotar(); }
      arrastre.px = p.px; arrastre.py = p.py;
    });
    function soltar(ev) {
      if (!dedos.has(ev.pointerId)) return;
      const p = local(ev); dedos.delete(ev.pointerId);
      if (arrastre && !arrastre.movido && dedos.size === 0 && ev.type === "pointerup") alToque({ ...aMundo(p.px, p.py), radio: Math.max(1.1, 20 / T) });
      if (dedos.size === 0) { arrastre = null; pellizco = 0; }
    }
    lienzo.addEventListener("pointerup", soltar);
    lienzo.addEventListener("pointercancel", soltar);
    lienzo.addEventListener("wheel", (ev) => { ev.preventDefault(); const p = local(ev); zoom(ev.deltaY < 0 ? 1.15 : 1 / 1.15, p.px, p.py); }, { passive: false });

    // ---------- Formas ----------
    function circulo(x, y, r) { ctx.beginPath(); ctx.arc(X(x), Y(y), r * T, 0, TAU); }
    function poligono(x, y, r, n, giro = 0) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = giro + i * TAU / n; ctx[i ? "lineTo" : "moveTo"](X(x) + Math.cos(a) * r * T, Y(y) + Math.sin(a) * r * T); }
      ctx.closePath();
    }
    function girado(x, y, a, pintar) { ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(a); ctx.scale(T, T); pintar(); ctx.restore(); }
    function redondo(x, y, ancho, alto, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, ancho, alto, r) : ctx.rect(x, y, ancho, alto); }
    function pips(x, y, n, total, color) {
      if (total < 2 || T < 9) return;
      const s = Math.max(2.5, T * .16), ancho = total * (s + 1.5) - 1.5;
      for (let i = 0; i < total; i++) { ctx.fillStyle = i < n ? color : rgba(C["metal-negro"], .7); ctx.fillRect(X(x) - ancho / 2 + i * (s + 1.5), Y(y), s, s * .7); }
    }
    function etiqueta(texto, x, y, color, fondo = true) {
      ctx.font = `700 ${Math.max(9, Math.min(12, T * .55))}px ${css("f-code") || "monospace"}`;
      const m = ctx.measureText(texto).width, px = X(x) - m / 2, py = Y(y);
      if (fondo) { ctx.fillStyle = rgba(C["metal-negro"], .72); ctx.fillRect(px - 3, py - 10, m + 6, 13); }
      ctx.fillStyle = color; ctx.fillText(texto, px, py);
    }

    function dibujarSuelo(mundo) {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = C.suelo; ctx.fillRect(X(0), Y(0), COLS * T, ROWS * T);
      ctx.fillStyle = C.base; ctx.fillRect(X(0), Y(0), MURO_X * T, ROWS * T);
      // Franja por donde entran los enemigos.
      const g = ctx.createLinearGradient(X(COLS - 3), 0, X(COLS), 0);
      g.addColorStop(0, rgba(C.enemigo, 0)); g.addColorStop(1, rgba(C.enemigo, .12));
      ctx.fillStyle = g; ctx.fillRect(X(COLS - 3), Y(0), 3 * T, ROWS * T);
      if (T >= 7) {
        ctx.lineWidth = 1; ctx.strokeStyle = C.grid; ctx.beginPath();
        for (let i = 0; i <= COLS; i++) { ctx.moveTo(Math.round(X(i)) + .5, Y(0)); ctx.lineTo(Math.round(X(i)) + .5, Y(ROWS)); }
        for (let j = 0; j <= ROWS; j++) { ctx.moveTo(X(0), Math.round(Y(j)) + .5); ctx.lineTo(X(COLS), Math.round(Y(j)) + .5); }
        ctx.stroke();
      }
      ctx.strokeStyle = C["grid-2"]; ctx.lineWidth = 1; ctx.strokeRect(X(0) + .5, Y(0) + .5, COLS * T - 1, ROWS * T - 1);
    }

    function dibujarMuro(mundo, ahora) {
      const salud = mundo.muro / mundo.muroMax;
      const hueco = (y) => mundo.puertas.some(p => y >= p - 1 && y < p + 1);
      for (let j = 0; j < ROWS; j++) {
        if (hueco(j)) continue;
        const golpe = mundo.golpesMuro.find(gm => Math.abs(gm.y - (j + .5)) < 1.6);
        const k = golpe ? Math.max(0, 1 - (mundo.t - golpe.t0) / 1.2) : 0;
        ctx.fillStyle = k > 0 ? `rgba(${rgb(C.bad).join(",")},${.35 + k * .5})` : j % 2 ? C.metal : C["building-top"];
        ctx.fillRect(X(MURO_X) + 1, Y(j) + 1, T - 2, T - 2);
        ctx.fillStyle = rgba(C["metal-negro"], .35); ctx.fillRect(X(MURO_X) + 1, Y(j) + T * .62, T - 2, T * .3);
      }
      // Puertas: dos postes y el paso abierto cuando hay un vehículo cerca.
      for (const p of mundo.puertas) {
        const cerca = mundo.unidades.some(u => u.viva && CLASES[u.clase].vel && Math.abs(u.cx - MURO_X - .5) < 2.2 && Math.abs(u.cy - p) < 1.6);
        ctx.fillStyle = rgba(C["metal-negro"], .55); ctx.fillRect(X(MURO_X), Y(p - 1), T, 2 * T);
        ctx.fillStyle = C.laton;
        ctx.fillRect(X(MURO_X) + T * .1, Y(p - 1) - 2, T * .8, 3); ctx.fillRect(X(MURO_X) + T * .1, Y(p + 1) - 1, T * .8, 3);
        if (!cerca) {
          ctx.strokeStyle = rgba(C["metal-hi"], .8); ctx.lineWidth = Math.max(1.5, T * .12); ctx.beginPath();
          ctx.moveTo(X(MURO_X + .5), Y(p - 1) + 2); ctx.lineTo(X(MURO_X + .5), Y(p + 1) - 2); ctx.stroke();
        }
      }
      // Integridad: una barra a lo largo del muro, del lado de la base.
      const alto = ROWS * T * salud;
      ctx.fillStyle = rgba(C["metal-negro"], .6); ctx.fillRect(X(MURO_X) - 4, Y(0), 3, ROWS * T);
      ctx.fillStyle = salud > .5 ? C.ok : salud > .25 ? C.warn : C.bad; ctx.fillRect(X(MURO_X) - 4, Y(ROWS) - alto, 3, alto);
    }

    function dibujarEnemigo(e, off, mundo, sim, ahora) {
      const tp = TIPOS[e.tipo], x = e.x + e.vx * off, y = e.y + e.vy * off;
      const golpe = mundo.t - e.golpeT < .25, color = golpe ? "#fff" : C.enemigo;
      if (!tp.suelo) { ctx.fillStyle = rgba(C["metal-negro"], .35); ctx.beginPath(); ctx.ellipse(X(x) + T * .25, Y(y) + T * .35, T * .35, T * .2, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = color; ctx.strokeStyle = C["metal-negro"]; ctx.lineWidth = 1.2;
      if (e.tipo === "crawler") {
        girado(x, y, 0, () => { redondo(-.5, -.36, 1, .72, .16); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(-.5, -.36, 1, .14); ctx.fillRect(-.5, .22, 1, .14); });
      } else if (e.tipo === "drone") {
        poligono(x, y, .46, 4, 0); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = rgba(color, .7); ctx.lineWidth = 1; circulo(x, y, .62); ctx.stroke();
      } else if (e.tipo === "gunner") {
        poligono(x, y, .5, 5, e.yaw); ctx.fill(); ctx.stroke();
        girado(x, y, e.yaw, () => { ctx.fillStyle = C["metal-negro"]; ctx.fillRect(.1, -.09, .75, .18); });
        if (e.blanco) { ctx.strokeStyle = rgba(C.enemigo, .28); ctx.lineWidth = 1; ctx.setLineDash([3, 4]); const u = mundo.porId[e.blanco]; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(u.cx), Y(u.cy)); ctx.stroke(); ctx.setLineDash([]); }
      } else if (e.tipo === "siege") {
        poligono(x, y, .92, 8, Math.PI / 8); ctx.fill(); ctx.stroke();
        if (e.apostado) { ctx.strokeStyle = rgba(color, .8); ctx.lineWidth = Math.max(1.5, T * .1); for (const a of [.8, 2.35, 3.95, 5.5]) { ctx.beginPath(); ctx.moveTo(X(x) + Math.cos(a) * T * .85, Y(y) + Math.sin(a) * T * .85); ctx.lineTo(X(x) + Math.cos(a) * T * 1.3, Y(y) + Math.sin(a) * T * 1.3); ctx.stroke(); } }
        girado(x, y, e.apostado ? e.yaw : Math.PI, () => { ctx.fillStyle = C["metal-negro"]; ctx.fillRect(0, -.14, 1.5, .28); ctx.beginPath(); ctx.arc(0, 0, .38, 0, TAU); ctx.fill(); });
      } else if (e.tipo === "roller") {
        ctx.lineWidth = Math.max(2, T * .16); ctx.strokeStyle = color; circulo(x, y, .42); ctx.stroke();
        girado(x, y, -(mundo.t + off) * 9, () => { ctx.strokeStyle = color; ctx.lineWidth = .1; ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * .4, Math.sin(a) * .4); } ctx.stroke(); });
        ctx.fillStyle = C.explosion; circulo(x, y, .14); ctx.fill();
      }
      pips(x, y - tp.z * .12 - (e.tipo === "siege" ? 1.25 : .82), e.hp, e.hpMax, C.enemigo);
      // Marca del jugador: corchetes que se cierran y un arco con el tiempo que queda.
      const queda = (mundo.marcas[e.id] || 0) - mundo.t;
      if (queda > 0) {
        const r = (e.tipo === "siege" ? 1.3 : .9) * T, cx = X(x), cy = Y(y);
        ctx.strokeStyle = C.sel; ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + ahora / 600; ctx.beginPath(); ctx.arc(cx, cy, r, a - .32, a + .32); ctx.stroke(); }
        ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * queda / MARCA); ctx.stroke();
      }
      if (T >= 15 || queda > 0) etiqueta(e.id, x, y + (e.tipo === "siege" ? 1.75 : 1.25), rgba(C.enemigo, .95), false);
    }

    function dibujarUnidad(u, off, mundo, sim, est, ahora) {
      const c = CLASES[u.clase], elegida = est.seleccion.has(u.id), abierta = est.abierta === u.id;
      const rol = u.clase === "radar" ? C["rol-rastreo"] : C["rol-ofensiva"];
      if (!u.viva) {
        // Destruida: su sitio en la base y, si se repone, cuánto falta.
        ctx.strokeStyle = rgba(rol, .45); ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; circulo(u.hx, u.hy, .45); ctx.stroke(); ctx.setLineDash([]);
        if (u.reponer) { ctx.strokeStyle = rol; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(u.hx), Y(u.hy), .45 * T, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - Math.max(0, u.tReponer) / u.reponer)); ctx.stroke(); }
        if (T >= 12) etiqueta(u.id, u.hx, u.hy + 1.15, rgba(rol, .55), false);
        return;
      }
      const x = u.cx + u.vx * off, y = u.cy + u.vy * off, golpe = mundo.t - u.golpeT < .3;
      // Alcances de las elegidas (o de todas con niebla): sensor en trazos, arma en línea.
      if ((elegida || abierta || (mundo.def.niebla && u.clase !== "radar")) && u.clase !== "radar") {
        ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(C["s-visual"], elegida || abierta ? .55 : .3); circulo(x, y, sim.sensorDe(u)); ctx.stroke(); ctx.setLineDash([]);
        if (c.alcance && (elegida || abierta)) { ctx.strokeStyle = rgba(C.misil, .4); circulo(x, y, c.alcance); ctx.stroke(); }
      }
      // Ruta y destino.
      if (u.moviendo && u.ruta.length) {
        ctx.strokeStyle = rgba(rol, .55); ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(x), Y(y));
        for (const p of u.ruta) ctx.lineTo(X(p.x), Y(p.y));
        ctx.stroke(); ctx.setLineDash([]);
        const d = u.ruta[u.ruta.length - 1]; ctx.strokeStyle = rol; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(X(d.x) - 4, Y(d.y) - 4); ctx.lineTo(X(d.x) + 4, Y(d.y) + 4); ctx.moveTo(X(d.x) + 4, Y(d.y) - 4); ctx.lineTo(X(d.x) - 4, Y(d.y) + 4); ctx.stroke();
      }
      if (elegida) { ctx.strokeStyle = C.sel; ctx.lineWidth = 2; circulo(x, y, u.clase === "vehiculo" ? 1.05 : .82); ctx.stroke(); }
      else { ctx.strokeStyle = rgba(rol, .35); ctx.lineWidth = Math.max(2, T * .18); circulo(x, y, u.clase === "vehiculo" ? .95 : .72); ctx.stroke(); }
      const cuerpo = golpe ? "#fff" : rol;
      ctx.strokeStyle = C["metal-negro"]; ctx.lineWidth = 1.2;
      if (u.clase === "torreta") {
        ctx.fillStyle = C["metal-lo"]; circulo(x, y, .62); ctx.fill(); ctx.stroke();
        ctx.fillStyle = cuerpo; circulo(x, y, .4); ctx.fill();
        girado(x, y, u.yaw, () => { ctx.fillStyle = cuerpo; ctx.fillRect(.15, -.12, .8, .24); ctx.fillStyle = C["metal-negro"]; ctx.fillRect(.8, -.12, .15, .24); });
      } else if (u.clase === "radar") {
        ctx.fillStyle = C["metal-lo"]; circulo(x, y, .55); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = cuerpo; ctx.lineWidth = Math.max(1.5, T * .1);
        girado(x, y, ahora / 700, () => { ctx.lineWidth = .1; ctx.beginPath(); ctx.arc(0, 0, .36, -.9, .9); ctx.moveTo(0, 0); ctx.lineTo(.36, 0); ctx.stroke(); });
        ctx.strokeStyle = rgba(cuerpo, .12 + .1 * Math.sin(ahora / 400)); ctx.lineWidth = 1; circulo(x, y, 1.2 + (ahora / 900 % 1) * 1.5); ctx.stroke();
      } else if (u.clase === "vehiculo") {
        girado(x, y, u.rumbo || 0, () => {
          ctx.fillStyle = C["metal-negro"]; for (const [a, b] of [[-.62, -.56], [.3, -.56], [-.62, .38], [.3, .38]]) ctx.fillRect(a, b, .34, .18);
          ctx.fillStyle = C["metal-lo"]; redondo(-.72, -.44, 1.44, .88, .18); ctx.fill();
          ctx.fillStyle = cuerpo; redondo(-.6, -.34, 1.2, .68, .12); ctx.fill();
          ctx.fillStyle = rgba(C["metal-negro"], .5); ctx.fillRect(.36, -.26, .16, .52);
        });
        girado(x, y, u.yaw, () => { ctx.fillStyle = C["metal-negro"]; ctx.beginPath(); ctx.arc(0, 0, .26, 0, TAU); ctx.fill(); ctx.fillRect(0, -.08, .78, .16); ctx.fillStyle = cuerpo; ctx.beginPath(); ctx.arc(0, 0, .14, 0, TAU); ctx.fill(); });
      } else if (u.clase === "rueda") {
        ctx.lineWidth = Math.max(2.5, T * .2); ctx.strokeStyle = cuerpo; circulo(x, y, .44); ctx.stroke();
        girado(x, y, u.giro * 2.2, () => { ctx.strokeStyle = cuerpo; ctx.lineWidth = .09; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * .42, Math.sin(a) * .42); } ctx.stroke(); });
        ctx.fillStyle = `rgba(${rgb(C.explosion).join(",")},${.65 + .35 * Math.sin(ahora / 140)})`; circulo(x, y, .17); ctx.fill();
      }
      if (c.hp > 1) pips(x, y - 1.08, u.hp, u.hpMax, C.ok);
      if (c.cargador && T >= 9 && u.clase === "vehiculo") {
        const ancho = T * 1.1; ctx.fillStyle = rgba(C["metal-negro"], .7); ctx.fillRect(X(x) - ancho / 2, Y(y - .86), ancho, 2.5);
        ctx.fillStyle = C.misil; ctx.fillRect(X(x) - ancho / 2, Y(y - .86), ancho * u.misiles / c.cargador, 2.5);
      }
      if (T >= 11 || elegida) etiqueta(u.id + (est.oyen.has(u.id) ? " ◉" : ""), x, y + (u.clase === "vehiculo" ? 1.55 : 1.3), elegida ? C.sel : rol);
    }

    function posVuelo(o, t) {
      const k = Math.min(1, Math.max(0, (t - o.t0) / o.dur));
      return { x: o.x0 + (o.x1 - o.x0) * k, y: o.y0 + (o.y1 - o.y0) * k, alto: 4 * k * (1 - k), k };
    }
    function dibujarVuelos(mundo, off) {
      const t = mundo.t + off;
      for (const mi of mundo.misiles) {
        const p = posVuelo(mi, t), q = posVuelo(mi, t - .09), arco = mi.arco * .22;
        ctx.strokeStyle = rgba(C.misil, .5); ctx.lineWidth = Math.max(1.5, T * .1); ctx.beginPath(); ctx.moveTo(X(q.x), Y(q.y - q.alto * arco)); ctx.lineTo(X(p.x), Y(p.y - p.alto * arco)); ctx.stroke();
        ctx.fillStyle = C.misil; circulo(p.x, p.y - p.alto * arco, .16); ctx.fill();
        ctx.strokeStyle = rgba(C.misil, .25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(mi.x1) - 3, Y(mi.y1)); ctx.lineTo(X(mi.x1) + 3, Y(mi.y1)); ctx.moveTo(X(mi.x1), Y(mi.y1) - 3); ctx.lineTo(X(mi.x1), Y(mi.y1) + 3); ctx.stroke();
      }
      for (const o of mundo.obuses) {
        const p = posVuelo(o, t), grande = o.clase === "asedio", arco = grande ? 1.6 : .35;
        // Dónde va a caer: un aro que se cierra. Es lo que el zigzag tiene que esquivar.
        ctx.strokeStyle = rgba(C.enemigo, .25 + .5 * p.k); ctx.lineWidth = 1.2; circulo(o.x1, o.y1, (grande ? 1.2 : .9) * (1.5 - .5 * p.k)); ctx.stroke();
        ctx.fillStyle = rgba(C["metal-negro"], .3); circulo(p.x, p.y, grande ? .2 : .12); ctx.fill();
        ctx.fillStyle = grande ? C.explosion : C.enemigo; circulo(p.x, p.y - p.alto * arco, grande ? .26 : .15); ctx.fill();
      }
    }
    function dibujarEfectos(mundo, off, est, ahora) {
      const t = mundo.t + off;
      for (const x of mundo.explosiones) {
        const k = Math.min(1, (t - x.t0) / .9), r = (x.r || MISIL.radio) * (.35 + .65 * Math.sqrt(k));
        const color = x.enemiga ? C.enemigo : x.muro ? C.bad : C.explosion;
        ctx.fillStyle = rgba(color, (x.carga ? .5 : x.golpe || x.muro ? .38 : .16) * (1 - k)); circulo(x.x, x.y, r); ctx.fill();
        ctx.strokeStyle = rgba(color, .9 * (1 - k)); ctx.lineWidth = x.carga ? 3 : 1.5; circulo(x.x, x.y, r); ctx.stroke();
      }
      for (const d of mundo.derribados) {
        const k = Math.min(1, (t - d.t0) / 1.4), s = T * .45;
        ctx.strokeStyle = rgba(d.amiga ? C["rol-ofensiva"] : C.enemigo, 1 - k); ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(X(d.x) - s, Y(d.y) - s); ctx.lineTo(X(d.x) + s, Y(d.y) + s); ctx.moveTo(X(d.x) + s, Y(d.y) - s); ctx.lineTo(X(d.x) - s, Y(d.y) + s); ctx.stroke();
      }
      // Clics del jugador: una onda en el terreno; en un enemigo, una mira.
      for (const e of est.efectos) {
        const k = Math.min(1, (ahora - e.t0) / 700);
        if (k >= 1) continue;
        const color = e.sordo ? C.muted : e.enemigo ? C.sel : C.accent;
        ctx.strokeStyle = rgba(color, 1 - k); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), 6 + k * 22, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(e.x) - 9, Y(e.y)); ctx.lineTo(X(e.x) - 3, Y(e.y)); ctx.moveTo(X(e.x) + 3, Y(e.y)); ctx.lineTo(X(e.x) + 9, Y(e.y));
        ctx.moveTo(X(e.x), Y(e.y) - 9); ctx.lineTo(X(e.x), Y(e.y) - 3); ctx.moveTo(X(e.x), Y(e.y) + 3); ctx.lineTo(X(e.x), Y(e.y) + 9); ctx.stroke();
      }
      // Globos de console.log sobre la unidad.
      for (const [id, g] of est.globos) {
        const u = mundo.porId[id];
        if (!u || ahora > g.hasta) continue;
        ctx.font = `600 11px ${css("f-code") || "monospace"}`;
        const texto = g.texto.length > 34 ? g.texto.slice(0, 33) + "…" : g.texto, m = ctx.measureText(texto).width;
        const px = Math.min(w - m - 10, Math.max(4, X(u.viva ? u.cx : u.hx) - m / 2)), py = Y((u.viva ? u.cy : u.hy) - 1.5) - 6;
        ctx.fillStyle = rgba(C["metal-negro"], .88); ctx.fillRect(px - 5, py - 12, m + 10, 17);
        ctx.strokeStyle = g.nivel === "error" ? C.bad : g.nivel === "warn" ? C.warn : C.edge; ctx.lineWidth = 1; ctx.strokeRect(px - 4.5, py - 11.5, m + 9, 16);
        ctx.fillStyle = C.ink; ctx.fillText(texto, px, py);
      }
    }

    function dibujar(off, ahora) {
      const est = estado(), mundo = est.mundo, sim = est.sim;
      if (!mundo || !w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dibujarSuelo(mundo);
      dibujarMuro(mundo, ahora);
      for (const e of mundo.enemigos) dibujarEnemigo(e, off, mundo, sim, ahora);
      for (const u of mundo.unidades) dibujarUnidad(u, off, mundo, sim, est, ahora);
      dibujarVuelos(mundo, off);
      dibujarEfectos(mundo, off, est, ahora);
    }

    leerColores(); ajustar();
    new ResizeObserver(ajustar).observe(lienzo);
    return { dibujar, ajustar, zoom, aMundo, reiniciar() { cam.z = 1; cam.x = COLS / 2; cam.y = ROWS / 2; acotar(); }, get escala() { return T; }, get ampliado() { return cam.z > 1.01; } };
  }
  window.LAB_VISTA = { crear };
})();
