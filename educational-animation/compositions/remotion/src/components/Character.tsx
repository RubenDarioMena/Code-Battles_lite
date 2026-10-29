import {staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {solveStickman, type Pose} from '../../../../shared/stickman';
import {theme} from '../../../../shared/theme';

/**
 * Fuente del personaje:
 * - vector: stickman provisional dibujado con el esqueleto compartido.
 * - png: secuencia exportada por StykAnimate (PNG con alfa) copiada a public/ por sync-assets.
 *   Archivos esperados: public/<dir>/0001.png … <frames>.png
 */
export type CharacterSource =
  | {mode: 'vector'}
  | {mode: 'png'; dir: string; frames: number; fps: number; width: number; height: number; loop?: boolean};

/** Stickman vectorial en coordenadas SVG (origen entre los pies). */
export const VectorStickman: React.FC<{pose: Pose; x: number; y: number; opacity?: number; color?: string}> = ({
  pose,
  x,
  y,
  opacity = 1,
  color = theme.ink,
}) => {
  const s = solveStickman(pose);
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      {s.limbs.map((line, i) => (
        <polyline
          key={i}
          points={line.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      <circle cx={s.head.x} cy={s.head.y} r={s.headRadius} fill={theme.bg} stroke={color} strokeWidth={10} />
      <circle cx={s.eye.x} cy={s.eye.y} r={4.5} fill={color} />
    </g>
  );
};

/** Secuencia PNG anclada por el centro inferior en (x, y). */
export const PngSequence: React.FC<{source: Extract<CharacterSource, {mode: 'png'}>; x: number; y: number; startFrame?: number}> = ({
  source,
  x,
  y,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const raw = Math.floor(((frame - startFrame) * source.fps) / fps);
  const i = source.loop ? ((raw % source.frames) + source.frames) % source.frames : Math.min(Math.max(raw, 0), source.frames - 1);
  return (
    <image
      href={staticFile(`${source.dir}/${String(i + 1).padStart(4, '0')}.png`)}
      x={x - source.width / 2}
      y={y - source.height}
      width={source.width}
      height={source.height}
    />
  );
};
