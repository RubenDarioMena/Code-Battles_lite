import {defineConfig} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';
import ffmpeg from '@motion-canvas/ffmpeg';

export default defineConfig({
  plugins: [motionCanvas({output: '../../renders/motion-canvas'}), ffmpeg()],
  server: {
    port: 9000,
    // shared/ vive dos niveles arriba
    fs: {allow: ['../..']},
  },
});
