import {Circle, Line, Node} from '@motion-canvas/2d';
import {createComputed} from '@motion-canvas/core';
import {solveStickman, type Pose} from '../../../../shared/stickman';
import {theme} from '../../../../shared/theme';

export interface StickmanProps {
  pose: () => Pose;
  x: number;
  y: number;
  color?: string;
  opacity?: () => number;
}

/** Stickman vectorial provisional (se reemplazará por la exportación de StykAnimate). */
export function Stickman({pose, x, y, color = theme.ink, opacity = () => 1}: StickmanProps) {
  const skel = createComputed(() => solveStickman(pose()));
  return (
    <Node x={x} y={y} opacity={opacity}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Line
          points={() => skel().limbs[i].map((p) => [p.x, p.y] as [number, number])}
          stroke={color}
          lineWidth={11}
          lineCap="round"
          lineJoin="round"
        />
      ))}
      <Circle
        position={() => [skel().head.x, skel().head.y]}
        size={skel().headRadius * 2}
        stroke={color}
        lineWidth={10}
        fill={theme.bg}
      />
      <Circle position={() => [skel().eye.x, skel().eye.y]} size={9} fill={color} />
    </Node>
  );
}
