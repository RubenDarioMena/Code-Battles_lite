// Paquete estático por lista permitida: solo tres módulos compartidos del laboratorio, sin sus páginas ni proyectos.
import { mkdir, rm } from 'node:fs/promises';
import { comprobarFuentes, copiarPublicables } from './archivos-publicables.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const destino = path.join(raiz, 'dist');
// Comprobar fuentes antes de reconstruir la carpeta generada.
await comprobarFuentes(raiz);
await rm(destino, { recursive: true, force: true });
await mkdir(destino);
await copiarPublicables(raiz, destino);
console.log('Paquete de Netlify preparado en dist/ (sin dependencias ni compilación).');
