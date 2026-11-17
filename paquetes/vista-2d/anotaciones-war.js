// Información por encima de las partículas: miras, altura del estallido y selección.
export function dibujarAnotacionesWar(c, estado, { off, T, P, Q, MISIL, r2, radioDe }) {
  for (const l of estado.escena.lanzadores) {
    if (l.lugar && !l.atascado && l.modo !== "idle") {
      const x = P(l.lugar.x), y = Q(l.lugar.y), r = T * .45;
      c.strokeStyle = estado.col.accent; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.moveTo(x - r * 1.4, y); c.lineTo(x + r * 1.4, y); c.moveTo(x, y - r * 1.4); c.lineTo(x, y + r * 1.4); c.stroke();
      if ((l.lugar.z || 0) > .05) { c.fillStyle = estado.col.accent; c.font = `700 ${Math.max(9, T * .42)}px "JetBrains Mono", monospace`; c.textAlign = "left"; c.textBaseline = "bottom"; c.fillText(`↑${r2(l.lugar.z)}`, x + r, y - r * .6); }
    }
  }
  const t = estado.escena.t + off;
  for (const x of estado.escena.explosiones) {
    if (x.atasco || !(x.z > .05)) continue;
    const u = Math.min(1, (t - x.t0) / .35), a = 1 - Math.max(0, (t - x.t0 - .25) / .5);
    const r = MISIL.radio * T * (.25 + .75 * Math.min(1, u * 1.4));
    c.globalAlpha = Math.max(0, a);
    c.beginPath(); c.arc(P(x.x), Q(x.y), r, 0, Math.PI * 2);
    c.strokeStyle = estado.col.explosion; c.setLineDash([4, 3]); c.lineWidth = 1.5; c.stroke(); c.setLineDash([]);
    c.fillStyle = estado.col.ink; c.font = `600 ${Math.max(8, T * .36)}px "JetBrains Mono", monospace`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`↑${r2(x.z)}`, P(x.x), Q(x.y));
    c.globalAlpha = 1;
  }
  // Selección: el mismo círculo del halo, nítido y claro, con un filo oscuro para leerse sobre cualquier color.
  for (const e of estado.escena.maquinas) {
    if (!estado.seleccionadas.has(e.id)) continue;
    c.beginPath(); c.arc(P(e.cx), Q(e.cy), radioDe(e) * T, 0, Math.PI * 2);
    c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 4; c.stroke(); c.strokeStyle = estado.col.sel; c.lineWidth = 2; c.stroke();
  }

  for (const e of estado.escena.enemigos) {
    const x = P(e.x + e.vx * off), y = Q(e.y + e.vy * off);
    if (estado.seleccionadas.has(e.id)) { c.beginPath(); c.arc(x, y, T * .62, 0, Math.PI * 2); c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 4; c.stroke(); c.strokeStyle = estado.col.sel; c.lineWidth = 2; c.stroke(); }
  }
}
