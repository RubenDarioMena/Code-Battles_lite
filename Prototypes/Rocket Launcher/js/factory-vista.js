/* Dibujo de logística trasladado de Factory; usa el canvas y selección de la base común. */
(() => {
  "use strict";
  function dibujar(ctx, mundo, colores, seleccionMapa, geo) {
    const { T, ox, oy } = geo, OP = .5, MATERIALES = ["cobre", "silicio"];
    const c = colores;
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    ctx.save(); ctx.translate(ox, oy);
    ctx.fillStyle = c.surface; ctx.fillRect(0, 0, 9 * T, 7 * T);
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= 9; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, 7 * T); }
    for (let y = 0; y <= 7; y++) { ctx.moveTo(0, y * T); ctx.lineTo(9 * T, y * T); }
    ctx.stroke();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
    for (const e of mundo.entidades) { rr(e.puerta.x * T + T * .3, e.puerta.y * T + T * .3, T * .4, T * .4, 3); ctx.stroke(); }
    ctx.setLineDash([]);

    for (const e of mundo.entidades) dibujarEntidad(e, T);

    for (const e of mundo.entidades) {
      if (!e.suelo || !e.suelo.length) continue;
      const cx = (e.puerta.x + .5) * T, cy = (e.puerta.y + .5) * T + T * .32;
      ctx.fillStyle = c["bad-soft"]; ctx.beginPath(); ctx.ellipse(cx, cy, T * .34, T * .14, 0, 0, Math.PI * 2); ctx.fill();
      e.suelo.slice(0, 6).forEach((m, i) => {
        ctx.fillStyle = c[m]; ctx.beginPath(); ctx.arc(cx - T * .22 + (i % 3) * T * .22, cy - T * .03 + Math.floor(i / 3) * T * .08, T * .06, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = c.bad; ctx.font = `700 ${Math.max(T * .17, 9)}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(`derrame ×${e.suelo.length}`, cx, cy + T * .1);
    }

    const r = mundo.robot;
    if (r.tarea && r.tarea.wps.length) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo((r.x + .5) * T, (r.y + .5) * T);
      for (const w of r.tarea.wps) ctx.lineTo((w.x + .5) * T, (w.y + .5) * T);
      ctx.stroke(); ctx.setLineDash([]);
    }

    const px = (r.x + .5) * T, py = (r.y + .5) * T;
    if (r.tarea && !r.tarea.wps.length) {
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, T * .38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - Math.max(0, r.tarea.op) / (r.tarea.op0 || OP)), false); ctx.stroke();
    }
    if (seleccionMapa === "R1") { ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, T * .36, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(px, py, T * .28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.surface; ctx.font = `700 ${Math.max(T * .2, 10)}px Archivo, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("R1", px, py + 1);
    if (r.carga) {
      ctx.fillStyle = c[r.carga]; ctx.strokeStyle = c.surface; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px + T * .24, py - T * .24, T * .13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  function dibujarEntidad(e, T) {
    const c = colores, x = e.x * T + T * .07, y = e.y * T + T * .07, s = T * .86;
    ctx.fillStyle = c.edge; rr(x, y + T * .05, s, s, T * .1); ctx.fill();
    ctx.fillStyle = c.building; rr(x, y, s, s, T * .1); ctx.fill();
    ctx.fillStyle = c["building-top"]; rr(x + T * .05, y + T * .05, s - T * .1, T * .2, T * .05); ctx.fill();
    const marcado = seleccionMapa === e.id;
    if (marcado) {
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5;

      rr(x - 2, y - 2, s + 4, s + T * .05 + 4, T * .12); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = c.ink; ctx.font = `700 ${Math.max(T * .17, 9.5)}px Archivo, sans-serif`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(e.id, x + T * .09, y + T * .15);

    if (e.tipo === "bodega") {
      if (e.oculto && !mundo.revelado) {
        // Lona: el contenido no se ve, hay que medirlo con el sensor.
        ctx.save(); rr(x + T * .08, y + T * .3, s - T * .16, s - T * .4, T * .06); ctx.clip();
        ctx.strokeStyle = c.edge; ctx.lineWidth = 1;
        for (let k = -s; k < s * 2; k += T * .12) { ctx.beginPath(); ctx.moveTo(x + k, y + T * .3); ctx.lineTo(x + k - s, y + s); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = c.ink; ctx.font = `800 ${Math.max(T * .32, 13)}px Archivo, sans-serif`; ctx.textAlign = "center";
        ctx.fillText("?", x + s / 2, y + s * .62);
        return;
      }
      const mats = MATERIALES.filter(m => m in e.stock);
      mats.forEach((m, i) => {
        const yy = y + T * .44 + i * T * .22;
        ctx.fillStyle = c[m]; ctx.beginPath(); ctx.arc(x + T * .2, yy, T * .075, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.stock[m] ? c.ink : c.muted; ctx.font = `600 ${Math.max(T * .17, 9)}px "JetBrains Mono", monospace`;
        ctx.textAlign = "left";
        ctx.fillText(`${m.slice(0, 2)} ${e.stock[m]}`, x + T * .33, yy + 1);
      });
    } else {
      const cx = x + s / 2, cy = y + T * .45, Rr = T * .14;
      ctx.strokeStyle = c[e.acepta]; ctx.lineWidth = T * .05;
      ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, Math.PI * 2); ctx.stroke();
      if (e.procesando) {
        ctx.fillStyle = c[e.acepta]; ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, Rr * .8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.progreso / e.tProceso)); ctx.closePath(); ctx.fill();
      }
      const sy = y + T * .7, n = e.cap;
      if (n <= 4) {
        const sw = T * .13, gap = T * .05, tot = n * sw + (n - 1) * gap;
        for (let i = 0; i < n; i++) {
          const sx = cx - tot / 2 + i * (sw + gap);
          ctx.lineWidth = 1.5; ctx.strokeStyle = c.edge; rr(sx, sy - sw / 2, sw, sw, 2); ctx.stroke();
          if (i < e.entrada) { ctx.fillStyle = c[e.acepta]; rr(sx + 2, sy - sw / 2 + 2, sw - 4, sw - 4, 1); ctx.fill(); }
        }
      } else {
        ctx.fillStyle = c.muted; ctx.font = `600 ${Math.max(T * .15, 9)}px "JetBrains Mono", monospace`; ctx.textAlign = "center";
        ctx.fillText(`${e.entrada}/${n}`, cx, sy);
      }
    }
  }

  }
  const svg = cuerpo => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
  const caja = `<path class="s1" stroke-width="2" stroke-linejoin="round" d="M5 15l11-5 11 5v12H5zM5 15l11 5 11-5M16 20v7"/>`;
  window.ICONOS.recoger = { c1: "#7FA3FF", c2: "#E2894F", svg: svg(`${caja}<path class="s2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M16 3v11m-4-4l4 4 4-4"/>`) };
  window.ICONOS.entregar = { c1: "#7FA3FF", c2: "#5FC28A", svg: svg(`${caja}<path class="s2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M16 14V3m-4 4l4-4 4 4"/>`) };
  window.FACTORY_VISTA = { dibujar };
})();
