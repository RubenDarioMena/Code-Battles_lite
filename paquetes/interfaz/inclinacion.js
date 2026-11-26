// Deslizador de inclinación de Campaign-V2, a la derecha del campo: abajo, casi a ras del suelo; arriba, desde lo
// alto. Solo aparece con la vista 3D y sigue a la cámara cuando la inclinan los gestos (dos dedos, Mayúsculas +
// rueda, rueda pulsada). La vista lo admite con `inclinacion(valor?)` y `limitesInclinacion` (vista-3d/camara.js).
export function montarInclinacion(ctx, campo) {
  const caja = document.createElement('div');
  caja.className = 'cv2-inclinacion';
  const rango = document.createElement('input');
  rango.type = 'range'; rango.step = '0.01';
  caja.append(rango);
  campo.append(caja);
  const vista = () => ctx.vista === '3d' && typeof ctx.V3?.inclinacion === 'function' ? ctx.V3 : null;
  rango.addEventListener('input', () => vista()?.inclinacion(Number(rango.value)));
  // El campo no debe tomar el arrastre del deslizador como selección o desplazamiento.
  for (const tipo of ['pointerdown', 'wheel', 'dblclick']) caja.addEventListener(tipo, ev => ev.stopPropagation());
  function rotulo() {
    const texto = ctx.ti18n('cv2.ui.inclinacion');
    rango.setAttribute('aria-label', texto); caja.title = texto;
  }
  function sincronizar() {
    const v = vista();
    caja.hidden = !v;
    if (!v) return;
    const [min, max] = v.limitesInclinacion;
    rango.min = String(min); rango.max = String(max);
    if (document.activeElement !== rango) rango.value = String(v.inclinacion());
  }
  // Las vistas se conectan después que la interfaz V2 (iniciar.js): la primera lectura, al terminar la instalación.
  caja.hidden = true; rotulo();
  Promise.resolve().then(sincronizar);
  // Los gestos de la cámara llegan al campo (burbujean desde el lienzo): tras cada uno se lee la inclinación. El
  // reloj lento cubre lo demás (cambio 2D ↔ 3D, vista que se reconstruye); el DOM de las pruebas no tiene reloj.
  const tras = () => sincronizar();
  for (const tipo of ['pointermove', 'pointerup', 'wheel']) campo.addEventListener(tipo, tras, { passive: true });
  const reloj = globalThis.setInterval?.(sincronizar, 500);
  addEventListener('cmg:idioma', rotulo);
  return { sincronizar, destruir() {
    globalThis.clearInterval?.(reloj); removeEventListener('cmg:idioma', rotulo);
    for (const tipo of ['pointermove', 'pointerup', 'wheel']) campo.removeEventListener?.(tipo, tras);
    caja.remove();
  } };
}
