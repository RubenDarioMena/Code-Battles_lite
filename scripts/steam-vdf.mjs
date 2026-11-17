import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { carpetaSalida } from './empaquetar-escritorio.mjs';

const raizRepo = fileURLToPath(new URL('../', import.meta.url));
const uso = 'Uso: npm run escritorio:steam-vdf -- --appid=N --depot-windows=N --depot-linux=N [--rama=nombre]';

export function opcionesVdf(argumentos) {
  /** @type {Record<string, string>} */
  const opciones = {};
  for (const argumento of argumentos) {
    const par = /^--(appid|depot-windows|depot-linux|rama)=(.+)$/.exec(argumento);
    if (!par || Object.hasOwn(opciones, par[1])) throw new Error(uso);
    opciones[par[1]] = par[2];
  }
  for (const clave of ['appid', 'depot-windows', 'depot-linux']) {
    const id = opciones[clave];
    if (!/^[1-9]\d*$/.test(id || '') || Number(id) > 0xffffffff) throw new Error(uso);
  }
  if (opciones['depot-windows'] === opciones['depot-linux']) throw new Error('Los depósitos deben ser distintos');
  if (opciones.rama && (!/^[a-zA-Z0-9_-]+$/.test(opciones.rama) || opciones.rama.toLowerCase() === 'default'))
    throw new Error('Usa el nombre de una rama privada, distinto de default (letras, números, _ o -)');
  return opciones;
}

function rutaVdf(ruta) {
  // Rutas absolutas independientes del directorio desde el que corre steamcmd.
  const valor = path.resolve(ruta).split(path.sep).join('/');
  if (/["\r\n]/.test(valor)) throw new Error('La ruta contiene caracteres incompatibles con VDF');
  return valor;
}

export async function generarVdf(argumentos, raiz = raizRepo) {
  const opciones = opcionesVdf(argumentos);
  const destino = path.join(raiz, 'dist/steam');
  const valores = {
    APPID: opciones.appid, DEPOT_WINDOWS: opciones['depot-windows'], DEPOT_LINUX: opciones['depot-linux'],
    BUILDOUTPUT: rutaVdf(path.join(destino, 'salida')),
    CONTENIDO_WINDOWS: rutaVdf(path.join(raiz, 'dist/escritorio', carpetaSalida('win32'))),
    CONTENIDO_LINUX: rutaVdf(path.join(raiz, 'dist/escritorio', carpetaSalida('linux'))),
    SETLIVE: opciones.rama ? `"setlive" "${opciones.rama}"` : '',
  };
  await mkdir(path.join(destino, 'salida'), { recursive: true });
  const archivos = ['app_build.vdf', 'depot_build_windows.vdf', 'depot_build_linux.vdf'];
  for (const archivo of archivos) {
    const plantilla = await readFile(path.join(raizRepo, 'cascaras/escritorio/steam', archivo + '.plantilla'), 'utf8');
    const texto = plantilla.replace(/\{\{([A-Z_]+)\}\}/g, (_marca, clave) => {
      if (!Object.hasOwn(valores, clave)) throw new Error(`Variable VDF desconocida: ${clave}`);
      return valores[clave];
    });
    await writeFile(path.join(destino, archivo), texto);
  }
  return path.join(destino, 'app_build.vdf');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generarVdf(process.argv.slice(2)).then(archivo => console.log(`SteamPipe: ${archivo}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
