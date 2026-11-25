import { puntoEnMarco } from '../../reglas-campaign-v2/index.js';

export function crearColocador(ctx, escenaMetros) {
  const marcas = new Map();
  function seleccion() {
    if (!ctx.mundo || (ctx.mundo.t > 0 && !(ctx.ejec && ctx.pausa))) return null;
    if (ctx.seleccionadas.size === 1 && ctx.mundo.porId[ctx.seleccion]?.clase === 'lanzador') return ctx.seleccion;
    return null;
  }
  function colocar(indice) {
    const unidad = seleccion();
    if (!unidad || indice == null) return false;
    const orden = { unidad, verbo: 'colocar', args: [indice] };
    if (ctx.ejec) ctx.encolar({ tipo: 'orden', ...orden });
    else {
      const p = ctx.partida;
      p.ordenar({ ...orden, paso: p.pasoActual, origen: 'jugador' });
      p.aplicarOrdenes();
      // A t=0 el reglamento reconstruye War conservando la semilla.
      ctx.mundo = ctx.mundoPantalla(p.mundo);
      const ultimo = p.sucesos(p.pasoActual).at(-1);
      if (ultimo?.tipo === 'colocar-descartada') ctx.avisoSistema(ctx.ti18n('cv2.colocar.' + ultimo.datos.motivo));
      ctx.invalidarEscena();
    }
    return true;
  }
  function pintar() {
    if (!seleccion()) {
      for (const el of marcas.values()) el.hidden = true;
      return;
    }
    const vista = ctx.vistaActual(), escena = escenaMetros();
    for (const b of escena.bastiones) {
      let el = marcas.get(b.indice);
      if (b.ocupado) { if (el) el.hidden = true; continue; }
      const local = puntoEnMarco({ x: b.cx, y: b.cy }, escena.marco.origen);
      const p = vista.proyectarBastion?.(b) ?? vista.proyectar(local.x, 0, local.y);
      if (!p.visible) { if (el) el.hidden = true; continue; }
      if (!el) {
        el = document.createElement('button');
        el.type = 'button'; el.className = 'bastion-libre'; el.textContent = '+';
        el.addEventListener('click', () => colocar(b.indice));
        ctx.$('campo').append(el);
        marcas.set(b.indice, el);
      }
      el.setAttribute('aria-label', ctx.ti18n('cv2.colocar.en', { n: b.indice + 1 }));
      el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
      el.hidden = false;
    }
  }
  function tocar(x, y) {
    if (!seleccion()) return false;
    const r = ctx.$('campo').getBoundingClientRect();
    const px = x - r.left, py = y - r.top;
    // Las marcas dejan pasar los punteros para conservar el clic derecho y el pellizco.
    for (const [i, el] of marcas)
      if (!el.hidden && Math.hypot(px - parseFloat(el.style.left), py - parseFloat(el.style.top)) <= 13) return colocar(i);
    const indice = ctx.vistaActual().bastionEn?.(px, py);
    if (indice == null || escenaMetros().bastiones.find(b => b.indice === indice)?.ocupado) return false;
    return colocar(indice);
  }
  return { pintar, tocar, colocar };
}
