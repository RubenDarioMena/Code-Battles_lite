import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generarVdf, opcionesVdf } from '../scripts/steam-vdf.mjs';
const ids = ['--appid=123', '--depot-windows=124', '--depot-linux=125'];
for (const args of [[], ['--appid=1'], [...ids, '--appid=456'], [...ids, '--rama=default'],
  [...ids, '--rama=x"\nsetlive'], [...ids, '--rama='], ['--appid=-1', ...ids.slice(1)],
  ['--appid=1e3', ...ids.slice(1)], ['--appid=4294967296', ...ids.slice(1)],
  ['--appid=123', '--depot-windows=124', '--depot-linux=124']])
  assert.throws(() => opcionesVdf(args));
const temporal = await mkdtemp(path.join(tmpdir(), 'cbl-steam vdf-'));
try {
  for (const rama of ['qa-privada', null]) {
    const archivo = await generarVdf([...ids, ...(rama ? [`--rama=${rama}`] : [])], temporal);
    const app = await readFile(archivo, 'utf8');
    assert(app.includes('"appid" "123"'));
    assert(app.includes('"124" "depot_build_windows.vdf"'));
    assert(app.includes('"125" "depot_build_linux.vdf"'));
    assert.equal(/setlive/i.test(app), !!rama, 'regenerar sin rama elimina setlive');
    if (rama) assert(app.includes(`"setlive" "${rama}"`));
    assert(!app.includes('{{'));
    for (const [nombre, plataforma, id] of [['windows', 'win32', '124'], ['linux', 'linux', '125']]) {
      const depot = await readFile(path.join(path.dirname(archivo), `depot_build_${nombre}.vdf`), 'utf8');
      assert(depot.includes(`"DepotID" "${id}"`));
      assert(depot.includes(path.join(temporal, 'dist/escritorio', `Code Battle Lite-${plataforma}-x64`).split(path.sep).join('/')));
      assert(depot.includes('"LocalPath" "*"')); assert(depot.includes('"recursive" "1"'));
      assert(!depot.includes('{{'));
    }
    assert.deepEqual((await readdir(path.dirname(archivo))).sort(),
      ['app_build.vdf', 'depot_build_linux.vdf', 'depot_build_windows.vdf', 'salida']);
  }
  console.log('SteamPipe: IDs, rutas absolutas con espacios, dos depósitos y setlive solo con rama explícita; sin cuentas ni subida.');
} finally { await rm(temporal, { recursive: true, force: true }); }
