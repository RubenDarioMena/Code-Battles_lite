import { DT, avanzar } from '../../../paquetes/nucleo/index.js';
import { legado, retos } from '../../../paquetes/reglas-war/index.js';
import { legado as factory, retos as factoryRetos } from '../../../paquetes/reglas-factory/index.js';

// Se borra al terminar la fase 2.
window.WAR = { ...legado };
window.WAR_RETOS = { ...retos };
window.FACTORY = { ...factory };
window.FACTORY_RETOS = { ...factoryRetos };
window.NUCLEO = { DT, avanzar };
