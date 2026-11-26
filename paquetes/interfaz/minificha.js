// Minificha de Campaign-V2: con una unidad elegida, la tira del inspector se convierte en la ficha compacta de
// Campaign 1, abajo a la izquierda del campo. Muestra el dibujo de la unidad, su id, clase y estado, dos
// propiedades con su valor en vivo y las órdenes clave como tokens. Al tocar la tarjeta fuera de un token, al
// mantener pulsada la unidad o con ▾ se abre la ficha completa, como antes.
// Las filas salen de la ficha completa (#ins-cuerpo), que el inspector ya pinta debajo: así son las mismas
// propiedades y órdenes que enseña ella, en el idioma del editor. Los tokens funcionan igual porque el inspector
// los escucha en el documento, y los valores vivos se refrescan porque siguen dentro de #inspector.

/** Dibujo de cada clase, relativo a la página (img/campaign: los SVG y sprites de Campaign 1). */
export const DIBUJOS = {
  prensa: 'maquinas/prensa.svg', moldeadora: 'maquinas/moldeadora.svg', mezcladora: 'maquinas/mezcladora.svg',
  ensambladora: 'maquinas/ensambladora.svg', fundidora: 'maquinas/fundidora.svg', cnc: 'maquinas/cnc.svg',
  obrero: 'robots/bot-01-agarre.png', montacargas: 'robots/frk-01-armado.png',
};
const PROPS = 2, ORDENES = 3;

/** Lo que la minificha toma de la ficha completa: las primeras filas con propiedad y los primeros tokens de orden.
 * Solo de sus columnas (.ins-cols): la leyenda de abajo también usa las clases de color (.tk-fn) sin ser token. */
export function elegirFilas(cuerpo) {
  const props = [...cuerpo.querySelectorAll('.ins-cols .fila-tk')].filter(f => f.querySelector('.tk.tk-prop')).slice(0, PROPS);
  const ordenes = [...cuerpo.querySelectorAll('.ins-cols .tk.tk-fn')].slice(0, ORDENES);
  return { props, ordenes };
}

/** raw.githack responde 403 a los PNG del repo (los SVG sí los sirve): se piden a raw.githubusercontent, como hace
 * urlBinario con los GLB de la vista 3D. */
export function urlDibujo(ruta, base) {
  if (!base) return ruta; // DOM de pruebas sin dirección
  const u = new URL(ruta, base);
  if (/(^|\.)githack\.com$/.test(u.hostname) && /\.png$/i.test(u.pathname))
    return new URL(u.pathname + u.search, 'https://raw.githubusercontent.com').href;
  return u.href;
}

/** «await ARM_01.pickUp(lugar, pieza)» → «ARM_01.pickUp()»; igual en Python. */
export const rotuloCorto = texto => texto.replace(/^await\s+/, '').replace(/\(.*\)$/, '()');

export function crearMinificha(ctx, { base = 'img/campaign/' } = {}) {
  const app = ctx.$('app');
  app.dataset.minificha = 'true';
  // En el teléfono también: elegir una unidad abre la minificha y no la ficha completa a pantalla entera. No hay
  // ajuste que lo cambie todavía: layout.js reserva «inspector-movil» y lo escribe al instalarse, después que la
  // interfaz V2 (iniciar.js), así que se pone al terminar la instalación.
  Promise.resolve().then(() => { app.dataset.inspectorMovil = 'tira'; });
  /** Una fila «prop = valor» sin las notas largas; las notas con valor vivo (cargo = null) se quedan. */
  function propiedad(fila) {
    const p = document.createElement('span');
    p.className = 'cv2-prop';
    for (const hijo of fila.children) {
      if (hijo.classList.contains('nota') && !hijo.dataset.vivo) continue;
      p.append(hijo.cloneNode(true));
    }
    return p;
  }
  /** El token de orden con el rótulo corto de Campaign 1 («pickUp()»): inserta lo mismo que en la ficha. */
  function corta(token) {
    const t = token.cloneNode(true);
    t.title = token.textContent;
    t.textContent = rotuloCorto(token.textContent);
    return t;
  }
  return function mini(e, estado) {
    const tira = ctx.$('ins-tira');
    if (estado !== 'tira' || !e || !tira) return;
    const cab = tira.querySelector('.ins-cab');
    const ruta = DIBUJOS[e.clase];
    if (cab && ruta) {
      const img = document.createElement('img');
      img.className = 'cv2-mini-dibujo'; img.src = urlDibujo(base + ruta, document.baseURI); img.alt = ''; img.decoding = 'async';
      cab.prepend(img);
    }
    const { props, ordenes } = elegirFilas(ctx.$('ins-cuerpo'));
    const nodos = [];
    if (props.length) {
      const caja = document.createElement('div');
      caja.className = 'cv2-mini-props';
      caja.append(...props.map(propiedad));
      nodos.push(caja);
    }
    if (ordenes.length) {
      const caja = document.createElement('div');
      caja.className = 'cv2-mini-ord';
      caja.append(...ordenes.map(corta));
      nodos.push(caja);
    }
    cab?.after(...nodos);
  };
}
