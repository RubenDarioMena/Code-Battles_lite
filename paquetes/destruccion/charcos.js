import { CHARCO, FISICA } from './tablas.js';
import { local, rotar, conj, ruidoSuave } from './geometria.js';
import { cajaVolumen } from './celdas.js';
import { resolverDanio } from './danio.js';
import { actualizarRobot } from './vuelo.js';

// La vista muestrea el mismo perfil angular que recorta la máscara.
export function radioDelCharco(c, x, y) {
  const longitud = Math.hypot(x, y) || 1;
  const k = c.radio / longitud;
  return c.radio * (1 - CHARCO.irregularidad * ruidoSuave(c.id, [x*k, y*k, 0], CHARCO.escalaRuido));
}

export function alimentarCharco(w, pos, radio, clave) {
  const centro = [pos[0], pos[1], 0];
  let area = Math.min(radio, CHARCO.radioMax) ** 2, charco;
  // Un nuevo aporte puede conectar dos charcos. Conserva la identidad del primero.
  for (const c of w.charcos) {
    if (!c.activo || Math.hypot(centro[0] - c.centro[0], centro[1] - c.centro[1]) > Math.min(CHARCO.radioMax, Math.sqrt(area)) + c.final) continue;
    const otra = c.final ** 2;
    for (let i = 0; i < 2; i++) centro[i] = (centro[i] * area + c.centro[i] * otra) / (area + otra);
    area += otra;
    if (!charco) charco = c;
    else w.charcos = w.charcos.filter(x => x !== c);
  }
  if (!charco) {
    charco = { id: clave, centro, paso: w.paso, edad: 0, activo: true, radio: 0, altura: 0 };
    w.charcos.push(charco);
    w.eventos.push({ paso: w.paso, tipo: 'charco', unidad: null, datos: { id: clave, pos: [...centro] } });
  }
  Object.assign(charco, { centro, final: Math.min(CHARCO.radioMax, Math.sqrt(area)), ultimo: w.paso });
}

function corroer(w, c, p) {
  const a = local(p, c.centro), b = local(p, [c.centro[0], c.centro[1], c.altura]);
  const v = { tipo: 'acido', fuente: 'charco', hash: c.id, a, b, radio: c.radio, paso: c.ultimo, duracion: CHARCO.duracion };
  const arriba = rotar(conj(p.rot), [0, 0, 1]);
  let quitadas = 0;
  for (const i of cajaVolumen(p.g, v, c.radio)) {
    if (!p.mask[i]) continue;
    const cel = p.g.centros[i], x = cel[0] - a[0], y = cel[1] - a[1], z = cel[2] - a[2];
    const altura = x * arriba[0] + y * arriba[1] + z * arriba[2];
    if (altura < -1e-8 || altura > c.altura + 1e-8) continue;
    const radial2 = x*x + y*y + z*z - altura*altura;
    if (radial2 > c.radio ** 2) continue;
    if (radial2 > (c.radio * (1 - CHARCO.irregularidad)) ** 2) {
      const horizontal = rotar(p.rot, [x, y, z]);
      if (radial2 > radioDelCharco(c, horizontal[0], horizontal[1]) ** 2) continue;
    }
    p.mask[i] = 0; quitadas++;
  }
  if (!quitadas) return;
  const indice = p.volumenes.findIndex(q => q.fuente === 'charco' && q.hash === c.id);
  if (indice < 0) p.volumenes.push(v); else p.volumenes[indice] = v;
  if (p.salida === 'saliendo') p.salida = 'reposo';
  resolverDanio(w, p, v, null, quitadas);
  actualizarRobot(w, p.robot);
}

export function pasoCharcos(w) {
  for (const c of w.charcos) {
    c.edad = (w.paso - c.paso) * FISICA.dt;
    c.inactivoDesde = Math.max(0, (w.paso - c.ultimo) * FISICA.dt - CHARCO.duracion);
    c.activo = (w.paso - c.ultimo) * FISICA.dt < CHARCO.duracion;
    if (!c.activo) continue;
    c.radio = c.final * Math.min(1, c.edad / CHARCO.crecimiento);
    c.altura = CHARCO.altura * Math.min(1, c.edad / CHARCO.ascenso);
    if (c.altura > 0) for (const p of w.piezas.slice()) {
      if (p.vivas && p.salida !== 'oculto') corroer(w, c, p);
    }
  }
  w.charcos = w.charcos.filter(c => c.inactivoDesde < CHARCO.mancha);
}
