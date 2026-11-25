// Siluetas en coordenadas locales. El tamaño del icono y su posición siguen el plano.
const azul = '#83bdd7', verde = '#73cfaa', ambar = '#f2b956', dano = '#ff685e';
let prensa;

function poligono(c, color, puntos) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(...puntos[0]);
  for (const [x, y] of puntos.slice(1)) c.lineTo(x, y);
  c.closePath(); c.fill(); c.stroke();
}

function edificio(c, tipo, luz, yaw) {
  poligono(c, '#546675', [[-.6, -.12], [0, -.42], [.6, -.12], [0, .24]]);
  poligono(c, '#354955', [[-.6, -.12], [0, .24], [0, .57], [-.6, .22]]);
  poligono(c, '#253943', [[0, .24], [.6, -.12], [.6, .22], [0, .57]]);
  c.fillStyle = luz;
  if (tipo === 'lanzador') {
    c.beginPath(); c.arc(0, -.2, .29, 0, 2 * Math.PI); c.fill(); c.stroke();
    c.translate(0, -.2); c.rotate(yaw); c.fillRect(.1, -.08, .52, .16);
  } else if (tipo === 'vibracion') {
    c.fillRect(-.04, -.52, .08, .52);
    c.beginPath(); c.ellipse(0, -.52, .25, .11, 0, 0, 2 * Math.PI); c.fill();
  } else {
    for (const x of [-.25, 0, .25]) c.fillRect(x, -.13, .09, .16);
  }
}

function robot(c, tipo, luz) {
  c.fillStyle = '#435663';
  if (tipo === 'reparador') {
    c.fillRect(-.34, -.33, .68, .66); c.strokeRect(-.34, -.33, .68, .66);
    c.fillStyle = luz; c.fillRect(-.08, -.22, .16, .44); c.fillRect(-.21, -.08, .42, .16);
    for (const x of [-.44, .32]) for (const y of [-.28, .12]) c.fillRect(x, y, .12, .16);
    return;
  }
  if (tipo === 'drone' || tipo === 'stealth') {
    for (const x of [-.31, .31]) for (const y of [-.29, .29]) {
      c.beginPath(); c.moveTo(0, 0); c.lineTo(x, y); c.stroke();
      c.beginPath(); c.arc(x, y, .19, 0, 2 * Math.PI); c.fill(); c.stroke();
    }
    if (tipo === 'stealth') poligono(c, luz, [[-.45, 0], [.32, -.3], [.14, 0], [.32, .3]]);
    else poligono(c, luz, [[-.3, 0], [.03, -.19], [.26, -.1], [.26, .1], [.03, .19]]);
  } else {
    for (const y of [-.39, .23]) { c.fillRect(-.48, y, .96, .16); c.strokeRect(-.48, y, .96, .16); }
    poligono(c, luz, [[-.45, -.12], [-.29, -.26], [.38, -.22], [.38, .22], [-.29, .26], [-.45, .12]]);
    c.fillStyle = '#334651'; c.fillRect(-.14, -.12, .28, .24);
  }
}

export function dibujarIconoHito(c, e, x, y, escala, t) {
  const tipo = e.clase || e.tipo;
  c.save(); c.translate(x, y); c.scale(escala, escala);
  c.strokeStyle = '#182932'; c.lineWidth = .055; c.lineJoin = 'round';
  const trabajando = e.proceso || e.objetivo || (e.modo && e.modo !== 'idle');
  let luz = trabajando ? verde : azul;
  if (e.atascado) luz = ambar;
  if (t - e.golpeT < .25) luz = dano;
  if (tipo === 'prensa' && typeof Image !== 'undefined') {
    if (!prensa) {
      prensa = new Image();
      prensa.src = new URL('../../Prototypes/Campaign-V2/img/prensa.svg', import.meta.url).href;
    }
  }
  if (tipo === 'prensa' && prensa?.naturalWidth) {
    c.drawImage(prensa, -.8, -.55, 1.6, 1.1);
    c.fillStyle = luz; c.fillRect(.46, -.42, .15, .1);
  } else if (!e.clase || e.programable || tipo === 'reparador') robot(c, tipo, luz);
  else edificio(c, tipo, luz, e.yaw || 0);
  c.restore();
}
