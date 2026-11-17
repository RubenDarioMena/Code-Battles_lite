// Nunca carga steamworks.js real ni Electron.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { crearSteam } = createRequire(import.meta.url)('../cascaras/escritorio/steam.cjs');

for (const appId of [undefined, null, 0, -1, '123', NaN, 1.5, 0x100000000]) {
  const steam = crearSteam({ appId, cargar() { assert.fail('no debe cargar el módulo'); } });
  assert.deepEqual(steam.estado(), { activo: false, appId: null });
  steam.desbloquear('CBL_PRUEBA_VICTORIA');
  steam.prepararSuperposicion({ SteamAppId: '123', SteamGameId: '123' });
}
for (const donde of ['cargar', 'init']) {
  const anotaciones = [];
  const steam = crearSteam({ appId: 123, registro: (...args) => anotaciones.push(args),
    cargar() {
      if (donde === 'cargar') throw new Error('binario no disponible');
      return { init() { throw new Error('Steam cerrado o sin licencia'); } };
    },
  });
  assert.deepEqual(steam.estado(), { activo: false, appId: 123 });
  steam.desbloquear('CBL_PRUEBA_VICTORIA');
  steam.prepararSuperposicion({ SteamAppId: '123' });
  assert.equal(anotaciones.length, 1, 'solo un aviso aunque falle también la superposición');
}

for (const entorno of [{}, { SteamAppId: '' }, { SteamGameId: '123' }, { SteamAppId: '123' },
  { SteamAppId: '123', SteamGameId: '123' }]) {
  const activados = new Set(['YA_EXISTE']), llamadas = [], anotaciones = [];
  let overlays = 0, cargas = 0;
  const steam = crearSteam({ appId: 123, registro: e => anotaciones.push(e), cargar() {
    cargas++;
    return {
      init(id) {
        assert.equal(id, 123);
        return { achievement: {
          isActivated: nombre => activados.has(nombre),
          activate(nombre) { llamadas.push(nombre); activados.add(nombre); return true; },
        } };
      },
      electronEnableSteamOverlay() { overlays++; },
    };
  } });
  assert.deepEqual(steam.estado(), { activo: true, appId: 123 });
  steam.desbloquear('YA_EXISTE');
  steam.desbloquear('CBL_PRUEBA_VICTORIA'); steam.desbloquear('CBL_PRUEBA_VICTORIA');
  steam.desbloquear(null); steam.desbloquear('');
  assert.deepEqual(llamadas, ['CBL_PRUEBA_VICTORIA']);
  steam.prepararSuperposicion(entorno); steam.prepararSuperposicion(entorno);
  assert.equal(overlays, entorno.SteamAppId || entorno.SteamGameId ? 1 : 0);
  assert.equal(cargas, 1); assert.deepEqual(anotaciones, []);
}
const avisos = [];
const fallos = crearSteam({ appId: 123, registro: e => avisos.push(e), cargar: () => ({
  init: () => ({ achievement: { isActivated() { throw new Error('servicio desconectado'); } } }),
  electronEnableSteamOverlay() { throw new Error('overlay no disponible'); },
}) });
assert.doesNotThrow(() => {
  fallos.desbloquear('CBL_PRUEBA_VICTORIA'); fallos.desbloquear('CBL_PRUEBA_VICTORIA');
  fallos.prepararSuperposicion({ SteamAppId: '123' });
});
assert.equal(avisos.length, 1);
console.log('Steam opcional: carga diferida, fallos tolerados, logro idempotente y superposición condicionada; módulo falso, sin Electron.');
