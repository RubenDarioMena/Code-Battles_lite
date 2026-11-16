import { arrancarJuego } from '../../../paquetes/app/index.js';
import { crearPlataformaWeb } from '../../../cascaras/web/plataforma.js';
import { servicios } from './servicios.js';

arrancarJuego({ plataforma: crearPlataformaWeb(), servicios });
