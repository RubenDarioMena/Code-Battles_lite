// Sin Electron, Chromium ni red: protocolo, disco, caché del preload y geometría.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { MIME, resolverRuta, servir, esInterna, peticionPermitida } = require('../cascaras/escritorio/protocolo.cjs');
const { crearGuardado } = require('../cascaras/escritorio/guardado.cjs');
const { limitar, leerVentana } = require('../cascaras/escritorio/ventana.cjs');
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'cbl-disco-'));
try {
  const raiz = path.join(temporal, 'app'); fs.mkdirSync(raiz);
  for (const [ext, tipo] of Object.entries(MIME)) {
    fs.writeFileSync(path.join(raiz, 'recurso' + ext), 'contenido');
    const url = 'cbl://app/recurso' + ext;
    assert.equal(resolverRuta(raiz, url).tipo, tipo);
    const respuesta = await servir(raiz, { url, method: 'GET' });
    assert.equal(respuesta.status, 200); assert.equal(respuesta.headers.get('content-type'), tipo);
    assert.equal(await respuesta.text(), 'contenido');
  }
  fs.mkdirSync(path.join(raiz, 'con espacio'));
  fs.writeFileSync(path.join(raiz, 'con espacio/index.html'), 'hola');
  assert.equal((await servir(raiz, { url: 'cbl://app/con%20espacio/?serie=war', method: 'GET' })).status, 200);
  for (const ruta of ['../package.json', '%2e%2e/package.json', 'a/../../x.js',
    'a/%2E%2e/x.js', '%252e%252e/x.js', '%2fetc/passwd.txt', '/etc/passwd.txt',
    'C:/x.js', 'a\\..\\x.js', 'a%5c..%5cx.js', '%00.js', '%zz.js',
    'package.json', '.env', 'x.exe', 'ausente.js', 'cascaras/escritorio/main.cjs']) {
    const url = 'cbl://app/' + ruta;
    assert.equal((await servir(raiz, { url, method: 'GET' })).status, 404, url);
  }
  for (const url of ['file:///etc/passwd', 'https://example.com/x.js', 'cbl://otro/x.js', 'cbl://user@app/x.js']) {
    assert.equal(resolverRuta(raiz, url), null); assert.equal(peticionPermitida(url), false);
  }
  assert(esInterna('cbl://app/index.html')); assert(peticionPermitida('blob:cbl://app/abc'));
  assert(peticionPermitida('data:text/plain,hola'));
  assert.equal((await servir(raiz, { url: 'cbl://app/recurso.js', method: 'POST' })).status, 404);
  assert.equal(await (await servir(raiz, { url: 'cbl://app/recurso.js', method: 'HEAD' })).text(), '');
  fs.writeFileSync(path.join(temporal, 'secreto.txt'), 'fuera');
  fs.symlinkSync(path.join(temporal, 'secreto.txt'), path.join(raiz, 'enlace.txt'));
  assert.equal((await servir(raiz, { url: 'cbl://app/enlace.txt', method: 'GET' })).status, 404);

  const carpeta = path.join(temporal, 'datos'), archivo = path.join(carpeta, 'guardado.json');
  let escrituras = 0, renombres = 0;
  const disco = { ...fs, writeFileSync(...args) { escrituras++; return fs.writeFileSync(...args); },
    renameSync(origen, destino) {
      renombres++; assert.notEqual(origen, destino); assert.equal(destino, archivo);
      // El temporal ya es un documento completo antes de sustituir el destino.
      assert.equal(JSON.parse(fs.readFileSync(origen, 'utf8')).version, 1);
      return fs.renameSync(origen, destino);
    } };
  const guardado = crearGuardado(carpeta, { retardo: 20, disco });
  assert.deepEqual(guardado.cargar(), {});
  for (const clave of ['cmg-banco03:reto', '__proto__', '', 'cmg-banco03:prog-1'])
    guardado.cambiar('escribir', clave, ' { "á": "🐢" }\n');
  guardado.cambiar('escribir', 'borrar', 'x'); guardado.cambiar('borrar', 'borrar');
  guardado.cambiar('escribir', 'invalida', 7); guardado.cambiar('otra', 'no', 'x');
  assert.equal(escrituras, 0);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(escrituras, 1); assert.equal(renombres, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(archivo, 'utf8')), { version: 1, almacen: guardado.cargar() });
  assert.equal(guardado.cargar()['__proto__'], ' { "á": "🐢" }\n');
  const copia = guardado.cargar(); copia[''] = 'ajena'; assert.notEqual(guardado.cargar()[''], 'ajena');
  assert.deepEqual(crearGuardado(carpeta).cargar(), guardado.cargar());
  guardado.cambiar('escribir', 'cierre', '"2d"'); guardado.volcar(); guardado.volcar();
  assert.equal(escrituras, 2); assert.equal(JSON.parse(fs.readFileSync(archivo, 'utf8')).almacen.cierre, '"2d"');
  await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(escrituras, 2, 'cierre cancela el temporizador');

  let errores = 0;
  const anterior = fs.readFileSync(archivo, 'utf8');
  const fallo = crearGuardado(carpeta, { disco: { ...fs, renameSync() { throw new Error('disco lleno'); } }, alError() { errores++; } });
  fallo.cambiar('escribir', 'x', 'y'); fallo.volcar();
  assert.equal(errores, 1); assert.equal(fs.readFileSync(archivo, 'utf8'), anterior);
  for (const contenido of ['{roto', '{"version":2,"almacen":{}}', '{"version":1,"almacen":{"x":1}}', '{"version":1,"almacen":[]}']) {
    fs.writeFileSync(archivo, contenido);
    assert.deepEqual(crearGuardado(carpeta).cargar(), {});
    assert(!fs.existsSync(archivo));
    const apartados = fs.readdirSync(carpeta).filter(n => n.startsWith('guardado.json.danado-'));
    assert(apartados.some(n => fs.readFileSync(path.join(carpeta, n), 'utf8') === contenido));
  }

  const fuente = fs.readFileSync(new URL('../cascaras/escritorio/preload.cjs', import.meta.url), 'utf8');
  function cargarPreload() {
    let api; const enviados = [];
    vm.runInNewContext(fuente, { require(nombre) {
      assert.equal(nombre, 'electron');
      return { contextBridge: { exposeInMainWorld(nombre, valor) { assert.equal(nombre, 'cblCascara'); api = valor; } },
        ipcRenderer: { sendSync(canal) { assert.equal(canal, 'cbl:cargar'); return { version: '0.1.0', almacen: { x: 'texto' }, sesion: {} }; },
          send(...args) { enviados.push(args); } } };
    } });
    return { api, enviados };
  }
  const { api, enviados } = cargarPreload();
  assert.equal(api.nombre, 'escritorio'); assert.equal(api.plataforma.almacen.leer('x'), 'texto');
  const { almacen, sesion } = api.plataforma;
  for (const clave of ['__proto__', '', 'x']) {
    almacen.escribir(clave, ' \n"2d"'); assert.equal(almacen.leer(clave), ' \n"2d"');
    sesion.escribir(clave, 'sesión'); assert.equal(sesion.leer(clave), 'sesión');
    almacen.borrar(clave); assert.equal(almacen.leer(clave), null); assert.equal(sesion.leer(clave), 'sesión');
    sesion.borrar(clave); assert.equal(sesion.leer(clave), null);
  }
  assert.equal(enviados.filter(e => e[0] === 'cbl:cambiar').length, 6);
  assert.equal(enviados.filter(e => e[0] === 'cbl:sesion').length, 6);
  assert.equal(cargarPreload().api.plataforma.sesion.leer('x'), null);
  assert.equal(enviados[0][0], 'cbl:cambiar');

  const area = { x: -1600, y: 0, width: 1600, height: 900 };
  assert.deepEqual(limitar({ x: 9000, y: -2000, width: 1920, height: 1080 }, area), area);
  assert(Object.values(limitar({ x: -800.5, y: 10.5, width: 800.5, height: 600.5 }, area)).every(Number.isInteger));
  assert.equal(leerVentana(path.join(temporal, 'no.json')), null);
  console.log('Escritorio Node: rutas/MIME, escapes/symlinks, disco atómico agrupado/cierre/dañados, preload y geometría verificados.');
} finally { fs.rmSync(temporal, { recursive: true, force: true }); }
