// Muralla de vóxeles (shared/muralla/voxeles.js), sin DOM: node pruebas/muralla-voxeles.cjs
// Rejilla y trozos, paredes sobre un eje, capas contiguas, obras en orden, romper/reparar, ampliar,
// guardado de ida y vuelta, malla (caras ocultas entre trozos, oclusión) y determinismo.
const assert = require('node:assert/strict');
const path = require('node:path');
const V = require(path.join(__dirname, '..', 'shared/muralla/voxeles.js'));
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

// Trazado de la muralla del boceto de Campaign (campaign-nivel.js, rama campaign-nivel-1).
const BOCETO = [[104.5, 26.5], [104.5, 62], [104, 68], [102.5, 74], [99.5, 80], [94.5, 85], [87, 88.6], [78, 90.6], [66, 91.8], [51, 92.8]];
const BASE = { eje: 'principal', s0: -.75, s1: .75, z0: 0, z1: 3.5, material: 'piedra', almenas: { alto: .5, paso: 1 } };
function muralla(tam = .5) { const m = V.crear({ tam }); m.eje('principal', BOCETO); return m; }

// Ni Math.random ni reloj en las reglas.
const rnd = Math.random, now = Date.now;
Math.random = () => { throw new Error('Math.random en la muralla'); };
Date.now = () => { throw new Error('Date.now en la muralla'); };
try {
  // ---------- Rejilla ----------
  {
    const r = V.crearRejilla();
    eq(r.get(-1, -1, -1), 0, 'vacía');
    r.set(-1, -1, -1, 2); r.set(15, 0, 0, 1); r.set(16, 0, 0, 1);
    eq([r.get(-1, -1, -1), r.get(15, 0, 0), r.get(16, 0, 0)], [2, 1, 1], 'índices negativos y borde de trozo');
    eq(r.total, 3, 'cuenta'); eq(r.numTrozos, 3, 'tres trozos');
    r.tomarSucios();
    r.set(16, 0, 0, 0);
    const sucios = r.tomarSucios().map(V.deClave).map(String).sort();
    eq(sucios, ['0,0,0', '1,0,0'], 'quitar en el borde ensucia también al vecino');
    eq(V.deClave(V.claveDe(-3, 7, -511)), [-3, 7, -511], 'clave numérica de ida y vuelta');
  }

  // ---------- Eje ----------
  {
    const pr = V.proyectar(BOCETO, 106, 40);
    ok(pr.s > 0 && Math.abs(pr.d - 1.5) < 1e-9, 'al este del tramo recto es «fuera» (s > 0)');
    ok(V.proyectar(BOCETO, 100, 40).s < 0, 'al oeste es «dentro»');
    ok(V.proyectar(BOCETO, 104.5, 20).extremo, 'antes del primer punto cae fuera del eje');
    ok(Math.abs(V.proyectar(BOCETO, 104.5, 40).u - 13.5) < 1e-9, 'recorrido a lo largo del eje');
  }

  // ---------- Pared base ----------
  const m = muralla();
  const base = m.construir(BASE);
  ok(base.total > 2000, `pared base con ${base.total} vóxeles`);
  eq(m.estadisticas().voxeles, base.total, 'todo colocado');
  eq(m.obras.length, 0, 'sin obras pendientes');
  ok(m.altoEn(104.5, 40) === 3.5 || m.altoEn(104.5, 40) === 4, 'la cima está a 3,5 m (4 con almena)');
  eq(m.altoEn(90, 40), null, 'sin muralla lejos del eje');
  ok(m.solido(104.5, 40, 1) === V.MAT.piedra, 'piedra dentro de la banda');
  ok(!m.solido(106, 40, 1), 'vacío a 1,5 m del eje');
  // Almenas solo en el borde de fuera, alternando cada metro.
  {
    let almenas = 0, dentroAlmena = 0;
    m.rejilla.recorrer((i, j, k) => { if (k === 7) { almenas++; const c = m.centro(i, j, k); if (V.proyectar(BOCETO, c[0], c[1]).s < .25) dentroAlmena++; } });
    ok(almenas > 50, `${almenas} vóxeles de almena`); eq(dentroAlmena, 0, 'las almenas van en el borde de fuera');
  }

  // ---------- Capas contiguas: sin huecos ni solapes ----------
  {
    const fuera = m.capa('principal', 'fuera', 1), dentro = m.capa('principal', 'dentro', 1);
    eq([fuera.s0, fuera.s1, dentro.s0, dentro.s1], [.75, 1.75, -1.75, -.75], 'bandas contiguas');
    eq([fuera.z0, fuera.z1], [0, 3.5], 'misma altura que la muralla');
    const otra = muralla();
    otra.construir({ ...BASE, almenas: null });
    const antes = otra.estadisticas().voxeles;
    const o = otra.construir({ ...otra.capa('principal', 'fuera', 1), material: 'hormigon' });
    eq(otra.estadisticas().voxeles, antes + o.total, 'la capa no se solapa con la base');
    // Sin hueco: cada columna del tramo recto, de s = −0,75 a 1,75, está llena del suelo a la cima.
    let huecos = 0;
    for (let y = 30.25; y < 60; y += .5) for (let x = 103.75; x < 106.25; x += .5) {
      const s = V.proyectar(BOCETO, x, y).s; if (s < -.75 || s >= 1.75) continue;
      for (let z = .25; z < 3.5; z += .5) if (!otra.solido(x, y, z)) huecos++;
    }
    eq(huecos, 0, 'capa pegada a la base, sin hueco');
    ok(otra.solido(105.75, 40, 1) === V.MAT.hormigon, 'la capa nueva es de hormigón');
  }

  // ---------- Obras: orden, plano y avance ----------
  {
    const subir = m.planear({ ...m.hilada('principal', 1), material: 'hormigon' });
    ok(subir.total > 0, 'hilada planeada');
    const o = m.obras[0], L = o.lista;
    // Tramos de 2 m de recorrido, y dentro de cada tramo de abajo arriba.
    let ordenado = true;
    for (let n = 3; n < L.length; n += 3) {
      const ua = V.proyectar(BOCETO, ...m.centro(L[n - 3], L[n - 2], 0).slice(0, 2)).u, ub = V.proyectar(BOCETO, ...m.centro(L[n], L[n + 1], 0).slice(0, 2)).u;
      const ta = Math.floor(ua / V.TRAMO_OBRA), tb = Math.floor(ub / V.TRAMO_OBRA);
      if (tb < ta || (tb === ta && L[n + 2] < L[n - 1])) { ordenado = false; break; }
    }
    ok(ordenado, 'orden de obra: por tramos de 2 m y de abajo arriba');
    eq(m.estadisticas().planeados, subir.total, 'lo que falta está en el plano');
    const r = m.avanzar(100);
    eq(r.colocados, 100, 'avanza 100'); eq(m.estadisticas().planeados, subir.total - 100, 'el plano se vacía al construir');
    eq(m.obrasResumen()[0].hechos, 100, 'progreso de la obra');
    const fin = m.avanzar(1e9);
    eq(fin.terminadas, [subir.id], 'obra terminada'); eq(m.estadisticas().planeados, 0, 'plano vacío');
    ok(m.altoEn(104.5, 40) === 4.5, 'tras subir 1 m la cima está a 4,5 m');
  }

  // ---------- Romper y reparar ----------
  {
    const antes = m.estadisticas().voxeles;
    const debil = m.romper(104.5, 40, 2, 1.2, .2, { escombros: 0 });
    eq(debil.quitados, 0, 'un golpe por debajo de la resistencia de la piedra no rompe');
    const g = m.romper(104.5, 40, 2, 1.2, 1, { escombros: 0 });
    ok(g.quitados > 5, `golpe fuerte: ${g.quitados} vóxeles`);
    eq(m.estadisticas().voxeles, antes - g.quitados, 'cuenta tras romper');
    ok(!m.solido(104.5, 40, 2), 'agujero en el centro del golpe');
    // El acero resiste el mismo golpe.
    const acero = muralla(); acero.construir({ ...BASE, almenas: null, material: 'acero' });
    const ga = acero.romper(104.5, 40, 2, 1.2, 1, { escombros: 0 });
    ok(ga.quitados < g.quitados, `el acero pierde menos (${ga.quitados} frente a ${g.quitados})`);
    const obras = m.reparar();
    eq(obras.reduce((s, o) => s + o.total, 0), g.quitados, 'reparar planea justo lo que falta');
    m.avanzar(1e9);
    eq(m.estadisticas().voxeles, antes, 'reparada');
    eq(m.solido(104.5, 40, 2), V.MAT.piedra, 'el hueco vuelve con su material');
  }


  // ---------- Destrucción en tres capas ----------
  // Utilidades: vaciar a mano un bloque (sin onda ni derrumbe) y contar materiales.
  const vaciar = (x, x0, x1, y0, y1, z0, z1) => { for (let i = x.indice(x0, 0, 0)[0]; i < x.indice(x1, 0, 0)[0]; i++) for (let j = x.indice(0, y0, 0)[1]; j < x.indice(0, y1, 0)[1]; j++) for (let k = x.indice(0, 0, z0)[2]; k < x.indice(0, 0, z1)[2]; k++) x.rejilla.set(i, j, k, 0); };
  const contar = (x) => { const c = { solido: 0, escombro: 0 }; x.rejilla.recorrer((i, j, k, mm) => { c[V.esEscombro(mm) ? 'escombro' : 'solido']++; }); return c; };
  {
    const w = muralla(); w.construir(BASE);
    eq(w.derrumbar(0), [], 'la muralla recién construida está apoyada entera');
    // Túnel de 4 m en la base del tramo recto: el centro del dintel queda a más de 1,5 m de apoyo (voladizo de la piedra).
    vaciar(w, 103, 106, 38, 42, 0, 2);
    const antes = w.estadisticas().voxeles;
    const ids = w.derrumbar(1);
    eq(ids.length, 1, 'el dintel suelto es una pieza');
    const p = w.piezas[0];
    ok(p.estado === 'cae' && p.a1 === 0 && Math.abs(p.caida - 2) < 1e-9, `sujeto por los dos lados se hunde 2 m (cae ${p.caida} m)`);
    ok(p.vox.length / 4 >= 18, `${p.vox.length / 4} vóxeles en la pieza`);
    eq(w.paso(1 + p.dur - .01), [], 'aún cayendo');
    eq(w.paso(1 + p.dur), [p.id], 'se asienta al terminar la caída');
    eq(w.estadisticas().voxeles, antes, 'no se pierde ningún vóxel');
    ok(contar(w).escombro === p.vox.length / 4, 'la pieza vuelve como escombro');
    ok(V.esEscombro(w.solido(104.5, 40, .25)), 'el escombro tapa el túnel');
    eq(w.derrumbar(2), [], 'el escombro no se recalcula');
    // Con acero (6 m de voladizo) el mismo túnel aguanta.
    const a = muralla(); a.construir({ ...BASE, material: 'acero' }); vaciar(a, 103, 106, 38, 42, 0, 2);
    eq(a.derrumbar(0), [], 'el acero aguanta el túnel');
    // Reparar sustituye el escombro que quedó dentro de la pared.
    w.reparar(); w.avanzar(1e9);
    eq(w.solido(104.5, 40, .25), V.MAT.piedra, 'reparar reconstruye sobre el escombro');
  }
  {
    // Voladizo de un solo lado: se socava el extremo norte. La pieza gira sobre una bisagra y se queda colgando.
    const w = muralla(); w.construir(BASE);
    vaciar(w, 103, 106, 26, 30.5, 0, 2);
    w.derrumbar(5, [104.5, 25, 1]);
    eq(w.piezas.length, 1, 'una pieza en voladizo');
    const p = w.piezas[0];
    eq(p.estado, 'cuelga', 'la unión es ancha: cuelga');
    ok(p.a1 > 5 * Math.PI / 180 && p.a1 <= 30 * Math.PI / 180, `cuelga a ${(p.a1 * 180 / Math.PI).toFixed(1)}°`);
    // La matriz de Three hace bajar el centro de la pieza y coincide con la rotación de Rodrigues en el mapa.
    const M = w.matrizPieza(p, 5 + p.dur), c = w.centro(p.vox[0], p.vox[1], p.vox[2]);
    const Q = [c[0], c[2], c[1]], R = [0, 1, 2].map(f => M[f] * Q[0] + M[4 + f] * Q[1] + M[8 + f] * Q[2] + M[12 + f]);
    const [ax, ay] = p.eje, an = p.a1, piv = p.pivote, v = [c[0] - piv[0], c[1] - piv[1], c[2] - piv[2]];
    const cr = [ay * v[2], -ax * v[2], ax * v[1] - ay * v[0]], dt = ax * v[0] + ay * v[1];
    const esp = [0, 1, 2].map(n => piv[n] + v[n] * Math.cos(an) + cr[n] * Math.sin(an) + [ax, ay, 0][n] * dt * (1 - Math.cos(an)));
    ok(Math.hypot(R[0] - esp[0], R[1] - esp[2], R[2] - esp[1]) < 1e-9, 'matriz de la pieza = rotación en el mapa con ejes de Three');
    let zAntes = 0, zDespues = 0;
    for (let n = 0; n < p.vox.length; n += 4) { const q = w.centro(p.vox[n], p.vox[n + 1], p.vox[n + 2]); zAntes += q[2]; zDespues += M[1] * q[0] + M[5] * q[2] + M[9] * q[1] + M[13]; }
    ok(zDespues < zAntes, 'al colgar, la pieza baja');
    ok(w.pose(p, 5 + p.dur + .3).angulo !== p.a1 && Math.abs(w.pose(p, 5 + p.dur + 20).angulo - p.a1) < 1e-6, 'se mece y se calma');
    eq(w.paso(100), [], 'colgada no se asienta sola');
    // Guardado con la pieza colgada.
    const h = V.cargar(JSON.parse(JSON.stringify(w.serializar())));
    eq(h.piezas.length, 1, 'la pieza colgada se guarda'); eq(h.pose(h.piezas[0], 7), w.pose(p, 7), 'misma pose tras cargar');
    // Un golpe cerca la suelta: sigue girando hasta tocar el suelo y se asienta como escombro más abajo.
    const r = w.romper(104.5, 29, 3, 1, .3, { t: 10, escombros: 0 });
    eq(r.sueltas, [p.id], 'el golpe suelta la pieza');
    ok(p.a1 > 45 * Math.PI / 180, `cae hasta ${(p.a1 * 180 / Math.PI).toFixed(0)}°`);
    w.paso(10 + p.dur);
    eq(w.piezas.length, 0, 'asentada');
    let bajo = 0; w.rejilla.recorrer((i, j, k, mm) => { if (V.esEscombro(mm) && k <= 2) bajo++; });
    ok(bajo > 10, `${bajo} vóxeles de escombro cerca del suelo: la pieza quedó tumbada`);
  }
  {
    // Golpes reales en la base del extremo norte: tras cada golpe ninguna pieza colgada se queda sin unión.
    const w = muralla(); w.construir(BASE);
    let t = 0, colgaron = 0, cayeron = 0;
    for (const y of [27, 28, 29.2, 30.2]) {
      const r = w.romper(104.5, y, .3, 1.4, 1.3, { t }); t += .5;
      colgaron += r.piezas.filter(id => w.piezas.find(q => q.id === id).estado === 'cuelga').length; cayeron += r.sueltas.length;
      const huerfanas = w.piezas.filter(q => q.estado === 'cuelga' && q.soportes.some(c => !w.rejilla.get(...V.deK(c))));
      eq(huerfanas.length, 0, `sin piezas colgadas de nada tras el golpe en y = ${y}`);
    }
    ok(colgaron >= 2 && cayeron >= 1, `socavar el extremo: ${colgaron} piezas colgaron y ${cayeron} cayeron después`);
    w.paso(t + 5);
    ok(w.piezas.every(q => q.estado === 'cuelga'), 'lo que cae termina asentado');
  }
  {
    // Onda: parte de lo roto cae lejos del centro, en el suelo o encima de algo.
    const w = muralla(); w.construir(BASE);
    const r = w.romper(105, 50, 1, 1.3, 1, { t: 0 });
    ok(r.escombros > 0 && r.escombros < r.quitados, `${r.escombros} de ${r.quitados} vóxeles salen despedidos`);
    let lejos = 0, flotando = 0;
    w.rejilla.recorrer((i, j, k, mm) => {
      if (!V.esEscombro(mm)) return;
      const c = w.centro(i, j, k); if (Math.hypot(c[0] - 105, c[1] - 50) > 1.3) lejos++;
      if (k > 0 && !w.rejilla.get(i, j, k - 1)) flotando++;
    });
    ok(lejos >= r.escombros * .6, 'los restos caen fuera del radio'); eq(flotando, 0, 'ningún resto flota');
    // Medida del cálculo de apoyos, que corre una vez por golpe.
    for (const tam of [.5, .25]) {
      const x = muralla(tam); x.construir(BASE); x.construir({ ...x.capa('principal', 'fuera', 1), material: 'hormigon' });
      const t0 = process.hrtime.bigint(); x.apoyo(); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`  apoyos de la muralla con dos capas a ${tam} m: ${x.estadisticas().voxeles} vóxeles en ${ms.toFixed(1)} ms`);
      ok(ms < 400, 'apoyos en tiempo razonable');
    }
  }

  // ---------- Ampliar ----------
  {
    const a = muralla(); a.construir({ ...BASE, almenas: null }); a.construir({ ...a.capa('principal', 'fuera', 1), material: 'hormigon' });
    const L0 = a.largo('principal');
    const obras = a.ampliar('principal', [40, 92.8]);
    eq(obras.length, 2, 'ampliar extiende cada capa');
    a.avanzar(1e9);
    ok(a.largo('principal') > L0 + 10.9, 'eje más largo');
    ok(a.solido(45, 92.8, 1) === V.MAT.piedra && a.solido(45, 93.8, 1) === V.MAT.hormigon, 'el tramo nuevo lleva base y capa');
    ok(a.solido(51, 92.8, 1), 'sin hueco en la unión');
  }

  // ---------- Guardado ----------
  {
    const g = muralla(); g.construir(BASE); g.romper(104.5, 50, 1, 1.2, 1);
    g.planear({ ...g.capa('principal', 'fuera', 1), material: 'acero' }); g.avanzar(321);
    const datos = JSON.parse(JSON.stringify(g.serializar()));
    const h = V.cargar(datos);
    eq(h.estadisticas().voxeles, g.estadisticas().voxeles, 'mismos vóxeles');
    eq(h.estadisticas().planeados, g.estadisticas().planeados, 'mismo plano');
    const sig = (x) => { const out = []; x.rejilla.recorrer((i, j, k, mm) => out.push(`${i},${j},${k},${mm}`)); return out.sort().join(';'); };
    eq(sig(h), sig(g), 'misma rejilla');
    g.avanzar(1e9); h.avanzar(1e9);
    eq(sig(h), sig(g), 'la obra sigue igual tras cargar');
    const kb = JSON.stringify(datos).length / 1024;
    ok(kb < 80, `guardado compacto (${kb.toFixed(1)} KB)`);
  }

  // ---------- Malla ----------
  {
    const r = V.crearRejilla();
    r.set(0, 0, 0, 1);
    eq(V.mallar(r, V.claveDe(0, 0, 0)).caras, 6, 'un vóxel: 6 caras');
    r.set(1, 0, 0, 1);
    eq(V.mallar(r, V.claveDe(0, 0, 0)).caras, 10, 'dos juntos: 10 caras');
    const s = V.crearRejilla(); s.set(15, 0, 0, 1); s.set(16, 0, 0, 1);
    eq(V.mallar(s, V.claveDe(0, 0, 0)).caras + V.mallar(s, V.claveDe(1, 0, 0)).caras, 10, 'la cara entre trozos se oculta');
    // Winding: la normal de cada triángulo coincide con la de sus vértices (visible desde fuera).
    const u = V.crearRejilla(); u.set(0, 0, 0, 1);
    const mm = V.mallar(u, V.claveDe(0, 0, 0), { tam: 1 }), P = mm.posiciones, N = mm.normales, I = mm.indices;
    let bien = 0;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(n => [P[n * 3], P[n * 3 + 1], P[n * 3 + 2]]);
      const e1 = b.map((v, q) => v - a[q]), e2 = c.map((v, q) => v - a[q]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * N[I[t] * 3] + cr[1] * N[I[t] * 3 + 1] + cr[2] * N[I[t] * 3 + 2] > 0) bien++;
    }
    eq(bien, 12, 'los 12 triángulos miran hacia fuera');
    // Ejes de Three: Y es la altura.
    const alto = V.crearRejilla(); alto.set(0, 0, 3, 1);
    const ma = V.mallar(alto, V.claveDe(0, 0, 0), { tam: .5 });
    ok(Math.max(...ma.posiciones.filter((_, n) => n % 3 === 1)) === 2, 'la altura va en Y (k = 3 → techo a 2 m)');
    // Oclusión: en una esquina interior el vértice se oscurece.
    const e = V.crearRejilla(); e.set(0, 0, 0, 1); e.set(1, 0, 0, 1); e.set(0, 0, 1, 1);
    const me = V.mallar(e, V.claveDe(0, 0, 0));
    ok(Math.min(...me.colores) < Math.max(...me.colores) * .8, 'oclusión ambiental en las esquinas');
    // La muralla entera: caras y tiempo.
    const w = muralla(); w.construir(BASE);
    let caras = 0; const t0 = process.hrtime.bigint();
    for (const c of w.rejilla.claves()) caras += V.mallar(w.rejilla, c, { tam: w.tam, origen: w.origen }).caras;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    ok(caras > 1000 && caras < w.estadisticas().voxeles * 6, `muralla del boceto: ${w.estadisticas().voxeles} vóxeles, ${caras} caras, ${ms.toFixed(0)} ms`);
    console.log(`  muralla del boceto a 0,5 m: ${w.estadisticas().voxeles} vóxeles, ${w.rejilla.numTrozos} trozos, ${caras} caras, malla en ${ms.toFixed(0)} ms`);
  }

  // ---------- Determinismo ----------
  {
    const firma = () => {
      const x = muralla(); x.construir(BASE); x.planear({ ...x.capa('principal', 'fuera', 1), material: 'hormigon' }); x.avanzar(500); x.romper(104.5, 45, 2.5, 1.5, 1, { t: 0 }); x.romper(104.5, 27.5, .5, 1.6, 1.2, { t: .5 }); x.paso(.8);
      return JSON.stringify(x.serializar());
    };
    eq(firma(), firma(), 'misma secuencia, mismo resultado');
  }
} finally { Math.random = rnd; Date.now = now; }

console.log(`muralla-voxeles: ${checks} comprobaciones correctas`);
