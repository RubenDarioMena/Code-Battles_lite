
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarCampoJuego(ctx) {
  const LARGO_MS = 480, $campo = ctx.$("campo"), $carga = ctx.$("carga");
  const $cajaSeleccion = ctx.$("seleccion-caja"), punterosCampo = new Set();
  /** @type {any} */
  let largo = null, arrastreCampo = null, ultimoToque = null;
  /** @type {any} */
  let tFicha = 0;
  let campoCoordenadas = null;
  const unidades = () => [...ctx.mundo.maquinas, ...ctx.mundo.enemigos];
  const unidadPorId = (id) => ctx.mundo.porId[id] || ctx.mundo.enemigos.find(e => e.id === id);
  function puntoPantalla(e) {
    const r = $campo.getBoundingClientRect();
    const vista = ctx.vistaActual();
    const p = vista.proyectarUnidad?.(e, e.z || 0) ?? vista.proyectar(e.cx ?? e.x, e.z || 0, e.cy ?? e.y);
    return { x: p.x + r.left, y: p.y + r.top, visible: p.visible && p.x >= 0 && p.x <= r.width && p.y >= 0 && p.y <= r.height };
  }
  function unidadEn(cx, cy) {
    const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    return ctx.vistaActual().elegir(x, y);
  }
  function coordenadasEn(cx, cy) {
    const r = $campo.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    const p = ctx.vistaActual().suelo(x, y);
    return p && p.x >= 0 && p.x <= ctx.COLS && p.y >= 0 && p.y <= ctx.ROWS ? { x: ctx.r2(p.x), y: ctx.r2(p.y), z: 0 } : null;
  }
  if (ctx.runtime?.instalarGestosClic) return { unidades, unidadPorId, puntoPantalla, unidadEn, coordenadasEn,
    ...ctx.runtime.instalarGestosClic(ctx, $campo, $cajaSeleccion, { unidades, puntoPantalla, unidadEn, coordenadasEn }) };
  document.addEventListener("focusin", (ev) => {
    if (/** @type {Element} */ (ev.target).matches("[data-coordenadas]")) campoCoordenadas = ev.target;
    else campoCoordenadas = null;
  });
  function escribirCoordenadas(x, y) {
    if (!campoCoordenadas || !campoCoordenadas.isConnected || campoCoordenadas.disabled || campoCoordenadas.readOnly) return false;
    const p = coordenadasEn(x, y);
    if (p) {
      campoCoordenadas.value = ctx.fmtLugar(p);
      campoCoordenadas.dispatchEvent(new Event("input", { bubbles: true }));
      campoCoordenadas.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }
  function igualesVisibles(id) {
    const e = unidadPorId(id);
    if (!e) return;
    const tipo = (u) => u.clase || `enemigo:${u.tipo}`;
    ctx.seleccionar(unidades().filter(u => tipo(u) === tipo(e) && puntoPantalla(u).visible).map(u => u.id));
  }
  function dobleEnCampo(x, y) {
    clearTimeout(tFicha); ultimoToque = null;
    if (escribirCoordenadas(x, y)) return;
    const id = unidadEn(x, y);
    if (id) igualesVisibles(id);
  }
  $campo.addEventListener("dblclick", (ev) => {
    if (ev.button !== 0 || ev.target.tagName !== "CANVAS") return;
    ev.preventDefault();
    // El doble toque ya se procesa en pointerup, sin depender del clic sintético.
    if (ev.sourceCapabilities && ev.sourceCapabilities.firesTouchEvents) return;
    dobleEnCampo(ev.clientX, ev.clientY);
  });
  function cancelarLargo() { if (largo) { cancelAnimationFrame(largo.raf); clearTimeout(largo.fin); } largo = null; $carga.hidden = true; }
  function cancelarArrastre() {
    cancelarLargo(); arrastreCampo = null; $cajaSeleccion.hidden = true;
  }
  $campo.addEventListener("pointerdown", (ev) => {
    if (ev.target.tagName !== "CANVAS") return;
    ctx.cerrarHoja();
    clearTimeout(tFicha);
    punterosCampo.add(ev.pointerId);
    if (punterosCampo.size > 1) { cancelarArrastre(); ultimoToque = null; return; }
    if (ev.button !== 0) return;
    ev.target.setPointerCapture(ev.pointerId);
    // Evita que el mapa quite el foco al destino de coordenadas.
    if (campoCoordenadas) ev.preventDefault();
    const id = unidadEn(ev.clientX, ev.clientY), tactil = ev.pointerType === "touch";
    // Doble toque en el suelo y, sin soltar el segundo, arrastrar: el cuadro de selección de PC.
    const cajaTactil = tactil && !campoCoordenadas && !!ultimoToque && !ultimoToque.id
      && performance.now() - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 32;
    arrastreCampo = { puntero: ev.pointerId, tactil, cajaTactil, x: ev.clientX, y: ev.clientY, px: ev.clientX, py: ev.clientY, t0: performance.now(), id, modo: null, movido: false, base: ev.shiftKey ? [...ctx.seleccionadas] : [] };
    if (!id || campoCoordenadas || cajaTactil) return;
    const r = $campo.getBoundingClientRect();
    largo = { puntero: ev.pointerId, id, x: ev.clientX, y: ev.clientY, t0: performance.now(), raf: 0 };
    $carga.style.left = `${ev.clientX - r.left}px`; $carga.style.top = `${ev.clientY - r.top}px`; $carga.style.setProperty("--p", 0);
    // El temporizador decide; el anillo solo acompaña (sin fotogramas, la ficha se abre igual).
    largo.fin = setTimeout(() => {
      if (!arrastreCampo || !largo) return;
      const elegido = largo.id;
      arrastreCampo.ficha = true;
      cancelarLargo(); ctx.seleccionar([elegido], { inspeccionar: false });
      ctx.ponerInspector("abierto");
      if (navigator.vibrate) navigator.vibrate(12);
    }, LARGO_MS);
    const tick = (now) => {
      if (!largo) return;
      const u = (now - largo.t0 - 110) / (LARGO_MS - 110);
      if (u > 0) { $carga.hidden = false; $carga.style.setProperty("--p", Math.min(1, u).toFixed(3)); }
      largo.raf = requestAnimationFrame(tick);
    };
    largo.raf = requestAnimationFrame(tick);
  }, true);
  $campo.addEventListener("pointermove", (ev) => {
    const a = arrastreCampo;
    if (!a || a.puntero !== ev.pointerId) return;
    const distancia = Math.hypot(ev.clientX - a.x, ev.clientY - a.y);
    if (distancia > 8) a.movido = true;
    // Con un dedo, arrastrar mueve la cámara salvo que el doble toque haya armado el cuadro.
    if (a.tactil && !a.cajaTactil) {
      if (a.movido && a.modo !== "camara") { a.modo = "camara"; cancelarLargo(); }
    } else if (a.movido) {
      cancelarLargo(); a.modo = "caja";
      const r = $campo.getBoundingClientRect();
      $cajaSeleccion.hidden = false;
      Object.assign($cajaSeleccion.style, { left: `${Math.min(a.x, ev.clientX) - r.left}px`, top: `${Math.min(a.y, ev.clientY) - r.top}px`, width: `${Math.abs(ev.clientX - a.x)}px`, height: `${Math.abs(ev.clientY - a.y)}px` });
    }
    a.px = ev.clientX; a.py = ev.clientY;
  }, true);
  $campo.addEventListener("pointerup", (ev) => {
    punterosCampo.delete(ev.pointerId);
    const a = arrastreCampo;
    if (!a || a.puntero !== ev.pointerId) return;
    if (a.modo === "caja") {
      ctx.seleccionar([...a.base, ...unidades().filter(u => {
        const p = puntoPantalla(u);
        return p.visible && p.x >= Math.min(a.x, ev.clientX) && p.x <= Math.max(a.x, ev.clientX) && p.y >= Math.min(a.y, ev.clientY) && p.y <= Math.max(a.y, ev.clientY);
      }).map(u => u.id)]);
      ultimoToque = null;
    } else if (!a.movido && !a.ficha) {
      if (a.tactil) {
        const ahora = performance.now();
        if (ultimoToque && ahora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 24) dobleEnCampo(ev.clientX, ev.clientY);
        else {
          ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, id: a.id };
          if (!campoCoordenadas) {
            ctx.seleccionar(a.id, { inspeccionar: false });
            tFicha = setTimeout(() => { if (ctx.seleccion) ctx.ponerInspector(ctx.inspectorCompleto() ? "abierto" : "tira"); }, 320);
          }
        }
      } else if (!campoCoordenadas) ctx.seleccionar(a.base.length ? [...a.base, a.id].filter(Boolean) : a.id);
    }
    cancelarArrastre();
  }, true);
  for (const tipo of ["pointercancel", "lostpointercapture"]) $campo.addEventListener(tipo, (ev) => {
    punterosCampo.delete(ev.pointerId);
    if (arrastreCampo && arrastreCampo.puntero === ev.pointerId) cancelarArrastre();
  }, true);
  addEventListener("blur", () => { clearTimeout(tFicha); punterosCampo.clear(); cancelarArrastre(); });


  return {
    cancelarGestosCampo() { clearTimeout(tFicha); cancelarArrastre(); ultimoToque = null; },
    get LARGO_MS() { return LARGO_MS; },
    get $campo() { return $campo; },
    get $carga() { return $carga; },
    get $cajaSeleccion() { return $cajaSeleccion; },
    get punterosCampo() { return punterosCampo; },
    get largo() { return largo; }, set largo(v) { largo = v; },
    get arrastreCampo() { return arrastreCampo; }, set arrastreCampo(v) { arrastreCampo = v; },
    get ultimoToque() { return ultimoToque; }, set ultimoToque(v) { ultimoToque = v; },
    get tFicha() { return tFicha; }, set tFicha(v) { tFicha = v; },
    get campoCoordenadas() { return campoCoordenadas; }, set campoCoordenadas(v) { campoCoordenadas = v; },
    get unidades() { return unidades; },
    get unidadPorId() { return unidadPorId; },
    get puntoPantalla() { return puntoPantalla; },
    get unidadEn() { return unidadEn; },
    get coordenadasEn() { return coordenadasEn; },
    get escribirCoordenadas() { return escribirCoordenadas; },
    get igualesVisibles() { return igualesVisibles; },
    get dobleEnCampo() { return dobleEnCampo; },
    get cancelarLargo() { return cancelarLargo; },
    get cancelarArrastre() { return cancelarArrastre; }
  };
}
