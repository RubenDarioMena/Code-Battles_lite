// Frontera estática de servicios + carga diferida emulada en Node. No abre navegador.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const raiz = new URL('../', import.meta.url);
const navegador = new Set(['devicePixelRatio', 'visualViewport', 'addEventListener',
  'isSecureContext', 'dispatchEvent', 'document']);
const publicaciones = new Set(['cmg', '__banco', '__juegoListo']);
const parsear = fuente => acorn.parse(fuente, { ecmaVersion: 2022, sourceType: 'module', locations: true });
function visitar(nodo, hacer, padre = null) {
  if (!nodo || typeof nodo !== 'object') return;
  hacer(nodo, padre);
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === 'loc') continue;
    if (Array.isArray(valor)) for (const hijo of valor) visitar(hijo, hacer, nodo);
    else if (valor && typeof valor === 'object') visitar(valor, hacer, nodo);
  }
}
function infracciones(fuente) {
  const arbol = parsear(fuente), alias = new Set(['window', 'globalThis', 'self']), errores = [];
  let cambio;
  do {
    cambio = false;
    visitar(arbol, nodo => {
      if (nodo.type === 'VariableDeclarator' && nodo.id.type === 'Identifier'
        && nodo.init?.type === 'Identifier' && alias.has(nodo.init.name) && !alias.has(nodo.id.name)) {
        alias.add(nodo.id.name); cambio = true;
      }
    });
  } while (cambio);
  visitar(arbol, (nodo, padre) => {
    if (nodo.type === 'MemberExpression' && alias.has(nodo.object.name)) {
      const nombre = nodo.computed ? nodo.property.value : nodo.property.name;
      const publica = publicaciones.has(nombre) && padre?.type === 'AssignmentExpression'
        && padre.operator === '=' && padre.left === nodo;
      if (!navegador.has(nombre) && !publica) errores.push(`${nodo.loc.start.line}: ${nodo.object.name}.${nombre ?? '[dinámico]'}`);
    }
    if (nodo.type === 'VariableDeclarator' && nodo.id.type === 'ObjectPattern' && alias.has(nodo.init?.name))
      for (const p of nodo.id.properties) if (!navegador.has(p.key?.name))
        errores.push(`${nodo.loc.start.line}: desestructuración global ${p.key?.name ?? 'resto'}`);
    if (nodo.type === 'CallExpression' && nodo.callee.object?.name === 'Object'
      && nodo.callee.property?.name === 'assign' && alias.has(nodo.arguments[0]?.name))
      errores.push(`${nodo.loc.start.line}: publicación global mediante Object.assign`);
  });
  return errores;
}
for (const fuente of ['window.CMGI18n.t();', 'window["THREE"];', 'window[nombre];',
  'window.localStorage;', 'globalThis.sessionStorage;', 'const w = window; w.localStorage;',
  'window.cmg.editor;', 'window.__juegoListo ||= true;',
  'const globales = window; globales.acorn;', 'const { CMGTerreno } = window;',
  'Object.assign(window, { CMGEditor });']) assert(infracciones(fuente).length, fuente);
assert.deepEqual(infracciones('window.cmg = {}; window.__banco = {}; window.__juegoListo = true; window.visualViewport; window.addEventListener("x", f);'), []);
// Sin lib DOM: el checker distingue un identificador libre de uno declarado en su ámbito.
function almacenesLibres(fuentes) {
  const opciones = { allowJs: true, noLib: true, noResolve: true, target: ts.ScriptTarget.ES2022 };
  const host = ts.createCompilerHost(opciones);
  host.getSourceFile = nombre => fuentes.has(nombre)
    ? ts.createSourceFile(nombre, fuentes.get(nombre), opciones.target, true, ts.ScriptKind.JS) : undefined;
  const programa = ts.createProgram([...fuentes.keys()], opciones, host);
  const checker = programa.getTypeChecker(), errores = [];
  for (const fuente of programa.getSourceFiles()) {
    function visitar(nodo) {
      if (ts.isIdentifier(nodo) && ['localStorage', 'sessionStorage'].includes(nodo.text)) {
        const padre = nodo.parent;
        const propiedad = (ts.isPropertyAccessExpression(padre) && padre.name === nodo)
          || ((ts.isPropertyAssignment(padre) || ts.isMethodDeclaration(padre)
            || ts.isGetAccessor(padre) || ts.isSetAccessor(padre) || ts.isBindingElement(padre))
            && (padre.name === nodo || padre.propertyName === nodo));
        const simbolo = ts.isShorthandPropertyAssignment(padre)
          ? checker.getShorthandAssignmentValueSymbol(padre) : checker.getSymbolAtLocation(nodo);
        if (!propiedad && !simbolo) errores.push(`${fuente.fileName}: identificador libre ${nodo.text}`);
      }
      ts.forEachChild(nodo, visitar);
    }
    visitar(fuente);
  }
  return errores;
}
for (const fuente of ['localStorage.getItem("x");', 'sessionStorage.setItem("x", "y");',
  'const x = { localStorage };', 'function f() { return sessionStorage; }'])
  assert(almacenesLibres(new Map([['/libre.js', fuente]])).length, fuente);
assert.deepEqual(almacenesLibres(new Map([['/declarado.js',
  'export {}; const o = { localStorage: 1 }; function f(sessionStorage) { return sessionStorage; }']])), []);
let cantidad = 0;
const fuentesPaquetes = new Map();
async function recorrer(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    // pruebas/ y demo/ son anfitriones (como las cáscaras): pueden leer globales para inyectarlos.
    if (e.name === 'pruebas' || e.name === 'demo' || e.name === 'node_modules') continue;
    const url = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
    if (e.isDirectory()) await recorrer(url);
    else if (e.name.endsWith('.js')) {
      const fuente = await readFile(url, 'utf8'); cantidad++;
      fuentesPaquetes.set(fileURLToPath(url), fuente);
      assert.deepEqual(infracciones(fuente), [], fileURLToPath(url));
      assert(!fuente.includes('?v='), `${fileURLToPath(url)}: sin versiones manuales`);
    }
  }
}
await recorrer(new URL('paquetes/', raiz));
assert.deepEqual(almacenesLibres(fuentesPaquetes), [], 'almacenamiento de navegador fuera de paquetes');
const html = await readFile(new URL('Prototypes/Rocket Launcher/index.html', raiz), 'utf8');
assert(!html.includes('?v='), 'HTML del juego sin versiones manuales');
const scripts = [...html.matchAll(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>/g)];
const indice = scripts.findIndex(([, , src]) => src === 'js/servicios.js');
assert(indice > 0 && /type="module"/.test(scripts[indice][1]));
assert.equal(scripts[indice + 1][2], 'js/juego.js', 'servicios antes de la composición, incluso si esta falla');
for (const [, attrs, src] of scripts.slice(0, indice))
  assert(!/\basync\b|type="module"/.test(attrs), `${src}: clásico ordenado antes de leer servicios`);
const internos = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(([, js]) => js).join('\n');
assert(!/\b(?:CMG\w+|THREE|acorn|LezerPython)\b/.test(internos),
  'el HTML no lee las bibliotecas, ni siquiera al avisar de un fallo');

if (!vm.SourceTextModule) {
  const hijo = spawnSync(process.execPath, ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning',
    fileURLToPath(import.meta.url)], { stdio: 'inherit' });
  process.exit(hijo.status ?? 1);
}
const fuentes = await readFile(new URL('Prototypes/Rocket Launcher/js/servicios.js', raiz), 'utf8');
assert(!fuentes.includes('?v='));
const iniciales = ['CMGI18n', 'CMGPresentacion', 'CMGTerreno', 'CMGTrazador', 'CMGFlujo',
  'CMGPythonRevision', 'acorn', 'LezerPython'];
const leidos = new Map(), eventos = new Map(), recursos = [];
let link = null, fallar = 'catalogo.js';
const valores = Object.fromEntries([...iniciales, 'CMGCatalogoRevision', 'CMGRevision'].map(k => [k, { id: k }]));
valores.CMGPresentacion.html = texto => 'traducido:' + texto;
const ventana = {};
for (const [k, valor] of Object.entries(valores)) Object.defineProperty(ventana, k, {
  get() { leidos.set(k, (leidos.get(k) || 0) + 1); return valor; },
});
const contexto = vm.createContext({ window: ventana, addEventListener: (tipo, fn) => eventos.set(tipo, fn),
  document: {
    querySelector: () => link, createElement: tag => ({ tag, dataset: {} }),
    head: { append(el) {
      if (el.tag === 'link') { link = el; return; }
      recursos.push(el.src);
      queueMicrotask(() => el.src.endsWith(fallar) ? el.onerror() : el.onload());
    } },
  },
});
const modulo = new vm.SourceTextModule(fuentes, { context: contexto });
const three = await import('../shared/vendor/three-r180/three.module.min.js');
await modulo.link(ruta => {
  assert.equal(ruta, '../../../shared/vendor/three-r180/three.module.min.js');
  return new vm.SyntheticModule(Object.keys(three), function () {
    for (const [k, valor] of Object.entries(three)) this.setExport(k, valor);
  }, { context: contexto });
});
await modulo.evaluate();
const servicios = modulo.namespace.servicios;
assert.equal(servicios.THREE.REVISION, '180');
assert.equal(typeof servicios.cargarGLTFLoader, 'function');
assert.equal(leidos.has('THREE'), false, 'Three viene del módulo, sin leer globales');
for (const k of iniciales) { assert.equal(leidos.get(k), 1, k); assert.equal(servicios[k], valores[k]); }
assert.equal(leidos.has('CMGRevision'), false, 'no lee el visor antes de cargarlo');
const fallida = servicios.cargarRevision();
assert.equal(servicios.cargarRevision(), fallida, 'una sola carga concurrente');
await assert.rejects(fallida, /motor\/catalogo.js/);
fallar = 'ninguno'; recursos.length = 0;
const carga = servicios.cargarRevision();
assert.equal(servicios.cargarRevision(), carga);
const motor = await carga;
assert.equal(motor.python, valores.CMGPythonRevision); assert.equal(motor.trazador, valores.CMGTrazador);
assert.equal(motor.revision, valores.CMGRevision); assert.equal(motor.catalogo, valores.CMGCatalogoRevision);
assert.deepEqual(recursos.map(src => src.split('/').at(-1)),
  ['textos.js', 'catalogo.js', 'explicar.js', 'documentacion.js', 'revision.js'], 'orden diferido, sin recargar proveedores existentes');
assert.equal(link.href, '../../educational-animation/revision/motor/revision.css');
assert.equal(await servicios.cargarRevision(), motor);
for (const k of Object.keys(valores)) assert.equal(leidos.get(k), 1, `${k}: leído una vez`);
const detalle = { html: 'fallo' };
eventos.get('cmg:error-arranque')({ detail: detalle });
assert.equal(detalle.html, 'traducido:fallo', 'el aviso de arranque usa la presentación capturada');
// Entrada de la demo: ejecuta su montaje con DOM/editor emulados, sin Chromium.
const tarjetas = Array.from({ length: 2 }, () => {
  const nodos = new Map();
  return { querySelector(selector) {
    if (!nodos.has(selector)) nodos.set(selector, { value: 'principal', checked: false,
      eventos: new Map(), addEventListener(tipo, fn) { this.eventos.set(tipo, fn); } });
    return nodos.get(selector);
  } };
});
const ventanaDemo = { acorn: {}, LezerPython: {} }, creados = [];
let configurados;
const contextoDemo = vm.createContext({ window: ventanaDemo, URLSearchParams,
  location: { search: '?forma=movil' }, document: { querySelectorAll: () => tarjetas } });
const entradaDemo = new URL('paquetes/editor/demo/demo.js', raiz);
const demo = new vm.SourceTextModule(await readFile(entradaDemo, 'utf8'), { context: contextoDemo });
await demo.link(async ruta => {
  const valores = { ...await import(new URL(ruta, entradaDemo)) };
  if (new URL(ruta, entradaDemo).pathname.endsWith('/editor/index.js')) {
    valores.configurar = opciones => { configurados = opciones; };
    valores.CMGEditor = { crear(opciones) {
      let documento = opciones.documento;
      assert(documento, 'documento inicial disponible al montar');
      const instancia = { opciones, documento: () => documento,
        abrir: otro => { documento = otro; }, refrescar() {}, destruir() { this.destruida = true; } };
      creados.push(instancia); return instancia;
    } };
  }
  return new vm.SyntheticModule(Object.keys(valores), function () {
    for (const [k, valor] of Object.entries(valores)) this.setExport(k, valor);
  }, { context: contextoDemo });
});
await demo.evaluate();
assert.equal(configurados.acorn, ventanaDemo.acorn);
assert.equal(configurados.lezer, ventanaDemo.LezerPython);
assert.equal(ventanaDemo.demoEditores.length, 2);
assert.deepEqual(creados.map(e => [e.documento().lenguaje, e.opciones.forma]), [['js', 'movil'], ['python', 'movil']]);
const selector = tarjetas[0].querySelector('[data-documento]');
selector.value = 'borrador'; selector.eventos.get('change')();
assert.equal(ventanaDemo.demoEditores[0].documento().id, 'borrador.js');
const anteriorDemo = ventanaDemo.demoEditores[0];
tarjetas[0].querySelector('[data-recrear]').eventos.get('click')();
assert(anteriorDemo.destruida);
assert.equal(ventanaDemo.demoEditores[0].documento().id, 'borrador.js');
for (const nombre of ['CMGEditor', 'CMGAdaptadorJS', 'CMGAdaptadorPython', 'CMGLenguajes',
  'CMGEditorJS', 'ESTRUCTURA', 'CMGPythonJS', 'CMGJSaPython']) assert(ventanaDemo[nombre], nombre);
assert.equal(ventanaDemo.cmg, undefined, 'demo sin fachada del juego');
console.log(`Globales: ${cantidad} archivos de paquetes sin lecturas externas ni almacenamiento libre; HTML sin ?v=; captura única, orden diferido, concurrencia, reintento y demo verificados en Node; 15 infracciones inyectadas rechazadas.`);
