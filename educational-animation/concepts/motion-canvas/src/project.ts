import {makeProject} from '@motion-canvas/core';
import './fonts.css';
import awaitBusyWait from './scenes/awaitBusyWait?scene';

export default makeProject({
  scenes: [awaitBusyWait],
});
