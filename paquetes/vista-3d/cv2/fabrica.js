// Fábrica de Campaign-V2 sobre el mapa papercraft. La planta de la misión 1 se dibuja con el lenguaje de las máquinas
// de Campaign 1 (Prototypes/Campaign-V2/img/campaign/maquinas/*.svg): colores planos con contorno oscuro, losa azul
// marino, bandeja de entrada con borde cian y de salida con borde amarillo, y una consola con pantalla y piloto. Los
// robots siguen sus sprites: el brazo es azul con la pinza blanca y el montacargas es rojo con horquillas de acero.
// Tiene el mismo contrato que crearCampaign3D (coordenadas de la planta). Solo esta vista conoce el traslado a metros:
// toda la planta cuelga de un grupo colocado en `origen` y a la altura de la losa.
import { crearCamara3D } from '../camara.js';
import { liberarEscena } from '../recursos.js';
import { crearPaisaje } from './paisaje.js';
import { zoomMax, PITCH_RASANTE } from './decorado.js';
import { maquinaTaller, ALTO_TALLER } from './taller.js';

/** Tonos de las máquinas de Campaign 1 (generar.py de svg-b): [base, luz, sombra]. */
export const PALETA = {
  contorno: 0x171b26,
  marino: [0x252a36, 0x3a4150, 0x1b1f29], acero: [0x9aa3b2, 0xc3cad5, 0x6c7584], blanco: [0xf2f4f7, 0xffffff, 0xb4bcc9],
  naranja: [0xf08a24, 0xffb04d, 0xb85e12], amarillo: [0xe3a81b, 0xf6cc4a, 0xa8760f], morado: [0x7b4cc4, 0x9a72dc, 0x55318f],
  verde: [0x2f9a45, 0x53bd68, 0x1e6a30], turquesa: [0x1e9c9c, 0x45c0bd, 0x136c70], pizarra: [0x5d6e8a, 0x8193ad, 0x3f4c63],
  hierro: [0x474450, 0x615e6c, 0x2e2c36], ladrillo: [0xb5482c, 0xd46a48, 0x7d2f1c],
  // Robots (sprites bot-01 y frk-01).
  azul: [0x2563d8, 0x4a86ee, 0x163f94], rojo: [0xc0282d, 0xe04848, 0x8a1a1e], goma: [0x23272f, 0x353a44, 0x15181d],
  madera: [0xb08a55, 0xcaa472, 0x7d6038],
  entrada: 0x3fc1e0, salida: 0xf6b817, apagado: 0x59606e, piloto: 0x7dff6a,
};
const PIEZA = { steel: PALETA.acero[0], polymer: 0xe9dca0, nose: PALETA.naranja[0], base: PALETA.verde[0], charge: PALETA.morado[1],
  motor: PALETA.amarillo[0], missile: PALETA.blanco[0],
  // Taller de carcasas (P7): la placa y el domo en bruto son acero; la semiesfera recortada brilla; los recortes, hierro.
  plate: PALETA.acero[1], dome: PALETA.acero[0], shell: 0xdfe4ec, scrap: PALETA.hierro[1] };
const LUZ = { green: PALETA.piloto, amber: 0xffc247, red: 0xff5a4f, off: 0x3a4150 };

/** Puertas de la muralla en metros, a partir del marco de la Batalla (paso.js: el muro está en x0 + 3).
 * @param {{ origen: number[], puertas: number[] }} marco */
export function puertasDelMarco(marco) {
  return marco.puertas.map(f => ({ x: marco.origen[0] + 3, y: marco.origen[1] + f + .5 }));
}

/** @param {any} estado la vista común (escena = mundo de la planta, selección) @param {any} deps */
export function crearFabricaCV2(estado, { THREE, cargarGLTFLoader, $, mapa, reglas: C, radioDe, origen = [103, 22], puertas = [] }) {
  if (typeof THREE === 'undefined') return null;
  const canvas = $('c3d');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const [ox, oy] = origen;
  const escena = new THREE.Scene(), camara = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const hemi = new THREE.HemisphereLight(0xfff5da, 0x898175, 1.9), sol = new THREE.DirectionalLight(0xffeed6, 2.3);
  sol.position.set(-20, 45, 18);
  const FONDO = 0xd8cdb5, FONDO_BATALLA = 0x09131a;
  escena.background = new THREE.Color(FONDO);
  escena.fog = new THREE.Fog(escena.background, 30, 60);
  const planta = new THREE.Group(), fijo = new THREE.Group(), movil = new THREE.Group();
  planta.position.set(ox, 0, oy);
  planta.add(fijo, movil);
  escena.add(hemi, sol, planta);
  const paisaje = crearPaisaje(THREE, escena, renderer, cargarGLTFLoader);
  paisaje.montarMuralla(puertas);

  // ---------- Materiales: uno por color, con su contorno ----------
  const mats = new Map(), geos = new Set(), texturas = new Set();
  const mat = hex => {
    if (!mats.has(hex)) mats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return mats.get(hex);
  };
  // Máquina sin corriente: su mismo color, apagado hacia el gris (como los SVG «off» de Campaign 1), para que la
  // prensa siga siendo amarilla y la moldeadora morada aunque no tengan energía.
  const gris = new THREE.Color(PALETA.apagado);
  const apagados = new Map();
  const apagadoDe = m => { if (!apagados.has(m)) apagados.set(m, mat(m.color.clone().lerp(gris, .6).getHex())); return apagados.get(m); };
  const tinta = new THREE.LineBasicMaterial({ color: PALETA.contorno });
  const especiales = {
    sel: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    alcance: new THREE.MeshBasicMaterial({ color: PALETA.salida, side: THREE.DoubleSide, transparent: true, opacity: .55 }),
    misil: new THREE.MeshBasicMaterial({ color: 0xffd27a }), estela: new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: .7 }),
    explosion: new THREE.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: .4, depthWrite: false }),
    progreso: new THREE.MeshBasicMaterial({ color: PALETA.piloto }),
    brasa: new THREE.MeshBasicMaterial({ color: 0xff7a1f }),
  };
  const luces = Object.fromEntries(Object.entries(LUZ).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c })]));
  const geo = g => { geos.add(g); return g; };
  const bordes = new Map();
  /** Malla con contorno oscuro (las aristas de más de 25°), como el trazo de los SVG. */
  function trazo(g, m, x = 0, y = 0, z = 0, conBorde = true) {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    if (conBorde) {
      if (!bordes.has(g)) bordes.set(g, geo(new THREE.EdgesGeometry(g, 25)));
      const l = new THREE.LineSegments(bordes.get(g), tinta);
      l.raycast = () => {};
      o.add(l);
    }
    return o;
  }
  // Geometrías compartidas por medidas: reconstruir la planta (otro checkpoint) no acumula mallas.
  const formas = new Map();
  const forma = (clave, crear) => { if (!formas.has(clave)) formas.set(clave, geo(crear())); return formas.get(clave); };
  /** Bloque con la base en `y` (como los bloques de generar.py: planta en el suelo y altura). */
  const caja = (w, h, d, color, x = 0, y = 0, z = 0, borde = true) =>
    trazo(forma(`c${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(color), x, y + h / 2, z, borde);
  const cil = (r1, r2, h, color, x = 0, y = 0, z = 0, n = 16) =>
    trazo(forma(`k${r1}|${r2}|${h}|${n}`, () => new THREE.CylinderGeometry(r1, r2, h, n)), mat(color), x, y + h / 2, z);
  /** Cilindro tumbado a lo largo de x, con el eje a la altura `y`. */
  function cilX(r, largo, color, x, y, z) {
    const k = cil(r, r, largo, color, x, 0, z);
    k.rotation.z = Math.PI / 2; k.position.y = y;
    return k;
  }
  /** Media esfera hacia arriba, con la base en el centro (el punzón de la embutidora la gira). */
  const semiesfera = (r, color) => trazo(forma(`s${r}`, () => new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)), mat(color));
  const herramientas = { THREE, P: PALETA, caja, cil, cilX, geo, semiesfera, haz: luces.red, brasa: especiales.brasa };

  // Texturas pintadas en un lienzo: franjas de peligro, pantalla de la consola, chevrones de la ensambladora y la losa.
  function lienzo(w, h, pintar) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    pintar(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texturas.add(t);
    return t;
  }
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const franjas = lienzo(64, 16, (g, w, h) => {
    g.fillStyle = hex(PALETA.salida); g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETA.contorno);
    for (let x = -h; x < w; x += 16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 8, h); g.lineTo(x + 8 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  });
  const pantalla = lienzo(32, 20, (g, w, h) => {
    g.fillStyle = hex(PALETA.marino[2]); g.fillRect(0, 0, w, h);
    g.fillStyle = hex(PALETA.entrada); g.fillRect(3, 3, 17, 12);
    g.fillStyle = hex(PALETA.marino[1]); g.beginPath(); g.arc(25, 9, 3, 0, 7); g.fill();
  });
  const chevron = lienzo(256, 160, (g, w, h) => {
    g.fillStyle = hex(PALETA.turquesa[0]); g.fillRect(0, 0, w, h);
    g.strokeStyle = hex(PALETA.turquesa[1]); g.lineWidth = 12; g.lineJoin = 'round';
    for (const y of [45, 115]) { g.beginPath(); g.moveTo(26, y - 22); g.lineTo(46, y); g.lineTo(26, y + 22); g.stroke(); }
    g.fillStyle = hex(PALETA.turquesa[2]); g.fillRect(70, 62, 120, 36);
    g.fillStyle = hex(PALETA.contorno); g.beginPath(); g.arc(150, 80, 30, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(146, 62, 8, 36); g.fillRect(132, 76, 36, 8);
    g.strokeStyle = hex(PALETA.turquesa[1]); g.beginPath(); g.moveTo(208, 58); g.lineTo(228, 80); g.lineTo(208, 102); g.stroke();
  });
  const conTextura = (t, color = 0xffffff) => t ? new THREE.MeshLambertMaterial({ map: t, color }) : mat(color);
  const MT = { franjas: conTextura(franjas), pantalla: conTextura(pantalla, 0xffffff), chevron: conTextura(chevron) };

  // ---------- Losa de la planta: azul marino con su cuadrícula de 1 m, el pasillo marcado y el borde de peligro ----------
  const L = mapa.losa, P = mapa.pasillo, anchoL = L.x1 - L.x0, fondoL = L.y1 - L.y0;
  const PXM = 24;
  const texLosa = lienzo(Math.round(anchoL * PXM), Math.round(fondoL * PXM), (g, w, h) => {
    g.fillStyle = '#56606f'; g.fillRect(0, 0, w, h);
    // Baldosas de 5 m con tonos alternos: el ojo cuenta la planta sin leer la cuadrícula.
    for (let x = 0; x < anchoL; x += 5) for (let y = 0; y < fondoL; y += 5) {
      g.fillStyle = (Math.floor(x / 5) + Math.floor(y / 5)) % 2 ? '#5b6676' : '#525c6b';
      g.fillRect(x * PXM, y * PXM, 5 * PXM, 5 * PXM);
    }
    g.strokeStyle = 'rgba(23,27,38,.35)'; g.lineWidth = 1;
    for (let x = 0; x <= anchoL; x++) { g.beginPath(); g.moveTo(x * PXM, 0); g.lineTo(x * PXM, h); g.stroke(); }
    for (let y = 0; y <= fondoL; y++) { g.beginPath(); g.moveTo(0, y * PXM); g.lineTo(w, y * PXM); g.stroke(); }
    // Pasillo del montacargas: banda más clara entre dos líneas amarillas discontinuas.
    const px0 = (P.x0 - L.x0) * PXM, py0 = (P.y0 - L.y0) * PXM, px1 = (P.x1 - L.x0) * PXM, py1 = (P.y1 - L.y0) * PXM;
    g.fillStyle = 'rgba(195,202,213,.12)'; g.fillRect(px0, py0, px1 - px0, py1 - py0);
    g.strokeStyle = hex(PALETA.salida); g.lineWidth = 4; g.setLineDash([18, 12]);
    for (const y of [py0, py1]) { g.beginPath(); g.moveTo(px0, y); g.lineTo(px1, y); g.stroke(); }
    g.setLineDash([]);
    // Borde de peligro alrededor de la losa.
    const b = 10;
    if (franjas) {
      const patron = g.createPattern(franjas.image, 'repeat');
      g.fillStyle = patron;
      g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); g.fillRect(0, 0, b, h); g.fillRect(w - b, 0, b, h);
    }
  });
  const losa = new THREE.Mesh(geo(new THREE.BoxGeometry(anchoL, 1, fondoL)),
    [mat(PALETA.marino[2]), mat(PALETA.marino[2]), conTextura(texLosa, 0xffffff), mat(PALETA.marino[2]), mat(PALETA.marino[2]), mat(PALETA.marino[2])]);
  losa.userData.losa = true;
  const bordeLosa = new THREE.LineSegments(geo(new THREE.EdgesGeometry(losa.geometry)), tinta);
  bordeLosa.raycast = () => {};
  losa.add(bordeLosa);
  escena.add(losa);
  // La losa se apoya en lo más alto del relieve bajo ella y baja como un zócalo hasta lo más hondo.
  let alto = 0, revision = -1;
  function asentar() {
    if (revision === paisaje.revisionRelieve) return false;
    revision = paisaje.revisionRelieve;
    let max = -Infinity, min = Infinity;
    for (let x = L.x0; x <= L.x1; x += 1.5) for (let y = L.y0; y <= L.y1; y += 1.5) {
      const h = paisaje.altura(x + ox, y + oy);
      max = Math.max(max, h); min = Math.min(min, h);
    }
    alto = max + .12;
    const grueso = Math.max(.4, alto - min + .3);
    losa.scale.y = grueso;
    losa.position.set(ox + L.x0 + anchoL / 2, alto - grueso / 2, oy + L.y0 + fondoL / 2);
    planta.position.y = alto;
    return true;
  }

  // ---------- Piezas ----------
  const torno = pts => geo(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 10));
  const GP = {
    steel: geo(new THREE.BoxGeometry(.5, .07, .36)), polymer: geo(new THREE.BoxGeometry(.3, .22, .3)),
    nose: torno([[0, .24], [.15, -.1], [.15, -.2], [0, -.2]]), base: torno([[0, .18], [.15, .18], [.15, -.04], [.3, -.18], [0, -.18]]),
    charge: geo(new THREE.CylinderGeometry(.1, .1, .26, 10)), motor: torno([[0, .32], [.15, .32], [.15, -.14], [.3, -.3], [0, -.3]]),
    missile: torno([[0, .62], [.15, .28], [.15, -.3], [.3, -.46], [0, -.46]]),
    // El domo sale de la embutidora con su ala; la sierra o el láser la recortan: semiesfera limpia y medio anillo.
    plate: geo(new THREE.BoxGeometry(.46, .05, .46)),
    dome: torno([[0, .2], [.1, .185], [.16, .13], [.19, .05], [.2, 0], [.27, 0], [.27, -.03], [0, -.03]]),
    shell: torno([[0, .2], [.1, .185], [.16, .13], [.19, .05], [.2, 0], [0, 0]]),
    scrap: geo(new THREE.TorusGeometry(.2, .035, 4, 10, Math.PI).rotateX(-Math.PI / 2)),
  };
  const ALTO_P = { steel: .035, polymer: .11, nose: .2, base: .18, charge: .13, motor: .3, missile: .46, plate: .025, dome: .03, shell: .005, scrap: .035 };
  function ponerPieza(o, tipo) {
    if (o.userData.tipo !== tipo) { o.geometry = GP[tipo]; o.material = mat(PIEZA[tipo] ?? PALETA.naranja[0]); o.userData.tipo = tipo; }
    o.visible = true;
  }
  function piezas(g, n, lugar) {
    return Array.from({ length: n }, (_, i) => {
      const o = new THREE.Mesh(GP.steel, mat(PIEZA.steel));
      o.visible = false; o.userData.base = lugar(i); g.add(o);
      return o;
    });
  }
  function pintarPiezas(lista, tipos) {
    for (let i = 0; i < lista.length; i++) {
      const o = lista[i], tipo = tipos[i];
      if (!tipo) { o.visible = false; continue; }
      ponerPieza(o, tipo);
      const b = o.userData.base;
      o.position.set(b[0], b[1] + ALTO_P[tipo], b[2]);
    }
  }

  // ---------- Máquinas: el frente (+z) mira a su punto de trabajo ----------
  /** Bandeja de entrada o salida: caja de acero con el borde de su color. */
  function bandeja(g, x, z, borde) {
    g.add(caja(.62, .39, .55, PALETA.acero[2], x, 0, z), caja(.62, .03, .06, borde, x, .39, z - .25, false), caja(.62, .03, .06, borde, x, .39, z + .25, false));
  }
  /** Consola con pantalla cian y piloto (la luz de la máquina). */
  function consola(g, x, z) {
    g.add(caja(.36, .5, .32, PALETA.marino[0], x, .25, z));
    const p = new THREE.Mesh(geo(new THREE.PlaneGeometry(.3, .19)), MT.pantalla);
    p.position.set(x, .77, z + .02); p.rotation.x = -Math.PI / 2.6;
    g.add(p);
    const luz = new THREE.Mesh(geo(new THREE.SphereGeometry(.09, 10, 8)), luces.off);
    luz.position.set(x + .1, .8, z - .08);
    g.add(luz);
    return luz;
  }
  /** El frente (+z) mira al punto de trabajo: al sur o al norte; al este u oeste solo si queda de lado (la fundidora). */
  const frente = (dx, dz) => Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) * Math.PI / 2 : dz < 0 ? Math.PI : 0;
  function rumbo(e, pad) { return frente((pad.ax ?? e.cx) - e.cx, (pad.ay ?? e.cy + 1) - e.cy); }
  function maquinaObj(e) {
    const g = new THREE.Group(), cuerpo = [], o = { grupo: g, cuerpo, alto: 2.7 };
    const c = m => { m.userData.color = m.material; cuerpo.push(m); return m; };
    const grande = e.clase === 'ensambladora';
    const ancho = grande ? 3 : 2.3, fondo = grande ? 2.3 : 1.7, frente = fondo / 2 + .35;
    g.add(caja(ancho, .25, fondo, PALETA.marino[0], 0, 0, 0));
    if (e.clase === 'prensa') {
      g.add(c(caja(1.2, .5, .9, PALETA.marino[1], 0, .25, -.1)));
      const franja = new THREE.Mesh(geo(new THREE.PlaneGeometry(1.1, .14)), MT.franjas);
      franja.position.set(0, .5, .36); g.add(franja);
      for (const x of [-.72, .72]) g.add(c(caja(.32, 2.3, .32, PALETA.amarillo[0], x, .25, -.1)));
      g.add(c(caja(1.8, .45, .55, PALETA.amarillo[0], 0, 2.3, -.1)));
      const ojo = cil(.16, .16, .1, PALETA.hierro[0], 0, 0, .2);
      ojo.rotation.x = Math.PI / 2; ojo.position.y = 2.52; g.add(ojo);
      o.ariete = new THREE.Group();
      o.ariete.add(caja(.85, .32, .5, PALETA.blanco[0], 0, 0, 0), caja(.5, .12, .34, PALETA.acero[0], 0, -.12, 0));
      o.ariete.position.set(0, 1.75, -.1); g.add(o.ariete);
      o.pieza = caja(.42, .12, .3, PALETA.naranja[0], 0, .75, -.1); o.pieza.visible = false; g.add(o.pieza);
    } else if (e.clase === 'moldeadora') {
      g.add(c(caja(1.3, 1.1, 1.1, PALETA.morado[0], .3, .25, -.1)));
      g.add(caja(.5, .62, .04, PALETA.blanco[0], .08, .5, .47), caja(.5, .62, .04, PALETA.acero[0], .62, .5, .47));
      o.cil = [];
      for (const z of [-.42, .12]) {
        const k = c(cilX(.17, .9, PALETA.acero[0], -.62, .8, z));
        g.add(k, cilX(.21, .08, PALETA.amarillo[0], -.17, .8, z)); o.cil.push(k);
      }
    } else if (e.clase === 'mezcladora') {
      g.add(c(cil(.78, .78, 1.15, PALETA.verde[0], 0, .25, -.1, 22)), cil(.82, .82, .12, PALETA.verde[2], 0, 1.3, -.1, 22));
      g.add(cil(.62, .62, .03, PALETA.verde[1], 0, 1.42, -.1, 22));
      o.pala = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const aspa = caja(.55, .05, .12, PALETA.blanco[0], .3, 0, 0);
        const brazo = new THREE.Group(); brazo.rotation.y = k * Math.PI * 2 / 3; brazo.add(aspa); o.pala.add(brazo);
      }
      o.pala.add(cil(.1, .1, .1, PALETA.blanco[0], 0, -.02, 0));
      o.pala.position.set(0, 1.47, -.1); g.add(o.pala);
      g.add(caja(.42, .3, .36, PALETA.acero[0], .98, .45, -.1));
    } else if (!maquinaTaller(e, g, o, { ...herramientas, c })) {
      // Ensambladora: cuerpo turquesa con chevrones y el sello «+» arriba, y su franja de estado al frente.
      g.add(c(caja(2.4, 1.3, 1.6, PALETA.turquesa[0], .1, .25, -.15)));
      const tapa = new THREE.Mesh(geo(new THREE.PlaneGeometry(2.36, 1.56)), MT.chevron);
      tapa.rotation.x = -Math.PI / 2; tapa.position.set(.1, 1.56, -.15); g.add(tapa);
      g.add(c(caja(.6, .5, .5, PALETA.turquesa[2], -1.15, .25, -.5)), c(caja(.6, .5, .5, PALETA.turquesa[2], -1.15, .25, .2)));
      o.franja = caja(2.0, .12, .05, LUZ.off, .1, .9, .66, false); o.franja.material = luces.off; g.add(o.franja);
    }
    bandeja(g, -ancho / 2 + .35, frente, PALETA.entrada);
    bandeja(g, ancho / 2 - .35, frente, PALETA.salida);
    o.luz = consola(g, ancho / 2 - .2, -fondo / 2 + .3);
    o.entrada = piezas(g, 8, i => [-ancho / 2 + .17 + (i % 4) * .12, .39 + Math.floor(i / 4) * .22, frente - .12 + (i % 2) * .24]);
    o.salida = piezas(g, 3, i => [ancho / 2 - .5 + i * .15, .39, frente]);
    o.barra = new THREE.Mesh(geo(new THREE.BoxGeometry(1, .07, .07)), especiales.progreso);
    o.barra.position.set(0, .4, fondo / 2 + .04); o.barra.visible = false; g.add(o.barra);
    o.alto = ALTO_TALLER[e.clase] ?? (grande ? 2.2 : e.clase === 'prensa' ? 2.9 : 1.8);
    return o;
  }
  function robotObj(e) {
    const g = new THREE.Group(), o = { grupo: g, rumbo: e.rumbo || 0, alto: 1.2 };
    if (e.clase === 'obrero') {
      // bot-01: chasis azul sobre orugas, torreta blanca y un brazo de dos tramos con pinza.
      g.add(caja(.8, .3, .62, PALETA.azul[0], 0, .12, 0));
      for (const z of [-.36, .36]) g.add(caja(.86, .22, .16, PALETA.goma[0], 0, .02, z));
      g.add(cil(.24, .26, .12, PALETA.blanco[0], -.05, .42, 0));
      o.hombro = new THREE.Group(); o.hombro.position.set(-.05, .58, 0); g.add(o.hombro);
      const brazo = caja(.62, .1, .12, PALETA.blanco[0], .31, -.05, 0);
      o.hombro.add(brazo);
      o.codo = new THREE.Group(); o.codo.position.set(.62, 0, 0); o.hombro.add(o.codo);
      o.codo.add(caja(.5, .08, .1, PALETA.blanco[2], .25, -.04, 0));
      o.pinza = new THREE.Group(); o.pinza.position.set(.5, 0, 0); o.codo.add(o.pinza);
      o.pinza.add(caja(.06, .1, .26, PALETA.blanco[0], .03, -.05, 0), caja(.16, .06, .05, PALETA.blanco[0], .1, -.05, .11), caja(.16, .06, .05, PALETA.blanco[0], .1, -.05, -.11));
      o.carga = piezas(o.pinza, 1, () => [.14, -.12, 0]);
    } else {
      // frk-01: carrocería roja, ruedas oscuras, mástil y horquillas de acero.
      g.add(caja(1.25, .5, .9, PALETA.rojo[0], -.2, .2, 0), caja(.5, .42, .7, PALETA.rojo[2], -.45, .7, 0), caja(.42, .06, .6, PALETA.marino[0], -.45, 1.12, 0));
      for (const [x, z] of [[.25, .5], [-.65, .5], [.25, -.5], [-.65, -.5]]) {
        const r = cil(.22, .22, .16, PALETA.goma[0], x, -.08, z, 12);
        r.rotation.x = Math.PI / 2; r.position.y = .22; g.add(r);
      }
      for (const z of [-.32, .32]) g.add(caja(.1, 1.7, .1, PALETA.hierro[0], .5, .1, z));
      o.horquilla = new THREE.Group();
      o.horquilla.add(caja(1.0, .05, .13, PALETA.acero[0], 1.0, 0, .3), caja(1.0, .05, .13, PALETA.acero[0], 1.0, 0, -.3), caja(.08, .4, .8, PALETA.acero[2], .52, 0, 0));
      o.horquilla.position.y = .14; g.add(o.horquilla);
      o.alto = 2;
    }
    return o;
  }
  function marco(w, d, color) {
    const s = new THREE.Group(), m = mat(color), k = .14, l = Math.min(w, d) * .3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      s.add(caja(l, .02, k, color, sx * (w / 2 - l / 2), .01, sz * (d / 2 - k / 2), false));
      s.add(caja(k, .02, l, color, sx * (w / 2 - k / 2), .01, sz * (d / 2 - l / 2), false));
    }
    s.children.forEach(h => { h.material = m; h.raycast = () => {}; });
    return s;
  }
  const veladas = new Map();
  const placa = (w, d, color) => {
    const o = caja(w, .03, d, color, 0, 0, 0, false);
    if (!veladas.has(color)) veladas.set(color, new THREE.MeshLambertMaterial({ color, transparent: true, opacity: .55 }));
    o.material = veladas.get(color);
    return o;
  };
  function otroObj(e) {
    const g = new THREE.Group();
    if (e.clase === 'lugar') {
      g.add(placa(1.7, 1.7, PALETA.marino[2]), marco(1.7, 1.7, e.tipo === 'sup' ? PALETA.entrada : PALETA.salida));
      return { grupo: g, alto: 1.2 };
    }
    if (e.clase === 'pad') { g.add(placa(2.6, 2.6, PALETA.marino[2]), marco(2.6, 2.6, PALETA.acero[1])); return { grupo: g, alto: .4 }; }
    if (e.clase === 'pila') {
      for (let i = 0; i < 6; i++) g.add(caja(1.25, .1, 1.25, PALETA.madera[i % 2], 0, i * .15, 0));
      g.add(marco(1.7, 1.7, PALETA.acero[1]));
      return { grupo: g, alto: 1.3 };
    }
    if (e.clase === 'bahia') {
      g.add(placa(2.6, 3.4, PALETA.marino[2]), marco(2.6, 3.4, PALETA.entrada));
      for (const [x, z] of [[-1.2, -1.6], [-1.2, 1.6], [1.2, -1.6], [1.2, 1.6]]) g.add(caja(.16, 2.6, .16, PALETA.marino[1], x, 0, z));
      g.add(caja(2.9, .14, 3.7, PALETA.turquesa[0], 0, 2.6, 0), caja(2.9, .06, .2, PALETA.entrada, 0, 2.74, 1.75, false));
      return { grupo: g, alto: 2.9 };
    }
    if (e.clase === 'banda') {
      const L2 = e.largo, ang = Math.atan2(e.y1 - e.y0, e.x1 - e.x0);
      g.rotation.y = -ang;
      g.add(caja(L2, .3, .9, PALETA.marino[0], 0, .3, 0), caja(L2, .06, .7, PALETA.goma[0], 0, .6, 0),
        caja(L2, .12, .06, PALETA.salida, 0, .6, .45, false), caja(L2, .12, .06, PALETA.salida, 0, .6, -.45, false));
      for (let x = -L2 / 2 + .3; x < L2 / 2; x += 1.2) g.add(caja(.12, .3, .9, PALETA.acero[2], x, 0, 0));
      const o = { grupo: g, alto: 1.2, L: L2, items: piezas(g, 8, () => [0, .66, 0]), listones: [] };
      for (let k = 0; k < Math.floor(L2); k++) { const s = caja(.08, .02, .66, PALETA.acero[0], 0, .66, 0, false); g.add(s); o.listones.push(s); }
      return o;
    }
    if (e.clase === 'arsenal') {
      // Bodega de la muralla: búnker pizarra con puerta de franjas y los misiles apilados encima.
      g.add(caja(2, 2.1, 3, PALETA.pizarra[0], 0, 0, 0), caja(2.1, .16, 3.1, PALETA.salida, 0, 2.1, 0));
      const puerta = new THREE.Mesh(geo(new THREE.PlaneGeometry(1, 1.2)), MT.franjas);
      puerta.position.set(-1.01, .7, 0); puerta.rotation.y = -Math.PI / 2; g.add(puerta);
      return { grupo: g, alto: 2.8, stock: piezas(g, 8, i => [-.5 + (i % 4) * .34, 2.26, -.6 + Math.floor(i / 4) * 1.1]) };
    }
    if (e.clase === 'torreta') {
      g.add(caja(1.3, .4, 1.3, PALETA.marino[0], 0, 0, 0));
      const torre = new THREE.Group(); torre.position.y = .5;
      torre.add(caja(.95, .42, .7, PALETA.acero[0], .12, .1, 0));
      g.add(torre);
      return { grupo: g, alto: 1.4, torre, carga: piezas(g, 4, i => [-.4 + i * .27, .46, -.5]) };
    }
    if (e.clase === 'control') {
      g.add(caja(1.3, .3, 1.3, PALETA.marino[0], 0, 0, 0), caja(.9, 2.8, .9, PALETA.pizarra[0], 0, .3, 0), caja(.94, .16, .94, PALETA.turquesa[0], 0, 3, 0));
      const luz = new THREE.Mesh(geo(new THREE.SphereGeometry(.1, 8, 6)), luces.off); luz.position.set(0, 3.4, 0); g.add(luz);
      return { grupo: g, alto: 3.6, luz };
    }
    return null;
  }

  // ---------- Construir y actualizar desde el mundo de la planta ----------
  const objetos = new Map(), tarimas = new Map(), misiles = new Map(), efectos = new Map(), aros = new Map(), alcances = new Map();
  let camion = null;
  function vaciarGrupo(g) {
    while (g.children.length) g.children.pop().removeFromParent();
  }
  function construir() {
    vaciarGrupo(fijo); vaciarGrupo(movil);
    objetos.clear(); tarimas.clear(); misiles.clear(); efectos.clear(); aros.clear(); alcances.clear(); camion = null;
    const m = estado.escena;
    if (!m) return;
    for (const e of m.maquinas) {
      const o = C.esMaquina(e) ? maquinaObj(e) : C.esRobot(e) ? robotObj(e) : otroObj(e);
      if (!o) continue;
      o.grupo.userData.id = e.id;
      (C.esRobot(e) ? movil : fijo).add(o.grupo);
      objetos.set(e.id, o);
    }
    // Camión de los proveedores: llega por el oeste hasta la bahía.
    camion = new THREE.Group();
    camion.add(caja(3.2, 1.5, 1.7, PALETA.blanco[2], -.9, .45, 0), caja(1.2, 1.2, 1.6, PALETA.turquesa[0], 1.5, .4, 0));
    for (const [x, z] of [[1.4, .8], [-1.6, .8], [1.4, -.8], [-1.6, -.8], [-.3, .8], [-.3, -.8]]) {
      const r = cil(.34, .34, .22, PALETA.goma[0], x, 0, z, 12);
      r.rotation.x = Math.PI / 2; r.position.y = .34; camion.add(r);
    }
    camion.visible = false; camion.traverse(x => { x.raycast = () => {}; });
    movil.add(camion);
  }

  // ---------- Fantasma del colocador (app/juego/mover-fabrica.js) ----------
  // Copia translúcida de la pieza en su destino: verde si el motor la acepta ahí y roja si no. Un disco amarillo marca
  // el punto de trabajo, ya girado: donde se parará el obrero. Cuelga de `planta`, fuera de lo que se elige con el ratón,
  // y la pieza real sigue en su sitio hasta que el jugador confirma.
  const fantasmaMat = {
    si: new THREE.MeshBasicMaterial({ color: 0x4fd68a, transparent: true, opacity: .42, depthWrite: false }),
    no: new THREE.MeshBasicMaterial({ color: LUZ.red, transparent: true, opacity: .42, depthWrite: false }),
  };
  const fantasmaTinta = { si: new THREE.LineBasicMaterial({ color: 0x1f7a47 }), no: new THREE.LineBasicMaterial({ color: 0x8a1a1e }) };
  const discoTrabajo = new THREE.Mesh(geo(new THREE.CylinderGeometry(.34, .34, .03, 20)), especiales.alcance);
  discoTrabajo.visible = false;
  planta.add(discoTrabajo);
  const fantasmas = new Map();
  let fantasmaVisto = null;
  function fantasma(f) {
    if (fantasmaVisto && (!f || fantasmaVisto.id !== f.id)) { fantasmaVisto.grupo.visible = false; fantasmaVisto = null; }
    discoTrabajo.visible = !!f && f.ax != null;
    if (!f) return;
    const e = estado.escena?.porId[f.id];
    if (!e) return;
    if (!fantasmas.has(f.id)) {
      const o = C.esMaquina(e) ? maquinaObj(e) : C.esRobot(e) ? robotObj(e) : otroObj(e);
      if (!o) return;
      o.grupo.traverse(x => { x.raycast = () => {}; });
      planta.add(o.grupo);
      fantasmas.set(f.id, { id: f.id, grupo: o.grupo, valido: null });
    }
    const v = fantasmaVisto = fantasmas.get(f.id);
    if (v.valido !== f.valido) {
      const k = f.valido ? 'si' : 'no';
      v.grupo.traverse(x => {
        if (x.isMesh) x.material = fantasmaMat[k];
        else if (x.isLine) x.material = fantasmaTinta[k];
      });
      v.valido = f.valido;
    }
    v.grupo.visible = true;
    v.grupo.position.set(f.x, .03, f.y);
    v.grupo.rotation.y = f.ax == null ? 0 : frente(f.ax - f.x, f.ay - f.y);
    if (f.ax != null) discoTrabajo.position.set(f.ax, .05, f.ay);
  }

  const posMisil = (mi, t) => {
    const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
    return [mi.x0 + (mi.x1 - mi.x0) * u, mi.z0 + (mi.z1 - mi.z0) * u + mi.arco * 4 * u * (1 - u), mi.y0 + (mi.y1 - mi.y0) * u];
  };
  const giro = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  function actualizar(off, ahora) {
    const m = estado.escena;
    if (!m) return;
    asentar();
    const t = m.t + off, activo = m.activo;
    for (const e of m.maquinas) {
      const o = objetos.get(e.id);
      if (!o) continue;
      const g = o.grupo;
      g.visible = e.presente !== false;
      if (C.esRobot(e)) {
        g.position.set(e.cx, 0, e.cy);
        const destino = e.tarea && m.porId[e.tarea.lugar];
        o.rumbo = giro(o.rumbo, e.tarea?.fase === 'op' && destino ? Math.atan2(destino.cy - e.cy, destino.cx - e.cx) : e.rumbo ?? o.rumbo, .25);
        g.rotation.y = -o.rumbo;
        if (o.carga) pintarPiezas(o.carga, e.carga ? [e.carga] : []);
        if (o.hombro) {
          // Brazo extendido mientras trabaja en un lugar; plegado en reposo (las poses de bot-01).
          const tendido = e.tarea?.fase === 'op' ? 1 : e.carga ? .5 : 0;
          o.hombro.rotation.z = giro(o.hombro.rotation.z, -.15 + (1 - tendido) * .9, .2);
          o.codo.rotation.z = giro(o.codo.rotation.z, -(1 - tendido) * 2.1 - tendido * .4, .2);
          o.pinza.rotation.z = -o.hombro.rotation.z - o.codo.rotation.z;
        }
        if (o.horquilla) o.horquilla.position.y = e.carga ? .55 : .14;
      } else if (C.esMaquina(e)) {
        const est = C.estadoMaquina(e), enc = e.encendida, pad = e.pad ? m.porId[e.pad] : e;
        g.position.set(e.cx, e.enVilo ? .62 : 0, e.cy);
        if (!e.enVilo) g.rotation.y = rumbo(e, pad);
        for (const c of o.cuerpo) c.material = enc ? c.userData.color : apagadoDe(c.userData.color);
        pintarPiezas(o.entrada, Object.entries(e.entrada).flatMap(([p, n]) => Array(n).fill(p)));
        pintarPiezas(o.salida, e.salida);
        const luz = !enc ? 'off' : e.luz ? e.luz : est === 'blocked' ? 'red' : 'off';
        o.luz.material = luces[luz] ?? luces.off;
        const R = e.proceso ? C.RECETAS[e.proceso.receta] : null;
        const u = R ? Math.min(1, e.proceso.prog / R.t) : e.cambio ? 1 - e.cambio.falta / e.cambio.total : 0;
        o.barra.visible = u > 0; o.barra.scale.x = Math.max(.02, u * 1.6);
        const anda = est === 'working' && activo;
        if (o.ariete) o.ariete.position.y = anda ? 1.05 + .7 * Math.abs(Math.sin(ahora / 160)) : 1.75;
        if (o.pieza) o.pieza.visible = !!e.proceso;
        if (o.cil) o.cil.forEach((x, i) => { x.scale.y = anda ? 1 + .18 * Math.sin(ahora / 180 + i * 2) : 1; });
        if (o.pala && anda) o.pala.rotation.y = ahora / 130;
        if (o.anima) o.anima(anda, ahora);
        if (o.franja) {
          o.franja.material = luces[!enc ? 'off' : est === 'working' ? 'green' : est === 'changeover' ? 'amber' : est === 'blocked' ? 'red' : 'off'];
          g.position.y += anda ? .015 * Math.sin(ahora / 30) : 0;
        }
      } else {
        g.position.set(e.cx, 0, e.cy);
        if (e.clase === 'banda') {
          pintarPiezas(o.items, e.piezas.slice(0, 8).map(x => x.pieza));
          e.piezas.slice(0, 8).forEach((x, i) => { o.items[i].position.set(-o.L / 2 + x.s, .82, 0); o.items[i].rotation.z = Math.PI / 2; });
          const fase = e.marcha && activo ? (t * C.BANDA.vel) % 1 : 0;
          o.listones.forEach((s, k) => { s.position.x = -o.L / 2 + ((k + fase) % Math.max(1, o.listones.length)); });
        } else if (e.clase === 'arsenal') {
          pintarPiezas(o.stock, Array(Math.min(8, e.misiles)).fill('missile'));
          o.stock.forEach(x => { x.rotation.z = Math.PI / 2; });
        } else if (e.clase === 'torreta') {
          o.torre.rotation.y = -e.yaw;
          pintarPiezas(o.carga, Array(e.misiles).fill('missile'));
        } else if (e.clase === 'control') o.luz.material = luces[e.encendida ? (ahora % 1200 < 700 ? 'green' : 'off') : 'off'];
      }
    }
    // Tarimas de madera con su carga: en su lugar o sobre las horquillas del montacargas.
    const vivas = new Set();
    for (const ta of m.tarimas) {
      vivas.add(ta.id);
      let o = tarimas.get(ta.id);
      if (!o) {
        const g = new THREE.Group();
        g.add(caja(1.25, .08, 1.25, PALETA.madera[0], 0, .06, 0), caja(1.25, .06, .16, PALETA.madera[2], 0, 0, .45), caja(1.25, .06, .16, PALETA.madera[2], 0, 0, -.45));
        o = { grupo: g, firma: null, piezas: piezas(g, C.TARIMA_CAP, i => [-.42 + (i % 4) * .28, .14, -.34 + Math.floor(i / 4) * .34]) };
        movil.add(g); tarimas.set(ta.id, o);
      }
      const en = m.porId[ta.en];
      if (!en) { o.grupo.visible = false; continue; }
      o.grupo.visible = true; o.grupo.userData.id = en.id;
      if (C.esRobot(en)) {
        const a = objetos.get(en.id)?.rumbo ?? 0;
        o.grupo.position.set(en.cx + Math.cos(a) * 1.15, .58, en.cy + Math.sin(a) * 1.15); o.grupo.rotation.y = -a;
      } else { o.grupo.position.set(en.cx, .04, en.cy); o.grupo.rotation.y = 0; }
      const firma = ta.piezas.join(',');
      if (firma !== o.firma) { o.firma = firma; pintarPiezas(o.piezas, ta.piezas); }
    }
    for (const [id, o] of tarimas) if (!vivas.has(id)) { o.grupo.removeFromParent(); tarimas.delete(id); }
    const ped = m.bahia?.pedidos?.[0], bahia = m.maquinas.find(e => e.clase === 'bahia');
    if (camion && bahia) {
      const falta = ped ? ped.llega - t : -1, ver = ped && falta < 5;
      camion.visible = !!ver;
      if (ver) {
        const u = Math.max(0, Math.min(1, 1 - falta / 5));
        camion.position.set(bahia.cx - 14 + 11 * u, 0, bahia.cy);
      }
    }
    // Salva de prueba: misiles con estela y explosiones.
    const enVuelo = new Set();
    for (const mi of m.misiles) {
      enVuelo.add(mi.id);
      let o = misiles.get(mi.id);
      if (!o) {
        const bola = new THREE.Mesh(geo(new THREE.SphereGeometry(.2, 10, 8)), especiales.misil), gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
        const estela = new THREE.Line(gg, especiales.estela);
        estela.frustumCulled = false; o = { bola, estela }; misiles.set(mi.id, o); movil.add(bola, estela);
      }
      o.bola.position.set(...posMisil(mi, t));
      const arr = o.estela.geometry.attributes.position.array;
      for (let k = 0; k < 10; k++) { const q = posMisil(mi, t - k * .04); arr[k * 3] = q[0]; arr[k * 3 + 1] = q[1]; arr[k * 3 + 2] = q[2]; }
      o.estela.geometry.attributes.position.needsUpdate = true;
    }
    for (const [id, o] of misiles) if (!enVuelo.has(id)) { o.bola.removeFromParent(); o.estela.removeFromParent(); o.estela.geometry.dispose(); misiles.delete(id); }
    const vistos = new Set();
    for (const x of m.explosiones) {
      const k = `${x.t0}|${x.x}|${x.y}`; vistos.add(k);
      let o = efectos.get(k);
      if (!o) { o = new THREE.Mesh(geo(new THREE.SphereGeometry(1, 14, 10)), especiales.explosion.clone()); efectos.set(k, o); movil.add(o); }
      const u = Math.min(1, (t - x.t0) / .4);
      o.position.set(x.x, x.z + .3, x.y); o.scale.setScalar(2.2 * (.25 + .75 * Math.min(1, u * 1.4)));
      o.material.opacity = .45 * (1 - Math.max(0, (t - x.t0 - .25) / .5));
    }
    for (const [k, o] of efectos) if (!vistos.has(k)) { o.removeFromParent(); o.material.dispose(); efectos.delete(k); }
    // Aros de selección y alcance de los brazos anclados.
    for (const id of estado.seleccionadas) {
      const e = m.porId[id];
      if (!e || e.presente === false) continue;
      let a = aros.get(id);
      if (!a) {
        const r = radioDe(e);
        a = new THREE.Mesh(geo(new THREE.RingGeometry(r - .07, r + .07, 64)), especiales.sel);
        a.rotation.x = -Math.PI / 2; a.raycast = () => {}; movil.add(a); aros.set(id, a);
      }
      a.position.set(e.cx, .06, e.cy);
    }
    for (const [id, a] of aros) if (!estado.seleccionadas.has(id) || m.porId[id]?.presente === false || !m.porId[id]) { a.removeFromParent(); aros.delete(id); }
    const verAlcance = [...estado.seleccionadas].some(id => { const e = m.porId[id]; return e && (e.alcance || (e.clase === 'lugar' && e.tipo === 'lot') || e.entrada); });
    for (const e of m.robots) {
      if (!e.alcance || !e.base) continue;
      let a = alcances.get(e.id);
      if (!verAlcance) { if (a) a.visible = false; continue; }
      if (!a) {
        a = new THREE.Mesh(geo(new THREE.RingGeometry(e.alcance - .05, e.alcance + .05, 72)), especiales.alcance);
        a.rotation.x = -Math.PI / 2; a.raycast = () => {}; movil.add(a); alcances.set(e.id, a);
      }
      a.position.set(e.base.x, .05, e.base.y); a.visible = true;
    }
  }

  // ---------- Cámara: la de las Batallas de V2, encuadrando la losa ----------
  // La cámara puede pasear 5 m más allá de la losa, pero el encuadre inicial solo pide que quepa la losa
  // (`puntos`, a su altura): así las máquinas se ven grandes desde el primer momento.
  const margen = 5;
  const puntos = [[L.x0, L.y0], [L.x1, L.y0], [L.x0, L.y1], [L.x1, L.y1]].map(([x, y]) => new THREE.Vector3(ox + x, 0, oy + y));
  const zona = { x0: ox + L.x0 - margen, x1: ox + L.x1 + margen, z0: oy + L.y0 - margen, z1: oy + L.y1 + margen, yaw: -.35, pitch: 1, pitchMin: PITCH_RASANTE, alto: 0, zoom: [3, zoomMax], puntos };
  const interseccion = ray => ray.intersectObject(losa, false)[0]?.point ?? paisaje.interseccion(ray);
  // `horizonte`: la niebla de la fábrica empieza detrás de la cámara (dist + 24 m), como la del visor común,
  // en vez de la de las Batallas (55 % de la distancia), que lavaba la mitad lejana de la losa.
  const control = crearCamara3D({ THREE, renderer, escena, camara, fijo, movil, zona, horizonte: escena.fog,
    estado: { camaraDosDedos: true, get arrastreCampo() { return estado.arrastreCampo; } },
    $: id => id === 'c3d' ? canvas : $(id), interseccionTerreno: interseccion });
  let encuadre = -1, anchoCampo = 0, altoCampo = 0;
  function tamano(w, h) { anchoCampo = w; altoCampo = h; control.tamano(w, h); }
  function render() {
    if (encuadre !== revision && anchoCampo && altoCampo) {
      // La losa sube cuando llegan las teselas: el encuadre la sigue mientras el jugador no haya movido la cámara.
      zona.alto = alto;
      for (const q of puntos) q.y = alto;
      const primero = encuadre < 0;
      control.tamano(anchoCampo, altoCampo);
      if (primero) control.recentrar();
      encuadre = revision;
    }
    control.render();
  }
  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();
  function elegir(px, py, w, h) {
    ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    for (const hit of rayo.intersectObjects([fijo, movil], true)) {
      let visible = true, o = hit.object;
      for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) continue;
      while (o && !o.userData.id) o = o.parent;
      if (o) return o.userData.id;
    }
    return null;
  }
  return {
    construir, actualizar, render, tamano, fantasma,
    proyectar(x, altoP, y, w, h) {
      v.set(x + ox, altoP + alto, y + oy).project(camara);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 && v.z > -1 };
    },
    elegir,
    suelo(px, py, w, h) { const p = control.suelo(px, py, w, h); return p ? { x: p.x - ox, y: p.y - oy, z: 0 } : null; },
    centrar(x, y) { control.centrar(x + ox, y + oy); },
    recentrar: control.recentrar, girar: control.girar, desplazar: control.desplazar,
    inclinacion: control.inclinacion, limitesInclinacion: control.limitesInclinacion,
    anillosDe() {}, aplicarColores() {}, retrato: () => null,
    batalla(si) {
      escena.background.set(si ? FONDO_BATALLA : FONDO);
      escena.fog.color.copy(escena.background);
      paisaje.batalla(si);
    },
    // Vista del campo de batalla, al este de la muralla (la salva de prueba de H5).
    verCampo() { control.centrar(ox + mapa.dianas[0].x, oy + mapa.dianas[0].y); },
    camara: () => control.camara(),
    destruir() {
      control.destruir(); paisaje.destruir();
      for (const t of texturas) t.dispose();
      liberarEscena(escena, renderer, [...mats.values(), ...geos, tinta, ...Object.values(especiales), ...Object.values(luces), ...Object.values(MT), ...veladas.values(),
        ...Object.values(fantasmaMat), ...Object.values(fantasmaTinta)]);
    },
  };
}
