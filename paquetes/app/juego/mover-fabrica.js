/** Colocador de la fábrica de Campaign-V2 (hitos hN). Con la planta parada, el jugador elige una tarima, una máquina o
 * un brazo anclado, pulsa «Mover» y toca el suelo de la losa. La orden `colocar` entra en la partida como orden del
 * jugador: el motor decide si cabe (losa, solapes, máquina o brazo ocupados) y los programas nunca la pueden dar.
 * @param {any} ctx */
export function instalarMoverFabrica(ctx) {
  const boton = ctx.fabricaV2 ? ctx.$('b-mover') : null;
  if (!boton) return { moverFabrica: null };
  let activo = false;
  const movible = e => !!e && e.presente && ((e.clase === 'lugar' && e.tipo === 'lot')
    || (ctx.campaign.esMaquina(e) && !e.pad) || (ctx.campaign.esRobot(e) && !!e.alcance));
  const elegida = () => ctx.seleccionadas.size === 1 ? ctx.mundo?.porId[ctx.seleccion] ?? null : null;
  boton.hidden = false;
  boton.textContent = ctx.ti18n('cv2.fab.mover');
  boton.dataset.tip = ctx.ti18n('cv2.fab.moverTip');
  boton.setAttribute('aria-label', ctx.ti18n('cv2.fab.moverTip'));

  function salir() {
    activo = false;
    boton.setAttribute('aria-pressed', 'false');
  }
  function entrar() {
    const e = elegida();
    if (ctx.ejec || !movible(e)) return;
    activo = true;
    boton.setAttribute('aria-pressed', 'true');
    ctx.globo(e.id, 'info', ctx.ti18n('cv2.fab.moverAyuda', { id: e.id }));
  }
  boton.addEventListener('click', () => (activo ? salir() : entrar()));
  addEventListener('keydown', ev => { if (activo && ev.key === 'Escape') salir(); });
  addEventListener('cmg:idioma', () => {
    boton.textContent = ctx.ti18n('cv2.fab.mover');
    boton.dataset.tip = ctx.ti18n('cv2.fab.moverTip');
    boton.setAttribute('aria-label', ctx.ti18n('cv2.fab.moverTip'));
  });

  // Cada fotograma: solo se puede mover con la planta parada y una sola pieza movible elegida.
  function pintar() {
    const puede = !ctx.ejec && movible(elegida());
    if (!puede && activo) salir();
    if (boton.disabled !== !puede) boton.disabled = !puede;
  }
  /** El toque en el campo, en coordenadas de pantalla. Devuelve true si lo consumió el colocador. */
  function tocar(cx, cy) {
    if (!activo) return false;
    const e = elegida(), p = ctx.coordenadasEn(cx, cy);
    salir();
    if (!e || !p || ctx.ejec) return true;
    colocar(e.id, p.x, p.y);
    return true;
  }
  /** Coloca una unidad en (x, y) del mapa. También lo usan las pruebas. */
  function colocar(id, x, y) {
    const partida = ctx.partida;
    partida.ordenar({ unidad: id, verbo: 'colocar', args: [x, y], paso: partida.pasoActual, origen: 'jugador' });
    partida.aplicarOrdenes();
    const resultado = ctx.reglas.respuestas(partida.mundo).filter(r => r.unidad === id).at(-1)?.resultado ?? 'rechazado';
    const texto = ctx.ti18n(`cv2.colocar.${resultado}`, { id });
    if (resultado === 'ok') {
      // Las máquinas y los puestos son fijos en la escena 3D: se rehace con su nueva posición.
      if (ctx.V3) { ctx.V3.construir(); ctx.V3.anillosDe(ctx.seleccion); }
      for (const o of ctx.etiquetas.values()) { o.etq.remove(); o.g.remove(); }
      ctx.etiquetas.clear();
      ctx.globo(id, 'info', texto);
      ctx.guardarVivo();
      ctx.pintarInspector();
    } else ctx.avisoSistema(texto);
    return resultado;
  }
  return { moverFabrica: { pintar, tocar, colocar, get activo() { return activo; } } };
}
