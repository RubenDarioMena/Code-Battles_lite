// Paquete estático por lista permitida: no publica pruebas, documentos ni el laboratorio de animación.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const destino = path.join(raiz, 'dist');
const entradas = ['index.html', '404.html', 'css', 'campaign', 'shared', 'Prototypes/Tres vistas', 'Prototypes/Rocket Launcher', 'Prototypes/02_tres_vistas.html'];
// Comprobar fuentes antes de reconstruir la carpeta generada.
for (const entrada of entradas) await stat(path.join(raiz, entrada));
await rm(destino, { recursive: true, force: true });
await mkdir(destino);
for (const entrada of entradas) await cp(path.join(raiz, entrada), path.join(destino, entrada), { recursive: true });
console.log('Paquete de Netlify preparado en dist/ (sin dependencias ni compilación).');
