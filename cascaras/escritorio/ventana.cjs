const fs = require('node:fs');

// Geometría independiente de Electron; coordenadas en DIP, admite monitores negativos.
function limitar(rectangulo, area) {
  const width = Math.min(Math.max(Math.round(rectangulo.width), 640), area.width);
  const height = Math.min(Math.max(Math.round(rectangulo.height), 480), area.height);
  return {
    width, height,
    x: Math.max(area.x, Math.min(Math.round(rectangulo.x), area.x + area.width - width)),
    y: Math.max(area.y, Math.min(Math.round(rectangulo.y), area.y + area.height - height)),
  };
}

function leerVentana(archivo) {
  try {
    const estado = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    if (['x', 'y', 'width', 'height'].every(k => Number.isFinite(estado[k]))
      && estado.width > 0 && estado.height > 0) return estado;
  } catch { /* primera apertura o preferencias ilegibles */ }
  return null;
}

/** @param {import('electron').BrowserWindow} ventana
 * @param {import('electron').Screen} pantalla
 * @param {typeof import('electron').Menu} Menu
 * @param {string} idioma */
function crearMenu(ventana, pantalla, Menu, idioma) {
  const es = idioma.toLowerCase().startsWith('es');
  const completa = () => ventana.setFullScreen(!ventana.isFullScreen());
  const resoluciones = [ [1280, 720], [1600, 900], [1920, 1080] ];
  const menu = Menu.buildFromTemplate([{ label: es ? 'Ver' : 'View', submenu: [
    { id: 'resolucion', label: es ? 'Resolución' : 'Resolution', submenu: resoluciones.map(([width, height]) => ({
      label: `${width}×${height}`, click() {
        if (ventana.isFullScreen()) return;
        if (ventana.isMaximized()) ventana.unmaximize();
        const area = pantalla.getDisplayMatching(ventana.getBounds()).workArea;
        const [ancho, alto] = ventana.getSize(), [contenidoX, contenidoY] = ventana.getContentSize();
        ventana.setBounds(limitar({ ...ventana.getBounds(),
          width: width + ancho - contenidoX, height: height + alto - contenidoY }, area));
      },
    })) },
    { id: 'completa', label: es ? 'Pantalla completa' : 'Fullscreen', type: 'checkbox', click: completa },
  ] }]);
  const actualizar = () => {
    menu.getMenuItemById('resolucion').enabled = !ventana.isFullScreen();
    menu.getMenuItemById('completa').checked = ventana.isFullScreen();
  };
  ventana.on('enter-full-screen', actualizar);
  ventana.on('leave-full-screen', actualizar);
  ventana.webContents.on('before-input-event', (evento, tecla) => {
    if (tecla.key === 'F11' && tecla.type === 'keyDown' && !tecla.isAutoRepeat) {
      evento.preventDefault(); completa();
    }
  });
  actualizar();
  return menu;
}

module.exports = { limitar, leerVentana, crearMenu };
