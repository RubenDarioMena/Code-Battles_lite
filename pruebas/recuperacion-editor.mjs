// Arnés externo: importar desde ego-browser nodejs. No se carga desde el juego.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { diferenciaUso } from './uso-tokens.mjs';

// Función autocontenida: se instala solo en la página de QA y sobrevive a las rondas de Ego.
function instalar(config) {
  const url = new URL(location.href);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '8771' ||
      !decodeURIComponent(url.pathname).startsWith('/Prototypes/Rocket Launcher/')) {
    throw new Error('El ciclo solo funciona en Rocket Launcher, localhost:8771.');
  }
  if (window.__qaRecuperacion) {
    if (JSON.stringify(window.__qaRecuperacion.config) !== JSON.stringify(config)) throw new Error('Ya existe otro ciclo en esta página.');
    return window.__qaRecuperacion.estado();
  }
  const editor = document.querySelector(config.editor);
  if (!(editor instanceof HTMLTextAreaElement)) throw new Error('No se encontró el textarea del editor. Actualiza el adaptador.');
  let semilla = 2166136261;
  for (const c of config.semilla) semilla = Math.imul(semilla ^ c.charCodeAt(0), 16777619) >>> 0;
  const q = window.__qaRecuperacion = {
    config, rng: semilla || 1, actual: null, resumenes: [],
    version: { url: location.href, agente: navigator.userAgent,
      recursos: [...document.querySelectorAll('script[src],link[rel="stylesheet"]')].map(e => e.src || e.href) },
    entero(n) {
      let s = this.rng; s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      this.rng = s >>> 0;
      return Math.floor(this.rng / 4294967296 * n);
    },
    foto() {
      const e = document.querySelector(config.editor);
      if (e !== editor) throw new Error('El editor fue reemplazado: reinicia el ciclo.');
      let sintaxis = null;
      if (window.acorn) {
        try { window.acorn.parse(e.value, { ecmaVersion: 2022, allowAwaitOutsideFunction: true }); sintaxis = { valida: true }; }
        catch (err) { sintaxis = { valida: false, mensaje: err.message, posicion: err.pos }; }
      }
      return { codigo: e.value, seleccion: [e.selectionStart, e.selectionEnd], direccion: e.selectionDirection,
        scroll: [e.scrollLeft, e.scrollTop], soloLectura: e.readOnly, sintaxis,
        viewport: { ancho: innerWidth, alto: innerHeight, escala: visualViewport?.scale ?? 1 },
        clasesApp: document.querySelector('#app')?.className,
        programa: [...document.querySelectorAll('.prog-tab[aria-pressed="true"]')].map(e => e.dataset.id) };
    },
    registrar(tipo, datos = {}) {
      if (!this.actual) return;
      const a = this.actual;
      const evento = { orden: ++a.secuencia, ms: Math.round(performance.now() - a.inicio), fase: a.fase, tipo, ...datos };
      if (a.traza.length < 300) a.traza.push(evento); else a.trazaTruncada = true;
    },
    estado() {
      const a = this.actual;
    return { sesion: this.sesion, semilla: config.semilla, completados: this.resumenes.length, maxIntentos: config.intentos,
        intento: a && { numero: a.numero, ejercicio: a.ejercicio, fase: a.fase, umbral: a.umbral,
          clicsPrevios: a.clicsPrevios, clicsReparacion: a.clicsReparacion, pendiente: a.pendiente,
          perturbacion: a.perturbacion && { punto: a.perturbacion.punto, boton: a.perturbacion.boton }, limite: a.clicsReparacion >= config.maxClics ||
            (performance.now() - a.inicio) / 1000 >= config.maxSegundos } };
    },
    botones() {
      const ruta = el => {
        if (el.id) return '#' + CSS.escape(el.id);
        const partes = [];
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          if (n.id) { partes.unshift('#' + CSS.escape(n.id)); break; }
          const hermanos = [...n.parentElement.children].filter(h => h.tagName === n.tagName);
          partes.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + (hermanos.indexOf(n) + 1) + ')');
        }
        return partes.join(' > ');
      };
      return [...document.querySelectorAll(config.botones)].filter(b => {
        const descripcion = [b.id, b.textContent, b.getAttribute('aria-label'), b.title, ...Object.values(b.dataset)].join(' ');
        return b instanceof HTMLButtonElement && !b.disabled && b.getAttribute('aria-disabled') !== 'true' &&
          b.getClientRects().length && getComputedStyle(b).visibility === 'visible' &&
          !/copiar|pegar|copy|paste|clipboard|portapapeles/i.test(descripcion);
      }).map(b => ({ selector: ruta(b), nombre: b.getAttribute('aria-label') || b.title || b.textContent.trim(), datos: { ...b.dataset } }));
    },
    punto() {
      // La UI sin teclado dibuja fichas encima del textarea; pulsar su texto real.
      const vista = document.querySelector('#bloques');
      if (vista && !vista.hidden && getComputedStyle(vista).display !== 'none') {
        const candidatos = [], rango = document.createRange(), r = vista.getBoundingClientRect();
        for (const pieza of vista.querySelectorAll('span[data-a]')) {
          const texto = pieza.firstChild;
          if (!texto || texto.nodeType !== Node.TEXT_NODE) continue;
          for (let i = 0; i < texto.length; i++) {
            const longitud = texto.data.codePointAt(i) > 0xffff ? 2 : 1;
            rango.setStart(texto, i); rango.setEnd(texto, i + longitud);
            for (const c of rango.getClientRects()) {
              const x = c.left + c.width / 2, y = c.top + c.height / 2;
              if (c.width > 0 && x > r.left && x < r.right && y > r.top && y < r.bottom &&
                  x > 0 && x < innerWidth && y > 0 && y < innerHeight &&
                  pieza.contains(document.elementFromPoint(x, y))) {
                candidatos.push({ offset: +pieza.dataset.a + i, caracter: texto.data.slice(i, i + longitud), x, y });
              }
            }
            if (longitud === 2) i++;
          }
        }
        if (!candidatos.length) throw new Error('No hay caracteres visibles y pulsables en las fichas.');
        const p = candidatos[this.entero(candidatos.length)], prefijo = editor.value.slice(0, p.offset);
        return { ...p, linea: prefijo.split('\n').length, columna: p.offset - prefijo.lastIndexOf('\n'), candidatos: candidatos.length };
      }
      // Espejo independiente del hit testing del juego. Incluye wrapping, tabs, scroll y zoom CSS.
      if (!editor.value.length || editor.value.length > 20000) throw new Error('Se requiere código de 1–20000 caracteres.');
      const r = editor.getBoundingClientRect(), cs = getComputedStyle(editor), espejo = document.createElement('div');
      for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'padding', 'whiteSpace',
        'overflowWrap', 'wordBreak', 'tabSize', 'letterSpacing', 'fontVariantLigatures', 'textAlign', 'textIndent']) espejo.style[k] = cs[k];
      Object.assign(espejo.style, { position: 'fixed', left: `${r.left + editor.clientLeft}px`, top: `${r.top + editor.clientTop}px`,
        width: `${editor.clientWidth}px`, height: `${editor.clientHeight}px`, boxSizing: 'border-box', border: '0',
        overflow: 'hidden', opacity: '0', pointerEvents: 'none' });
      const texto = document.createTextNode(editor.value); espejo.append(texto); document.body.append(espejo);
      espejo.scrollTop = editor.scrollTop; espejo.scrollLeft = editor.scrollLeft;
      const rango = document.createRange(), candidatos = [];
      try {
        for (let i = 0; i < texto.length; i++) {
          if (/[\r\n]/.test(texto.data[i])) continue;
          // No partir un par UTF-16; el offset registrado sigue siendo el usado por textarea.
          const longitud = texto.data.codePointAt(i) > 0xffff ? 2 : 1;
          rango.setStart(texto, i); rango.setEnd(texto, i + longitud);
          for (const c of rango.getClientRects()) {
            const x = c.left + c.width / 2, y = c.top + c.height / 2;
            if (c.width > 0 && x > r.left && x < r.right && y > r.top && y < r.bottom &&
                document.elementFromPoint(x, y) === editor) candidatos.push({ offset: i, caracter: texto.data.slice(i, i + longitud), x, y });
          }
          if (longitud === 2) i++;
        }
      } finally { espejo.remove(); }
      if (!candidatos.length) throw new Error('No hay caracteres visibles y pulsables. Revisa overlays y desplazamiento.');
      const p = candidatos[this.entero(candidatos.length)], prefijo = editor.value.slice(0, p.offset);
      return { ...p, linea: prefijo.split('\n').length, columna: p.offset - prefijo.lastIndexOf('\n'), candidatos: candidatos.length };
    }
  };
  document.addEventListener('click', ev => {
    const a = q.actual;
    if (!a || !ev.isTrusted || !(ev.target instanceof Element) || !ev.target.closest(config.area)) return;
    const b = ev.target.closest('button');
    q.registrar('clic', { x: ev.clientX, y: ev.clientY, detalle: ev.detail,
      elemento: b ? { nombre: b.getAttribute('aria-label') || b.textContent.trim(), id: b.id, datos: { ...b.dataset } } : ev.target.tagName, antes: q.foto() });
    if (a.fase === 'espera') { a.clicsPrevios++; if (a.clicsPrevios >= a.umbral) a.pendiente = true; }
    if (a.fase === 'reparacion') a.clicsReparacion++;
  }, true);
  for (const tipo of ['keydown', 'paste', 'drop', 'input']) document.addEventListener(tipo, ev => {
    if (!q.actual || !['espera', 'reparacion'].includes(q.actual.fase) ||
        !(ev.target instanceof Element) || !ev.target.closest(config.area)) return;
    q.registrar(tipo, { confiable: ev.isTrusted, tecla: ev.key, entrada: ev.inputType, despues: q.foto() });
    if (ev.isTrusted && ['keydown', 'paste'].includes(tipo)) q.actual.usoTeclado = true;
  }, true);
  window.addEventListener('error', ev => q.registrar('error', { mensaje: ev.message }));
  window.addEventListener('unhandledrejection', ev => q.registrar('promesa-rechazada', { mensaje: String(ev.reason) }));
  q.sesion = crypto.randomUUID(); // Identificador del log; no participa en el RNG de las perturbaciones.
  return q.estado();
}

const hash = texto => createHash('sha256').update(texto).digest('hex');

export async function conectarCiclo(page, opciones = {}) {
  const config = { semilla: 'rocket-piloto-v1', intentos: 10, maxClics: 40, maxSegundos: 180, modalidad: 'piloto',
    editor: '#codigo', botones: '#paleta button.atajo[data-i]', area: '#editor, #paleta, #simbolos, #acciones-edicion, #edicion, #bloques',
    ...opciones.config };
  if (!Number.isInteger(config.intentos) || config.intentos < 1 || config.intentos > 100 ||
      !Number.isInteger(config.maxClics) || config.maxClics < 1 || !Number.isFinite(config.maxSegundos) || config.maxSegundos < 1 ||
      typeof config.semilla !== 'string' || !config.semilla || !['piloto', 'calibracion'].includes(config.modalidad)) throw new Error('Configuración del ciclo inválida.');
  const uso = opciones.leerUso || (async () => null);
  const inicial = await page.evaluate(instalar, config);
  const directorio = resolve(opciones.directorio || fileURLToPath(new URL(`../.qa-recuperacion/${inicial.sesion}/`, import.meta.url)));
  try {
    const anterior = JSON.parse(await readFile(join(directorio, 'resumen.json'), 'utf8'));
    if (anterior.sesion !== inicial.sesion) {
      if (!opciones.reanudar || inicial.intento || inicial.completados || JSON.stringify(anterior.config) !== JSON.stringify(config) ||
          !Number.isInteger(anterior.rngSiguiente)) throw new Error('El directorio contiene otra sesión. Usa uno nuevo o reanuda explícitamente entre intentos.');
      await page.evaluate(anterior => {
        const q = window.__qaRecuperacion;
        q.sesion = anterior.sesion; q.resumenes = anterior.intentos; q.rng = anterior.rngSiguiente;
      }, anterior);
      inicial.sesion = anterior.sesion;
    }
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  const evaluar = (fn, arg) => arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg);
  const api = {
    async estado() { return evaluar(() => window.__qaRecuperacion.estado()); },
    async iniciar(ejercicio) {
      const usoInicio = await uso();
      return evaluar(({ ejercicio, usoInicio }) => {
        const q = window.__qaRecuperacion;
        if (q.actual) throw new Error('Cierra el intento actual antes de iniciar otro.');
        if (q.resumenes.length >= q.config.intentos) throw new Error('Piloto terminado.');
        q.actual = { numero: q.resumenes.length + 1, ejercicio, usoInicio, rngInicio: q.rng,
          umbral: 1 + q.entero(4), fase: 'espera', pendiente: false, clicsPrevios: 0, clicsReparacion: 0,
          inicio: performance.now(), secuencia: 0, traza: [], inicial: q.foto(), usoTeclado: false };
        q.registrar('inicio'); return q.estado();
      }, { ejercicio, usoInicio });
    },
    // Ejecutar cada gesto completo antes de sincronizar: nunca interrumpir un doble clic o un drag a medias.
    async paso(accion) {
      const estado = await api.estado();
      if (!estado.intento) throw new Error('Inicia un intento.');
      if (!['espera', 'reparacion'].includes(estado.intento.fase)) throw new Error('El intento requiere cerrarse antes de continuar.');
      if (estado.intento.limite) throw new Error('Límite del intento: registra el resultado y ciérralo.');
      await accion();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return api.sincronizar();
    },
    async click(selector, opciones) { return api.paso(() => page.click(selector, opciones)); },
    async clickEn(x, y, opciones) { return api.paso(() => page.mouse.click(x, y, opciones)); },
    async dobleClick(selector, opciones) { return api.paso(() => page.dblclick(selector, opciones)); },
    async sincronizar() {
      const estado = await evaluar(() => {
        const q = window.__qaRecuperacion; q.registrar('tras-gesto', { despues: q.foto() }); return q.estado();
      });
      if (!estado.intento?.pendiente || estado.intento.fase !== 'espera') return estado;
      try {
        const plan = await evaluar(() => {
          const q = window.__qaRecuperacion, a = q.actual, botones = q.botones();
          a.fase = 'inyeccion'; a.pendiente = false; a.objetivo = q.foto();
          if (!botones.length) throw new Error('No hay botones de código permitidos. Actualiza el adaptador.');
          const punto = q.punto(), boton = botones[q.entero(botones.length)];
          a.perturbacion = { punto, boton, inventario: botones, rng: q.rng };
          q.registrar('antes-perturbacion', { antes: a.objetivo, plan: a.perturbacion });
          return { punto, boton };
        });
        await page.mouse.click(plan.punto.x, plan.punto.y, { label: 'perturbar carácter del programa' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await evaluar(() => {
          const q = window.__qaRecuperacion; q.actual.trasCaracter = q.foto();
          q.registrar('tras-caracter', { despues: q.actual.trasCaracter });
        });
        await page.click(plan.boton.selector, { label: 'insertar botón aleatorio de código' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        return evaluar(() => {
          const q = window.__qaRecuperacion, a = q.actual;
          a.trasPerturbacion = q.foto(); a.fase = 'reparacion';
          a.cambio = a.objetivo.codigo !== a.trasPerturbacion.codigo;
          q.registrar('tras-perturbacion', { despues: a.trasPerturbacion }); return q.estado();
        });
      } catch (err) {
        await evaluar(mensaje => {
          const q = window.__qaRecuperacion;
          q.actual.fase = 'infraestructura'; q.actual.pendiente = false;
          q.actual.errorInyeccion = mensaje; q.registrar('error-inyeccion', { mensaje, despues: q.foto() });
        }, String(err));
        throw err;
      }
    },
    async cerrar({ clasificacion = 'evaluar', nota = '', esperado = '', observado = '', faltantes = [] } = {}) {
      if (!['evaluar', 'bug-sospechado', 'limite-ui', 'fallo-agente', 'infraestructura'].includes(clasificacion)) throw new Error('Clasificación inválida.');
      if (clasificacion === 'bug-sospechado' && (!esperado || !observado)) throw new Error('Describe la regla esperada y lo observado.');
      const usoFin = await uso();
      const detalle = await evaluar(() => {
        const q = window.__qaRecuperacion;
        if (!q.actual) throw new Error('No hay intento activo.');
        return { ...q.actual, final: q.foto(), duracionMs: Math.round(performance.now() - q.actual.inicio), version: q.version, config: q.config, rngFin: q.rng };
      });
      const exacto = !!detalle.objetivo && detalle.final.codigo === detalle.objetivo.codigo;
      const valido = !!detalle.cambio && !detalle.usoTeclado && !detalle.errorInyeccion;
      const resultado = detalle.errorInyeccion ? 'infraestructura' : !valido ? 'inconcluso' : exacto ? 'recuperado' : 'no-recuperado';
      const incidencia = resultado !== 'recuperado' || clasificacion !== 'evaluar' || faltantes.length > 0;
      const resumen = { numero: detalle.numero, ejercicio: detalle.ejercicio, semilla: config.semilla, rngInicio: detalle.rngInicio,
        resultado, clasificacion, recompensa: valido && config.modalidad === 'piloto' ? Number(exacto) : null, nota, esperado, observado, faltantes,
        umbral: detalle.umbral, clicsPrevios: detalle.clicsPrevios, clicsReparacion: detalle.clicsReparacion,
        duracionMs: detalle.duracionMs, usoTeclado: detalle.usoTeclado,
        objetivoHash: detalle.objetivo ? hash(detalle.objetivo.codigo) : null, finalHash: hash(detalle.final.codigo),
        perturbacion: detalle.perturbacion && { punto: detalle.perturbacion.punto, boton: detalle.perturbacion.boton },
        uso: diferenciaUso(detalle.usoInicio, usoFin), detalle: incidencia ? `caso-${String(detalle.numero).padStart(2, '0')}.json` : null };
      resumen.contexto = { version: detalle.version, viewport: detalle.final.viewport, programa: detalle.final.programa, clasesApp: detalle.final.clasesApp };
      await mkdir(directorio, { recursive: true });
      if (incidencia) {
        await writeFile(join(directorio, resumen.detalle), JSON.stringify({ resumen, ...detalle, usoFin }, null, 2) + '\n');
        // La captura es evidencia adicional; el JSON se conserva aunque la captura no esté disponible.
        try { await page.screenshot({ path: join(directorio, resumen.detalle.replace('.json', '.png')) }); }
        catch (err) { resumen.errorCaptura = String(err); }
      }
      const resumenes = await evaluar(() => window.__qaRecuperacion.resumenes);
      await writeFile(join(directorio, 'resumen.json'), JSON.stringify({ sesion: inicial.sesion, config, rngSiguiente: detalle.rngFin,
        version: detalle.version, intentos: [...resumenes, resumen] }, null, 2) + '\n');
      await evaluar(resumen => {
        const q = window.__qaRecuperacion;
        q.resumenes.push(resumen); q.actual = null; // Descarta el código y la traza de los intentos sanos.
      }, resumen);
      return resumen;
    }
  };
  return api;
}

// Repite SOLO la perturbación de un caso. El agente prepara el código/viewport originales antes.
export async function reproducirCaso(page, archivo) {
  const caso = JSON.parse(await readFile(archivo, 'utf8'));
  const { objetivo, perturbacion, config } = caso;
  if (!objetivo || !perturbacion) throw new Error('El caso no tiene una perturbación reproducible.');
  await page.evaluate(({ objetivo, perturbacion, config }) => {
    const u = new URL(location.href), e = document.querySelector('#codigo');
    if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.port !== '8771' ||
        !decodeURIComponent(u.pathname).startsWith('/Prototypes/Rocket Launcher/')) throw new Error('Reproducción solo en Rocket Launcher, puerto 8771.');
    if (window.__qaRecuperacion?.actual) throw new Error('Cierra el intento activo antes de reproducir.');
    if (!e || e.value !== objetivo.codigo || e.scrollLeft !== objetivo.scroll[0] || e.scrollTop !== objetivo.scroll[1] ||
        e.selectionStart !== objetivo.seleccion[0] || e.selectionEnd !== objetivo.seleccion[1] || e.selectionDirection !== objetivo.direccion || e.readOnly !== objetivo.soloLectura ||
        innerWidth !== objetivo.viewport.ancho || innerHeight !== objetivo.viewport.alto ||
        (visualViewport?.scale ?? 1) !== objetivo.viewport.escala || document.querySelector('#app')?.className !== objetivo.clasesApp) {
      throw new Error('Prepara el código, selección, modo, scroll y viewport originales.');
    }
    const b = document.querySelector(perturbacion.boton.selector);
    if (!(b instanceof HTMLButtonElement) || !b.matches(config?.botones || '#paleta button.atajo[data-i]') || b.disabled ||
        b.getAttribute('aria-disabled') === 'true' || (b.getAttribute('aria-label') || b.title || b.textContent.trim()) !== perturbacion.boton.nombre ||
        /copiar|pegar|copy|paste|clipboard|portapapeles/i.test([b.id, b.textContent, b.getAttribute('aria-label'), b.title, ...Object.values(b.dataset)].join(' '))) {
      throw new Error('El botón del caso cambió o está excluido. Revisa la versión de la UI.');
    }
    const p = perturbacion.punto;
    const hit = document.elementFromPoint(p.x, p.y);
    if (hit !== e && !hit?.closest('#bloques')) throw new Error('La geometría cambió: el punto ya no cae sobre el editor.');
  }, { objetivo, perturbacion, config: config || null });
  await page.mouse.click(perturbacion.punto.x, perturbacion.punto.y, { label: 'reproducir carácter del caso' });
  await page.click(perturbacion.boton.selector, { label: 'reproducir botón del caso' });
  const codigo = await page.evaluate(() => document.querySelector('#codigo').value);
  return { reproduceTexto: codigo === caso.trasPerturbacion?.codigo, codigo, esperado: caso.trasPerturbacion?.codigo };
}
