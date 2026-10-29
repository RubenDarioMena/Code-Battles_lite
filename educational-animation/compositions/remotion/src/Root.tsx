import {Composition, type CalculateMetadataFunction} from 'remotion';
import {cues, defaultPilot} from '../../../shared/awaitPilot';
import {AwaitPilot, type AwaitPilotProps} from './AwaitPilot';

const FPS = 30;

const metadata: CalculateMetadataFunction<AwaitPilotProps> = ({props}) => ({
  durationInFrames: Math.ceil(cues(props).end * FPS),
});

const base: AwaitPilotProps = {
  ...defaultPilot,
  characters: {busy: {mode: 'vector'}, async: {mode: 'vector'}},
};

// Prueba de reutilización (§8): otro idioma, otro intervalo y otra espera,
// sin tocar la composición.
const english: AwaitPilotProps = {
  ...base,
  lang: 'en',
  polling: {startIntervalMs: 500, endIntervalMs: 24},
  timing: {...base.timing, waitSeconds: 11},
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="AwaitPilot"
      component={AwaitPilot}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={base}
      calculateMetadata={metadata}
    />
    <Composition
      id="AwaitPilotEn"
      component={AwaitPilot}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={english}
      calculateMetadata={metadata}
    />
  </>
);
