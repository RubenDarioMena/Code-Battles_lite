// Piloto: polling ocupado frente a espera asíncrona (variante A, pantalla dividida).
// Todo lo que depende del tiempo se calcula desde `time` con funciones puras de
// shared/awaitPilot.ts, igual que en Remotion. Los resaltados de código usan los
// tweens nativos de Motion Canvas.
import {Code, LezerHighlighter, Line, Node, Rect, Txt, blur, lines, makeScene2D} from '@motion-canvas/2d';
import {DEFAULT, all, createRef, createSignal, linear, waitFor} from '@motion-canvas/core';
import {HighlightStyle} from '@codemirror/language';
import {parser} from '@lezer/javascript';
import {tagStyles} from '../../../../shared/highlight';
import {theme} from '../../../../shared/theme';
import {
  asyncBoxPosition,
  asyncPose,
  attemptsAt,
  blurAmount,
  blurSamples,
  boxDrop,
  busyPose,
  cues,
  defaultPilot,
  frequencyAt,
  ramp,
} from '../../../../shared/awaitPilot';
import {solveStickman} from '../../../../shared/stickman';
import {Stickman} from '../components/Stickman';

// Para la prueba de reutilización: cambiar lang, intervalos o duración en shared/await-pilot.json.
const params = defaultPilot;
const c = cues(params);
const text = params.texts[params.lang];
const code = params.code[params.lang];
const highlighter = new LezerHighlighter(parser, HighlightStyle.define(tagStyles));

const GROUND = 400;
const BUSY_X = -560;
const ASYNC_X = 260;
const PAD = 130;
const BOX = 70;

export default makeScene2D(function* (view) {
  view.fill(theme.bg);
  const time = createSignal(0);
  const busyCode = createRef<Code>();
  const asyncCode = createRef<Code>();

  const box = (x: () => number, y: () => number) => (
    <Rect x={x} y={y} width={BOX} height={BOX} radius={6} fill={theme.cobre} stroke={theme.laton} lineWidth={3}>
      <Line points={[[-BOX / 2, -6], [BOX / 2, -6]]} stroke={theme.laton} lineWidth={6} />
    </Rect>
  );

  view.add(
    <>
      <Txt y={-480} text={text.title} fill={theme.ink} fontFamily={theme.font.display} fontWeight={780} fontSize={44} />

      {/* Paneles de código */}
      <Txt x={-470} y={-405} text={text.busyLabel.toUpperCase()} fill={theme.warn} fontFamily={theme.font.display} fontWeight={700} fontSize={24} letterSpacing={3} />
      <Rect x={-470} y={-270} width={840} height={230} radius={16} fill={theme.codeBg} stroke={theme.line} lineWidth={2}>
        <Code ref={busyCode} highlighter={highlighter} code={code.busy} fontFamily={theme.font.code} fontSize={28} offsetX={-1} x={-390} />
      </Rect>
      <Txt x={470} y={-405} text={text.asyncLabel.toUpperCase()} fill={theme.ok} fontFamily={theme.font.display} fontWeight={700} fontSize={24} letterSpacing={3} />
      <Rect x={470} y={-270} width={840} height={230} radius={16} fill={theme.codeBg} stroke={theme.line} lineWidth={2}>
        <Code ref={asyncCode} highlighter={highlighter} code={code.async} fontFamily={theme.font.code} fontSize={28} offsetX={-1} x={-390} />
      </Rect>

      {/* Suelo y plataformas de entrega */}
      <Line points={[[-960, GROUND], [960, GROUND]]} stroke={theme.line} lineWidth={4} />
      <Rect x={BUSY_X + PAD} y={GROUND + 4} width={110} height={10} radius={4} fill={theme.laton} />
      <Rect x={ASYNC_X + PAD} y={GROUND + 4} width={110} height={10} radius={4} fill={theme.laton} />

      {/* Contador con rastro: cada copia es una muestra anterior del mismo intervalo de obturación */}
      <Node x={BUSY_X} y={-40} opacity={() => ramp(time(), c.busyStart - 0.3, c.busyStart)}>
        {blurSamples(params, 0).map((_, k, all) => (
          <Txt
            text={() => `${attemptsAt(params, c, blurSamples(params, time())[k])}`}
            y={() => -k * 7 * blurAmount(params, c, time())}
            opacity={() => (k === 0 ? 1 : 0.5 * (1 - k / all.length) * blurAmount(params, c, time()))}
            fill={theme.tk.num}
            fontFamily={theme.font.code}
            fontWeight={600}
            fontSize={88}
            shadowColor={theme.tk.num}
            shadowBlur={() => 40 * blurAmount(params, c, time())}
            filters={[blur(() => 9 * blurAmount(params, c, time()))]}
          />
        ))}
        <Txt y={62} text={text.attempts} fill={theme.muted} fontFamily={theme.font.display} fontSize={26} />
      </Node>

      {/* Polling ocupado: la muestra 0 es sólida; las demás forman la estela */}
      {blurSamples(params, 0).map((_, k, all) => (
        <Stickman
          x={BUSY_X}
          y={GROUND}
          color={theme.ink}
          pose={() => busyPose(params, c, blurSamples(params, time())[k])}
          opacity={() =>
            k === 0 ? 1 : 0.4 * (1 - k / all.length) * Math.min(1, frequencyAt(params, c, time()) / 4)
          }
        />
      ))}
      {box(() => BUSY_X + PAD, () => GROUND - BOX / 2 - boxDrop(c, time()))}

      {/* Espera asíncrona */}
      <Stickman x={ASYNC_X} y={GROUND} color={theme.ink} pose={() => asyncPose(params, c, time())} />
      {box(
        () => ASYNC_X + asyncBoxPosition(c, time(), PAD, solveStickman(asyncPose(params, c, time())).hands, BOX).x,
        () => GROUND + asyncBoxPosition(c, time(), PAD, solveStickman(asyncPose(params, c, time())).hands, BOX).y,
      )}
      <Txt
        x={ASYNC_X + PAD}
        y={GROUND - 340}
        text={text.boxArrived}
        fill={theme.ok}
        fontFamily={theme.font.display}
        fontWeight={760}
        fontSize={38}
        opacity={() => ramp(time(), c.boxArrives, c.boxArrives + 0.3) * (1 - ramp(time(), c.outroStart, c.outroStart + 0.4))}
      />

      {/* Cierre */}
      <Rect width={1920} height={1080} fill={theme.bg} opacity={() => 0.86 * ramp(time(), c.outroStart, c.outroStart + 0.6)} />
      <Txt
        y={-30}
        width={1500}
        textWrap
        textAlign="center"
        text={text.takeaway}
        fill={theme.ink}
        fontFamily={theme.font.display}
        fontWeight={650}
        fontSize={50}
        lineHeight={74}
        opacity={() => ramp(time(), c.outroStart + 0.3, c.outroStart + 0.9)}
      />
      <Txt
        y={170}
        text={text.caveat}
        fill={theme.muted}
        fontFamily={theme.font.display}
        fontSize={28}
        opacity={() => ramp(time(), c.outroStart + 1.2, c.outroStart + 1.7)}
      />
    </>,
  );

  yield* all(
    time(c.end, c.end, linear),
    (function* () {
      yield* waitFor(c.busyStart - 0.4);
      yield* all(busyCode().selection(lines(code.busyLoopLines[0], code.busyLoopLines[1]), 0.4), asyncCode().selection(lines(code.asyncAwaitLine), 0.4));
      yield* waitFor(c.boxArrives - c.busyStart);
      yield* all(
        asyncCode().selection(lines(code.asyncAfterLine), 0.4),
        busyCode().selection(lines(code.busyAfterLine), 0.4),
      );
      yield* waitFor(c.outroStart - c.boxArrives - 0.4);
      yield* all(busyCode().selection(DEFAULT, 0.4), asyncCode().selection(DEFAULT, 0.4));
    })(),
  );
});
