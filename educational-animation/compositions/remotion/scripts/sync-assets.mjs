// Copia los recursos fuente (exportaciones de StykAnimate, voz, SFX) a public/
// para que Remotion los sirva con staticFile(). public/ es una copia regenerable.
import {cpSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const pub = join(here, '..', 'public');

const pairs = [
  [join(root, 'characters', 'exports'), join(pub, 'characters')],
  [join(root, 'audio'), join(pub, 'audio')],
];

mkdirSync(pub, {recursive: true});
for (const [from, to] of pairs) {
  if (!existsSync(from)) continue;
  cpSync(from, to, {recursive: true, filter: (src) => !src.endsWith('.gitkeep')});
  console.log(`sync-assets: ${from} → ${to}`);
}
