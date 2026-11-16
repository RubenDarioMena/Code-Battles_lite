import { DT, crearPartida } from '../../../paquetes/nucleo/index.js';
import war, { legado, retos } from '../../../paquetes/reglas-war/index.js';
import reglasFactory, { legado as factory, retos as factoryRetos } from '../../../paquetes/reglas-factory/index.js';
import reglasCampaign, { legado as campaign, nivel, quieto as quietoCampaign } from '../../../paquetes/reglas-campaign/index.js';
import { crearAnfitrion } from '../../../paquetes/anfitrion/index.js';
import { crearConductor } from '../../../paquetes/app/index.js';
import * as vista2d from '../../../paquetes/vista-2d/index.js';
import * as vista3d from '../../../paquetes/vista-3d/index.js';

// Se borra al terminar la fase 2.
window.WAR = { ...legado };
window.WAR_RETOS = { ...retos };
window.FACTORY = { ...factory };
window.FACTORY_RETOS = { ...factoryRetos };
window.CAMPAIGN = { ...campaign };
window.CAMPAIGN_NIVEL = { ...nivel };
// Lo que dibujan las vistas (fase 2): escena(mundo) de cada reglamento.
window.ESCENAS = { war: war.escena, factory: reglasFactory.escena, campaign: reglasCampaign.escena };
// Vistas 2D y 3D: la app inyecta el relieve de Campaign de una vista en la otra.
window.VISTA_2D = vista2d;
window.VISTA_3D = vista3d;
window.FACTORY_3D = vista3d.factory3d;
// Antes, js/runtime.js. Este módulo va después de shared/python/traductor.js por el preludio de Python.
const piezasTrabajador = {
  validarFactory: factory.validar, validarCampaign: campaign.validar, modoCampaign: campaign.modoEnSnap,
  preludioPython: window.CMGPythonJS ? window.CMGPythonJS.preludio : null,
};
window.APP = { DT, crearPartida, crearAnfitrion, crearConductor,
  reglas: { war, factory: reglasFactory, campaign: reglasCampaign }, quietoCampaign, piezasTrabajador };
