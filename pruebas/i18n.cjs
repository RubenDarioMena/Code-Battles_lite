// Runtime de idioma sin DOM real ni dependencias: node pruebas/i18n.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const archivo = path.join(__dirname, '..', 'shared/i18n/i18n.js');
const codigo = readFileSync(archivo, 'utf8');

function cargar(extra = {}) {
  const contexto = vm.createContext({ console, ...extra });
  vm.runInContext(codigo, contexto, { filename: 'shared/i18n/i18n.js' });
  return { contexto, api: contexto.window && contexto.window.CMGI18n || contexto.CMGI18n };
}

class Elemento {
  constructor(atributos = {}) {
    this.nodeType = 1;
    this.attributes = Object.create(null);
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.escriturasTexto = 0;
    this.escriturasHTML = 0;
    this._texto = '';
    for (const [nombre, valor] of Object.entries(atributos)) this.setAttribute(nombre, valor);
  }
  get childElementCount() { return this.children.length; }
  get textContent() { return this._texto; }
  set textContent(valor) { this.escriturasTexto++; this._texto = String(valor); }
  get innerHTML() { return ''; }
  set innerHTML(_) { this.escriturasHTML++; throw new Error('No se debe interpretar HTML'); }
  append(hijo) {
    this.children.push(hijo);
    hijo.parentElement = this;
    hijo.parentNode = this;
    return hijo;
  }
  getAttribute(nombre) { return Object.prototype.hasOwnProperty.call(this.attributes, nombre) ? this.attributes[nombre] : null; }
  setAttribute(nombre, valor) { this.attributes[nombre] = String(valor); }
  matches(selector) {
    return selector.split(',').some(parte => {
      const m = parte.trim().match(/^\[([^\]]+)\]$/);
      return !!m && this.getAttribute(m[1]) !== null;
    });
  }
  querySelectorAll(selector) {
    const encontrados = [];
    const visitar = nodo => {
      for (const hijo of nodo.children) {
        if (hijo.matches(selector)) encontrados.push(hijo);
        visitar(hijo);
      }
    };
    visitar(this);
    return encontrados;
  }
}

class Documento {
  constructor() {
    this.nodeType = 9;
    this.readyState = 'loading';
    this.listeners = Object.create(null);
    this.documentElement = new Elemento();
    this.body = this.documentElement.append(new Elemento());
  }
  addEventListener(tipo, fn) { (this.listeners[tipo] ||= []).push(fn); }
  emitir(tipo, evento = {}) { for (const fn of this.listeners[tipo] || []) fn(evento); }
  querySelectorAll(selector) {
    const encontrados = [];
    if (this.documentElement.matches(selector)) encontrados.push(this.documentElement);
    return encontrados.concat(this.documentElement.querySelectorAll(selector));
  }
}

class EventoPersonalizado {
  constructor(type, opciones = {}) { this.type = type; this.detail = opciones.detail; }
}

// Funciona sin DOM ni almacenamiento, y publica la API tanto en globalThis como en window.
{
  const ventana = {};
  const { api } = cargar({ window: ventana });
  assert.equal(ventana.CMGI18n, api);
  assert.equal(api.idioma, 'es');
  assert.equal(api.t('desconocida'), 'desconocida');
  assert.equal(api.cambiarIdioma('fr'), false);
  assert.equal(api.idioma, 'es');
  assert.equal(api.cambiarIdioma('en'), true);
  assert.equal(api.idioma, 'en');
  assert.equal(api.cambiarIdioma('en'), false);
}

// Catálogos separados se fusionan; la búsqueda y la interpolación solo leen propiedades propias.
{
  const { api } = cargar({ window: {} });
  api.registrar('es', { hola: 'Hola {nombre}; {faltante}', compartida: 'Primera' });
  api.registrar('es', { compartida: 'Segunda', soloEs: 'Solo español' });
  api.registrar('en', { hola: 'Hello {nombre}; {faltante}' });
  assert.equal(api.t('compartida'), 'Segunda');
  assert.equal(api.t('hola', { nombre: 'Ada' }), 'Hola Ada; {faltante}');
  assert.equal(api.t('soloEs'), 'Solo español');
  assert.equal(api.cambiarIdioma('en'), true);
  assert.equal(api.t('hola', { nombre: 'Ada' }), 'Hello Ada; {faltante}');
  assert.equal(api.t('soloEs'), 'Solo español', 'las claves inglesas ausentes usan español');

  const heredado = Object.create({ ajena: 'no registrar' });
  Object.defineProperty(heredado, '__proto__', { value: 'texto seguro', enumerable: true });
  Object.defineProperty(heredado, 'constructor', { value: 'constructor propio', enumerable: true });
  let getterEjecutado = false;
  Object.defineProperty(heredado, 'conGetter', { enumerable: true, get() { getterEjecutado = true; throw Error('getter'); } });
  assert.equal(api.registrar('en', heredado), true);
  assert.equal(api.t('ajena'), 'ajena');
  assert.equal(api.t('__proto__'), 'texto seguro');
  assert.equal(api.t('constructor'), 'constructor propio');
  assert.equal(api.t('conGetter'), 'conGetter');
  assert.equal(getterEjecutado, false);

  const parametros = Object.create({ heredado: 'no interpolar' });
  Object.defineProperty(parametros, 'nombre', { value: '<img src=x onerror=alert(1)>' });
  Object.defineProperty(parametros, 'peligro', { get() { getterEjecutado = true; throw Error('getter'); } });
  api.registrar('en', { seguro: '{nombre}|{heredado}|{peligro}|{codigo}' });
  assert.equal(api.t('seguro', parametros), '<img src=x onerror=alert(1)>|{heredado}|{peligro}|{codigo}');
  assert.equal(api.t('seguro', { codigo: 'globalThis.alert("no")' }), '{nombre}|{heredado}|{peligro}|globalThis.alert("no")');
  assert.equal(getterEjecutado, false);
  assert.equal(api.registrar('fr', { hola: 'Bonjour' }), false);
}

// Storage corrupto y bloqueado cae a español sin impedir la carga ni un cambio posterior.
{
  const ventana = {};
  Object.defineProperty(ventana, 'localStorage', { get() { throw new Error('Storage bloqueado'); } });
  const { api } = cargar({ window: ventana });
  assert.equal(api.idioma, 'es');
  assert.equal(api.cambiarIdioma('en'), true);
  assert.equal(api.idioma, 'en');
}
{
  const ventana = { localStorage: { getItem(clave) { assert.equal(clave, 'cmg-interfaz-idioma'); return 'en-US'; } } };
  const { api } = cargar({ window: ventana });
  assert.equal(api.idioma, 'es');
}

// DOMContentLoaded aplica catálogos ya registrados, y la delegación cambia idioma desde un hijo.
{
  const documento = new Documento();
  const guardados = new Map([['cmg-interfaz-idioma', 'en']]);
  const accesosStorage = [];
  const ventana = {
    document: documento,
    CustomEvent: EventoPersonalizado,
    localStorage: {
      getItem(clave) { accesosStorage.push(['leer', clave]); return guardados.get(clave) ?? null; },
      setItem(clave, valor) { accesosStorage.push(['guardar', clave]); guardados.set(clave, valor); },
    },
    eventos: [],
    dispatchEvent(evento) { this.eventos.push(evento); return true; },
  };
  const hoja = documento.body.append(new Elemento({ 'data-i18n': 'saludo' }));
  const caja = documento.body.append(new Elemento({ 'data-i18n': 'contenedor' }));
  caja.textContent = 'conservar hijos';
  const dentro = caja.append(new Elemento({ 'data-i18n': 'etiqueta' }));
  const atributos = documento.body.append(new Elemento({
    'data-i18n-title': 'titulo',
    'data-i18n-aria-label': 'accesible',
    'data-i18n-data-tip': 'tip',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-content': 'contenido',
  }));
  const botonEs = documento.body.append(new Elemento({ 'data-idioma-interfaz': 'es' }));
  const hijoBoton = botonEs.append(new Elemento());
  const botonEn = documento.body.append(new Elemento({ 'data-idioma-interfaz': 'en' }));
  const botonInvalido = documento.body.append(new Elemento({ 'data-idioma-interfaz': 'fr' }));
  const { api } = cargar({ window: ventana, document: documento });
  api.registrar('es', {
    saludo: 'Hola {nombre}', contenedor: 'no borrar', etiqueta: 'texto ES', titulo: 'Título ES',
    accesible: 'Nombre ES', tip: 'Consejo ES', placeholder: 'Escribe ES', contenido: 'Contenido ES',
  });
  api.registrar('en', {
    saludo: 'Hello {nombre}', etiqueta: 'text EN', titulo: 'Title EN', accesible: 'Name EN',
    tip: 'Tip EN', placeholder: 'Type EN', contenido: 'Content EN',
  });
  assert.equal(api.idioma, 'en', 'lee solo el locale soportado guardado');
  assert.equal(hoja.textContent, '', 'espera al DOMContentLoaded para aplicar');
  assert.equal(typeof documento.listeners.DOMContentLoaded[0], 'function');
  documento.emitir('DOMContentLoaded');
  assert.equal(documento.documentElement.lang, 'en');
  assert.equal(hoja.textContent, 'Hello {nombre}');
  assert.equal(caja.textContent, 'conservar hijos', 'un elemento con hijos conserva su contenido');
  assert.equal(dentro.textContent, 'text EN', 'se traduce el descendiente hoja');
  assert.equal(atributos.getAttribute('title'), 'Title EN');
  assert.equal(atributos.getAttribute('aria-label'), 'Name EN');
  assert.equal(atributos.getAttribute('data-tip'), 'Tip EN');
  assert.equal(atributos.getAttribute('placeholder'), 'Type EN');
  assert.equal(atributos.getAttribute('content'), 'Content EN');
  assert.equal(botonEs.getAttribute('aria-pressed'), 'false');
  assert.equal(botonEn.getAttribute('aria-pressed'), 'true');
  assert.equal(botonInvalido.getAttribute('aria-pressed'), 'false');

  // Se llama aplicar con una raíz que también coincide; repetirla no cambia el resultado.
  hoja.setAttribute('data-i18n', 'saludo');
  api.aplicar(hoja);
  api.aplicar(hoja);
  assert.equal(hoja.textContent, 'Hello {nombre}');
  assert.equal(documento.documentElement.lang, 'en');
  assert.equal(hoja.escriturasHTML, 0);
  assert.equal(caja.escriturasHTML, 0);
  assert.equal(atributos.escriturasHTML, 0);

  // El evento delegado reconoce un descendiente del botón.
  documento.emitir('click', { target: hijoBoton });
  assert.equal(api.idioma, 'es');
  assert.equal(documento.documentElement.lang, 'es');
  assert.equal(hoja.textContent, 'Hola {nombre}');
  assert.equal(dentro.textContent, 'texto ES');
  assert.equal(atributos.getAttribute('title'), 'Título ES');
  assert.deepEqual(ventana.eventos.map(e => e.type), ['cmg:idioma']);
  assert.equal(ventana.eventos[0].detail.idioma, 'es');
  assert.equal(guardados.get('cmg-interfaz-idioma'), 'es');
  assert.deepEqual([...new Set(accesosStorage.map(([, clave]) => clave))], ['cmg-interfaz-idioma']);
  assert.equal(botonEs.getAttribute('aria-pressed'), 'true');
  assert.equal(botonEn.getAttribute('aria-pressed'), 'false');

  documento.emitir('click', { target: botonInvalido });
  assert.equal(api.idioma, 'es');
  assert.equal(ventana.eventos.length, 1, 'locale inválido no emite evento');
  assert.equal(api.cambiarIdioma('es'), false);
  assert.equal(ventana.eventos.length, 1, 'repetir el locale no es un cambio efectivo');
  assert.equal(hoja.escriturasHTML + dentro.escriturasHTML + atributos.escriturasHTML, 0);
}

// Un documento que ya está listo se inicializa de inmediato.
{
  const documento = new Documento();
  documento.readyState = 'complete';
  const ventana = { document: documento, CustomEvent: EventoPersonalizado, dispatchEvent() {} };
  const etiqueta = documento.body.append(new Elemento({ 'data-i18n': 'lista' }));
  const { api } = cargar({ window: ventana, document: documento });
  api.registrar('es', { lista: 'Listo' });
  assert.equal(etiqueta.textContent, 'Listo');
  assert.equal(documento.documentElement.lang, 'es');
  assert.equal(documento.listeners.click.length, 1);
}

// Las etiquetas defer ven readyState interactive; DOMContentLoaded espera a que registren los catálogos.
{
  const documento = new Documento();
  documento.readyState = 'interactive';
  const guardados = new Map([['cmg-interfaz-idioma', 'en']]);
  const ventana = {
    document: documento,
    localStorage: { getItem(clave) { return guardados.get(clave) ?? null; } },
    CustomEvent: EventoPersonalizado,
    dispatchEvent() {},
  };
  const intro = documento.body.append(new Elemento({ 'data-i18n': 'intro.portada' }));
  const { api } = cargar({ window: ventana, document: documento });
  assert.equal(intro.textContent, '', 'interactive espera DOMContentLoaded antes de aplicar');
  api.registrar('es', { 'intro.portada': 'Bienvenido' });
  api.registrar('en', { 'intro.portada': 'Welcome' });
  documento.emitir('DOMContentLoaded');
  assert.equal(api.idioma, 'en');
  assert.equal(intro.textContent, 'Welcome');
  assert.equal(documento.documentElement.lang, 'en');
}

console.log('i18n: fallback, fusión, interpolación segura, storage, DOM y delegación correctos.');
