// Guardado de texto, sin navegador ni disco; ejercita también consumidores reales.
import assert from 'node:assert/strict';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';
import { crearPlataformaWeb } from '../cascaras/web/plataforma.js';
import { crearEstadoJuego } from '../paquetes/app/juego/estado.js';
import { configurar } from '../paquetes/editor/index.js';
import { preparar } from '../paquetes/editor/edicion-acciones.js';

const llamadas = [];
function almacenamientoFalso(nombre) {
  const datos = new Map();
  return {
    getItem(clave) { llamadas.push([nombre, 'leer', clave]); return datos.get(clave) ?? null; },
    setItem(clave, texto) { llamadas.push([nombre, 'escribir', clave, texto]); datos.set(clave, texto); },
    removeItem(clave) { llamadas.push([nombre, 'borrar', clave]); datos.delete(clave); },
  };
}
const ventana = { localStorage: almacenamientoFalso('local'), sessionStorage: almacenamientoFalso('sesion') };
const web = crearPlataformaWeb(ventana);
const claves = ['cmg-banco03:prog-0', 'cmg-banco03:factory-propio', 'cmg-banco02:reto',
  'cmg-juego-factory-idioma-seudo', 'cmg-banco03:remota:quien', 'cmg-portapapeles', '', '__proto__'];
const textos = ['false', 'null', '0', '"2d"', ' { "texto": "á\\n🐢" } \n', 'sin JSON\n', ''];
for (const plataforma of [web, crearPlataformaMemoria()]) {
  for (const clave of claves) for (const texto of textos) {
    assert.equal(plataforma.almacen.leer(clave), null);
    plataforma.almacen.escribir(clave, texto);
    assert.equal(plataforma.almacen.leer(clave), texto);
    assert.equal(plataforma.sesion.leer(clave), null);
    plataforma.sesion.escribir(clave, 'sesión');
    assert.equal(plataforma.almacen.leer(clave), texto);
    plataforma.almacen.borrar(clave);
    assert.equal(plataforma.almacen.leer(clave), null);
    assert.equal(plataforma.sesion.leer(clave), 'sesión');
    plataforma.sesion.borrar(clave);
    plataforma.sesion.borrar(clave); // borrar una clave ausente no falla
  }
}
assert(llamadas.some(c => JSON.stringify(c) === JSON.stringify(['local', 'escribir', claves[0], textos[4]])));
assert(llamadas.some(c => c[0] === 'sesion' && c[1] === 'borrar' && c[2] === 'cmg-portapapeles'));
const otra = crearPlataformaMemoria();
otra.almacen.escribir('x', 'guardado');
assert.equal(crearPlataformaMemoria().almacen.leer('x'), null, 'cada plataforma tiene sus propios datos');

const falla = () => { throw new Error('almacenamiento bloqueado'); };
for (const ventana of [
  {},
  { localStorage: { getItem: falla, setItem: falla, removeItem: falla },
    sessionStorage: { getItem: falla, setItem: falla, removeItem: falla } },
  Object.defineProperties({}, { localStorage: { get: falla }, sessionStorage: { get: falla } }),
]) {
  const plataforma = crearPlataformaWeb(ventana);
  for (const almacen of [plataforma.almacen, plataforma.sesion]) {
    assert.equal(almacen.leer('clave'), null);
    assert.doesNotThrow(() => almacen.escribir('clave', 'texto'));
    assert.doesNotThrow(() => almacen.borrar('clave'));
  }
}

// Las migraciones siguen leyendo el banco antiguo ANTES del nuevo, incluso
// cuando el nuevo existe. Las conversiones JSON siguen siendo del consumidor.
globalThis.location = new URL('http://qa.invalid/?serie=factory');
globalThis.document = { documentElement: { dataset: {} } };
const plataforma = crearPlataformaMemoria(), lecturas = [];
plataforma.almacen.escribir('cmg-banco02:reto', '2');
plataforma.almacen.escribir('cmg-banco02:propio', '{"titulo":"Antiguo"}');
const leer = plataforma.almacen.leer;
plataforma.almacen.leer = clave => { lecturas.push(clave); return leer(clave); };
const antiguo = crearEstadoJuego({ plataforma });
assert.equal(antiguo.retoIdx, 2);
assert.equal(antiguo.propio.titulo, 'Antiguo');
assert.deepEqual(lecturas.slice(0, 4), ['cmg-banco02:reto', 'cmg-banco03:factory-reto',
  'cmg-banco02:propio', 'cmg-banco03:factory-propio']);
plataforma.almacen.escribir('cmg-banco03:factory-reto', '1');
plataforma.almacen.escribir('cmg-banco03:factory-propio', '{"titulo":"Nuevo"}');
const nuevo = crearEstadoJuego({ plataforma });
assert.equal(nuevo.retoIdx, 1);
assert.equal(nuevo.propio.titulo, 'Nuevo');
nuevo.guardado.escribir('prog-factory-1', { R1: 'console.log("á");\n' });
assert.equal(leer('cmg-banco03:prog-factory-1'), '{"R1":"console.log(\\"á\\");\\n"}');
plataforma.almacen.escribir('cmg-banco03:factory-reto', '{inválido');
assert.equal(crearEstadoJuego({ plataforma }).retoIdx, 2);
assert.equal(nuevo.guardado.leer('inexistente', 'defecto'), 'defecto');
delete globalThis.location;
delete globalThis.document;

// El portapapeles se mantiene en memoria por defecto y admite la sesión inyectada.
function edicion() {
  const ctx = { adaptador: { estructura: {} }, $: () => ({}),
    cmg: { codigo: { value: '' }, claveDocumento: 'qa' },
    preferencias: { leer: (_clave, defecto) => defecto, escribir() {} },
    vida: { escuchar() {} } };
  preparar(ctx)();
  return ctx;
}
const porDefecto = edicion();
porDefecto.guardarCopia('memoria\n');
assert.equal(edicion().portapapeles, 'memoria\n');
configurar({ sesion: web.sesion });
const editor = edicion();
editor.guardarCopia('copiado\n');
assert.equal(ventana.sessionStorage.getItem('cmg-portapapeles'), 'copiado\n');
assert.equal(edicion().portapapeles, 'copiado\n');
assert.equal(web.almacen.leer('cmg-portapapeles'), null);
console.log('Plataforma: claves/textos exactos, separación local/sesión, memoria aislada, errores, migración Factory y portapapeles verificados en Node.');
