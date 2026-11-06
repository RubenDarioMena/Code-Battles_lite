// Runtime de idioma de la interfaz. Se carga como script clásico, sin dependencias.
(function (global) {
  'use strict';

  var ventana = typeof window !== 'undefined' ? window : global;
  var claveStorage = 'cmg-interfaz-idioma';
  var catalogos = { es: Object.create(null), en: Object.create(null) };
  var idiomaActual = 'es';
  var inicializado = false;

  function idiomaValido(idioma) { return idioma === 'es' || idioma === 'en'; }

  function documento(raiz) {
    if (raiz && raiz.nodeType === 9) return raiz;
    if (raiz && raiz.ownerDocument) return raiz.ownerDocument;
    return (ventana && ventana.document) || global.document || null;
  }

  function leerIdioma() {
    try {
      var valor = ventana.localStorage.getItem(claveStorage);
      return idiomaValido(valor) ? valor : 'es';
    } catch (_) {
      try {
        var valorGlobal = global.localStorage.getItem(claveStorage);
        return idiomaValido(valorGlobal) ? valorGlobal : 'es';
      } catch (_) { return 'es'; }
    }
  }

  function guardarIdioma(idioma) {
    try { ventana.localStorage.setItem(claveStorage, idioma); }
    catch (_) {
      try { global.localStorage.setItem(claveStorage, idioma); } catch (_) {}
    }
  }

  function registrar(idioma, diccionario) {
    if (!idiomaValido(idioma) || !diccionario || typeof diccionario !== 'object' || Array.isArray(diccionario)) return false;
    var destino = catalogos[idioma];
    for (var clave of Object.keys(diccionario)) {
      // Copia solo valores propios string; los catálogos son datos, no ejecutan getters.
      var descriptor = Object.getOwnPropertyDescriptor(diccionario, clave);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') && typeof descriptor.value === 'string') {
        destino[clave] = descriptor.value;
      }
    }
    // Si el documento ya estaba listo, incorpora catálogos cargados después del runtime.
    if (inicializado) aplicar();
    return true;
  }

  function textoPrimitivo(valor) {
    if (valor === null) return 'null';
    var tipo = typeof valor;
    return tipo === 'string' || tipo === 'number' || tipo === 'boolean' || tipo === 'bigint' || tipo === 'symbol'
      ? String(valor) : null;
  }

  function parametro(parametros, nombre) {
    if (!parametros || (typeof parametros !== 'object' && typeof parametros !== 'function')) return null;
    var descriptor = Object.getOwnPropertyDescriptor(parametros, nombre);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    return textoPrimitivo(descriptor.value);
  }

  function t(clave, parametros) {
    var nombre = textoPrimitivo(clave);
    if (nombre === null) nombre = '';
    var texto = Object.prototype.hasOwnProperty.call(catalogos[idiomaActual], nombre)
      ? catalogos[idiomaActual][nombre]
      : Object.prototype.hasOwnProperty.call(catalogos.es, nombre) ? catalogos.es[nombre] : nombre;
    return texto.replace(/\{([^{}\r\n]+)\}/g, function (marcador, campo) {
      var valor = parametro(parametros || {}, campo);
      return valor === null ? marcador : valor;
    });
  }

  function elementos(raiz, selector) {
    var lista = [];
    if (raiz.matches && raiz.matches(selector)) lista.push(raiz);
    if (raiz.querySelectorAll) {
      var hijos = raiz.querySelectorAll(selector);
      for (var i = 0; i < hijos.length; i++) lista.push(hijos[i]);
    }
    return lista;
  }

  function actualizarBotones(raiz) {
    var botones = elementos(raiz, '[data-idioma-interfaz]');
    for (var i = 0; i < botones.length; i++) {
      var locale = botones[i].getAttribute('data-idioma-interfaz');
      botones[i].setAttribute('aria-pressed', locale === idiomaActual ? 'true' : 'false');
    }
  }

  function aplicar(raiz) {
    if (arguments.length === 0) raiz = documento(null);
    if (!raiz) return false;
    var doc = documento(raiz);
    if (doc && doc.documentElement) doc.documentElement.lang = idiomaActual;

    var textos = elementos(raiz, '[data-i18n]');
    for (var i = 0; i < textos.length; i++) {
      var elemento = textos[i];
      if (elemento.children && elemento.children.length) continue;
      if (elemento.getAttribute('data-i18n') !== null) {
        elemento.textContent = t(elemento.getAttribute('data-i18n'));
      }
    }

    var reglas = [
      ['data-i18n-title', 'title'],
      ['data-i18n-aria-label', 'aria-label'],
      ['data-i18n-data-tip', 'data-tip'],
      ['data-i18n-placeholder', 'placeholder'],
      ['data-i18n-content', 'content'],
    ];
    var conAtributos = elementos(raiz, reglas.map(regla => '[' + regla[0] + ']').join(', '));
    for (var j = 0; j < conAtributos.length; j++) {
      for (var k = 0; k < reglas.length; k++) {
        var clave = conAtributos[j].getAttribute(reglas[k][0]);
        if (clave !== null) conAtributos[j].setAttribute(reglas[k][1], t(clave));
      }
    }
    actualizarBotones(raiz);
    return true;
  }

  function emitirCambio(idioma) {
    if (!ventana || typeof ventana.dispatchEvent !== 'function' || typeof ventana.CustomEvent !== 'function') return;
    ventana.dispatchEvent(new ventana.CustomEvent('cmg:idioma', { detail: { idioma: idioma } }));
  }

  function cambiarIdioma(idioma) {
    if (!idiomaValido(idioma)) return false;
    if (idioma === idiomaActual) {
      guardarIdioma(idioma);
      aplicar();
      return false;
    }
    idiomaActual = idioma;
    guardarIdioma(idioma);
    aplicar();
    emitirCambio(idioma);
    return true;
  }

  function inicializar() {
    if (inicializado) return;
    var doc = documento(null);
    if (!doc) return;
    inicializado = true;
    doc.addEventListener('click', function (evento) {
      var nodo = evento.target && evento.target.nodeType === 1 ? evento.target : evento.target && evento.target.parentElement;
      while (nodo && nodo !== doc) {
        if (nodo.nodeType === 1 && nodo.getAttribute('data-idioma-interfaz') !== null) {
          cambiarIdioma(nodo.getAttribute('data-idioma-interfaz'));
          return;
        }
        nodo = nodo.parentElement || nodo.parentNode;
      }
    });
    aplicar(doc);
  }

  idiomaActual = leerIdioma();

  var api = { registrar: registrar, t: t, cambiarIdioma: cambiarIdioma, aplicar: aplicar };
  Object.defineProperty(api, 'idioma', { enumerable: true, get: function () { return idiomaActual; } });
  global.CMGI18n = api;
  if (ventana && ventana !== global) ventana.CMGI18n = api;

  var docInicial = documento(null);
  if (docInicial) {
    if (docInicial.readyState === 'loading' || docInicial.readyState === 'interactive') {
      docInicial.addEventListener('DOMContentLoaded', inicializar);
    } else {
      inicializar();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
