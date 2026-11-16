import { DT, avanzar } from '../../../paquetes/nucleo/index.js';
import { legado, retos } from '../../../paquetes/reglas-war/index.js';
import { legado as factory, retos as factoryRetos } from '../../../paquetes/reglas-factory/index.js';
import { legado as campaign, nivel } from '../../../paquetes/reglas-campaign/index.js';
import { fuenteTrabajador, algunoCorre, despertar, despertarCampaign } from '../../../paquetes/anfitrion/index.js';

// Se borra al terminar la fase 2.
window.WAR = { ...legado };
window.WAR_RETOS = { ...retos };
window.FACTORY = { ...factory };
window.FACTORY_RETOS = { ...factoryRetos };
window.CAMPAIGN = { ...campaign };
window.CAMPAIGN_NIVEL = { ...nivel };
window.NUCLEO = { DT, avanzar };
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
