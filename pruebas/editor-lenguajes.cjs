// Contrato D1/D2 e integridad de dependencias locales, sin paquetes instalados.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const raiz = path.join(__dirname, '..');
const leer = p => fs.readFileSync(path.join(raiz, p), 'utf8');
const ctx = vm.createContext({ window: {} });
for (const p of ['Prototypes/Rocket Launcher/js/proveedor.js', 'shared/editor/lenguajes.js']) vm.runInContext(leer(p), ctx);
const { CMGProveedor, CMGLenguajes } = ctx.window;
const factory = CMGProveedor.crear({ serie: 'factory' });
const fsRobot = factory.funciones().filter(f => f.grupo === 'Robot');
assert.equal(fsRobot.length, 4);
const recoger = fsRobot[0];
assert.equal(recoger.nombre, 'pickUp');
assert.equal(recoger.nombres.python, 'pick_up');
assert.equal(CMGLenguajes.llamada({ ...recoger, objeto: 'yo' }, 'python').texto, 'await yo.pick_up(__lugar__, __material__)');
assert.equal(CMGLenguajes.llamada(recoger).texto, 'await pickUp(/* lugar */, /* material */);');
for (const nombre of ['pick_up', 'pickUp', 'recoger']) {
  const alias = factory.alias('python').find(a => a.nombre === nombre);
  assert.equal(alias.destino, 'pickUp');
  assert.equal(alias.orden, 'recoger');
  assert.equal(alias.await, true);
}
assert(!factory.vocabulario().funciones.includes('pick_up'));
assert(factory.vocabulario('python').funciones.includes('pick_up'));
assert(factory.vocabulario('python').funciones.includes('recoger'));
assert(!factory.alias().some(a => a.nombre === 'pick_up'));
recoger.nombres.python = 'roto'; recoger.firma.push('roto'); recoger.alias.push('roto');
assert.equal(factory.funciones()[0].nombres.python, 'pick_up');
assert.equal(factory.funciones()[0].firma.length, 2);
assert(!factory.alias('python').some(a => a.nombre === 'roto'));
assert.equal(CMGLenguajes.llamada(fsRobot[3], 'python').texto, 'count(__lugar__, __material__)');
for (const fn of fsRobot.slice(1, 3)) assert(CMGLenguajes.llamada(fn, 'python').texto.startsWith('await '));
assert(CMGLenguajes.python.awaitExplicito && CMGLenguajes.python.asyncDef && CMGLenguajes.python.awaitSuperior);
let sensores = ['VIB_1'];
const war = CMGProveedor.crear({ serie: 'war', sensores: () => sensores });
assert(war.funciones().some(f => f.objeto === 'VIB_1' && f.nombre === 'detect'));
sensores = ['VIB_2'];
assert(!war.funciones().some(f => f.objeto === 'VIB_1'));
assert(war.alias('python').some(a => a.nombre === 'auto_target' && a.destino === 'autoTarget' && !a.await));
assert(!war.alias().some(a => a.nombre === 'auto_target'));
assert(war.alias('python').some(a => a.nombre === 'wait' && a.destino === 'esperar' && a.await));
assert(!war.alias('python').some(a => a.nombre === 'pick_up'));
// Una API ajena también funciona: los nombres no están codificados en el generador.
const llamada = CMGLenguajes.llamada({ nombre: 'custom', nombres: { python: 'otra' }, firma: ['posición'] }, 'python');
assert.equal(llamada.texto, 'otra(__posicion__)');
assert.equal(llamada.texto.slice(...llamada.sel), '__posicion__');
for (const [archivo, hash] of Object.entries(JSON.parse(leer('shared/vendor/manifest.json')))) {
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(raiz, 'shared/vendor', archivo))).digest('hex'), hash, archivo);
}
const acorn = require('../shared/vendor/acorn-8.11.3.js');
assert.equal(acorn.version, '8.11.3');
assert.equal(require('../shared/vendor/three-r128.min.js').REVISION, '128');
acorn.parse('async function viaje() { await pickUp(ENT_1, "cobre"); } await viaje();', { ecmaVersion: 2022, allowAwaitOutsideFunction: true });
assert.throws(() => acorn.parse('function viaje() { await pickUp(); }', { ecmaVersion: 2022 }));
for (const archivo of ['Prototypes/Rocket Launcher/index.html', 'Prototypes/Rocket Launcher/probar.html', 'Prototypes/Rocket Launcher/js/factory-3d.js']) {
  assert(!/https?:\/\/(?:cdn\.|cdnjs\.|fonts\.)/.test(leer(archivo)), archivo);
}
console.log('D1/D2: nombres, alias por lenguaje/serie, aislamiento, llamadas y await; dependencias locales íntegras.');
