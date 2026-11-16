
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarEtiquetas(ctx) {
  // ---------- Etiquetas y globos sobre el campo ----------
  const $capa = ctx.$("capa"), etiquetas = new Map();
  function pintarCapa(off, ahora) {
    const vista = ctx.vistaActual();
    const vivos = new Set(), puestas = [];
    const cercaC = ctx.ES_CAMPAIGN && (ctx.vista === "3d" && ctx.V3 ? ctx.V3.camara().dist < 55 : vista.proyectar(1, 0, 0).x - vista.proyectar(0, 0, 0).x > 9);
    for (const e of ctx.mundo.maquinas) {
      const alto = ctx.ES_CAMPAIGN ? ctx.uiC.altoEtiqueta(e) : e.clase === "lanzador" ? 1.45 : e.clase === "vibracion" ? 1.7 : e.clase === "deposito" ? 1.1 : .9;
      const p = vista.proyectar(e.cx, alto, e.cy, ctx.radioDe(e));
      vivos.add(e.id);
      let o = etiquetas.get(e.id);
      if (!o) {
        const etq = document.createElement("div"); etq.className = "etq";
        etq.style.setProperty("--rol", `var(--rol-${ctx.funcionDe(e).principal})`);
        const g = document.createElement("div"); g.className = "globo"; g.hidden = true;
        $capa.append(etq, g); o = { etq, g, texto: "", txtEtq: "" }; etiquetas.set(e.id, o);
      }
      const atasco = e.clase === "lanzador" && e.atascado;
      // Campaign: los contadores de tarimas y máquinas se ven de cerca sin seleccionar nada.
      const fija = ctx.ES_CAMPAIGN && !ctx.seleccionadas.has(e.id) && cercaC && ctx.uiC.siempre(e);
      const txt = ctx.ES_CAMPAIGN ? (fija ? ctx.uiC.etiqueta(e).replace(`${e.id} · `, "") : ctx.uiC.etiqueta(e)) : e.clase === "lanzador" ? `${e.id} · ${e.misiles}▮${atasco ? " ⚠" : ""}` : e.id;
      if (txt !== o.txtEtq) { o.etq.textContent = txt; o.txtEtq = txt; }
      o.etq.className = `etq${e.id === ctx.seleccion ? " principal" : ""}${atasco ? " atasco" : ""}${fija ? " fija" : ""}`;
      // Los nombres solo aparecen en las unidades seleccionadas: sin selección no tapan a nadie.
      o.etq.hidden = !p.visible || !(ctx.seleccionadas.has(e.id) || fija);
      if (!o.etq.hidden) puestas.push({ o, x: p.x, y: p.y, w: txt.length * 7.2 + 22, h: 21 });
      const gl = ctx.globos.get(e.id);
      if (gl && ahora < gl.hasta && p.visible) {
        const textoGlobo = gl.nivel === "sistema" && ctx.CMGPresentacion ? ctx.CMGPresentacion.texto(gl.texto) : gl.texto;
        if (o.texto !== gl.nivel + textoGlobo) { o.g.textContent = textoGlobo; o.g.className = `globo ${gl.nivel}`; o.texto = gl.nivel + textoGlobo; }
        o.g.hidden = false; o.g.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, calc(-100% - 22px))`;
      } else o.g.hidden = true;
    }
    for (const [id, o] of etiquetas) if (!vivos.has(id)) { o.etq.remove(); o.g.remove(); etiquetas.delete(id); }
    // Si dos etiquetas se tocan, la de más arriba en pantalla sube un escalón.
    puestas.sort((a, b) => b.y - a.y);
    const hechas = [];
    for (const q of puestas) {
      for (let i = 0, choca = true; choca && i < 12; i++) {
        const h = hechas.find(h => Math.abs(h.x - q.x) < (h.w + q.w) / 2 && q.y - q.h < h.y && h.y - h.h < q.y);
        choca = !!h; if (h) q.y = h.y - h.h - 2;
      }
      hechas.push(q);
      q.o.etq.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -100%)`;
    }
  }

  return {
    get $capa() { return $capa; },
    get etiquetas() { return etiquetas; },
    get pintarCapa() { return pintarCapa; }
  };
}
