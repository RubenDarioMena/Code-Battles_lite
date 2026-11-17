import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packager } from '@electron/packager';
import { comprobarFuentes, copiarPublicables } from './archivos-publicables.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));

export const nativosSteam = {
  win32: ['win64', 'steamworksjs.win32-x64-msvc.node', 'steam_api64.dll'],
  linux: ['linux64', 'steamworksjs.linux-x64-gnu.node', 'libsteam_api.so'],
  darwin: ['osx', 'steamworksjs.darwin-x64.node', 'libsteam_api.dylib'],
};
export const carpetaSalida = plataforma => `Code Battle Lite-${plataforma}-x64`;

// La misma configuración se inspecciona en Node sin invocar packager.
export function manifiestoEmpaquetado(dir, out, platform, electronVersion) {
  return { dir, out, platform, arch: 'x64', electronVersion,
    name: 'Code Battle Lite', executableName: 'code-battle-lite',
    asar: { unpack: '**/*.{node,dll,so,dylib}' }, overwrite: true, prune: false };
}

export function plataformas(argumentos) {
  if (!argumentos.length) return ['win32', 'linux'];
  const opcion = argumentos.length === 1 && /^--plataforma=(win32|linux|darwin)$/.exec(argumentos[0]);
  if (!opcion) throw new Error('Uso: npm run escritorio:empaquetar -- [--plataforma=win32|linux|darwin]');
  return [opcion[1]];
}

// Exportada para verificar el contenido sin ejecutar packager ni descargar Electron.
export async function prepararApp(destino, plataforma = 'win32') {
  if (!nativosSteam[plataforma]) throw new Error(`Plataforma desconocida: ${plataforma}`);
  await comprobarFuentes(raiz);
  await copiarPublicables(raiz, destino);
  await cp(path.join(raiz, 'cascaras/escritorio'), path.join(destino, 'cascaras/escritorio'), { recursive: true });
  const origenSteam = path.join(raiz, 'node_modules/steamworks.js');
  const destinoSteam = path.join(destino, 'node_modules/steamworks.js');
  await rm(destinoSteam, { recursive: true, force: true });
  await mkdir(destinoSteam, { recursive: true });
  for (const archivo of ['index.js', 'package.json', 'LICENSE'])
    await cp(path.join(origenSteam, archivo), path.join(destinoSteam, archivo));
  const [carpeta] = nativosSteam[plataforma];
  await cp(path.join(origenSteam, 'dist', carpeta), path.join(destinoSteam, 'dist', carpeta), { recursive: true });
  const steam = JSON.parse(await readFile(path.join(origenSteam, 'package.json'), 'utf8'));
  const { name, version } = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));
  if (!version) throw new Error('package.json necesita version');
  await writeFile(path.join(destino, 'package.json'), JSON.stringify({
    name, productName: 'Code Battle Lite', version, main: 'cascaras/escritorio/main.cjs',
    dependencies: { 'steamworks.js': steam.version },
  }, null, 2) + '\n');
}

export async function verificarSalida(salida, plataforma) {
  const recursos = plataforma === 'darwin' ? 'Code Battle Lite.app/Contents/Resources' : 'resources';
  const binario = plataforma === 'win32' ? 'code-battle-lite.exe'
    : plataforma === 'darwin' ? 'Code Battle Lite.app/Contents/MacOS/code-battle-lite' : 'code-battle-lite';
  const [carpeta, ...nativos] = nativosSteam[plataforma];
  for (const archivo of [binario, ...nativos.map(n => path.join(recursos,
    'app.asar.unpacked/node_modules/steamworks.js/dist', carpeta, n))]) {
    if (!(await stat(path.join(salida, archivo))).isFile()) throw new Error(`Falta ${archivo}`);
  }
  console.log(`Ejecutable y nativos Steam verificados: ${salida}`);
}

async function principal() {
  const elegidas = plataformas(process.argv.slice(2));
  const temporal = await mkdtemp(path.join(tmpdir(), 'cbl-escritorio-'));
  try {
    const { version: electronVersion } = JSON.parse(await readFile(path.join(raiz, 'node_modules/electron/package.json'), 'utf8'));
    const destino = path.join(raiz, 'dist/escritorio');
    await mkdir(destino, { recursive: true });
    for (const plataforma of elegidas) {
      await prepararApp(temporal, plataforma);
      const salidas = await packager(manifiestoEmpaquetado(temporal, destino, plataforma, electronVersion));
      if (!salidas.length) throw new Error(`Sin paquete para ${plataforma}`);
      for (const salida of salidas) await verificarSalida(salida, plataforma);
    }
  } finally { await rm(temporal, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  principal().catch(error => { console.error(error); process.exitCode = 1; });
