// Camino de producción: un reino por creador, API nativa y fotografías compartidas.
import { createRequire } from 'node:module';
import { crearTrabajadorInterprete } from '../../paquetes/anfitrion/index.js';
const acorn = createRequire(import.meta.url)('../../shared/vendor/acorn-8.11.3.js');
export const motorNativo = opciones => crearTrabajadorInterprete({ acorn, ...opciones });
export const crearPrograma = motorNativo();
