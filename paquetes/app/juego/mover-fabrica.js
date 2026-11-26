/** Colocador de la fábrica de Campaign-V2 (hitos hN). Con la planta parada, el jugador elige una tarima, una máquina o
 * un brazo anclado y pulsa «Mover». Tiene dos fases:
 * - apuntar: un fantasma sigue al ratón, verde si cabe y rojo si no;
 * - fijar: tras el toque, el fantasma espera en el suelo con la barra de girar (R), confirmar (Intro) y cancelar (Esc).
 *   Tocar otro punto lo lleva allí.
 * Solo al confirmar entra la orden `colocar` en la partida, como orden del jugador. El motor decide si cabe (losa,
 * solapes, pieza ocupada, punto de trabajo girado) y los programas nunca la pueden dar. Mientras tanto, el fantasma
 * pregunta lo mismo con `probarColocar`, que no toca el mundo.
 * @param {any} ctx */
export function instalarMoverFabrica(ctx) {
  const boton = ctx.fabricaV2 ? ctx.$('b-mover') : null;
  if (!boton) return { moverFabrica: null };
  const $campo = ctx.$('campo'), barra = ctx.$('cv2-colocar');
  const bGirar = ctx.$('cv2-colocar-girar'), bOk = ctx.$('cv2-colocar-ok'), bNo = ctx.$('cv2-colocar-no');
  const aro = ctx.$('cv2-fantasma-plano'), punto = ctx.$('cv2-fantasma-punto');
  /** @type {null | 'apuntar' | 'fijar'} */
  let fase = null;
  /** @type {any} Lo que se colocaría: pieza, destino, giro y la respuesta del motor ({ resultado, ax, ay }). */
  let plan = null;
  const movible = e => !!e && e.presente && ((e.clase === 'lugar' && e.tipo === 'lot')
    || (ctx.campaign.esMaquina(e) && !e.pad) || (ctx.campaign.esRobot(e) && !!e.alcance));
  const elegida = () => ctx.seleccionadas.size === 1 ? ctx.mundo?.porId[ctx.seleccion] ?? null : null;
  const textoResultado = (resultado, id) => ctx.ti18n(resultado === 'ocupado' ? 'cv2.fab.ocupado' : `cv2.colocar.${resultado}`, { id });
  boton.hidden = false;

  function rotular() {
    boton.textContent = ctx.ti18n('cv2.fab.mover');
    boton.dataset.tip = ctx.ti18n('cv2.fab.moverTip');
    boton.setAttribute('aria-label', ctx.ti18n('cv2.fab.moverTip'));
    for (const [b, k] of [[bGirar, 'cv2.fab.girar'], [bOk, 'cv2.fab.confirmar'], [bNo, 'cv2.fab.cancelar']]) {
      if (!b) continue;
      b.dataset.tip = ctx.ti18n(k);
      b.setAttribute('aria-label', ctx.ti18n(k));
    }
  }
  rotular();

  // Pregunta al motor sin tocar el mundo. Sin la consulta (otra serie), el fantasma no avisa y decide la orden.
  function probar() {
    plan.respuesta = ctx.campaign.probarColocar?.(ctx.partida.mundo, plan.id, plan.x, plan.y, plan.giro)
      ?? { resultado: 'ok', ax: null, ay: null };
  }
  function apuntar(x, y) {
    plan.x = x; plan.y = y;
    probar();
  }

  function salir() {
    fase = null; plan = null;
    boton.setAttribute('aria-pressed', 'false');
    if (barra) barra.hidden = true;
    if (aro) aro.hidden = true;
    if (punto) punto.hidden = true;
    ctx.V3?.fantasma?.(null);
  }
  function entrar() {
    const e = elegida();
    if (ctx.ejec || !movible(e)) return;
    fase = 'apuntar';
    // El fantasma empieza sobre la pieza: así se ve qué se mueve antes de tocar el suelo.
    plan = { id: e.id, x: e.base ? e.base.x : e.cx, y: e.base ? e.base.y : e.cy, giro: 0, respuesta: null };
    probar();
    boton.setAttribute('aria-pressed', 'true');
    ctx.globo(e.id, 'info', ctx.ti18n('cv2.fab.moverAyuda', { id: e.id }));
  }
  function girar() {
    if (!fase || plan.respuesta?.ax == null) return;
    plan.giro = (plan.giro + 1) % 4;
    probar();
  }
  // Solo donde el motor dijo que cabe: el ✓ apagado y la tecla Intro pasan por aquí.
  function confirmar() {
    if (fase !== 'fijar' || plan.respuesta?.resultado !== 'ok') return;
    const { id, x, y, giro } = plan;
    salir();
    colocar(id, x, y, giro);
  }

  boton.addEventListener('click', () => (fase ? salir() : entrar()));
  bGirar?.addEventListener('click', girar);
  bOk?.addEventListener('click', confirmar);
  bNo?.addEventListener('click', salir);
  // Con el ratón, el fantasma sigue al cursor hasta el primer toque; luego espera donde quedó.
  $campo.addEventListener('pointermove', ev => {
    if (fase !== 'apuntar' || ev.pointerType !== 'mouse') return;
    const p = ctx.coordenadasEn(ev.clientX, ev.clientY);
    if (p) apuntar(p.x, p.y);
  });
  const escribiendo = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName ?? ''));
  addEventListener('keydown', ev => {
    if (!fase) return;
    if (ev.key === 'Escape') { salir(); return; }
    if (escribiendo(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); girar(); }
    // Intro sobre un botón de la barra lo pulsa él mismo; sobre otro (Mover se queda con el foco), confirma sin pulsarlo.
    else if (ev.key === 'Enter' && fase === 'fijar' && !barra?.contains(ev.target)) { ev.preventDefault(); confirmar(); }
  });
  addEventListener('cmg:idioma', rotular);

  // Cada fotograma: solo se puede mover con la planta parada y la misma pieza movible elegida.
  function pintar() {
    const e = elegida(), puede = !ctx.ejec && movible(e);
    if (fase && (!puede || e.id !== plan.id)) salir();
    if (boton.disabled !== !puede) boton.disabled = !puede;
    if (!fase) return;
    const vista = ctx.vistaActual(), en3d = !!ctx.V3 && vista === ctx.V3;
    const proyectar = (x, alto, y) => vista.proyectar?.(x, alto, y) ?? { x: 0, y: 0, visible: false };
    const { resultado, ax, ay } = plan.respuesta, cabe = resultado === 'ok';
    ctx.V3?.fantasma?.(en3d ? { id: plan.id, x: plan.x, y: plan.y, ax, ay, valido: cabe } : null);
    // En el plano, un aro en el destino y un punto donde trabajará el obrero.
    const centro = proyectar(plan.x, 0, plan.y);
    if (aro) {
      aro.hidden = en3d || !centro.visible;
      aro.classList.toggle('no', !cabe);
      aro.style.left = centro.x + 'px'; aro.style.top = centro.y + 'px';
    }
    if (punto) {
      const p = ax == null ? null : proyectar(ax, 0, ay);
      punto.hidden = en3d || !p?.visible;
      if (p) { punto.style.left = p.x + 'px'; punto.style.top = p.y + 'px'; }
    }
    if (barra) {
      // La barra va encima del fantasma, dentro del campo.
      const arriba = proyectar(plan.x, en3d ? 2.6 : 0, plan.y), r = $campo.getBoundingClientRect();
      barra.hidden = fase !== 'fijar' || !arriba.visible;
      barra.style.left = Math.min(Math.max(arriba.x, 70), r.width - 70) + 'px';
      barra.style.top = Math.min(Math.max(arriba.y, 70), r.height - 10) + 'px';
      if (bGirar) bGirar.disabled = ax == null;
      if (bOk) {
        bOk.disabled = !cabe;
        bOk.dataset.tip = cabe ? ctx.ti18n('cv2.fab.confirmar') : textoResultado(resultado, plan.id);
      }
    }
  }
  /** El toque en el campo, en coordenadas de pantalla. Devuelve true si lo consumió el colocador. */
  function tocar(cx, cy) {
    if (!fase) return false;
    const p = ctx.coordenadasEn(cx, cy);
    if (!p || ctx.ejec) return true;
    apuntar(p.x, p.y);
    fase = 'fijar';
    if (plan.respuesta.resultado !== 'ok') ctx.avisoSistema(textoResultado(plan.respuesta.resultado, plan.id));
    return true;
  }
  /** Coloca una unidad en (x, y) del mapa con `giro` cuartos de vuelta. También lo usan las pruebas. */
  function colocar(id, x, y, giro = 0) {
    const partida = ctx.partida;
    partida.ordenar({ unidad: id, verbo: 'colocar', args: giro ? [x, y, giro] : [x, y], paso: partida.pasoActual, origen: 'jugador' });
    partida.aplicarOrdenes();
    const resultado = ctx.reglas.respuestas(partida.mundo).filter(r => r.unidad === id).at(-1)?.resultado ?? 'rechazado';
    const texto = textoResultado(resultado, id);
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
  return { moverFabrica: { pintar, tocar, colocar, girar, confirmar, cancelar: salir,
    get activo() { return !!fase; }, get fase() { return fase; }, get plan() { return plan && structuredClone(plan); } } };
}
