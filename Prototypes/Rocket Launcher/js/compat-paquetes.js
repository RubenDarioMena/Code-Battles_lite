import { DT, avanzar } from '../../../paquetes/nucleo/index.js';
import { legado, retos } from '../../../paquetes/reglas-war/index.js';

// Se borra al terminar la fase 2.
window.WAR = { ...legado };
window.WAR_RETOS = { ...retos };
window.NUCLEO = { DT, avanzar };
