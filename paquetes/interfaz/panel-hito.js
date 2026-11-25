import { montarHudHito } from './hud-hito.js';

export function montarInterfazHito(ctx, { crearFicha, volver }) {
  const { $, ti18n: t } = ctx;
  $('app').dataset.uiHito = 'true';
  $('progs').hidden = true;
  $('cv2-unidades').hidden = false;
  const etapa = () => ctx.partida.mundo.hito;
  const hud = montarHudHito(ctx, $('campo'), {
    titulo: () => ctx.textoReto('titulo'), texto: () => etapa() === 'b1' ? t('cv2.b1.texto') : ctx.textoReto('objetivo'),
    etapas: () => ctx.batallasV2.etapas,
    actual: () => ctx.checkpointsV2?.ultimo()?.hito ?? etapa(),
    ajustes: () => $('b-ajustes').click(), volver,
  });
  let ultimaLista, casillas = [];
  $('cv2-unidades').addEventListener('toggle', () => { if ($('cv2-unidades').open) arbol(); });
  $('cv2-unidades').addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { $('cv2-unidades').open = false; $('cv2-arbol-titulo').focus(); }
  });
  function casilla(texto, ids, clase, contenedor) {
    const fila = document.createElement('div'), label = document.createElement('label');
    fila.className = clase;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      const seleccion = new Set(ctx.seleccionadas);
      for (const id of ids) if (input.checked) seleccion.add(id); else seleccion.delete(id);
      ctx.seleccionar([...seleccion], { inspeccionar: 'conservar' });
    });
    label.append(input, texto); fila.append(label);
    contenedor.append(fila); casillas.push({ input, ids });
    return fila;
  }
  function arbol() {
    const unidades = ctx.unidades();
    const ausentes = ctx.mundo.ausentes ?? [];
    const clave = JSON.stringify([ausentes, ctx.CMGI18n?.idioma, unidades.map(e => [e.id, e.clase || e.tipo]), ctx.vinculos.datos]);
    if (clave !== ultimaLista) {
      ultimaLista = clave; casillas = [];
      const lista = $('cv2-arbol'); lista.replaceChildren();
      casilla(t('cv2.ui.todas'), unidades.map(e => e.id), 'cv2-todas', lista);
      const tipos = new Map();
      for (const e of unidades) {
        const tipo = e.clase || e.tipo;
        if (!tipos.has(tipo)) tipos.set(tipo, []);
        tipos.get(tipo).push(e.id);
      }
      for (const [tipo, ids] of tipos) {
        casilla(t('cv2.tipo.' + tipo), ids, 'cv2-tipo', lista);
        for (const id of ids) {
          const fila = casilla(id, [id], 'cv2-unidad', lista);
          const otros = ctx.vinculos.miembros(id).filter(u => u !== id);
          if (!otros.length) continue;
          const boton = document.createElement('button');
          boton.type = 'button'; boton.textContent = t('cv2.ui.desvincular');
          boton.setAttribute('aria-label', t('cv2.ui.separar', { id }));
          const vinculo = document.createElement('small'); vinculo.textContent = '↔ ' + otros.join(', ');
          fila.append(vinculo, boton);
          boton.addEventListener('click', () => ctx.vinculos.desvincular(id));
        }
      }
      for (const u of ausentes) {
        const fila = document.createElement('div');
        fila.className = 'cv2-unidad cv2-ausente';
        fila.setAttribute('aria-disabled', 'true');
        fila.textContent = t('cv2.reaparece', { id: u.id, n: u.segundos });
        lista.append(fila);
      }
    }
    $('cv2-arbol-titulo').textContent = t('cv2.ui.unidades', { n: ctx.seleccionadas.size });
    for (const { input, ids } of casillas) {
      const n = ids.filter(id => ctx.seleccionadas.has(id)).length;
      input.checked = n > 0 && n === ids.length; input.indeterminate = n > 0 && n < ids.length;
    }
  }
  let retrato, retratoId;
  function ficha(e) {
    const canvas = $('cv2-modelo');
    if (!e) { canvas.hidden = true; retrato?.pausar(); retratoId = null; return; }
    if (retratoId === e.id) return;
    retratoId = e.id;
    canvas.hidden = false;
    retrato ??= crearFicha(canvas);
    if (retrato) retrato.mostrar(e);
    else canvas.hidden = true;
  }
  window.addEventListener('cmg:idioma', () => { if (ctx.mundo) arbol(); });
  const barras = new Map();
  function vida(enemigos, vista, off) {
    const vivos = new Set();
    for (const e of enemigos) {
      vivos.add(e.id);
      let barra = barras.get(e.id);
      if (!barra) {
        barra = document.createElement('span'); barra.className = 'cv2-vida';
        barra.setAttribute('aria-hidden', 'true'); $('capa').append(barra); barras.set(e.id, barra);
      }
      const p = vista.proyectar(e.x + off * e.vx, e.z + .65, e.y + off * e.vy, .72);
      barra.hidden = !p.visible;
      barra.style.left = p.x + 'px'; barra.style.top = p.y + 'px';
      barra.style.setProperty('--vida', String(e.hp / e.hpMax));
      barra.dataset.herida = String(e.hp < e.hpMax);
      barra.dataset.elegida = String(ctx.seleccionadas.has(e.id));
    }
    for (const [id, barra] of barras) if (!vivos.has(id)) { barra.remove(); barras.delete(id); }
  }
  return { arbol, ficha, vida, rotulos: hud.rotulos, metas(filas) {
    const m = ctx.mundo;
    if (!filas.some(f => f.k === 'atascos')) filas.push({ nombre: t('cv2.ui.atascos'), valor: m.atascos });
    if (!filas.some(f => f.k === 'tiempo')) filas.push({ nombre: t('cv2.ui.tiempo'), valor: t('cv2.ui.segundos', { n: Math.floor(m.t) }) });
    if ($('cv2-unidades').open) arbol();
    return hud.metas(filas, $('metas'));
  } };
}
