import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packager } from '@electron/packager';
import { comprobarFuentes, copiarPublicables } from './archivos-publicables.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));

export function plataformas(argumentos) {
  if (!argumentos.length) return ['win32', 'linux'];
  const opcion = argumentos.length === 1 && /^--plataforma=(win32|linux|darwin)$/.exec(argumentos[0]);
  if (!opcion) throw new Error('Uso: npm run escritorio:empaquetar -- [--plataforma=win32|linux|darwin]');
  return [opcion[1]];
}

// Exportada para verificar el contenido sin ejecutar packager ni descargar Electron.
export async function prepararApp(destino) {
  await comprobarFuentes(raiz);
  await copiarPublicables(raiz, destino);
  await cp(path.join(raiz, 'cascaras/escritorio'), path.join(destino, 'cascaras/escritorio'), { recursive: true });
  const { name, version } = JSON.parse(await readFile(path.join(raiz, 'package.json'), 'utf8'));
  if (!version) throw new Error('package.json necesita version');
  await writeFile(path.join(destino, 'package.json'), JSON.stringify({
    name, productName: 'Code Battle Lite', version, main: 'cascaras/escritorio/main.cjs',
  }, null, 2) + '\n');
}

async function principal() {
  const elegidas = plataformas(process.argv.slice(2));
  const temporal = await mkdtemp(path.join(tmpdir(), 'cbl-escritorio-'));
  try {
    await prepararApp(temporal);
    const { version: electronVersion } = JSON.parse(await readFile(path.join(raiz, 'node_modules/electron/package.json'), 'utf8'));
    const destino = path.join(raiz, 'dist/escritorio');
    await mkdir(destino, { recursive: true });
    for (const plataforma of elegidas) {
      const salidas = await packager({
        dir: temporal, out: destino, platform: plataforma, arch: 'x64', electronVersion,
        name: 'Code Battle Lite', executableName: 'code-battle-lite', asar: true,
        overwrite: true, prune: false,
      });
      if (!salidas.length) throw new Error(`Sin paquete para ${plataforma}`);
      for (const salida of salidas) {
        const binario = plataforma === 'win32' ? 'code-battle-lite.exe'
          : plataforma === 'darwin' ? 'Code Battle Lite.app/Contents/MacOS/code-battle-lite' : 'code-battle-lite';
        if (!(await stat(path.join(salida, binario))).isFile()) throw new Error(`Falta ${binario}`);
        console.log(`Ejecutable verificado: ${path.join(salida, binario)}`);
      }
    }
  } finally { await rm(temporal, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  principal().catch(error => { console.error(error); process.exitCode = 1; });
