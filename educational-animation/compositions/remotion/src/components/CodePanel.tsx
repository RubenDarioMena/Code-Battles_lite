import {useMemo} from 'react';
import {tokenizeLines} from '../../../../shared/highlight';
import {theme} from '../../../../shared/theme';

/** Una fase de resaltado: desde `start` se iluminan `lines` (null = todas). */
export interface SelectionPhase {
  start: number;
  lines: number[] | null;
}

const DIM = 0.3;
const FADE = 0.4;

function lineOpacity(line: number, phases: SelectionPhase[], t: number) {
  const op = (p: SelectionPhase | undefined) => (!p || !p.lines ? 1 : p.lines.includes(line) ? 1 : DIM);
  let i = -1;
  for (let k = 0; k < phases.length; k++) if (t >= phases[k].start) i = k;
  if (i < 0) return 1;
  const k = Math.min(1, (t - phases[i].start) / FADE);
  return op(phases[i - 1]) + (op(phases[i]) - op(phases[i - 1])) * k;
}

export const CodePanel: React.FC<{
  code: string;
  label: string;
  labelColor: string;
  x: number;
  y: number;
  t: number;
  phases: SelectionPhase[];
}> = ({code, label, labelColor, x, y, t, phases}) => {
  const lines = useMemo(() => tokenizeLines(code), [code]);
  return (
    <div style={{position: 'absolute', left: x + 960 - 420, top: y + 540 - 150, width: 840}}>
      <div
        style={{
          textAlign: 'center',
          color: labelColor,
          fontFamily: theme.font.display,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 18,
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: theme.codeBg,
          border: `2px solid ${theme.line}`,
          borderRadius: 16,
          height: 230,
          boxSizing: 'border-box',
          padding: '0 30px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: theme.font.code,
          fontSize: 28,
          lineHeight: 1.45,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((tokens, i) => (
          <div key={i} style={{opacity: lineOpacity(i, phases, t)}}>
            {tokens.length === 0 ? ' ' : tokens.map((tk, j) => <span key={j} style={{color: tk.color}}>{tk.text}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
};
