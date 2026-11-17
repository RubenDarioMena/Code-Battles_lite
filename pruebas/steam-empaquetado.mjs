import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepararApp, manifiestoEmpaquetado, verificarSalida, nativosSteam } from '../scripts/empaquetar-escritorio.mjs';

const temporal = await mkdtemp(path.join(tmpdir(), 'cbl-steam-paquete-'));
try {
  const app = path.join(temporal, 'app');
  for (const plataforma of ['win32', 'linux', 'darwin']) {
    await prepararApp(app, plataforma);
    const paquete = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'));
    assert.equal(paquete.productName, 'Code Battle Lite');
    assert.deepEqual(paquete.dependencies, { 'steamworks.js': '0.4.0' });
    assert.deepEqual(JSON.parse(await readFile(path.join(app, 'cascaras/escritorio/steam.json'), 'utf8')), { appId: null });
    const modulo = path.join(app, 'node_modules/steamworks.js');
    assert.deepEqual((await readdir(modulo)).sort(), ['LICENSE', 'dist', 'index.js', 'package.json']);
    const [carpeta, ...binarios] = nativosSteam[plataforma];
    assert.deepEqual(await readdir(path.join(modulo, 'dist')), [carpeta], 'solo el destino, sin residuos del anterior');
    for (const archivo of ['index.js', 'package.json', 'LICENSE', ...binarios.map(n => `dist/${carpeta}/${n}`)])
      assert.deepEqual(await readFile(path.join(modulo, archivo)),
        await readFile(new URL(`../node_modules/steamworks.js/${archivo}`, import.meta.url)));
    const opciones = manifiestoEmpaquetado(app, temporal, plataforma, '45.2.1');
    assert.equal(opciones.platform, plataforma); assert.equal(opciones.arch, 'x64');
    assert.deepEqual(opciones.asar, { unpack: '**/*.{node,dll,so,dylib}' });
    assert.equal(opciones.prune, false);

    // Emula solo la estructura de salida: no packager, no ASAR, no ejecutables reales.
    const salida = path.join(temporal, plataforma);
    const recursos = plataforma === 'darwin' ? 'Code Battle Lite.app/Contents/Resources' : 'resources';
    const binario = plataforma === 'win32' ? 'code-battle-lite.exe'
      : plataforma === 'darwin' ? 'Code Battle Lite.app/Contents/MacOS/code-battle-lite' : 'code-battle-lite';
    const archivos = [binario, ...binarios.map(n => path.join(recursos,
      'app.asar.unpacked/node_modules/steamworks.js/dist', carpeta, n))];
    for (const archivo of archivos) {
      await assert.rejects(verificarSalida(salida, plataforma), /ENOENT/);
      const destino = path.join(salida, archivo);
      await mkdir(path.dirname(destino), { recursive: true }); await writeFile(destino, 'emulado');
    }
    await verificarSalida(salida, plataforma);
  }
  console.log('Manifiesto Steam y copias por plataforma verificados; comprobador de ejecutable/nativos probado con archivos emulados, sin empaquetar.');
} finally { await rm(temporal, { recursive: true, force: true }); }
