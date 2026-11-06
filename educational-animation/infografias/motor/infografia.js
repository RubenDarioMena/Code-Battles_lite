/* Infografía animada · motor (Code Battle Lite)
 *
 * Una sola fuente (una "spec" por concepto) produce:
 *   · el reproductor interactivo por pasos (auto-avance, pausa, ‹ ›, puntos, teclado, deslizar, JS/Python), y
 *   · el vídeo determinista (16:9 y 9:16, JS y Python) que captura render.mjs fotograma a fotograma.
 *
 * Todo lo que se mueve vive en UNA línea de tiempo GSAP en pausa. El reproductor la reproduce;
 * el renderizador la posiciona (seek) en cada fotograma. Nada depende del reloj ni de transiciones CSS.
 * Los cambios discretos (texto, valores, puntos, barra) los aplica aplicar(t): función pura del tiempo.
 *
 * Requiere window.gsap (vendor/gsap-3.13.0.min.js). Sin compilación ni dependencias más.
 * Referencia de la spec y de la receta: .claude/skills/infografia-animada/ */
(function (global) {
  'use strict';

  const gsap = global.gsap;
  if (!gsap) throw new Error('Infografía: falta gsap (cargar vendor/gsap-3.13.0.min.js antes).');

  // Tiempos de la coreografía de cada paso (segundos).
  const AJ = {
    intro: 0.9,        // entrada de la tarjeta antes del paso 1
    tr: 0.45,          // foco, anillo y línea
    rValor: 0.22,      // los valores cambian tras mover el foco (causa → efecto)
    rConsola: 0.32,    // la salida aparece después
    rMostrar: 0.3,
    sep: 0.6,          // separación de una secuencia de valores o líneas dentro de un paso
    asentar: 0.8,      // al navegar en pausa se reproduce la entrada del paso hasta aquí
    pps: 2.4,          // palabras por segundo de narración (≈145 ppm) si no hay audio
    plomo: 0.25,       // la voz empieza un poco después del cambio visual
    minPaso: 3.6, maxPaso: 16,
    pensar: 3.2,       // pausa de predicción antes de revelar una pregunta
    verRespuesta: 2.2,
    cola: 0.8,         // final del vídeo
  };

  // Palabras que cambian entre lenguajes. Cada spec puede ampliarlo con su propio "glosario".
  const GLOSARIO = {
    true: { js: 'true', py: 'True' }, false: { js: 'false', py: 'False' }, null: { js: 'null', py: 'None' },
    and: { js: '&&', py: 'and' }, or: { js: '||', py: 'or' }, not: { js: '!', py: 'not' },
    imprimir: { js: 'console.log', py: 'print' }, lenguaje: { js: 'JavaScript', py: 'Python' },
  };

  const LENG = { js: { nombre: 'JavaScript', corto: 'JS' }, py: { nombre: 'Python', corto: 'Python' } };

  const ICONO = {
    grafica: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2v12h12"/><path d="m4.5 10 3-3.5 2.5 2 3.5-4.5"/></svg>',
    prev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>',
    next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 5 5-5 5"/></svg>',
    pausa: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="3" width="3" height="10" rx="1"/><rect x="9.5" y="3" width="3" height="10" rx="1"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.3-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z"/></svg>',
    repetir: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4"/><path d="M2.5 2.5v3.2h3.2"/></svg>',
  };

  // Iconos para valores ({ icono: 'saltar', texto: '…' }). Cada spec puede añadir los suyos en "iconos".
  const ICONOS_VALOR = {
    saltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 0 1 14.5-4.7"/><path d="M19.5 6v5.5H14"/></svg>',
    parar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2Z"/><path d="M8.5 12h7" stroke-linecap="round"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    nada: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 3.5"><circle cx="12" cy="12" r="8"/></svg>',
  };

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Narración: **negrita**, `código` y `código`{tono} (el código toma el color de su papel).
  const md = (s) => esc(s).replace(/`([^`]+)`\{([a-z]+)\}/g, '<code data-tono="$2">$1</code>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const plano = (s) => String(s ?? '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`(\{[a-z]+\})?/g, '$1');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const porLenguaje = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('js' in v || 'py' in v);
  function h(tag, attrs, html) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'style') el.style.cssText = v; else el.setAttribute(k, v === true ? '' : v);
    }
    if (html != null) el.innerHTML = html;
    return el;
  }

  // ---------------------------------------------------------------- resaltado JS / Python
  const KW = {
    js: new Set('let const var if else for while do return function async await new class extends of in break continue switch case default try catch finally throw typeof instanceof this yield import export from delete void'.split(' ')),
    py: new Set('def return if elif else for while in not and or is break continue pass import from as class with try except finally raise lambda global nonlocal async await yield del assert match case'.split(' ')),
  };
  const LIT = { js: new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']), py: new Set(['True', 'False', 'None']) };
  const RE_STR = { js: /^(`(?:\\.|[^`\\])*`?|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)/, py: /^[fFrRbBuU]{0,2}("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)/ };
  const RE_OP = /^(===|!==|==|!=|<=|>=|=>|\*\*|\+\+|--|&&|\|\||\?\?|\+=|-=|\*=|\/=|\/\/|->|[-+*/%<>=!&|^~?:.,;()[\]{}@])/;

  function tokenizar(txt, lang) {
    const out = []; let i = 0; const com = lang === 'py' ? '#' : '//';
    while (i < txt.length) {
      const r = txt.slice(i); let m;
      if (r.startsWith(com)) { out.push({ t: r, c: 'com' }); break; }
      if ((m = RE_STR[lang].exec(r)) && m[0].length && /["'`]/.test(m[0])) out.push({ t: m[0], c: 'str' });
      else if ((m = /^\d[\d_]*(?:\.\d+)?n?/.exec(r))) out.push({ t: m[0], c: 'num' });
      else if ((m = /^[A-Za-z_$À-ɏ][\w$À-ɏ]*/.exec(r))) out.push({ t: m[0], c: 'id' });
      else if ((m = /^\s+/.exec(r))) out.push({ t: m[0], c: null });
      else if ((m = RE_OP.exec(r))) out.push({ t: m[0], c: 'op' });
      else out.push({ t: r[0], c: null });
      i += out[out.length - 1].t.length;
    }
    const sig = (k, d) => { for (let j = k + d; j >= 0 && j < out.length; j += d) if (out[j].c !== null) return out[j]; return null; };
    out.forEach((tk, k) => {
      if (tk.c !== 'id') return;
      if (KW[lang].has(tk.t)) tk.c = 'kw';
      else if (LIT[lang].has(tk.t)) tk.c = 'lit';
      else if (sig(k, 1)?.t === '(') tk.c = 'fn';
      else if (sig(k, -1)?.t === '.') tk.c = 'prop';
      else tk.c = 'var';
    });
    return out;
  }

  // Anclas: [[id|texto]] marca un fragmento que los pasos pueden señalar (marca/linea) en cualquier lenguaje.
  function lineaCodigo(fuente, lang) {
    let txt = '', last = 0, m; const anclas = []; const re = /\[\[([\w-]+)\|(.*?)\]\]/g;
    while ((m = re.exec(fuente))) { txt += fuente.slice(last, m.index); const ini = txt.length; txt += m[2]; anclas.push({ id: m[1], ini, fin: txt.length }); last = re.lastIndex; }
    txt += fuente.slice(last);
    const cortes = new Set([0, txt.length]); anclas.forEach((a) => { cortes.add(a.ini); cortes.add(a.fin); });
    const piezas = []; let pos = 0;
    for (const tk of tokenizar(txt, lang)) {
      const fin = pos + tk.t.length; let a = pos;
      for (let k = pos + 1; k <= fin; k++) if (cortes.has(k) || k === fin) { piezas.push({ t: txt.slice(a, k), c: tk.c, ini: a }); a = k; }
      pos = fin;
    }
    let html = ''; let abierta = null;
    for (const p of piezas) {
      const anc = anclas.find((x) => p.ini >= x.ini && p.ini < x.fin) || null;
      if (anc !== abierta) { if (abierta) html += '</span>'; if (anc) html += `<span class="ig-ancla" data-ancla="${esc(anc.id)}">`; abierta = anc; }
      html += p.c && p.c !== 'id' ? `<span class="tk-${p.c}">${esc(p.t)}</span>` : esc(p.t);
    }
    if (abierta) html += '</span>';
    return { html: html || '​', anclas: anclas.map((a) => a.id) };
  }

  // ---------------------------------------------------------------- instancia
  function montar(destino, spec, opciones = {}) {
    const raiz = typeof destino === 'string' ? document.querySelector(destino) : destino;
    const q = new URLSearchParams(global.location.search);
    const cfg = {
      modo: opciones.modo || q.get('modo') || 'interactivo',
      lang: opciones.lang || q.get('lang') || (spec.lenguajes || ['js'])[0],
      formato: opciones.formato || q.get('formato') || 'auto',
      seguro: (opciones.seguro ?? q.get('seguro')) === '1',
      auto: opciones.auto ?? q.get('auto') !== '0',
      paso: q.has('paso') ? +q.get('paso') - 1 : (opciones.paso ?? null),
      teclado: opciones.teclado || 'tarjeta',
    };
    const video = cfg.modo === 'video';
    const reducido = !video && global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const N = spec.pasos.length;
    const ig = { spec, cfg, raiz, avisos: [], audios: {}, pasoActual: -1, reproduciendo: false, esperando: null, tween: null, formato: null };
    const avisar = (m) => { if (!ig.avisos.includes(m)) { ig.avisos.push(m); console.warn('[infografía] ' + m); } };
    // L(v): resuelve {js, py} y el glosario {{clave}} (true/True, null/None, console.log/print…).
    const glosario = { ...GLOSARIO, ...(spec.glosario || {}) };
    const L = (v) => {
      let r = porLenguaje(v) ? v[cfg.lang] ?? v.js ?? v.py : v;
      if (typeof r === 'string' && r.includes('{{')) r = r.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in glosario ? (porLenguaje(glosario[k]) ? glosario[k][cfg.lang] : glosario[k]) : (avisar(`glosario: falta {{${k}}}`), m)));
      return r;
    };

    // El color identifica el PAPEL (condición, cuerpo, actualización…), no "lo que tiene el foco".
    // roles: { id: tono } se aplica a anclas del código, nodos, salidas, aristas, tarjetas y fichas con ese id.
    const roles = spec.roles || {};
    const tonoDe = (id, explicito) => explicito ?? roles[id] ?? null;
    const iconos = { ...ICONOS_VALOR, ...(spec.iconos || {}) };
    const valorHTML = (v) => {
      v = L(v);
      if (v == null) return '';
      if (typeof v !== 'object') return esc(v);
      const ic = v.icono ? `<span class="ig-icono">${iconos[v.icono] || (avisar(`icono desconocido: ${v.icono}`), '')}</span>` : '';
      return ic + (v.texto != null && v.texto !== '' ? (ic ? `<span class="ig-icono-txt">${esc(L(v.texto))}</span>` : esc(L(v.texto))) : '');
    };

    const voz = video ? null : new Audio();
    if (voz) { voz.preload = 'auto'; voz.dataset.paso = '-1'; }

    // ------------------------------------------------ DOM
    function elegirFormato() {
      if (cfg.formato === 'horizontal' || cfg.formato === 'vertical') return cfg.formato;
      const w = raiz.clientWidth || global.innerWidth, hh = raiz.clientHeight || global.innerHeight;
      return w < 640 || hh > w * 1.05 ? 'vertical' : 'horizontal';
    }

    function panelCodigo(def) {
      const sec = h('section', { class: 'ig-panel ig-codigo', 'data-id': def.id, 'data-grupo': def.id });
      const archivo = L(def.archivo);
      const conCabecera = (def.cabecera && typeof def.cabecera === 'object' ? def.cabecera[ig.formato] : def.cabecera) !== false;
      if (archivo !== false && conCabecera) sec.append(h('div', { class: 'ig-cod-cab' }, `<i></i><i></i><i></i><span>${esc(archivo || (cfg.lang === 'py' ? 'main.py' : 'main.js'))}</span>`));
      const porFormato = (v) => (v && typeof v === 'object' ? v[ig.formato] : v);
      const tam = porFormato(def.tamano), inter = porFormato(def.interlineado);
      const cod = h('div', { class: 'ig-cod', style: (tam ? `font-size:${tam}px;` : '') + (inter ? `line-height:${inter};` : '') || null });
      const fuente = L(def.fuente) ?? ''; const anclas = new Map();
      const tonoAncla = (id) => tonoDe(id, def.tonos?.[id]);
      fuente.replace(/\n$/, '').split('\n').forEach((ln, k) => {
        const r = lineaCodigo(ln, cfg.lang);
        const tonoLinea = r.anclas.map(tonoAncla).find(Boolean);
        const fila = h('div', { class: 'ig-linea', 'data-linea': k + 1, 'data-tono': tonoLinea }, (def.numeros !== false ? `<span class="ig-ln">${k + 1}</span>` : '') + `<span class="ig-lt">${r.html}</span>`);
        r.anclas.forEach((id) => anclas.set(id, k + 1));
        fila.querySelectorAll('.ig-ancla').forEach((a) => { const t = tonoAncla(a.dataset.ancla); if (t) a.dataset.tono = t; });
        cod.append(fila);
      });
      sec.append(cod);
      ig.codigos.push({ def, el: sec, anclas, anillos: new Map(), lineas: [...cod.querySelectorAll('.ig-linea')] });
      return sec;
    }

    function panelFichas(def) {
      const apilar = typeof def.apilar === 'object' ? def.apilar[ig.formato] : def.apilar;
      const sec = h('section', { class: 'ig-panel ig-fichas' + (apilar ? ' ig-apiladas' : ''), 'data-id': def.id });
      for (const f of def.fichas) {
        const raw = L(f.valor); const tono = raw && typeof raw === 'object' ? raw.tono : null;
        sec.append(h('div', { class: 'ig-ficha ig-caja' + (f.foco ? ' ig-f' : ''), 'data-id': f.id, 'data-tono': tonoDe(f.id, f.tono) },
          `<span class="ig-ficha-et">${md(L(f.etiqueta))}</span><span class="ig-ficha-val" data-valor="${esc(f.id)}"${tono ? ` data-tono="${esc(tono)}"` : ''}>${valorHTML(raw ?? '')}</span>`));
      }
      return sec;
    }

    function panelConsola(def) {
      const sec = h('section', { class: 'ig-panel ig-consola', 'data-id': def.id });
      sec.append(h('div', { class: 'ig-cons-cab' }, `<span>${esc(L(def.titulo) || 'Consola')}</span><i class="ig-cursor"></i>`));
      const vista = h('div', { class: 'ig-cons-vista' }); const lst = h('div', { class: 'ig-cons-lista' });
      vista.append(lst); sec.append(vista);
      ig.consolas.push({ def, el: sec, vista, lista: lst });
      return sec;
    }

    function panelFlujo(def) {
      const compacto = typeof def.compacto === 'object' ? def.compacto[ig.formato] : def.compacto;
      const carriles = 1 + Math.max(0, ...(def.aristas || []).filter((e) => e.tipo === 'vuelta').map((e) => e.carril || 0));
      const apretado = typeof def.apretado === 'object' ? def.apretado[ig.formato] : def.apretado;
      const sec = h('section', { class: 'ig-panel ig-flujo' + (compacto ? ' ig-compacto' : '') + (apretado ? ' ig-apretado' : ''), 'data-id': def.id });
      const rej = h('div', { class: 'ig-flujo-rejilla', style: `padding-left:${14 + 10 * carriles}px;` + (def.hueco ? `--hueco:${def.hueco}px` : '') });
      def.nodos.forEach((n, k) => {
        const num = def.numerar === false ? null : (n.num ?? k + 1);
        rej.append(h('div', { class: 'ig-nodo ig-f' + (n.salida ? ' ig-con-salida' : ''), 'data-id': n.id, 'data-grupo': def.id, 'data-tono': tonoDe(n.id, n.tono) },
          (num != null ? `<span class="ig-nodo-num">${esc(num)}</span>` : '') +
          `<span class="ig-nodo-txt"><span class="ig-nodo-tit" data-valor="${esc(n.id)}">${md(L(n.titulo))}</span>${n.detalle ? `<span class="ig-nodo-det">${md(L(n.detalle))}</span>` : ''}</span>`));
        if (n.salida) {
          const s = n.salida;
          const ts = tonoDe(s.id, s.tono) || 'bad';
          rej.append(h('span', { class: 'ig-salida-et ig-f ig-sin-caja', 'data-sigue': s.id, 'data-tono': s.tonoEtiqueta || ts }, md(L(s.etiqueta ?? '{{false}} →'))));
          rej.append(h('div', { class: 'ig-salida ig-f', 'data-id': s.id, 'data-grupo': def.id, 'data-tono': ts }, md(L(s.texto))));
        }
      });
      rej.append(h('div', { class: 'ig-aristas-et' }));
      rej.insertAdjacentHTML('afterbegin', '<svg class="ig-aristas" aria-hidden="true"></svg>');
      sec.append(rej);
      ig.flujos.push({ def, el: sec, rej });
      return sec;
    }

    function panelFila(def) {
      const cols = typeof def.columnas === 'object' ? def.columnas[ig.formato] : def.columnas;
      const sec = h('section', { class: 'ig-panel ig-fila' + (def.lista ? ' ig-lista' : '') + (def.estilo === 'vueltas' ? ' ig-vueltas' : ''), 'data-id': def.id, style: cols ? `--cols:${cols}` : null });
      if (def.titulo) sec.append(h('div', { class: 'ig-fila-tit' }, md(L(def.titulo))));
      for (const it of def.items) {
        const det = L(it.detalle); const tonoDet = det && typeof det === 'object' ? det.tono : it.tonoDetalle;
        const detHTML = det == null ? '' : def.lista
          ? `<span class="ig-chip ig-tarjeta-det" style="font-size:12px;padding:2px 8px" data-valor="${esc(it.id)}"${tonoDet ? ` data-tono="${esc(tonoDet)}"` : ''}>${valorHTML(det)}</span>`
          : `<span class="ig-tarjeta-det" data-valor="${esc(it.id)}"${tonoDet ? ` data-tono="${esc(tonoDet)}"` : ''}>${valorHTML(det)}</span>`;
        sec.append(h('div', { class: 'ig-tarjeta ig-f', 'data-id': it.id, 'data-grupo': def.id, 'data-tono': tonoDe(it.id, it.tono) },
          `<span class="ig-tarjeta-tit">${md(L(it.titulo))}</span>${detHTML}${it.nota ? `<span class="ig-tarjeta-nota">${md(L(it.nota))}</span>` : ''}`));
      }
      return sec;
    }

    function panelExpresion(def) {
      const sec = h('section', { class: 'ig-panel ig-expresion ig-caja', 'data-id': def.id });
      const ex = h('div', { class: 'ig-expr' });
      for (const p of def.partes) {
        const cls = { chip: 'ig-chip', op: 'ig-op', flecha: 'ig-flecha', texto: '' }[p.tipo || 'chip'];
        ex.append(h('span', { class: cls, 'data-id': p.id, 'data-valor': p.id, 'data-tono': p.tono }, esc(L(p.texto))));
      }
      sec.append(ex);
      if (def.nota) sec.append(h('div', { class: 'ig-expr-nota' }, md(L(def.nota))));
      return sec;
    }

    function panelHTML(def) {
      const sec = h('section', { class: 'ig-panel' + (def.caja ? ' ig-caja' : ''), 'data-id': def.id }, L(def.html));
      sec.querySelectorAll('[data-foco]').forEach((el) => el.classList.add('ig-f'));
      return sec;
    }

    const PANELES = { codigo: panelCodigo, fichas: panelFichas, consola: panelConsola, flujo: panelFlujo, fila: panelFila, expresion: panelExpresion, html: panelHTML };

    function crearDOM() {
      ig.formato = elegirFormato();
      ig.codigos = []; ig.consolas = []; ig.flujos = []; ig.preguntas = {};
      raiz.innerHTML = '';
      const encaje = h('div', { class: 'ig-encaje' });
      const lz = h('div', { class: 'ig', 'data-modo': cfg.modo, 'data-formato': ig.formato, 'data-seguro': cfg.seguro ? '1' : null, 'data-lang': cfg.lang, tabindex: video ? null : '0', role: 'region', 'aria-label': plano(L(spec.titulo)) });
      const leng = spec.lenguajes || ['js'];
      const selector = !video && leng.length > 1
        ? `<span class="ig-selector" role="group" aria-label="Lenguaje">${leng.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === cfg.lang}">${LENG[l].corto}</button>`).join('')}</span>`
        : `<span class="ig-lenguaje">${LENG[cfg.lang]?.nombre || cfg.lang}</span>`;
      const cab = h('header', { class: 'ig-cab' }, `<span class="ig-insignia">${ICONO.grafica}${esc(L(spec.insignia) || 'Infografía')}</span>${selector}<span class="ig-contador"></span>`);
      const titulo = h('h2', { class: 'ig-titulo' }, md(L(spec.titulo)));
      const escena = h('main', { class: 'ig-escena' });
      const E = spec.escena;
      const areas = (f) => lista(E.areas?.[f]).map((a) => `"${a}"`).join(' ');
      if (E.areas?.horizontal) escena.style.setProperty('--areas-h', areas('horizontal'));
      if (E.areas?.vertical) escena.style.setProperty('--areas-v', areas('vertical'));
      for (const k of ['columnas', 'filas']) for (const f of ['horizontal', 'vertical']) if (E[k]?.[f]) escena.style.setProperty(`--${k}-${f[0]}`, E[k][f]);
      const nombradas = E.areas?.[ig.formato] ? new Set(lista(E.areas[ig.formato]).join(' ').split(/\s+/)) : null;
      for (const def of E.paneles) {
        const fn = PANELES[def.tipo]; if (!fn) { avisar(`panel desconocido: ${def.tipo}`); continue; }
        const el = fn(def); el.style.gridArea = def.area || def.id; escena.append(el);
        if (nombradas && !nombradas.has(def.area || def.id)) el.classList.add('ig-fuera');
      }
      // Preguntas: una capa por paso que la tenga.
      spec.pasos.forEach((p, i) => {
        if (!p.pregunta) return;
        const pq = p.pregunta;
        const el = h('div', { class: 'ig-pregunta' + (pq.posicion === 'arriba' ? ' ig-preg-arriba' : ''), 'data-sobre': pq.sobre, role: 'group', 'aria-label': 'Pregunta' }, `<div class="ig-preg-et"><span>${esc(L(pq.etiqueta) || 'Predice')}</span><span class="ig-preg-espera"></span></div>`);
        const ops = h('div', { class: 'ig-preg-ops' });
        const botones = lista(L(pq.opciones)).map((o, k) => h('button', { type: 'button', class: 'ig-opcion ig-f', 'data-tono': 'neutro', 'data-k': k, tabindex: video ? '-1' : null }, md(o)));
        ops.append(...botones); el.append(ops); escena.append(el);
        ig.preguntas[i] = { el, ops: botones, correcta: L(pq.correcta), espera: el.querySelector('.ig-preg-espera'), respondida: false, elegida: null };
      });
      const pie = h('footer', { class: 'ig-pie' });
      const texto = h('div', { class: 'ig-texto', 'aria-live': video ? null : 'polite' });
      const puntos = h('div', { class: 'ig-puntos', role: 'tablist', 'aria-label': 'Pasos' });
      for (let i = 0; i < N; i++) puntos.append(h('button', { type: 'button', class: 'ig-punto', 'data-i': i, 'aria-label': `Paso ${i + 1}`, tabindex: video ? '-1' : null }));
      const botones = h('div', { class: 'ig-botones' },
        `<button type="button" class="ig-btn" data-accion="prev" aria-label="Paso anterior">${ICONO.prev}</button>` +
        `<button type="button" class="ig-btn" data-accion="alternar" aria-label="Pausar">${ICONO.pausa}</button>` +
        `<button type="button" class="ig-btn" data-accion="next" aria-label="Paso siguiente">${ICONO.next}</button>`);
      const mandos = h('div', { class: 'ig-mandos' }); mandos.append(puntos, botones);
      pie.append(texto, mandos);
      const barra = h('div', { class: 'ig-barra' }, '<i></i>');
      lz.append(cab, titulo, escena, pie, barra);
      encaje.append(lz); raiz.append(encaje);
      Object.assign(ig, { encaje, lienzo: lz, cab, titulo, escena, pie, texto, puntos: [...puntos.children], btn: Object.fromEntries([...botones.children].map((b) => [b.dataset.accion, b])), barra: barra.firstChild, contador: cab.querySelector('.ig-contador'), cursores: [...lz.querySelectorAll('.ig-cursor')] });
      if (!video) conectarMandos();
    }

    // ------------------------------------------------ geometría (tras fuentes y maquetación)
    function escala() { const r = ig.lienzo.getBoundingClientRect(); return r.width / ig.lienzo.offsetWidth || 1; }
    function rel(el, ref) {
      const s = escala(), a = el.getBoundingClientRect(), b = ref.getBoundingClientRect();
      return { x: (a.left - b.left) / s - ref.clientLeft, y: (a.top - b.top) / s - ref.clientTop, w: a.width / s, h: a.height / s };
    }

    function dibujarAristas(fl) {
      const { def, rej } = fl; const svg = rej.querySelector('svg'); const capa = rej.querySelector('.ig-aristas-et');
      svg.innerHTML = ''; capa.innerHTML = '';
      const nodo = (id) => rej.querySelector(`.ig-nodo[data-id="${CSS.escape(id)}"]`);
      const ex = def.aristas || [];
      const camino = (d, e) => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
        if (e?.id) { p.setAttribute('class', 'ig-f'); p.dataset.id = e.id; p.dataset.grupo = def.id; const t = tonoDe(e.id, e.tono); if (t) p.dataset.tono = t; }
        else p.setAttribute('class', 'ig-fija');
        svg.append(p);
      };
      const etiqueta = (e, x, y) => {
        if (!e?.etiqueta) return;
        capa.append(h('span', { class: 'ig-arista-et ig-f ig-sin-caja', 'data-sigue': e.id, 'data-tono': tonoDe(e.id, e.tono) || 'foco', style: `left:${x}px;top:${y}px` }, md(L(e.etiqueta))));
      };
      const N2 = def.nodos;
      for (let k = 0; k < N2.length - 1; k++) {
        const a = nodo(N2[k].id), b = nodo(N2[k + 1].id); if (!a || !b) continue;
        const e = ex.find((x) => x.de === N2[k].id && x.a === N2[k + 1].id && (x.tipo || 'abajo') === 'abajo');
        const ra = rel(a, rej), rb = rel(b, rej); const x = ra.x + (def.numerar === false ? 20 : 26.5), y1 = ra.y + ra.h + 2, y2 = rb.y - 2;
        camino(`M${x} ${y1}V${y2}M${x - 4} ${y2 - 5}L${x} ${y2}L${x + 4} ${y2 - 5}`, e);
        etiqueta(e, x + 9, (y1 + y2) / 2);
      }
      for (const e of ex.filter((x) => x.tipo === 'vuelta')) {
        const a = nodo(e.de), b = nodo(e.a); if (!a || !b) { avisar(`arista ${e.id}: nodo inexistente`); continue; }
        // Carriles: varias vueltas (p. ej. el final del cuerpo y un continue) no se pisan.
        const carril = e.carril || 0, nCar = 1 + Math.max(0, ...ex.filter((x) => x.tipo === 'vuelta' && x.a === e.a).map((x) => x.carril || 0));
        const ra = rel(a, rej), rb = rel(b, rej); const xl = 6 + carril * 10, r = 7;
        const ya = ra.y + ra.h / 2, yb = rb.y + rb.h / 2 + (carril - (nCar - 1) / 2) * 9, xa = ra.x - 2, xb = rb.x - 3;
        camino(`M${xa} ${ya}H${xl + r}Q${xl} ${ya} ${xl} ${ya - r}V${yb + r}Q${xl} ${yb} ${xl + r} ${yb}H${xb}M${xb - 5} ${yb - 4}L${xb} ${yb}L${xb - 5} ${yb + 4}`, e);
        if (e.etiqueta) etiqueta(e, xl + 4, (ya + yb) / 2);
      }
    }

    function medir() {
      for (const fl of ig.flujos) dibujarAristas(fl);
      ig.focos = new Map();
      ig.lienzo.querySelectorAll('.ig-f[data-id]').forEach((el) => {
        const id = el.dataset.id; const grupo = el.dataset.grupo || el.closest('.ig-panel')?.dataset.id || 'global';
        if (!ig.focos.has(id)) ig.focos.set(id, { els: [], grupo }); ig.focos.get(id).els.push(el);
      });
      ig.lienzo.querySelectorAll('[data-sigue]').forEach((el) => { const f = ig.focos.get(el.dataset.sigue); if (f) f.els.push(el); else avisar(`data-sigue sin destino: ${el.dataset.sigue}`); });
      ig.valores = new Map();
      ig.lienzo.querySelectorAll('[data-valor]').forEach((el) => ig.valores.set(el.dataset.valor, el));
      // Pregunta "sobre" un panel: tapa solo ese panel (arriba o abajo), no toda la escena.
      ig.escena.querySelectorAll('.ig-pregunta[data-sobre]').forEach((q) => {
        const panel = ig.escena.querySelector(`.ig-panel[data-id="${CSS.escape(q.dataset.sobre)}"]`);
        if (!panel || panel.classList.contains('ig-fuera')) { if (!panel) avisar(`pregunta sobre "${q.dataset.sobre}": panel inexistente`); return; }
        const r = rel(panel, ig.escena);
        Object.assign(q.style, { left: `${r.x}px`, right: 'auto', width: `${r.w}px`, minHeight: `${r.h}px` });
        if (q.classList.contains('ig-preg-arriba')) Object.assign(q.style, { top: `${r.y}px`, bottom: 'auto' });
        else Object.assign(q.style, { bottom: `${ig.escena.clientHeight - r.y - r.h}px`, top: 'auto' });
      });
      // Un anillo por ancla, del color de su papel: varios pueden estar encendidos a la vez.
      for (const cp of ig.codigos) {
        cp.anillos.forEach((r) => r.remove()); cp.anillos = new Map();
        cp.el.querySelectorAll('.ig-ancla').forEach((a) => {
          const id = a.dataset.ancla; if (cp.anillos.has(id)) return;
          const r = rel(a, cp.el); const anillo = h('div', { class: 'ig-anillo', 'data-ancla': id, 'data-tono': a.dataset.tono });
          cp.el.append(anillo);
          gsap.set(anillo, { x: r.x - 4, y: r.y - 1, width: r.w + 8, height: r.h + 2, transformOrigin: '50% 50%' });
          cp.anillos.set(id, anillo);
        });
      }
    }

    // ------------------------------------------------ tiempos (voz real o estimación)
    function duracionAudio(url) {
      return new Promise((res) => {
        const a = new Audio(); let fin = false; const ok = (d) => { if (!fin) { fin = true; res(d); } };
        a.preload = 'metadata'; a.onloadedmetadata = () => ok(Number.isFinite(a.duration) ? a.duration : null); a.onerror = () => ok(null);
        setTimeout(() => ok(null), 4000); a.src = url;
      });
    }
    async function cargarAudios() {
      if (ig.audios[cfg.lang]) return;
      const plantilla = L(spec.audio); const out = [];
      if (plantilla) {
        await Promise.all(spec.pasos.map(async (p, i) => {
          const url = plantilla.replace('{lang}', cfg.lang).replace('{n}', String(i + 1).padStart(2, '0'));
          const d = await duracionAudio(url); out[i] = d ? { url, dur: d } : null;
        }));
      }
      ig.audios[cfg.lang] = out;
    }
    function calcularTiempos() {
      const audios = ig.audios[cfg.lang] || []; let t = AJ.intro; ig.tiempos = [];
      spec.pasos.forEach((p, i) => {
        const palabras = plano(L(p.texto)).split(/\s+/).filter(Boolean).length;
        let d = L(p.duracion) ?? (audios[i] ? audios[i].dur + AJ.plomo + 0.7 : clamp(1.4 + palabras / AJ.pps, AJ.minPaso, AJ.maxPaso));
        // Que quepan las secuencias del paso (valores y consola, con su desfase "en" si lo tienen).
        const offs = [...lista(L(p.consola)).map((x, k) => x?.en ?? AJ.rConsola + k * AJ.sep),
          ...Object.values(p.valores || {}).flatMap((v) => lista(L(v)).map((x, k) => x?.en ?? AJ.rValor + k * AJ.sep))];
        d = Math.max(d, Math.max(0, ...offs) + 1.8);
        let revelar = null;
        if (p.pregunta) { revelar = d + AJ.pensar; d = revelar + AJ.verRespuesta; }
        ig.tiempos.push({ inicio: t, dur: d, revelar, audio: audios[i] || null, texto: plano(L(p.texto)) });
        t += d;
      });
      ig.duracion = t + AJ.cola;
    }

    // ------------------------------------------------ línea de tiempo
    function construirLinea() {
      ig.tl?.kill();
      const tl = gsap.timeline({ paused: true, onUpdate: () => aplicar(tl.time()), onComplete: () => { if (!video) { ig.reproduciendo = false; actualizarBoton(); vozPausa(); } } });
      ig.tl = tl; const T = ig.tiempos;

      // Estado inicial
      ig.focos.forEach((f) => gsap.set(f.els, { '--on': 0, '--hecho': 0 }));
      ig.codigos.forEach((cp) => { gsap.set(cp.lineas, { '--on': 0 }); gsap.set([...cp.anillos.values()], { autoAlpha: 0 }); cp.marcas = new Set(); cp.lineasOn = new Set(); });
      const hechos = new Set();
      Object.values(ig.preguntas).forEach((pq) => { gsap.set(pq.el, { autoAlpha: 0, y: 8 }); gsap.set(pq.ops, { '--on': 1 }); });
      const mostrables = new Set(spec.pasos.flatMap((p) => lista(L(p.mostrar))));
      mostrables.forEach((id) => { const els = elementos(id); els.forEach((e) => e.classList.add('ig-mostrable')); gsap.set(els, { '--vis': 0 }); });

      // Entrada
      tl.from([ig.cab, ig.titulo, ...ig.escena.querySelectorAll(':scope > .ig-panel'), ig.pie], { autoAlpha: 0, y: 10, duration: 0.5, stagger: 0.07, ease: 'power2.out' }, 0);

      // Consola: líneas pre-creadas para conocer su altura y desplazar la vista sin medir durante el vídeo.
      const cons = ig.consolas[0];
      const lineasPorPaso = spec.pasos.map((p) => lista(L(p.consola)));
      if (cons) {
        cons.lista.innerHTML = '';
        lineasPorPaso.forEach((ls, i) => ls.forEach((x, k) => cons.lista.append(h('div', { class: 'ig-cons-linea', 'data-paso': i, 'data-k': k }, esc(typeof x === 'object' ? x.texto : x)))));
        gsap.set(cons.lista.children, { autoAlpha: 0, y: 6 });
      } else if (lineasPorPaso.some((l) => l.length)) avisar('hay líneas de consola pero ningún panel consola');
      let consScroll = 0;

      ig.eventosValor = new Map(); ig.valorInicial = new Map();
      ig.valores.forEach((el, id) => { ig.eventosValor.set(id, []); ig.valorInicial.set(id, { texto: el.textContent, tono: el.dataset.tono || null, html: el.innerHTML }); });
      let foco = new Map();

      spec.pasos.forEach((p, i) => {
        const t0 = T[i].inicio;
        if (i > 0) tl.fromTo(ig.texto, { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out', immediateRender: false }, t0);

        // Foco: dentro de cada grupo tocado, quedan encendidos exactamente los listados.
        if (p.foco !== undefined || p.apagar) {
          const ids = lista(L(p.foco)); const nuevo = new Map(foco);
          const grupos = new Set(ids.map((id) => ig.focos.get(id)?.grupo).filter(Boolean));
          ig.focos.forEach((f, id) => { if (grupos.has(f.grupo)) nuevo.set(id, 0); });
          ids.forEach((id) => (ig.focos.has(id) ? nuevo.set(id, 1) : avisar(`paso ${i + 1}: foco "${id}" no existe`)));
          lista(L(p.apagar)).forEach((id) => nuevo.set(id, 0));
          ig.focos.forEach((f, id) => { const a = foco.get(id) || 0, b = nuevo.get(id) || 0; if (a !== b) tl.to(f.els, { '--on': b, duration: AJ.tr, ease: 'power2.out' }, t0); });
          foco = nuevo;
        }

        // Hecho: lo ya recorrido queda a plena luz (sin borde de color). Acumulativo.
        lista(L(p.hecho)).forEach((id) => {
          const f = ig.focos.get(id); if (!f) { avisar(`paso ${i + 1}: hecho "${id}" no existe`); return; }
          if (!hechos.has(id)) { tl.to(f.els, { '--hecho': 1, duration: AJ.tr }, t0); hechos.add(id); }
        });

        // Marcas: anillos sobre fragmentos del código, cada uno del color de su papel. Varias a la vez.
        if (p.marca !== undefined) {
          const ids = lista(L(p.marca));
          ids.forEach((id) => { if (!ig.codigos.some((cp) => cp.anillos.has(id))) avisar(`paso ${i + 1}: marca "${id}" no está en el código ${cfg.lang}`); });
          for (const cp of ig.codigos) {
            const nuevas = new Set(ids.filter((id) => cp.anillos.has(id)));
            cp.anillos.forEach((anillo, id) => {
              const a = cp.marcas.has(id), b = nuevas.has(id);
              if (b && !a) tl.fromTo(anillo, { autoAlpha: 0, scale: 1.18 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'power2.out', immediateRender: false }, t0);
              else if (a && !b) tl.to(anillo, { autoAlpha: 0, duration: 0.25 }, t0);
            });
            cp.marcas = nuevas;
          }
        }

        // Líneas resaltadas: números o anclas (la misma ancla vale en JS y en Python). Toman el color de su ancla.
        if (p.linea !== undefined) {
          const vals = lista(L(p.linea));
          vals.forEach((v) => { if (typeof v !== 'number' && v && !ig.codigos.some((c) => c.anclas.has(v))) avisar(`paso ${i + 1}: linea "${v}" no es un ancla`); });
          for (const cp of ig.codigos) {
            const nuevas = new Set();
            vals.forEach((v) => { if (typeof v === 'number') { if (cp === ig.codigos[0]) nuevas.add(v); } else if (v && cp.anclas.has(v)) nuevas.add(cp.anclas.get(v)); });
            cp.lineas.forEach((el, k) => { const a = cp.lineasOn.has(k + 1), b = nuevas.has(k + 1); if (a !== b) tl.to(el, { '--on': b ? 1 : 0, duration: AJ.tr }, t0); });
            cp.lineasOn = nuevas;
          }
        }

        // Valores: cambio discreto (aplicar) + golpe de escala. Un array = secuencia dentro del paso.
        for (const [id, v] of Object.entries(p.valores || {})) {
          const el = ig.valores.get(id); if (!el) { avisar(`paso ${i + 1}: valor "${id}" no existe`); continue; }
          lista(L(v)).forEach((x, k) => {
            const val = x && typeof x === 'object' ? x : { texto: String(x) }; const tv = t0 + (val.en ?? AJ.rValor + k * AJ.sep);
            ig.eventosValor.get(id).push({ t: tv, html: valorHTML(val), tono: val.tono ?? null });
            tl.fromTo(el, { scale: 1.2 }, { scale: 1, duration: 0.42, ease: 'back.out(2.2)', immediateRender: false }, tv);
          });
        }

        // Consola
        if (cons) lineasPorPaso[i].forEach((x, k) => {
          const ln = cons.lista.querySelector(`[data-paso="${i}"][data-k="${k}"]`); const tv = t0 + (x?.en ?? AJ.rConsola + k * AJ.sep);
          tl.to(ln, { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out' }, tv);
          // Desplaza por líneas completas: nunca queda una línea cortada arriba.
          const alto = ln.offsetHeight, sobra = ln.offsetTop + alto - (cons.vista.clientHeight - 6);
          const fondo = sobra > 0 ? Math.ceil(sobra / alto) * alto : 0;
          if (fondo > consScroll) { tl.to(cons.lista, { y: -fondo, duration: 0.3, ease: 'power2.out' }, tv); consScroll = fondo; }
        });

        lista(L(p.mostrar)).forEach((id) => tl.fromTo(elementos(id), { '--vis': 0, y: 6 }, { '--vis': 1, y: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, t0 + AJ.rMostrar));
        lista(L(p.ocultar)).forEach((id) => tl.to(elementos(id), { '--vis': 0, duration: 0.3 }, t0));

        // Pregunta: aparece, deja pensar y revela. En interactivo el reproductor espera la respuesta.
        const pq = ig.preguntas[i];
        if (pq) {
          tl.to(pq.el, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, t0 + 0.35);
          const tr = t0 + T[i].revelar;
          pq.ops.forEach((op, k) => tl.to(op, { '--on': k === pq.correcta ? 1 : 0, duration: 0.35 }, tr));
          tl.fromTo(pq.ops[pq.correcta], { scale: 1.12 }, { scale: 1, duration: 0.45, ease: 'back.out(2.5)', immediateRender: false }, tr);
          if (i < N - 1) tl.to(pq.el, { autoAlpha: 0, y: 8, duration: 0.25 }, T[i + 1].inicio);
        }
      });
      ig.eventosValor.forEach((evs) => evs.sort((a, b) => a.t - b.t));
      tl.set({}, {}, ig.duracion); // la duración incluye la última pausa de lectura
      // Intervalos con movimiento: el render captura todos sus fotogramas y reutiliza los de las pausas.
      ig.intervalos = tl.getChildren(false, true, false).filter((c) => c.duration() > 0).map((c) => [c.startTime(), c.startTime() + c.totalDuration()]);
      for (const ev of ig.eventosValor.values()) for (const e of ev) ig.intervalos.push([e.t, e.t + 0.05]);
    }

    function elementos(id) {
      const els = [...ig.lienzo.querySelectorAll(`[data-id="${CSS.escape(id)}"]`)];
      if (!els.length) avisar(`mostrar/ocultar: "${id}" no existe`);
      return els;
    }

    // ------------------------------------------------ estado discreto en función de t
    function pasoEn(t) { let i = 0; for (let k = 0; k < N; k++) if (t >= ig.tiempos[k].inicio - 1e-6) i = k; return i; }
    function aplicar(t) {
      const T = ig.tiempos; const i = pasoEn(t);
      if (i !== ig.pasoActual) {
        ig.pasoActual = i;
        ig.texto.innerHTML = `<span class="ig-num">${i + 1}.</span>${md(L(spec.pasos[i].texto))}`;
        ig.contador.textContent = `${i + 1}/${N}`;
        ig.puntos.forEach((p, k) => { p.classList.toggle('ig-actual', k === i); p.classList.toggle('ig-visto', k < i); p.setAttribute('aria-current', k === i ? 'step' : 'false'); });
        if (!video) { ig.btn.prev.disabled = i === 0; ig.btn.next.disabled = i === N - 1; }
      }
      ig.eventosValor.forEach((evs, id) => {
        let v = ig.valorInicial.get(id); for (const e of evs) { if (t >= e.t) v = e; else break; }
        if (v === ig.valorAplicado?.get(id)) return;
        const el = ig.valores.get(id);
        el.innerHTML = v.html;
        if (v.tono) el.dataset.tono = v.tono; else delete el.dataset.tono;
        if (el.classList.contains('ig-ficha-val')) el.classList.toggle('ig-largo', el.textContent.length > 9);
        (ig.valorAplicado ||= new Map()).set(id, v);
      });
      ig.barra.style.transform = `scaleX(${clamp((t - T[i].inicio) / T[i].dur, 0, 1)})`;
      ig.cursores.forEach((c) => { c.style.opacity = Math.floor(t * 1.8) % 2 === 0 ? 1 : 0.15; });
      for (const [k, pq] of Object.entries(ig.preguntas)) {
        const tr = T[k].inicio + T[k].revelar; const revelada = t >= tr - 1e-6;
        pq.ops.forEach((op, j) => {
          op.dataset.tono = revelada && j === pq.correcta ? 'ok' : 'neutro';
          op.classList.toggle('ig-elegida', pq.respondida && j === pq.elegida);
          op.classList.toggle('ig-mal', pq.respondida && j === pq.elegida && j !== pq.correcta);
        });
        if (+k === i) {
          const resta = tr - t; const contando = video || (ig.reproduciendo && ig.esperando == null);
          pq.espera.textContent = revelada ? (pq.respondida && pq.elegida != null ? (pq.elegida === pq.correcta ? '¡Bien!' : 'Era esta') : '')
            : contando ? (resta <= AJ.pensar ? `Piénsalo… ${Math.max(1, Math.ceil(resta))}` : '') : 'Elige una respuesta';
        }
      }
      if (!video) { vozSincronizar(t, i); vigilarPregunta(t, i); }
    }

    // ------------------------------------------------ reproductor interactivo
    function matarTween() { ig.tween?.kill(); ig.tween = null; }
    function asentarEn(i) { const T = ig.tiempos[i]; return T.inicio + Math.min(AJ.asentar, T.revelar != null ? T.revelar - 0.05 : AJ.asentar); }
    function ir(t) { ig.tl.seek(t, true); aplicar(t); }
    function irA(i, { animar = true } = {}) {
      i = clamp(i, 0, N - 1); matarTween(); vozPausa();
      const pq = ig.preguntas[i]; if (pq) { pq.respondida = false; pq.elegida = null; }
      const t0 = ig.tiempos[i].inicio;
      if (ig.reproduciendo) { ir(t0); ig.tl.play(); }
      else if (!animar || reducido) ir(asentarEn(i));
      else { ir(t0); ig.tween = ig.tl.tweenTo(asentarEn(i), { ease: 'none', onUpdate: () => aplicar(ig.tl.time()) }); }
    }
    function reproducir() {
      matarTween();
      if (ig.esperando != null) { const pq = ig.preguntas[ig.esperando]; pq.respondida = true; pq.elegida = null; ig.esperando = null; } // continuar = saltar la pregunta
      if (ig.tl.time() >= ig.duracion - 0.05) ir(0);
      ig.reproduciendo = true; ig.tl.play(); actualizarBoton();
    }
    function pausar() { ig.reproduciendo = false; ig.esperando = null; ig.tl.pause(); matarTween(); vozPausa(); actualizarBoton(); }
    function alternar() { if (ig.reproduciendo) pausar(); else reproducir(); }
    function actualizarBoton() {
      if (video || !ig.btn) return;
      const fin = !ig.reproduciendo && ig.tl && ig.tl.time() >= ig.duracion - 0.05;
      ig.btn.alternar.innerHTML = ig.reproduciendo ? ICONO.pausa : fin ? ICONO.repetir : ICONO.play;
      ig.btn.alternar.setAttribute('aria-label', ig.reproduciendo ? 'Pausar' : fin ? 'Repetir' : 'Reproducir');
    }
    function vigilarPregunta(t, i) {
      const pq = ig.preguntas[i]; if (!pq || pq.respondida || !ig.reproduciendo || ig.esperando === i) return;
      const tr = ig.tiempos[i].inicio + ig.tiempos[i].revelar;
      if (t >= tr - 0.03 && t < tr + 0.25) {
        ig.esperando = i; ig.tl.pause(); vozPausa(); const tw = tr - 0.03; ig.tl.seek(tw, true); aplicar(tw);
        pq.ops[0]?.focus({ preventScroll: true });
      }
    }
    function responder(i, k) {
      const pq = ig.preguntas[i]; if (!pq || pq.respondida) return;
      pq.respondida = true; pq.elegida = k; ig.esperando = null;
      const tr = ig.tiempos[i].inicio + ig.tiempos[i].revelar;
      if (ig.tl.time() < tr - 0.5) ig.tl.seek(tr - 0.03, true);
      if (ig.reproduciendo) ig.tl.play();
      else { matarTween(); ig.tween = ig.tl.tweenTo(tr + 0.6, { ease: 'none', onUpdate: () => aplicar(ig.tl.time()) }); }
      aplicar(ig.tl.time());
    }
    // Voz por paso (audio/{lang}/NN.*): se sincroniza con el tiempo de la línea.
    function vozSincronizar(t, i) {
      const a = ig.tiempos[i].audio; if (!voz || !ig.reproduciendo || !a || ig.esperando != null) return;
      if (voz.dataset.paso !== String(i)) { voz.pause(); voz.src = a.url; voz.dataset.paso = String(i); voz.dataset.empezado = ''; }
      const off = t - ig.tiempos[i].inicio - AJ.plomo;
      if (!voz.dataset.empezado && off >= 0 && off < a.dur) { voz.currentTime = off; voz.play().catch(() => {}); voz.dataset.empezado = '1'; }
    }
    function vozPausa() { if (voz) { voz.pause(); voz.dataset.empezado = ''; voz.dataset.paso = '-1'; } }

    function conectarMandos() {
      const lz = ig.lienzo;
      lz.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b || !lz.contains(b)) return;
        if (b.dataset.accion === 'prev') irA(ig.pasoActual - 1);
        else if (b.dataset.accion === 'next') irA(ig.pasoActual + 1);
        else if (b.dataset.accion === 'alternar') alternar();
        else if (b.classList.contains('ig-punto')) irA(+b.dataset.i);
        else if (b.classList.contains('ig-opcion')) responder(ig.pasoActual, +b.dataset.k);
        else if (b.dataset.lang && b.dataset.lang !== cfg.lang) cambiarLenguaje(b.dataset.lang);
      });
      const teclas = (e) => {
        if (e.target.closest?.('input,textarea,select')) return;
        if (e.key === 'ArrowRight') { irA(ig.pasoActual + 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { irA(ig.pasoActual - 1); e.preventDefault(); }
        else if ((e.key === ' ' || e.key === 'k') && !e.target.closest?.('button')) { alternar(); e.preventDefault(); }
        else if (e.key === 'Home') irA(0); else if (e.key === 'End') irA(N - 1);
      };
      (cfg.teclado === 'documento' ? document : lz).addEventListener('keydown', teclas);
      let x0 = null, y0 = null;
      lz.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
      lz.addEventListener('pointerup', (e) => {
        if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
        if (Math.abs(dx) > 45 && Math.abs(dy) < 40) irA(ig.pasoActual + (dx < 0 ? 1 : -1));
      });
    }

    // ------------------------------------------------ encaje y reconstrucción
    function encajar() {
      const W = ig.lienzo.offsetWidth, H = ig.lienzo.offsetHeight;
      const cw = raiz.clientWidth, ch = raiz.clientHeight || cw * (H / W);
      const s = video ? 1 : Math.min(cw / W, ch / H);
      ig.lienzo.style.transform = `translate(-50%, -50%) scale(${s})`;
    }
    let listoFuentes = null;
    async function construir() {
      crearDOM(); encajar();
      listoFuentes ||= document.fonts?.ready || Promise.resolve();
      await listoFuentes;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      medir(); await cargarAudios(); calcularTiempos(); construirLinea();
      ig.pasoActual = -1; ig.valorAplicado = new Map();
      ir(0);
    }
    async function cambiarLenguaje(l) {
      const i = ig.pasoActual; const seguia = ig.reproduciendo; pausar(); cfg.lang = l; await construir();
      irA(i, { animar: false }); if (seguia) reproducir(); else actualizarBoton();
      ig.lienzo.querySelector(`.ig-selector [data-lang="${l}"]`)?.focus({ preventScroll: true });
    }

    const listo = (async () => {
      await construir();
      if (video) return;
      const ro = new ResizeObserver(() => {
        encajar();
        if (cfg.formato === 'auto' && elegirFormato() !== ig.formato) {
          const i = ig.pasoActual; const seguia = ig.reproduciendo; pausar();
          construir().then(() => { irA(i, { animar: false }); if (seguia) reproducir(); });
        }
      });
      ro.observe(raiz);
      if (cfg.paso != null) irA(cfg.paso, { animar: false });
      else if (cfg.auto && !reducido) reproducir();
      else irA(0, { animar: false });
      actualizarBoton();
      if (cfg.teclado === 'documento') ig.lienzo.focus({ preventScroll: true });
    })();

    const api = {
      listo,
      get avisos() { return ig.avisos.slice(); },
      info: () => ({ id: spec.id, lang: cfg.lang, formato: ig.formato, duracion: ig.duracion, intervalos: ig.intervalos, pasos: ig.tiempos.map((t) => ({ inicio: t.inicio, duracion: t.dur, revelar: t.revelar, texto: t.texto, audio: t.audio })), avisos: ig.avisos.slice(), ajustes: { ...AJ } }),
      seek: (t) => ir(t),
      irA, reproducir, pausar, cambiarLenguaje,
      get paso() { return ig.pasoActual; },
    };
    if (video || opciones.global !== false) global.__infografia = api;
    return api;
  }

  global.Infografia = { montar, tokenizar, AJUSTES: AJ };
})(window);
