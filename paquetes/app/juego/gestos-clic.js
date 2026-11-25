// Campo de batalla de V2. Las dos vistas comparten selección, diana y reparto.
export function instalarGestosClic(ctx, campo, caja, { unidadEn, coordenadasEn, unidades, puntoPantalla }) {
  const contactos = new Map();
  const guia = document.createElement('div');
  guia.className = 'guia-puntual';
  guia.hidden = true;
  campo.append(guia);
  let gesto, timer;
  const cancelarArrastre = () => {
    clearTimeout(timer);
    guia.hidden = caja.hidden = true;
    gesto = null;
  };
  const armada = id => ctx.mundo.porId[id]?.clase === 'lanzador' || ctx.mundo.porId[id]?.programable;
  const pulsar = (x, y, torreta = null) => {
    if (!ctx.ejec) return;
    const elegido = unidadEn(x, y);
    const enemigo = ctx.mundo.enemigos.find(e => e.id === elegido);
    const p = coordenadasEn(x, y) ?? enemigo;
    if (!p) return;
    const ids = torreta ? [torreta] : [...ctx.seleccionadas].filter(id => armada(id));
    const entradas = ctx.runtime.repartirClic(ids, { x: p.x, y: p.y }, enemigo, ctx.anfitrion.escucha, !!torreta);
    for (const entrada of entradas) ctx.encolar(entrada);
  };
  const dibujarGuia = (x, y) => {
    if (!ctx.mundo.porId[gesto.id]) return cancelarArrastre();
    const p = puntoPantalla(ctx.mundo.porId[gesto.id]), r = campo.getBoundingClientRect();
    Object.assign(guia.style, { left: (p.x - r.left) + 'px', top: (p.y - r.top) + 'px',
      width: Math.hypot(x - p.x, y - p.y) + 'px', transform: 'rotate(' + Math.atan2(y - p.y, x - p.x) + 'rad)' });
    guia.hidden = false;
  };
  campo.addEventListener('contextmenu', ev => { if (ev.target.tagName === 'CANVAS') ev.preventDefault(); });
  campo.addEventListener('pointerdown', ev => {
    if (ev.target.tagName !== 'CANVAS') return;
    ctx.cerrarHoja();
    const x = ev.clientX, y = ev.clientY;
    if (ev.button === 2) { ev.preventDefault(); ev.stopPropagation(); pulsar(x, y); return; }
    if (ev.button !== 0) return;
    ev.target.setPointerCapture(ev.pointerId);
    contactos.set(ev.pointerId, { x, y });
    cancelarArrastre();
    if (contactos.size > 1) return;
    const id = unidadEn(x, y);
    gesto = { x, y, id, base: ev.shiftKey ? [...ctx.seleccionadas] : [], modo: 'toque' };
    if (armada(id) || ev.pointerType === 'touch') timer = setTimeout(() => {
      if (armada(id)) { gesto.modo = 'apuntar'; dibujarGuia(x, y); }
      else { gesto.modo = 'entregado'; pulsar(x, y); }
    }, 450);
  }, true);
  campo.addEventListener('pointermove', ev => {
    const antes = contactos.get(ev.pointerId);
    if (!antes) return;
    const x = ev.clientX, y = ev.clientY;
    contactos.set(ev.pointerId, { x, y });
    if (!gesto) {
      if (contactos.size === 2 && ctx.vistaActual() !== ctx.V3) {
        const otro = [...contactos].find(([id]) => id !== ev.pointerId)[1];
        const c = ctx.runtime.camaraPlano, r = campo.getBoundingClientRect();
        const factor = Math.hypot(x - otro.x, y - otro.y) / Math.max(1, Math.hypot(antes.x - otro.x, antes.y - otro.y));
        const zoom = Math.max(.5, Math.min(4, c.zoom * factor)), k = zoom / c.zoom;
        c.x = (x + otro.x) / 2 - r.left - ((antes.x + otro.x) / 2 - r.left - c.x) * k;
        c.y = (y + otro.y) / 2 - r.top - ((antes.y + otro.y) / 2 - r.top - c.y) * k;
        c.zoom = zoom;
      }
      return;
    }
    if (gesto.modo === 'apuntar') return dibujarGuia(x, y);
    if (gesto.modo === 'entregado' || Math.hypot(x - gesto.x, y - gesto.y) <= 8 && gesto.modo === 'toque') return;
    clearTimeout(timer);
    gesto.modo = 'caja';
    const r = campo.getBoundingClientRect();
    Object.assign(caja.style, { left: Math.min(x, gesto.x) - r.left + 'px', top: Math.min(y, gesto.y) - r.top + 'px',
      width: Math.abs(x - gesto.x) + 'px', height: Math.abs(y - gesto.y) + 'px' });
    caja.hidden = false;
  }, true);
  campo.addEventListener('pointerup', ev => {
    if (!contactos.delete(ev.pointerId) || !gesto) return;
    const x = ev.clientX, y = ev.clientY;
    if (gesto.modo === 'apuntar') {
      if (Math.hypot(x - gesto.x, y - gesto.y) > 8) pulsar(x, y, gesto.id);
      else ctx.seleccionar([gesto.id]);
    }
    if (gesto.modo === 'toque' && (gesto.id || !ctx.colocador?.tocar(x, y))) ctx.seleccionar([...gesto.base, gesto.id].filter(Boolean));
    if (gesto.modo === 'caja') ctx.seleccionar([...gesto.base, ...unidades().filter(e => {
      const p = puntoPantalla(e);
      return p.visible && p.x >= Math.min(x, gesto.x) && p.x <= Math.max(x, gesto.x) &&
        p.y >= Math.min(y, gesto.y) && p.y <= Math.max(y, gesto.y);
    }).map(e => e.id)]);
    cancelarArrastre();
  }, true);
  for (const tipo of ['pointercancel', 'lostpointercapture']) campo.addEventListener(tipo, ev => {
    if (contactos.delete(ev.pointerId)) cancelarArrastre();
  }, true);
  addEventListener('blur', () => { contactos.clear(); cancelarArrastre(); });
  return { $campo: campo, cancelarGestosCampo() { contactos.clear(); cancelarArrastre(); }, arrastreCampo: null };
}
