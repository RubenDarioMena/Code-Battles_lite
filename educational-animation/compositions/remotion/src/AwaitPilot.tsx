// Piloto: polling ocupado frente a espera asíncrona (variante A, pantalla dividida).
// Cada fotograma es una función pura de t = frame / fps (shared/awaitPilot.ts).
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadArchivo} from '@remotion/google-fonts/Archivo';
import {loadFont as loadJetBrains} from '@remotion/google-fonts/JetBrainsMono';
import {
  asyncBoxPosition,
  asyncPose,
  attemptsAt,
  blurAmount,
  blurSamples,
  boxDrop,
  busyPose,
  cues,
  frequencyAt,
  ramp,
  type PilotParams,
} from '../../../shared/awaitPilot';
import {solveStickman} from '../../../shared/stickman';
import {theme} from '../../../shared/theme';
import {PngSequence, VectorStickman, type CharacterSource} from './components/Character';
import {CodePanel} from './components/CodePanel';

loadArchivo('normal', {weights: ['400', '600', '700', '800'], subsets: ['latin', 'latin-ext']});
loadJetBrains('normal', {weights: ['400', '600'], subsets: ['latin', 'latin-ext']});

export type AwaitPilotProps = PilotParams & {
  characters: {busy: CharacterSource; async: CharacterSource};
  /** Ruta dentro de public/, p. ej. "audio/voice/await-es.wav". */
  voice?: string;
};

const GROUND = 400;
const BUSY_X = -560;
const ASYNC_X = 260;
const PAD = 130;
const BOX = 70;

const Box: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={-BOX / 2} y={-BOX / 2} width={BOX} height={BOX} rx={6} fill={theme.cobre} stroke={theme.laton} strokeWidth={3} />
    <line x1={-BOX / 2} y1={-6} x2={BOX / 2} y2={-6} stroke={theme.laton} strokeWidth={6} />
  </g>
);

export const AwaitPilot: React.FC<AwaitPilotProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const c = cues(props);
  const text = props.texts[props.lang];
  const code = props.code[props.lang];
  const blurK = blurAmount(props, c, t);
  const samples = blurSamples(props, t);
  const ghost = Math.min(1, frequencyAt(props, c, t) / 4);
  const asyncSkel = solveStickman(asyncPose(props, c, t));
  const asyncBox = asyncBoxPosition(c, t, PAD, asyncSkel.hands, BOX);
  const outro = ramp(t, c.outroStart, c.outroStart + 0.6);

  return (
    <AbsoluteFill style={{background: theme.bg, fontFamily: theme.font.display}}>
      {props.voice ? <Audio src={staticFile(props.voice)} /> : null}

      <div style={{position: 'absolute', top: 30, width: '100%', textAlign: 'center', color: theme.ink, fontWeight: 780, fontSize: 44}}>
        {text.title}
      </div>

      <CodePanel
        code={code.busy}
        label={text.busyLabel}
        labelColor={theme.warn}
        x={-470}
        y={-260}
        t={t}
        phases={[
          {start: c.busyStart - 0.4, lines: range(code.busyLoopLines[0], code.busyLoopLines[1])},
          {start: c.boxArrives, lines: [code.busyAfterLine]},
          {start: c.outroStart, lines: null},
        ]}
      />
      <CodePanel
        code={code.async}
        label={text.asyncLabel}
        labelColor={theme.ok}
        x={470}
        y={-260}
        t={t}
        phases={[
          {start: c.busyStart - 0.4, lines: [code.asyncAwaitLine]},
          {start: c.boxArrives, lines: [code.asyncAfterLine]},
          {start: c.outroStart, lines: null},
        ]}
      />

      {/* Contador con rastro: muestras anteriores del intervalo de obturación + desenfoque */}
      <div
        style={{
          position: 'absolute',
          left: BUSY_X + 960 - 200,
          top: 540 - 40 - 60,
          width: 400,
          textAlign: 'center',
          opacity: ramp(t, c.busyStart - 0.3, c.busyStart),
        }}
      >
        <div style={{position: 'relative', height: 110}}>
          {samples.map((s, k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateY(${-k * 7 * blurK}px)`,
                opacity: k === 0 ? 1 : 0.5 * (1 - k / samples.length) * blurK,
                color: theme.tk.num,
                fontFamily: theme.font.code,
                fontWeight: 600,
                fontSize: 88,
                lineHeight: '110px',
                filter: `blur(${9 * blurK}px)`,
                textShadow: `0 0 ${40 * blurK}px ${theme.tk.num}`,
              }}
            >
              {attemptsAt(props, c, s)}
            </div>
          ))}
        </div>
        <div style={{color: theme.muted, fontSize: 26, marginTop: 4}}>{text.attempts}</div>
      </div>

      <svg viewBox="-960 -540 1920 1080" style={{position: 'absolute', inset: 0}}>
        <line x1={-960} y1={GROUND} x2={960} y2={GROUND} stroke={theme.line} strokeWidth={4} />
        <rect x={BUSY_X + PAD - 55} y={GROUND - 1} width={110} height={10} rx={4} fill={theme.laton} />
        <rect x={ASYNC_X + PAD - 55} y={GROUND - 1} width={110} height={10} rx={4} fill={theme.laton} />

        {props.characters.busy.mode === 'png' ? (
          <PngSequence source={props.characters.busy} x={BUSY_X} y={GROUND} startFrame={Math.round(c.busyStart * fps)} />
        ) : (
          // La muestra 0 se dibuja al final para quedar encima de la estela.
          [...samples].reverse().map((s, i) => {
            const k = samples.length - 1 - i;
            return (
              <VectorStickman
                key={k}
                pose={busyPose(props, c, s)}
                x={BUSY_X}
                y={GROUND}
                opacity={k === 0 ? 1 : 0.4 * (1 - k / samples.length) * ghost}
              />
            );
          })
        )}
        <Box x={BUSY_X + PAD} y={GROUND - BOX / 2 - boxDrop(c, t)} />

        {props.characters.async.mode === 'png' ? (
          <PngSequence source={props.characters.async} x={ASYNC_X} y={GROUND} />
        ) : (
          <VectorStickman pose={asyncPose(props, c, t)} x={ASYNC_X} y={GROUND} />
        )}
        <Box x={ASYNC_X + asyncBox.x} y={GROUND + asyncBox.y} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: ASYNC_X + PAD + 960 - 300,
          top: 540 + GROUND - 340 - 25,
          width: 600,
          textAlign: 'center',
          color: theme.ok,
          fontWeight: 760,
          fontSize: 38,
          opacity: ramp(t, c.boxArrives, c.boxArrives + 0.3) * (1 - outro),
        }}
      >
        {text.boxArrived}
      </div>

      <AbsoluteFill style={{background: theme.bg, opacity: 0.86 * outro}} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 50}}>
        <div
          style={{
            width: 1500,
            textAlign: 'center',
            whiteSpace: 'pre-line',
            color: theme.ink,
            fontWeight: 650,
            fontSize: 50,
            lineHeight: '74px',
            opacity: ramp(t, c.outroStart + 0.3, c.outroStart + 0.9),
          }}
        >
          {text.takeaway}
        </div>
        <div style={{color: theme.muted, fontSize: 28, opacity: ramp(t, c.outroStart + 1.2, c.outroStart + 1.7)}}>{text.caveat}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function range(from: number, to: number) {
  return Array.from({length: to - from + 1}, (_, i) => from + i);
}
