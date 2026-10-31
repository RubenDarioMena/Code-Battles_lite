// Escribe <render>.manifest.json junto a un render: resolución, FPS, duración,
// versiones de herramientas, comando y parámetros de origen (§9 de la visión).
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const [file, composition] = process.argv.slice(2);
if (!file || !existsSync(file)) {
  console.error(`render-manifest: no existe ${file}`);
  process.exit(1);
}

const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {encoding: 'utf8'}),
);
const video = probe.streams.find((s) => s.codec_type === 'video');
// Con pnpm cada dependencia vive en el node_modules de su workspace.
const version = (pkg) => {
  for (const dir of ['compositions/remotion', 'concepts/motion-canvas', '.']) {
    try {
      return JSON.parse(readFileSync(`${dir}/node_modules/${pkg}/package.json`, 'utf8')).version;
    } catch {}
  }
  return null;
};

const manifest = {
  file,
  composition,
  createdAt: new Date().toISOString(),
  width: video?.width,
  height: video?.height,
  fps: video?.r_frame_rate,
  durationSeconds: Number(probe.format.duration),
  codec: video?.codec_name,
  sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  tools: {
    node: process.version,
    remotion: version('remotion'),
    '@motion-canvas/core': version('@motion-canvas/core'),
    ffmpeg: execFileSync('ffmpeg', ['-version'], {encoding: 'utf8'}).split('\n')[0],
  },
  command: `pnpm run ${process.env.npm_lifecycle_event ?? '?'}`,
  params: JSON.parse(readFileSync('shared/await-pilot.json', 'utf8')),
};

writeFileSync(`${file}.manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log(`render-manifest: ${file}.manifest.json`);
