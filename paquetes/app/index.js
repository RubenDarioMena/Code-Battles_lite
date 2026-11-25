/* app: compone reglamento, anfitrión, vistas e interfaz. Fase 2: partida sin pantalla y vista nula. */
export { crearPlataformaMemoria } from './plataforma.js';
export { crearVistaNula } from './vista-nula.js';
export { jugarPartida } from './partida.js';
export { crearConductor } from './conductor.js';
export { instalarCicloProgramas } from './juego/ciclo-programas.js';
export { instalarBucleJuego } from './juego/bucle.js';
export { instalarCierreIntentos } from './juego/cierre-intentos.js';
import * as campaign from '../reglas-campaign/index.js';
import { arrancarJuego as montarJuego } from './juego/iniciar.js';
export function arrancarJuego(opciones = {}) {
  montarJuego({ ...opciones, campaign });
}
export { CMGProveedor } from './juego/datos-proveedor.js';
export { CMGPaleta } from './juego/paleta.js';
export { CMGProgramas } from './juego/aplicar-programas.js';
export { componerCampaignV2 } from './juego/campaign-v2.js';
