import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);

// El Chrome headless que descarga Remotion (Chromium 157) se cierra al abrir la
// página en macOS 26.5.1. Se usa el Google Chrome instalado, en modo headless
// nuevo. Otra ruta: variable de entorno REMOTION_CHROME.
Config.setBrowserExecutable(
  process.env.REMOTION_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
);
Config.setChromeMode('chrome-for-testing');
