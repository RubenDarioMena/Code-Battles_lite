// Mando táctil sobre el campo: joystick semitransparente abajo a la izquierda (desplaza la cámara), un botón en
// cada esquina inferior del joystick (clic izquierdo y derecho) y una zona de ratón a la derecha que mueve un
// cursor. Los clics salen como eventos de ratón sobre el lienzo que queda bajo el cursor, así que la selección,
// el recuadro, apuntar arrastrando y las órdenes con clic derecho son los mismos que con un ratón de verdad.
const ID_RATON = 7071;
const SENSIBILIDAD = 1.6;
const VELOCIDAD = 9; // píxeles de arrastre por fotograma con el joystick a fondo

/** @param {HTMLElement} campo contenedor del lienzo (posición relativa)
 * @param {{ desplazar(dx: number, dy: number): void, almacen?: { leer(k: string): string | null, escribir(k: string, v: string): void },
 *   textos?: Record<string, string> }} opciones */
export function montarMandoTactil(campo, { desplazar, almacen, textos = {} }) {
  const t = k => textos[k] ?? ({ ocultar: 'Ocultar mando', mostrar: 'Mostrar mando', izq: 'Clic izquierdo', der: 'Clic derecho', raton: 'Ratón' })[k];
  const el = (tag, clase, padre, attrs = {}) => {
    const e = document.createElement(tag);
    e.className = clase;
    Object.assign(e, attrs);
    padre.append(e);
    return e;
  };
  // Capturar el dedo mantiene los eventos en su control aunque salga de él; un puntero sintético no se deja.
  const capturar = (e, ev) => { try { e.setPointerCapture(ev.pointerId); } catch { /* Puntero sintético. */ } };
  const raiz = el('div', 'mando-tactil', campo);
  const joystick = el('div', 'mando-joystick', raiz);
  const palanca = el('div', 'mando-palanca', joystick);
  const izq = el('button', 'mando-boton mando-izq', raiz, { type: 'button', textContent: 'L', title: t('izq') });
  const der = el('button', 'mando-boton mando-der', raiz, { type: 'button', textContent: 'R', title: t('der') });
  const zona = el('div', 'mando-raton', raiz, { title: t('raton') });
  el('span', 'mando-raton-texto', zona, { textContent: t('raton') });
  const cursor = el('div', 'mando-cursor', campo);
  const alternar = el('button', 'mando-alternar', campo, { type: 'button' });
  for (const b of [izq, der, alternar]) b.setAttribute('aria-label', b.title);

  // Cursor en coordenadas del campo; arranca en el centro.
  const pos = { x: 0, y: 0, puesto: false };
  const rect = () => campo.getBoundingClientRect();
  function colocarCursor() {
    const r = rect();
    if (!pos.puesto && r.width) Object.assign(pos, { x: r.width / 2, y: r.height / 2, puesto: true });
    pos.x = Math.min(r.width - 1, Math.max(0, pos.x));
    pos.y = Math.min(r.height - 1, Math.max(0, pos.y));
    cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  }

  // Clics del ratón virtual sobre el lienzo que hay bajo el cursor (el mando queda por encima, así que se busca el
  // primer CANVAS del campo en ese punto).
  const pulsados = new Map();
  function lienzoBajoCursor(x, y) {
    return document.elementsFromPoint(x, y).find(e => e.tagName === 'CANVAS' && campo.contains(e)) ?? null;
  }
  function emitir(tipo, objetivo, boton) {
    const r = rect(), x = r.left + pos.x, y = r.top + pos.y;
    const botones = [...pulsados.keys()].reduce((s, b) => s | (b === 2 ? 2 : 1), 0);
    objetivo.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, composed: true, pointerId: ID_RATON,
      pointerType: 'mouse', isPrimary: true, button: boton, buttons: botones, clientX: x, clientY: y }));
  }
  function pulsar(boton, ev) {
    ev.preventDefault(); ev.stopPropagation();
    if (pulsados.has(boton)) return;
    colocarCursor();
    const r = rect(), objetivo = lienzoBajoCursor(r.left + pos.x, r.top + pos.y);
    if (!objetivo) return;
    pulsados.set(boton, objetivo);
    emitir('pointerdown', objetivo, boton);
  }
  function soltar(boton) {
    const objetivo = pulsados.get(boton);
    if (!objetivo) return;
    pulsados.delete(boton);
    emitir('pointerup', objetivo, boton);
  }
  for (const [b, boton] of [[izq, 0], [der, 2]]) {
    b.addEventListener('pointerdown', ev => { capturar(b, ev); b.classList.add('activo'); pulsar(boton, ev); });
    for (const tipo of ['pointerup', 'pointercancel']) b.addEventListener(tipo, () => { b.classList.remove('activo'); soltar(boton); });
    b.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  // Zona de ratón: el arrastre relativo mueve el cursor; con un botón pulsado, el lienzo recibe el movimiento
  // (recuadro de selección, apuntar arrastrando).
  let dedo = null;
  zona.addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation();
    capturar(zona, ev);
    dedo = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    colocarCursor();
  });
  zona.addEventListener('pointermove', ev => {
    if (!dedo || ev.pointerId !== dedo.id) return;
    pos.x += (ev.clientX - dedo.x) * SENSIBILIDAD;
    pos.y += (ev.clientY - dedo.y) * SENSIBILIDAD;
    dedo.x = ev.clientX; dedo.y = ev.clientY;
    colocarCursor();
    const objetivo = pulsados.values().next().value;
    if (objetivo) emitir('pointermove', objetivo, -1);
  });
  for (const tipo of ['pointerup', 'pointercancel']) zona.addEventListener(tipo, ev => { if (dedo?.id === ev.pointerId) dedo = null; });

  // Joystick: mientras se mantiene, desplaza la cámara cada fotograma en la dirección de la palanca.
  const RADIO = 42;
  let palo = null, bucle = 0;
  const vector = { x: 0, y: 0 };
  function mover(ev) {
    const r = joystick.getBoundingClientRect();
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIO) { dx *= RADIO / d; dy *= RADIO / d; }
    vector.x = dx / RADIO; vector.y = dy / RADIO;
    palanca.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function paso() {
    if (!palo) { bucle = 0; return; }
    const m = Math.hypot(vector.x, vector.y);
    // Zona muerta pequeña y respuesta progresiva: precisión cerca del centro, velocidad a fondo.
    if (m > .12) {
      const k = VELOCIDAD * Math.pow((m - .12) / .88, 1.5) / m;
      desplazar(-vector.x * k, -vector.y * k);
    }
    bucle = requestAnimationFrame(paso);
  }
  joystick.addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation();
    capturar(joystick, ev);
    palo = ev.pointerId;
    joystick.classList.add('activo');
    mover(ev);
    if (!bucle) bucle = requestAnimationFrame(paso);
  });
  joystick.addEventListener('pointermove', ev => { if (ev.pointerId === palo) mover(ev); });
  for (const tipo of ['pointerup', 'pointercancel']) joystick.addEventListener(tipo, ev => {
    if (ev.pointerId !== palo) return;
    palo = null; vector.x = vector.y = 0;
    palanca.style.transform = '';
    joystick.classList.remove('activo');
  });

  // Mostrar u ocultar; se recuerda entre visitas. Por omisión, visible en pantallas táctiles.
  const CLAVE = 'cv2-mando';
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const forzado = new URLSearchParams(location.search).get('mando');
  let visible = forzado != null ? forzado !== '0' : (almacen?.leer(CLAVE) ?? (tactil ? '1' : '0')) === '1';
  function mostrar(si) {
    visible = si;
    raiz.hidden = cursor.hidden = !si;
    alternar.textContent = si ? '✕' : '🕹';
    alternar.title = t(si ? 'ocultar' : 'mostrar');
    alternar.setAttribute('aria-label', alternar.title);
    alternar.classList.toggle('abierto', si);
    if (!si) { for (const b of [...pulsados.keys()]) soltar(b); palo = null; dedo = null; }
    else colocarCursor();
  }
  alternar.addEventListener('click', ev => {
    ev.stopPropagation();
    mostrar(!visible);
    try { almacen?.escribir(CLAVE, visible ? '1' : '0'); } catch { /* Sin almacén. */ }
  });
  alternar.addEventListener('pointerdown', ev => ev.stopPropagation());
  mostrar(visible);
  const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (visible) colocarCursor(); }) : null;
  observador?.observe(campo);

  return {
    mostrar, get visible() { return visible; }, cursor: () => ({ ...pos }),
    destruir() { cancelAnimationFrame(bucle); observador?.disconnect(); raiz.remove(); cursor.remove(); alternar.remove(); },
  };
}
