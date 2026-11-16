/* Plano 2D de War (y marco común de Factory), antes en js/vistas.js. Dibuja solo con estado.escena. */
import { dibujarFactory } from './factory.js';

export function crearPlano(estado, { $c2d, ctx2, ES_FACTORY, LINEA_BASE, TIPOS, MISIL, SENSOR, LAU, FUNCIONES, FR, HALO, INTENSIDAD, ARCO, LUCES, visual, funcionDe, radioDe, direccionDe, alcance, rgba, mezclaBlanco, r2 }) {
function dibujar2D(off, _ahora = undefined) {
  const dpr = window.devicePixelRatio || 1, W = $c2d.clientWidth, H = $c2d.clientHeight;
  if (!W || !H) return;
  if ($c2d.width !== Math.round(W * dpr) || $c2d.height !== Math.round(H * dpr)) { $c2d.width = Math.round(W * dpr); $c2d.height = Math.round(H * dpr); }
  const T = Math.min(W / estado.cols, (H - 40) / estado.rows), ox = (W - T * estado.cols) / 2, oy = Math.max(36, (H - T * estado.rows) / 2);
  estado.geo2 = { T, ox, oy };
  const c = ctx2, P = (x) => ox + x * T, Q = (y) => oy + y * T;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = estado.col.bg; c.fillRect(0, 0, W, H);
  if (ES_FACTORY) { dibujarFactory(c, estado.escena, { ...estado.col, surface: estado.col.surface, cobre: "#d9924c", silicio: "#65b7cf", "bad-soft": estado.col.bad }, estado.seleccion, estado.geo2); return; }
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
  if (estado.escena.def.niebla) { c.fillStyle = estado.col.surface; c.globalAlpha = .28; c.fillRect(ox, oy, estado.cols * T, estado.rows * T); c.globalAlpha = 1; }
  // Alcances de la máquina elegida
  const sel = estado.seleccion && estado.escena.porId[estado.seleccion];
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
  for (const e of estado.escena.maquinas) {
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
  const d = estado.escena.deposito; caja(d.cx, d.cy, 1.4, 1.7, estado.col.building, rol(d));
  c.fillStyle = estado.col.misil; c.fillRect(P(d.cx - .45), Q(d.cy - .35), .9 * T, .14 * T); c.fillRect(P(d.cx - .45), Q(d.cy + .2), .9 * T, .14 * T);
  for (const s of estado.escena.sensores) {
    c.fillStyle = rol(s); c.beginPath(); c.arc(P(s.cx), Q(s.cy), T * .32, 0, Math.PI * 2); c.fill();
  }
  for (const l of estado.escena.lanzadores) {
    caja(l.cx, l.cy, 1.1, 1.1, estado.col.building, l.atascado ? estado.col.bad : rol(l));
    c.strokeStyle = l.atascado ? estado.col.bad : estado.col.ink; c.lineWidth = Math.max(2, T * .18); c.lineCap = "round";
    c.beginPath(); c.moveTo(P(l.cx), Q(l.cy)); c.lineTo(P(l.cx + Math.cos(l.yaw) * .7), Q(l.cy + Math.sin(l.yaw) * .7)); c.stroke(); c.lineCap = "butt";
    if (l.lugar && !l.atascado && l.modo !== "idle") {
      const x = P(l.lugar.x), y = Q(l.lugar.y), r = T * .45;
      c.strokeStyle = estado.col.accent; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.moveTo(x - r * 1.4, y); c.lineTo(x + r * 1.4, y); c.moveTo(x, y - r * 1.4); c.lineTo(x, y + r * 1.4); c.stroke();
      if ((l.lugar.z || 0) > .05) { c.fillStyle = estado.col.accent; c.font = `700 ${Math.max(9, T * .42)}px "JetBrains Mono", monospace`; c.textAlign = "left"; c.textBaseline = "bottom"; c.fillText(`↑${r2(l.lugar.z)}`, x + r, y - r * .6); }
    }
  }
  for (const r of estado.escena.reparadores) { c.fillStyle = rol(r); c.fillRect(P(r.cx) - T * .23, Q(r.cy) - T * .23, T * .46, T * .46); }
  // Luces: puntos claros encima de cada máquina (pilotos y faros); se apagan con el atasco.
  if (visual.brillo === "pilotos" || visual.brillo === "faros") for (const e of estado.escena.maquinas) {
    if (e.clase === "lanzador" && e.atascado) continue;
    if (e.clase === "vibracion" && ahora % 1600 >= 1100) continue;
    c.fillStyle = mezclaBlanco(rol(e), .55);
    for (const [lx, , lz] of LUCES[e.clase] || []) { c.beginPath(); c.arc(P(e.cx + lx), Q(e.cy + lz), Math.max(1.5, T * .07), 0, Math.PI * 2); c.fill(); }
  }
  // Selección: el mismo círculo del halo, nítido y claro, con un filo oscuro para leerse sobre cualquier color.
  for (const e of estado.escena.maquinas) {
    if (!estado.seleccionadas.has(e.id)) continue;
    c.beginPath(); c.arc(P(e.cx), Q(e.cy), radioDe(e) * T, 0, Math.PI * 2);
    c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 4; c.stroke(); c.strokeStyle = estado.col.sel; c.lineWidth = 2; c.stroke();
  }
  // Enemigos: la sombra desplazada indica la altura.
  for (const e of estado.escena.enemigos) {
    const x = P(e.x + e.vx * off), y = Q(e.y + e.vy * off), tp = TIPOS[e.tipo], golpe = estado.escena.t - e.golpeT < .25;
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
  const t = estado.escena.t + off;
  for (const mi of estado.escena.misiles) {
    const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
    const x = P(mi.x0 + (mi.x1 - mi.x0) * u), y = Q(mi.y0 + (mi.y1 - mi.y0) * u);
    c.strokeStyle = estado.col.misil; c.lineWidth = 1.5; c.beginPath(); c.moveTo(P(mi.x0 + (mi.x1 - mi.x0) * Math.max(0, u - .18)), Q(mi.y0 + (mi.y1 - mi.y0) * Math.max(0, u - .18))); c.lineTo(x, y); c.stroke();
    c.fillStyle = estado.col.misil; c.beginPath(); c.arc(x, y, T * .14, 0, Math.PI * 2); c.fill();
  }
  // Explosiones: llena = en el suelo, con borde discontinuo y altura = en el aire.
  for (const x of estado.escena.explosiones) {
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
