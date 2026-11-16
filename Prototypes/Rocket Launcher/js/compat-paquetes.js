import { DT, avanzar } from '../../../paquetes/nucleo/index.js';
import war, { legado, retos } from '../../../paquetes/reglas-war/index.js';
import reglasFactory, { legado as factory, retos as factoryRetos } from '../../../paquetes/reglas-factory/index.js';
import reglasCampaign, { legado as campaign, nivel } from '../../../paquetes/reglas-campaign/index.js';
import { fuenteTrabajador, algunoCorre, despertar, despertarCampaign } from '../../../paquetes/anfitrion/index.js';
import * as vista2d from '../../../paquetes/vista-2d/index.js';

// Se borra al terminar la fase 2.
window.WAR = { ...legado };
window.WAR_RETOS = { ...retos };
window.FACTORY = { ...factory };
window.FACTORY_RETOS = { ...factoryRetos };
window.CAMPAIGN = { ...campaign };
window.CAMPAIGN_NIVEL = { ...nivel };
window.NUCLEO = { DT, avanzar };
// Lo que dibujan las vistas (fase 2): escena(mundo) de cada reglamento.
window.ESCENAS = { war: war.escena, factory: reglasFactory.escena, campaign: reglasCampaign.escena };
// Vistas 2D (antes vistas.js, factory-vista.js, campaign-plano.js) y el relieve de Campaign, que también usa campaign-3d.js.
window.VISTA_2D = vista2d;
window.CAMPAIGN_TERRENO = { crear: vista2d.crearTerreno };
// Antes, js/runtime.js. Este módulo va después de shared/python/traductor.js por el preludio de Python.
const fuente = fuenteTrabajador({
  validarFactory: factory.validar, validarCampaign: campaign.validar, modoCampaign: campaign.modoEnSnap,
  preludioPython: window.CMGPythonJS ? window.CMGPythonJS.preludio : null,
});
const ahora = () => performance.now();
window.RUNTIME = {
  url: URL.createObjectURL(new Blob([fuente], { type: "text/javascript" })),
  algunoCorre,
  despertar: (ejec, mundo, instantanea) => despertar(ejec, mundo, instantanea, ahora),
  despertarCampaign: (ejec, mundo, instantanea) => despertarCampaign(ejec, mundo, instantanea, ahora),
};
