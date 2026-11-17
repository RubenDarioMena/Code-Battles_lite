// Lista única de distribución estática: Netlify y cáscara de escritorio.
import { cp, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const entradasPublicables = Object.freeze([
  'index.html', '404.html', 'css', 'campaign', 'shared', 'paquetes', 'cascaras/web',
  'herramientas/terreno', 'Prototypes/Tres vistas', 'Prototypes/Rocket Launcher',
  'Prototypes/02_tres_vistas.html',
  ...['trazador.js', 'flujo.js', 'python.js'].map(a => `educational-animation/revision/motor/${a}`),
]);

export async function comprobarFuentes(raiz) {
  for (const entrada of entradasPublicables) await stat(path.join(raiz, entrada));
}

export async function copiarPublicables(raiz, destino) {
  for (const entrada of entradasPublicables) {
    const salida = path.join(destino, entrada);
    await mkdir(path.dirname(salida), { recursive: true });
    await cp(path.join(raiz, entrada), salida, {
      recursive: true,
      filter: origen => entrada !== 'paquetes' || path.basename(origen) !== 'pruebas',
    });
  }
}
