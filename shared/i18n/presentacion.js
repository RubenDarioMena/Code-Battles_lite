/* Localización explícita de fragmentos de presentación y diagnósticos heredados.
 * No observa el DOM ni toca programas, valores de la API, simulación o registros guardados. */
(() => {
  'use strict';
  let reglas = [];
  const escaparRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function configurar(mensajes) {
    reglas = Object.entries(mensajes).map(([clave, fuente]) => {
      const nombres = [], partes = []; let inicio = 0;
      for (const m of fuente.matchAll(/\{(p\d+)\}/g)) {
        partes.push(escaparRE(fuente.slice(inicio, m.index)), '([\\s\\S]*?)'); nombres.push(m[1]); inicio = m.index + m[0].length;
      }
      partes.push(escaparRE(fuente.slice(inicio)));
      return { clave, fuente, nombres, re: new RegExp('^' + partes.join('') + '$') };
    }).sort((a, b) => b.fuente.replace(/\{p\d+\}/g, '').length - a.fuente.replace(/\{p\d+\}/g, '').length);
  }
  function resolver(texto) {
    for (const r of reglas) {
      const m = r.re.exec(texto); if (!m) continue;
      return { clave: r.clave, params: Object.fromEntries(r.nombres.map((n, i) => [n, m[i + 1]])) };
    }
    return null;
  }
  function traducir(r) {
    const params = { ...r.params }, fuente = reglas.find(x => x.clave === r.clave)?.fuente || "";
    if (CMGI18n.idioma === 'en' && (fuente.startsWith('Hubo ') || fuente.includes('derribados ·'))) {
      const nombres = { brecha: 'breach', brechas: 'breaches', atasco: 'jam', atascos: 'jams' };
      for (const k of ['p1', 'p5']) if (Object.hasOwn(nombres, params[k])) params[k] = nombres[params[k]];
    }
    return CMGI18n.t(r.clave, params);
  }
  const partesCompuestas = texto => texto.split(/(?<=[.!?])(?=\s+[A-ZÁÉÍÓÚÑ¿¡])/);
  const tieneCompuesto = texto => partesCompuestas(texto).some(p => resolver(p.trim()));
  function traducirCompuesto(original) {
    const directo = resolver(original);
    if (directo) return traducir(directo);
    return original.split(/(?<=[.!?])(?=\s+[A-ZÁÉÍÓÚÑ¿¡])/).map(p => {
      const texto = p.trim(), r = resolver(texto);
      return r ? p.replace(texto, traducir(r)) : p;
    }).join('');
  }
  function rotular(el, original) {
    const r = resolver(String(original));
    delete el.dataset.presentacionClave; delete el.dataset.presentacionParams;
    delete el.dataset.presentacionOriginal;
    if (r) { marcar(el, r); el.textContent = traducir(r); }
    else if (tieneCompuesto(String(original))) { el.dataset.presentacionOriginal = original; el.textContent = traducirCompuesto(original); }
    else el.textContent = original;
  }
  const texto = valor => { const r = resolver(String(valor)); return r ? traducir(r) : String(valor); };
  function marcar(el, r) { el.dataset.presentacionClave = r.clave; el.dataset.presentacionParams = JSON.stringify(r.params); }
  function html(valor) {
    const t = document.createElement('template'); t.innerHTML = valor;
    const walker = document.createTreeWalker(t.content, NodeFilter.SHOW_TEXT), nodos = [];
    while (walker.nextNode()) nodos.push(walker.currentNode);
    for (const n of nodos) {
      const p = n.parentElement;
      if (p && p.closest('code, pre, textarea, input, [data-ins], [data-fin], [data-ins-clase], [data-reto-campo], [data-reto-ui], [data-i18n], [data-ins-i18n-text]')) continue;
      const original = n.nodeValue, limpio = original.trim(), r = resolver(limpio); if (!r && !tieneCompuesto(limpio)) continue;
      const span = document.createElement('span'); if (r) marcar(span, r); else span.dataset.presentacionOriginal = limpio; span.textContent = traducirCompuesto(limpio);
      n.replaceWith(document.createTextNode(original.slice(0, original.indexOf(limpio))), span,
        document.createTextNode(original.slice(original.indexOf(limpio) + limpio.length)));
    }
    for (const el of t.content.querySelectorAll('[title], [aria-label], [alt]')) {
      for (const atributo of ['title', 'aria-label', 'alt']) {
        if (!el.hasAttribute(atributo)) continue;
        const r = resolver(el.getAttribute(atributo)); if (!r) continue;
        el.setAttribute(`data-presentacion-${atributo}`, JSON.stringify(r)); el.setAttribute(atributo, traducir(r));
      }
    }
    return t.innerHTML;
  }
  function actualizar() {
    for (const el of document.querySelectorAll('[data-presentacion-original]')) el.textContent = traducirCompuesto(el.dataset.presentacionOriginal);
    for (const el of document.querySelectorAll('[data-presentacion-clave]'))
      el.textContent = traducir({ clave: el.dataset.presentacionClave, params: JSON.parse(el.dataset.presentacionParams) });
    for (const a of ['title', 'aria-label', 'alt']) for (const el of document.querySelectorAll(`[data-presentacion-${a}]`)) {
      const r = JSON.parse(el.getAttribute(`data-presentacion-${a}`)); el.setAttribute(a, traducir(r));
    }
  }
  window.CMGPresentacion = { configurar, texto, html, actualizar, resolver, rotular, traducirCompuesto };
  window.addEventListener('cmg:idioma', actualizar);
})();
