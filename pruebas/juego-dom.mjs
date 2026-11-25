// Carga real de la composición en Node: DOM, editor y GPU emulados; NO abre navegador.
// Detecta ReferenceError/TDZ indirecta en los instaladores y conexiones que Node --check no ve.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';

// Cada suite se relanza con módulos VM en las versiones de Node que lo requieren.
export function habilitarVM(entradaSuite) {
  if (vm.SourceTextModule) return;
  const hijo = spawnSync(process.execPath, ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning',
    fileURLToPath(entradaSuite)], { stdio: 'inherit' });
  process.exit(hijo.status ?? 1);
}
const raiz = new URL('../', import.meta.url);
const noop = () => {};
class Elemento {
  constructor(id = '', rect = { width: 1000, height: 600 }) {
    this.rect = rect;
    this.id = id; this.dataset = {}; this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    this.classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
    this.value = ''; this.textContent = ''; this.innerHTML = ''; this.hidden = false;
    this.href = 'http://qa.invalid/probar.html'; this.children = []; this.listeners = new Map();
    this.selectionStart = 0; this.selectionEnd = 0;
  }
  addEventListener(tipo, fn) { const lista = this.listeners.get(tipo) || []; lista.push(fn); this.listeners.set(tipo, lista); }
  dispatchEvent(ev) { this['on' + ev.type]?.(ev); for (const fn of this.listeners.get(ev.type) || []) fn(ev); return true; }
  setAttribute(k, v) { (this.attrs ??= new Map()).set(k, String(v)); }
  removeAttribute(k) { this.attrs?.delete(k); }
  getAttribute(k) { return this.attrs?.get(k) ?? null; }
  click() { this.dispatchEvent({ type: 'click', target: this }); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  append(...nodos) { this.children.push(...nodos); } appendChild(nodo) { this.append(nodo); return nodo; }
  prepend(...nodos) { this.children.unshift(...nodos); } replaceChildren(...nodos) { this.children = nodos; }
  querySelector() { return new Elemento(); } querySelectorAll() { return []; }
  getBoundingClientRect() { return { ...this.rect, left: 0, top: 0 }; }
  getContext() { return {}; }
  contains() { return false; } insertBefore() {} after() {} remove() {} focus() {} select() {} scrollIntoView() {}
}
export async function cargar(serie, vista, propio, sin3d = false, mutacion = null, forma = 'escritorio', consulta = '', opciones = {}) {
  const v2 = serie === 'campaign-v2';
  const pagina = v2 ? 'Campaign-V2' : 'Rocket Launcher';
  const entrada = new URL('Prototypes/' + pagina + '/js/juego.js', raiz);
  const html = await readFile(new URL('../index.html', entrada), 'utf8');
  const nodos = new Map();
  const porId = id => {
    if (!nodos.has(id)) nodos.set(id, new Elemento(id, forma === 'movil' ? { width: 375, height: 812 } : undefined));
    return nodos.get(id);
  };
  for (const [, attrs, id] of html.matchAll(/<([^>]*\bid="([^"]+)"[^>]*)>/g))
    porId(id).hidden = /\bhidden\b/.test(attrs);
  porId('app').dataset = { forma: 'escritorio', modo: 'js' };
  const documento = {
    getElementById: id => nodos.get(id) ?? null, createElement: () => new Elemento(), createTextNode: texto => ({ textContent: texto }),
    querySelector: selector => porId(selector === '.app' ? 'app' : selector),
    querySelectorAll: () => [], addEventListener: noop, documentElement: new Elemento('html'),
    fonts: { ready: Promise.resolve() }, body: new Elemento('body'),
  };
  const idioma = /data-clave-idioma="([^"]+)"/.exec(html)?.[1];
  documento.currentScript = { dataset: { claveIdioma: idioma } };
  const plataforma = opciones.plataforma ?? crearPlataformaMemoria();
  const claveVista = serie === 'campaign-v2' ? 'campaign-v2:juego:vista' : `cmg-banco03:${serie === 'war' ? '' : serie + '-'}vista`;
  plataforma.almacen.escribir(claveVista, JSON.stringify(vista));
  const url = new URL(`http://qa.invalid/Prototypes/${pagina}/?${v2 ? '' : 'serie=' + serie + '&'}forma=${forma}&marco=1&poc=1${propio ? '&reto=propio' : ''}${consulta}`);
  url.assign = destino => opciones.alNavegar?.(new URL(destino, url));
  // Campaign-V2 recarga la página para pasar entre fábrica y Batalla: la prueba vuelve a llamar a cargar.
  url.reload = () => opciones.alRecargar?.();
  let fotogramas = 0, medidas = 0, editor = null, estadoVistas = null, vaciados = 0;
  const vaciar = () => vaciados++;
  const vistaFalsa = () => {
    if (sin3d) return null;
    return { vaciar, destruir: noop, alSuceso: noop, construir: noop, anillosDe: noop, aplicarColores: noop, tamano: noop,
      batalla: noop, actualizar: noop, render: noop, dibujar: noop, redimensionar: noop, camara: () => ({ dist: 60 }) };
  };
  const ventana = new Elemento();
  const ctx = vm.createContext({ console, structuredClone, document: documento, location: url, URL, URLSearchParams,
    performance: { now: () => 0 }, innerWidth: forma === 'movil' ? 375 : 1000, innerHeight: forma === 'movil' ? 812 : 700, Event: class { constructor(type) { this.type = type; } }, navigator: {},
    history: { replaceState: noop }, addEventListener: ventana.addEventListener.bind(ventana),
    dispatchEvent: ventana.dispatchEvent.bind(ventana),
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
    MutationObserver: class { observe() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    CustomEvent: class { constructor(type, opciones) { this.type = type; this.detail = opciones?.detail; } },
    setTimeout: () => 1, clearTimeout: noop, cancelAnimationFrame: noop,
    requestAnimationFrame: fn => { if (fn.name === 'bucle') fotogramas++; else medidas++; return fotogramas + medidas; },
  });
  ctx.window = ctx;
  ctx.localStorage = { getItem: k => plataforma.almacen.leer(k), setItem: (k, v) => plataforma.almacen.escribir(k, v) };
  ctx.removeEventListener = (tipo, fn) => {
    ventana.listeners.set(tipo, (ventana.listeners.get(tipo) || []).filter(otro => otro !== fn));
  };
  for (const vendor of ['acorn-8.11.3.js', 'lezer-python-1.1.19.js'])
    vm.runInContext(await readFile(new URL(`shared/vendor/${vendor}`, raiz), 'utf8'), ctx);
  // Los proveedores de app/interfaz se importan como módulos reales, sin globales.
  if (consulta || opciones.i18n) vm.runInContext(await readFile(new URL('shared/i18n/i18n.js', raiz), 'utf8'), ctx);
  if (opciones.i18n) {
    vm.runInContext(await readFile(new URL('shared/i18n/retos.js', raiz), 'utf8'), ctx);
    // Las metas de la planta (Campaign y los hitos de fábrica de Campaign-V2) viven en su propio catálogo.
    if (/shared\/i18n\/campaign\.js/.test(html)) vm.runInContext(await readFile(new URL('shared/i18n/campaign.js', raiz), 'utf8'), ctx);
  }
  if (!ctx.CMGI18n) ctx.CMGI18n = { t: clave => clave };
  ctx.crypto = { randomUUID: () => 'qa-sesion' };
  for (const nombre of ['trazador', 'flujo', 'python'])
    vm.runInContext(await readFile(new URL(`educational-animation/revision/motor/${nombre}.js`, raiz), 'utf8'), ctx);
  const cache = new Map();
  async function modulo(url) {
    if (v2) assert(!url.pathname.includes('/reglas-campaign/'), 'V2 cargó ' + url.pathname);
    if (cache.has(url.href)) return cache.get(url.href);
    let m;
    if (/\/paquetes\/(?:app|interfaz)\//.test(url.pathname) || /\/Prototypes\/(?:Rocket%20Launcher|Campaign-V2)\/js\//.test(url.pathname)) {
      let fuente = await readFile(url, 'utf8');
      if (mutacion && url.pathname.endsWith('/estado.js'))
        fuente = fuente.replace('const CMGPythonJS =', mutacion + '\nconst CMGPythonJS =');
      if (/\/(estado|layout)\.js$/.test(url.pathname)) {
        // Una dependencia adelantada no se disimula como undefined en el contexto compartido.
        fuente = fuente.replace('const l = {};', `const l = new Proxy({}, { get(o, k) {
          if (!(k in o)) throw new ReferenceError('layout.' + String(k) + ' leído antes de conectar');
          return Reflect.get(o, k);
        } });`);
        fuente = fuente.replace('return ctx;', `return new Proxy(ctx, { get(o, k) {
          if (!(k in o)) throw new ReferenceError('ctx.' + String(k) + ' leído antes de conectar');
          return Reflect.get(o, k);
        } });`);
      }
      m = new vm.SourceTextModule(fuente, { context: ctx, identifier: url.href });
      cache.set(url.href, m);
    } else {
      let valores = await import(url.href);
      if (url.pathname.endsWith('/cascaras/web/plataforma.js'))
        valores = { crearPlataformaWeb: () => plataforma };
      if (/\/vista-[23]d\/index.js$/.test(url.pathname)) {
        valores = Object.fromEntries(Object.keys(valores).map(n => [n,
          n === 'crearFicha3D' ? () => ({ mostrar: noop, pausar: noop }) : n === 'crearVista' ? (_contenedor, opciones) => {
            estadoVistas = opciones.estado;
            return url.pathname.includes('/vista-2d/') ? { dibujar: noop, vaciar, alSuceso: noop } : vistaFalsa();
          } : n.startsWith('crearPlano') ? (estado) => { estadoVistas = estado; return noop; } : vistaFalsa]));
      } else if (url.pathname.endsWith('/editor/index.js')) {
        valores = { ...valores, CMGTips: { crear: noop }, CMGEditor: { ...valores.CMGEditor, crear() {
          // El editor real monta estos nodos dentro del anclaje #editor.
          for (const id of ['codigo', 'gutter', 'area', 'espejo', 'banda', 'resaltado', 'bloques',
            'bloques-in', 'bloques-capa', 'bloques-texto', 'asas', 'asas-in']) porId(id);
          const fachada = Object.fromEntries(['insertar', 'envolver', 'alternarComentario', 'medirEditor',
            'pintarResaltado', 'seleccionarHueco', 'aviso', 'atajos'].map(n => [n, noop]));
          editor = { fachada, abrir: noop, marcas: noop, documento: () => ({ revision: 0 }),
            iniciarVistas: noop, irALinea: noop };
          return editor;
        } } };
      }
      const nombres = Object.keys(valores);
      m = new vm.SyntheticModule(nombres, function () {
        for (const n of nombres) this.setExport(n, valores[n]);
      }, { context: ctx, identifier: url.href });
      cache.set(url.href, m);
    }
    return m;
  }
  const principal = await modulo(entrada);
  await principal.link((ruta, padre) => modulo(new URL(ruta, padre.identifier)));
  await principal.evaluate();
  await Promise.resolve();
  assert.equal(ctx.__juegoListo, true, serie + ': llega al final del arranque');
  assert.equal(ctx.cmg.editor, editor);
  assert(ctx.__banco.mundo && ctx.__banco.partida, serie + ': mundo y partida conectados');
  assert.equal(fotogramas, 1, 'programa el bucle una vez');
  assert.equal(medidas, 1, 'programa la medida inicial del panel');
  assert(ctx.cmg.revisionJuego && ctx.cmg.pulsos, 'revisión y pulsos se conectan sin globales');
  assert.equal(porId('app').dataset.forma, forma);
  for (const nombre of ['CMGProveedor', 'CMGPaleta', 'CMGProgramas', 'CMGPulsos', 'cmgRemota',
    'CMGRevisionJuego', '__revisionJuego', 'CAMPAIGN_UI', 'FACTORY_FORM', 'FACTORY_3D', 'ESTRUCTURA'])
    assert.equal(ctx[nombre], undefined, nombre + ': no se publica');
  const fuentePulso = 'if (autoTarget("drone", "visual")) regularShoot(null);';
  assert.notEqual(ctx.cmg.pulsos.preparar('QA', fuentePulso), fuentePulso);
  assert(ctx.cmg.pulsos.programas.get('QA').nodos.size > 0, 'trazador y flujo clásicos inyectados');
  ctx.cmg.pulsos.python('PY', 'while True:\n    print(1)\n');
  assert(ctx.cmg.pulsos.programas.get('PY').lineas.size > 0, 'lector Python clásico inyectado');
  assert(estadoVistas.escena, 'la escena se obtiene después de crear el mundo');
  // Campaign-V2 arranca la serie Campaign en sus hitos de fábrica (opciones.serie lo dice).
  assert.equal(ctx.cmg.serie, opciones.serie ?? serie);
  if (serie === 'war') {
    const antes = vaciados;
    porId('b-reiniciar').dispatchEvent(new ctx.Event('click'));
    assert.equal(vaciados - antes, sin3d ? 1 : 2, 'reiniciar vacía ambas vistas');
  }
  assert.equal(porId('c2d').hidden, !sin3d && vista !== '2d');
  // Los handlers asíncronos leen los accesores vivos tras iniciar la página.
  ctx.__banco.abrirPrograma(ctx.__banco.mundo.programables[0].id);
  ctx.dispatchEvent(new ctx.CustomEvent('cmg:idioma'));
  return ctx.__banco;
}
