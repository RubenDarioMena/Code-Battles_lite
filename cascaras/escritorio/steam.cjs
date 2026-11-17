/** Adaptador opcional. Importarlo no carga el módulo nativo ni Electron.
 * @param {{ appId?: number | null, cargar?: () => any, registro?: (mensaje: string, error?: any) => void }} opciones */
function crearSteam({ appId, cargar = () => require('steamworks.js'), registro = console.warn }) {
  const id = Number.isInteger(appId) && appId > 0 && appId <= 0xffffffff ? appId : null;
  let cliente = null, modulo = null, anotado = false, superposicion = false;
  function anotar(error) {
    if (anotado) return;
    anotado = true;
    registro('Steam no disponible; el juego continúa sin integración.', error);
  }
  if (id) {
    try { modulo = cargar(); cliente = modulo.init(id); }
    catch (error) { anotar(error); }
  }
  return {
    estado: () => ({ activo: !!cliente, appId: id }),
    desbloquear(nombreApi) {
      if (!cliente || typeof nombreApi !== 'string' || !nombreApi) return;
      try {
        if (!cliente.achievement.isActivated(nombreApi)) cliente.achievement.activate(nombreApi);
      } catch (error) { anotar(error); }
    },
    // El principal lo llama antes de app.whenReady(), solo si Steam inició. No se modifica la GPU
    // al abrir directamente Electron, aunque haya un AppID configurado.
    prepararSuperposicion(entorno) {
      if (!cliente || superposicion || !(entorno.SteamAppId || entorno.SteamGameId)) return;
      superposicion = true;
      try { modulo.electronEnableSteamOverlay(); }
      catch (error) { anotar(error); }
    },
  };
}

module.exports = { crearSteam };
