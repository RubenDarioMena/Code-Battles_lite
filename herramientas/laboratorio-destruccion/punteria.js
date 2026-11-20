import { ARMAS, FISICA } from '../../paquetes/destruccion/index.js';

// El clic y los guiones usan el mismo emisor. Para las gotas, la tabla de
// arrastre del modo interviene también en la compensación a presión plena.
export function apuntar(arma, origen, blanco, potencia = 1, lateral = 0) {
  const [x, y, z] = blanco.map((n, i) => n - origen[i]);
  const d = Math.hypot(x, y), ux = d ? x / d : 0, uy = d ? y / d : 0;
  const granada = arma === 'granada';
  const modo = arma === 'chorro-caotico' ? 'caotico' : 'directo';
  const v = granada ? ARMAS.granada.velocidad : ARMAS.chorro.velocidad;
  const g = FISICA.gravedad;
  let angulo = Math.PI / 4;
  if (granada) {
    const discriminante = v**4 - g * (g * d*d + 2 * z * v*v);
    if (discriminante >= 0) angulo = Math.atan2(g*d*d + 2*z*v*v, d*(v*v + Math.sqrt(discriminante)));
  } else {
    const k = ARMAS.chorro[modo].arrastre, dt = FISICA.dt;
    function altura(a) {
      let u = v * Math.cos(a), w = v * Math.sin(a), h = 0, horizontal = 0;
      for (let i = 0; i < 360; i++) {
        const ax = -k*u, az = -g-k*w, dx = (u + ax*dt/2)*dt, dz = (w + az*dt/2)*dt;
        if (horizontal + dx >= d) return h + dz*(d-horizontal)/dx;
        horizontal += dx; h += dz; u += ax*dt; w += az*dt;
      }
      return -Infinity;
    }
    if (altura(angulo) >= z) {
      let bajo = -Math.PI/2, alto = angulo;
      for (let i = 0; i < 25; i++) {
        const medio = (bajo + alto)/2;
        if (altura(medio) < z) bajo = medio; else alto = medio;
      }
      angulo = (bajo + alto)/2;
    }
  }
  const direccion = d ? [ux*Math.cos(angulo), uy*Math.cos(angulo), Math.sin(angulo)] : [0, 0, z < 0 ? -1 : 1];
  return { arma: granada ? arma : 'chorro', origen, direccion, potencia,
    ...(granada ? {} : { modo, viento: [uy * lateral, -ux * lateral, 0] }) };
}
