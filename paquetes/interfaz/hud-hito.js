// El mismo HUD acompaña la fábrica inicial y la pantalla de combate.
export function montarHudHito(ctx, campo, acciones) {
  const { $, ti18n: t } = ctx;
  const hud = $('cv2-hud'), mision = $('cv2-objetivo'), menu = $('cv2-menu');
  campo.append(hud);
  hud.hidden = false;
  let anterior = '';
  const mostrar = (panel, boton, si) => {
    panel.hidden = !si;
    $(boton).setAttribute('aria-expanded', String(si));
  };
  function cerrar() {
    mostrar(mision, 'cv2-mision', false);
    mostrar(menu, 'cv2-opciones', false);
  }
  function rotulos() {
    $('cv2-mision').setAttribute('aria-label', t('cv2.ui.mision'));
    $('cv2-mision').title = t('cv2.ui.mision');
    $('cv2-opciones').setAttribute('aria-label', t('cv2.ui.opciones'));
    for (const [id, clave] of [['cv2-ajustes', 'cv2.ui.ajustes'], ['cv2-idioma', 'cv2.ui.idioma'],
      ['cv2-volver', 'cv2.checkpoint'], ['cv2-etiqueta-fuentes', 'cv2.conProgramas'],
      ['cv2-etapa', 'cv2.ui.hito']]) $(id).textContent = t(clave);
    const continuar = $('cv2-continuar');
    continuar.hidden = !!ctx.checkpointsV2;
    continuar.textContent = t('cv2.ui.continuar');
    const url = new URL(location.href);
    for (const clave of ['ensayo', 'modo', 'batalla']) url.searchParams.delete(clave);
    continuar.href = url.href;
    $('cv2-opciones').title = t('cv2.ui.opciones');
    $('cv2-gestos').hidden = !!acciones.fabrica || !!acciones.sinGestos;
    $('cv2-gestos').textContent = acciones.fabrica ? '' : t('cv2.ui.gestos');
    $('cv2-titulo').textContent = acciones.titulo();
    $('cv2-texto').textContent = acciones.texto();
  }
  $('cv2-mision').onclick = () => {
    const abrir = mision.hidden;
    cerrar(); rotulos(); mostrar(mision, 'cv2-mision', abrir);
  };
  $('cv2-opciones').onclick = () => {
    const abrir = menu.hidden;
    cerrar(); rotulos();
    const etapas = acciones.etapas(), selector = $('cv2-checkpoints');
    selector.replaceChildren(...etapas.map(h => {
      const op = document.createElement('option'); op.value = h; op.textContent = h.toUpperCase(); return op;
    }));
    selector.value = acciones.actual();
    $('cv2-con-fuentes').hidden = !ctx.checkpointsV2;
    $('cv2-fuentes').checked = false;
    mostrar(menu, 'cv2-opciones', abrir);
  };
  $('cv2-ajustes').onclick = () => { cerrar(); acciones.ajustes(); };
  $('cv2-idioma').onclick = () => ctx.CMGI18n.cambiarIdioma(ctx.CMGI18n.idioma === 'en' ? 'es' : 'en');
  $('cv2-volver').onclick = () => { cerrar(); acciones.volver($('cv2-checkpoints').value, $('cv2-fuentes').checked); };
  const escapar = ev => { if (ev.key === 'Escape') cerrar(); };
  const fuera = ev => { if (!hud.contains(ev.target)) cerrar(); };
  document.addEventListener('keydown', escapar);
  document.addEventListener('pointerdown', fuera);
  window.addEventListener('cmg:idioma', rotulos);
  cerrar();
  return {
    rotulos,
    metas(filas, destino) {
      const clave = JSON.stringify(filas);
      if (clave === anterior) return false;
      anterior = clave;
      const lista = filas.map(f => {
        const li = document.createElement('li');
        li.textContent = [f.nombre, f.valor, f.meta].filter(v => v !== '' && v != null).join(' · ');
        return li;
      });
      $('cv2-lista-metas').replaceChildren(...lista);
      if (destino) destino.replaceChildren(...filas.map((f, i) => {
        const el = document.createElement('span'); el.className = 'meta'; el.dataset.estado = f.estado;
        el.textContent = lista[i].textContent; return el;
      }));
      return true;
    },
    destruir() {
      document.removeEventListener?.('keydown', escapar);
      document.removeEventListener?.('pointerdown', fuera);
      window.removeEventListener?.('cmg:idioma', rotulos);
      cerrar(); hud.hidden = true;
    },
  };
}
