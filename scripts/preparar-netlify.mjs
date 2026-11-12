// Paquete estático por lista permitida: solo tres módulos compartidos del laboratorio, sin sus páginas ni proyectos.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const raiz = fileURLToPath(new URL('../', import.meta.url));
const destino = path.join(raiz, 'dist');
const entradas = ['index.html', '404.html', 'css', 'campaign', 'shared', 'herramientas/terreno', 'Prototypes/Tres vistas', 'Prototypes/Rocket Launcher', 'Prototypes/02_tres_vistas.html'];
// El juego reutiliza estos módulos autónomos; no se distribuye el resto del laboratorio.
for (const archivo of ['trazador.js', 'flujo.js', 'python.js']) entradas.push(`educational-animation/revision/motor/${archivo}`);
// Comprobar fuentes antes de reconstruir la carpeta generada.
for (const entrada of entradas) await stat(path.join(raiz, entrada));
await rm(destino, { recursive: true, force: true });
await mkdir(destino);
for (const entrada of entradas) {
  const salida = path.join(destino, entrada);
  await mkdir(path.dirname(salida), { recursive: true });
  await cp(path.join(raiz, entrada), salida, { recursive: true });
}
console.log('Paquete de Netlify preparado en dist/ (sin dependencias ni compilación).');
