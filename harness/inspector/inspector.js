(() => {
  const D = window.INSP, raiz = document.getElementById('insp');
  const $ = (s, r = raiz) => r.querySelector(s);
  const h = (tag, props = {}, ...hijos) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of hijos.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
  const ramas = Object.keys(D.ramas);
  const st = { pant: D.bloques[0].id, plat: D.plataformas[0].id, a: ramas[0], comparar: false, inspeccionar: true, grupos: {}, detalle: new Set(), fija: null };
  const otra = () => ramas.find(r => r !== st.a) || st.a;
  const capT = lado => (D.capturas[st.pant]?.[st.plat] || {})[lado === 'a' ? st.a : otra()] || null;
  const cap = lado => { const c = capT(lado); return c && !c.falta ? c : null; };
  const esta = (c, id) => !!c && (c.presentes ? c.presentes.includes(id) : !!c.cajas[id]);
  const bloque = () => D.bloques.find(b => b.id === st.pant);
  const arbol = () => bloque().elementos.flatMap(n => D.elementos[n]);
  const plano = () => { const out = []; const rec = (l, g) => l.forEach(e => { out.push({ ...e, grupo: g }); if (e.hijos) rec(e.hijos, e.id); }); rec(arbol(), null); return out; };
  const esGrupo = id => !!arbol().find(e => e.id === id && e.hijos);

  // Presencia y color: izquierda azul, derecha rojo, ambas morado.
  const pres = (cajaA, cajaB) => ({ a: !!cajaA, b: st.comparar && !!cajaB });
  const color = p => st.comparar ? (p.a && p.b ? 'var(--ab)' : p.a ? 'var(--a)' : p.b ? 'var(--b)' : '') : (p.a ? 'var(--a)' : '');
  const presId = id => ({ a: esta(cap('a'), id), b: st.comparar && esta(cap('b'), id) });
  const piezas = () => { // controles sin describir, unidos por referencia y texto
    const m = new Map();
    for (const lado of st.comparar ? ['a', 'b'] : ['a']) for (const s of cap(lado)?.sin || []) {
      const k = 'p:' + s.ref + '|' + s.t; const v = m.get(k) || { k, ref: s.ref, t: s.t, en: s.en, cajas: {} };
      v.cajas[lado] = s.caja; if (!v.en) v.en = s.en; m.set(k, v);
    }
    return [...m.values()];
  };
  const hojaDe = p => p.en && !esGrupo(p.en) ? p.en : null;

  // ---------- barra ----------
  const selPant = $('#insp-pant'), segPlat = $('#insp-plat'), selRama = $('#insp-rama'), bComp = $('#insp-comparar'), bInsp = $('#insp-inspeccionar');
  [...new Set(D.bloques.map(b => b.grupo))].forEach(g => selPant.append(h('optgroup', { label: g }, D.bloques.filter(b => b.grupo === g).map(b => h('option', { value: b.id }, b.titulo)))));
  ramas.forEach(r => selRama.append(h('option', { value: r }, `${r} · ${D.ramas[r].commit}`)));
  D.plataformas.forEach(p => segPlat.append(h('button', { type: 'button', 'data-id': p.id, 'aria-pressed': String(p.id === st.plat), onclick: () => { st.plat = p.id; todo(); } }, p.titulo)));
  selPant.onchange = () => { st.pant = selPant.value; st.grupos = {}; st.detalle.clear(); st.fija = null; todo(); };
  selRama.onchange = () => { st.a = selRama.value; todo(); };
  bComp.onclick = () => { st.comparar = !st.comparar; todo(); };
  bInsp.onclick = () => { st.inspeccionar = !st.inspeccionar; bInsp.setAttribute('aria-pressed', String(st.inspeccionar)); apagar(); };

  // ---------- pantallas ----------
  const cajasDom = { a: new Map(), b: new Map() };
  function pintarPantallas() {
    raiz.classList.toggle('comparando', st.comparar);
    for (const lado of ['a', 'b']) {
      const fig = $(`.i-p[data-lado=${lado}]`), c = cap(lado), cT = capT(lado); cajasDom[lado] = new Map();
      fig.hidden = lado === 'b' && !st.comparar;
      const lienzo = $('.i-lienzo', fig), pie = $('figcaption', fig);
      const rama = lado === 'a' ? st.a : otra();
      pie.replaceChildren(h('i'), h('b', {}, rama), `${D.ramas[rama].commit}`);
      lienzo.classList.toggle('vacio', !c);
      if (!c) { const plat = D.plataformas.find(p => p.id === st.plat).titulo; lienzo.replaceChildren(h('div', { class: 'i-falta' }, h('b', {}, `${bloque().titulo} no existe en ${rama} · ${plat}`), h('p', {}, cT?.falta || 'Sin captura.'))); continue; }
      const img = h('img', { src: D.imagenes[c.img], alt: `Captura del bloque ${bloque().titulo} en ${rama}`, width: c.w, height: c.h, draggable: 'false' });
      const capa = [img];
      const pon = (k, caja) => { const d = h('div', { class: 'i-caja', style: `left:${caja[0] / c.w * 100}%;top:${caja[1] / c.h * 100}%;width:${caja[2] / c.w * 100}%;height:${caja[3] / c.h * 100}%` }); cajasDom[lado].set(k, d); capa.push(d); };
      for (const [id, caja] of Object.entries(c.cajas)) pon(id, caja);
      for (const s of c.sin) pon('p:' + s.ref + '|' + s.t, s.caja);
      capa.push(h('div', { class: 'i-tip', hidden: true }));
      lienzo.replaceChildren(...capa);
      lienzo.dataset.w = c.w; lienzo.dataset.h = c.h;
    }
  }
  const objetivo = (lado, x, y) => { // el elemento más pequeño bajo el punto
    const c = cap(lado); if (!c) return null; let mejor = null, area = Infinity;
    const prueba = (k, b) => { if (x >= b[0] && y >= b[1] && x <= b[0] + b[2] && y <= b[1] + b[3] && b[2] * b[3] < area) { area = b[2] * b[3]; mejor = k; } };
    for (const [id, b] of Object.entries(c.cajas)) prueba(id, b);
    for (const s of c.sin) prueba('p:' + s.ref + '|' + s.t, s.caja);
    return mejor;
  };
  const punto = (lienzo, ev) => { const r = lienzo.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width * +lienzo.dataset.w, (ev.clientY - r.top) / r.height * +lienzo.dataset.h, ev.clientX - r.left, ev.clientY - r.top]; };
  for (const lado of ['a', 'b']) {
    const lienzo = $(`.i-p[data-lado=${lado}] .i-lienzo`);
    lienzo.addEventListener('pointermove', ev => { if (!st.inspeccionar || ev.pointerType === 'touch') return; const [x, y, px, py] = punto(lienzo, ev); encender(objetivo(lado, x, y), { lado, px, py }); });
    lienzo.addEventListener('pointerleave', () => apagar());
    lienzo.addEventListener('click', ev => { if (!st.inspeccionar) return; const [x, y, px, py] = punto(lienzo, ev); const k = objetivo(lado, x, y); if (k) { seleccionar(k); encender(k, { lado, px, py }); } });
  }

  // ---------- resaltado en las dos direcciones ----------
  let encendidos = [];
  function apagar() { encendidos.forEach(e => e.classList.remove('on')); encendidos = []; raiz.querySelectorAll('.i-tip').forEach(t => t.hidden = true); }
  function encender(k, tip) {
    apagar(); if (!k) return;
    const p = k.startsWith('p:') ? (() => { const v = piezas().find(v => v.k === k); return v ? pres(v.cajas.a, v.cajas.b) : { a: false, b: false }; })() : presId(k);
    for (const lado of ['a', 'b']) { const d = cajasDom[lado].get(k); if (d) { d.style.setProperty('--c', color(p) || 'var(--ab)'); d.classList.add('on'); encendidos.push(d); } }
    const nodo = raiz.querySelector(`[data-k="${CSS.escape(k)}"]`); // tarjeta, pieza o grupo
    if (nodo) { nodo.classList.add('on'); encendidos.push(nodo); const vis = visibleEnLista(nodo); if (vis !== nodo) { vis.classList.add('on'); encendidos.push(vis); } desplazar(vis); }
    if (tip) { const t = $(`.i-p[data-lado=${tip.lado}] .i-tip`); const info = infoDe(k); t.replaceChildren(info.t + ' ', h('code', {}, info.ref)); t.hidden = false; const L = t.parentElement.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
      t.style.left = Math.min(Math.max(tip.px, tw / 2 + 4), L.width - tw / 2 - 4) + 'px';
      t.style.top = (tip.py - th - 10 < 0 ? tip.py + th + 18 : tip.py) + 'px'; }
  }
  const infoDe = k => { if (k.startsWith('p:')) { const v = piezas().find(v => v.k === k); return { t: v?.t || '', ref: v?.ref || '' }; } const e = plano().find(e => e.id === k); return { t: e.t, ref: e.sel.join(', ') }; };
  function visibleEnLista(n) { // lo más cercano que se ve: la tarjeta, o la cabecera del grupo cerrado que la contiene
    let x = n;
    for (let o = x.closest('[hidden]'); o; o = x.closest('[hidden]')) {
      const dueno = o.classList.contains('i-det') ? o.closest('.i-tarjeta') : o.closest('.i-grupo');
      if (!dueno) break; x = dueno.querySelector(':scope > .i-cab');
    }
    return x.matches('.i-tarjeta') ? x.querySelector(':scope > .i-cab') : x;
  }
  function desplazar(n) { const lista = $('.i-lista'); const r = n.getBoundingClientRect(), l = lista.getBoundingClientRect(); if (lista.scrollHeight > lista.clientHeight && (r.top < l.top + 40 || r.bottom > l.bottom)) lista.scrollTop += r.top - l.top - l.height / 3; }

  // Clic en la pantalla: en toda la lista se despliega solo ese elemento.
  function seleccionar(k) {
    let id = k;
    if (k.startsWith('p:')) { const v = piezas().find(v => v.k === k); id = v && hojaDe(v) ? hojaDe(v) : k; }
    const e = plano().find(e => e.id === id);
    st.grupos = {}; st.detalle = new Set([id]);
    if (!e) st.grupos.sin = { foco: id };
    else if (e.grupo) st.grupos[e.grupo] = { foco: id };
    else if (e.hijos) st.grupos[id] = 'abierto';
    st.fija = id; pintarLista(); fijar();
    const nodo = raiz.querySelector(`[data-k="${CSS.escape(id)}"]`); if (nodo) desplazar(nodo);
  }
  function fijar() { raiz.querySelectorAll('.i-caja.fija').forEach(d => d.classList.remove('fija')); if (!st.fija) return; for (const lado of ['a', 'b']) cajasDom[lado].get(st.fija)?.classList.add('fija'); }

  // ---------- lista ----------
  const medida = (c, id) => !c ? 'no existe el bloque' : c.cajas[id] ? `${c.cajas[id][2]}×${c.cajas[id][3]}` : esta(c, id) ? 'fuera de la vista (hay que desplazar)' : 'no está';
  function tarjeta(e, foco) {
    const p = presId(e.id), c = color(p), abierta = st.detalle.has(e.id);
    const det = h('div', { class: 'i-det', hidden: !abierta },
      h('p', {}, h('b', {}, 'Interfaz'), e.ui), h('p', {}, h('b', {}, 'Juego'), e.juego),
      h('p', { style: 'font-family:var(--mono);font-size:.74rem;color:var(--tenue)' }, `${st.a}: ${medida(cap('a'), e.id)}`, st.comparar ? ` · ${otra()}: ${medida(cap('b'), e.id)}` : ''));
    const mias = piezas().filter(v => hojaDe(v) === e.id);
    if (mias.length) det.append(h('div', { class: 'i-piezas' }, mias.map(v => h('span', { class: 'i-pieza', 'data-k': v.k, style: `--c:${color(pres(v.cajas.a, v.cajas.b)) || 'var(--tenue)'}`, title: v.ref, onpointerenter: () => encender(v.k), onpointerleave: apagar }, v.t || v.ref, ' ', h('code', {}, v.ref)))));
    const cab = h('button', { type: 'button', class: 'i-cab', 'aria-expanded': String(abierta), onclick: () => { abierta ? st.detalle.delete(e.id) : st.detalle.add(e.id); pintarLista(); }, onpointerenter: () => encender(e.id), onpointerleave: apagar },
      h('span', { class: 'i-llave' }, abierta ? '▾' : '▸'), h('span', { class: 'i-t' }, e.t), mias.length ? h('span', { class: 'i-cuenta' }, `${mias.length} piezas`) : h('span'), h('span', { class: 'i-ref' }, e.sel.join(', ')));
    const fuera = (p.a || p.b) && !['a', 'b'].some(l => (l === 'a' || st.comparar) && cap(l)?.cajas[e.id]);
    const card = h('li', { class: 'i-tarjeta' + (p.a || p.b ? '' : ' ausente') + (fuera ? ' fuera' : ''), 'data-k': e.id, style: c ? `--c:${c}` : '' }, cab, det);
    if (foco) card.append(h('div', { style: 'padding:0 .6rem .5rem 2.3rem' }, h('button', { type: 'button', class: 'i-cerrar', onclick: () => { st.detalle.delete(e.id); st.grupos[e.grupo] = 'cerrado'; st.fija = null; fijar(); pintarLista(); } }, 'Colapsar este elemento')));
    return card;
  }
  function grupo(e, hijosLi, presente, titulo) {
    const estado = st.grupos[e.id] || 'cerrado', foco = typeof estado === 'object' ? estado.foco : null, abierto = estado !== 'cerrado';
    const p = e.sel ? presId(e.id) : { a: false, b: false }, c = color(p);
    const cab = h('button', { type: 'button', class: 'i-cab', 'data-k': e.id, 'aria-expanded': String(abierto), onclick: () => { st.grupos[e.id] = abierto ? 'cerrado' : 'abierto'; pintarLista(); }, onpointerenter: () => encender(e.id), onpointerleave: apagar },
      h('span', { class: 'i-llave' }, abierto ? '{' : '{…}'), h('span', { class: 'i-t' }, titulo || e.t), h('span', { class: 'i-cuenta' }, presente), e.sel ? h('span', { class: 'i-ref' }, e.sel.join(', ')) : null);
    const ul = h('ul', { class: 'i-hijos', hidden: !abierto });
    let ocultos = 0;
    for (const [id, li] of hijosLi) { if (foco && id !== foco) { li.hidden = true; ocultos++; } ul.append(li); }
    if (foco && ocultos) ul.append(h('li', {}, h('button', { type: 'button', class: 'i-mas', onclick: () => { st.grupos[e.id] = 'abierto'; pintarLista(); } }, `Mostrar los otros ${ocultos}`)));
    if (e.ui && abierto && !foco) ul.prepend(h('li', { class: 'i-det', style: 'padding:.2rem .5rem .3rem' }, h('p', {}, h('b', {}, 'Interfaz'), e.ui), h('p', {}, h('b', {}, 'Juego'), e.juego)));
    return h('li', { class: 'i-grupo', style: c ? `--c:${c}` : '' }, cab, ul, h('div', { class: 'i-cierre', hidden: !abierto }, '}'));
  }
  function pintarLista() {
    const arbolUl = $('.i-arbol'); arbolUl.replaceChildren();
    const cuenta = l => { const n = l.filter(x => { const p = presId(x.id); return p.a || p.b; }).length; return `${n}/${l.length}`; };
    for (const e of arbol()) {
      if (!e.hijos) { arbolUl.append(tarjeta({ ...e, grupo: null }, st.fija === e.id)); continue; }
      const estado = st.grupos[e.id]; const foco = typeof estado === 'object' ? estado.foco : null;
      arbolUl.append(grupo(e, e.hijos.map(x => [x.id, tarjeta({ ...x, grupo: e.id }, foco === x.id)]), cuenta(e.hijos)));
    }
    const sueltas = piezas().filter(v => !hojaDe(v));
    if (sueltas.length) {
      const estado = st.grupos.sin; const foco = typeof estado === 'object' ? estado.foco : null;
      arbolUl.append(grupo({ id: 'sin' }, sueltas.map(v => { const p = pres(v.cajas.a, v.cajas.b);
        return [v.k, h('li', { class: 'i-tarjeta', 'data-k': v.k, style: `--c:${color(p) || 'var(--linea)'}` },
          h('div', { class: 'i-cab', onpointerenter: () => encender(v.k), onpointerleave: apagar }, h('span', { class: 'i-llave' }, '·'), h('span', { class: 'i-t' }, v.t || '(sin texto)'), h('span'), h('span', { class: 'i-ref' }, v.ref)),
          foco === v.k ? h('div', { style: 'padding:0 .6rem .5rem 2.3rem' }, h('button', { type: 'button', class: 'i-cerrar', onclick: () => { st.grupos.sin = 'cerrado'; st.fija = null; fijar(); pintarLista(); } }, 'Colapsar este elemento')) : null)]; }),
        `${sueltas.length}`, 'Sin describir en el manifiesto'));
    }
    const b = bloque(); $('.i-bloque').replaceChildren(h('b', {}, `${b.grupo} · ${b.titulo}`), h('p', {}, b.que));
    const ley = $('.i-leyenda');
    ley.replaceChildren(...(st.comparar
      ? [h('span', { style: '--c:var(--a)' }, h('i'), `solo ${st.a}`), h('span', { style: '--c:var(--b)' }, h('i'), `solo ${otra()}`), h('span', { style: '--c:var(--ab)' }, h('i'), 'en ambas'), h('span', { style: '--c:var(--linea)' }, h('i'), 'en ninguna')]
      : [h('span', { style: '--c:var(--a)' }, h('i'), `visible en ${st.a}`), h('span', { style: '--c:var(--linea)' }, h('i'), 'no visible aquí')]));
  }
  function todo() {
    selPant.value = st.pant; selRama.value = st.a;
    segPlat.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === st.plat)));
    bComp.setAttribute('aria-pressed', String(st.comparar)); $('span', bComp).textContent = `Comparar con ${otra()}`;
    const errs = ['a', 'b'].flatMap(l => (l === 'b' && !st.comparar) ? [] : (capT(l)?.errores || []).map(e => `${l === 'a' ? st.a : otra()}: ${e}`));
    $('.i-errores').textContent = errs.length ? `Errores JS al capturar: ${errs.join(' · ')}` : '';
    pintarPantallas(); pintarLista(); fijar();
  }
  todo();
})();
