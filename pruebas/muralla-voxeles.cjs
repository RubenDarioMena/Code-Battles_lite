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
    eq(w.tension().size, 0, 'la muralla intacta está al nivel cero');
    vaciar(w, 103, 106, 38, 41, 0, 2);
    w.derrumbar();
    let recorridos = 0;
    const recorrer = w.rejilla.recorrer;
    w.rejilla.recorrer = fn => { recorridos++; recorrer(fn); };
    const mapa = w.tension();
    eq(recorridos, 1, 'tras derrumbar solo se clasifican las celdas, sin repetir la búsqueda de apoyos');
    const nivel = (y) => mapa.get(V.K(...w.indice(104.5, y, 2.25))) || 0;
    eq([37.75, 38.25, 38.75, 39.25, 39.75, 40.25, 40.75, 41.25].map(nivel),
      [0, 1, 3, 4, 4, 3, 1, 0], 'costes de los dos lados del dintel');
    w.planear({ ...w.hilada('principal', 1), material: 'acero' });
    ok(w.tension() === mapa && recorridos === 1, 'el plano y la lectura repetida conservan la caché');
    w.rejilla.set(...w.indice(104.5, 39.25, 2.25), V.MAT['piedra-escombro']);
    ok(!w.tension().has(V.K(...w.indice(104.5, 39.25, 2.25))), 'el escombro sustituye al vóxel teñido');
    // Un tramo en el borde de trozo; el daño geométrico se consume aparte del cambio de color.
    const s = V.crear();
    for (let i = 12; i <= 22; i++) for (let k = 0; k <= 1; k++) s.rejilla.set(i, 0, k, 1);
    s.rejilla.set(50, 0, 0, 1); s.tension();
    for (let i = 16; i <= 19; i++) s.rejilla.set(i, 0, 0, 0);
    s.rejilla.tomarSucios(); s.tension();
    eq(s.rejilla.tomarSucios(), [V.claveDe(1, 0, 0)], 'el color del borde solo ensucia su propio trozo');
    s.romper(...s.centro(50, 0, 0), .2, 1); s.rejilla.tomarSucios(); s.tension();
    eq(s.rejilla.tomarSucios(), [], 'un golpe lejano conserva el color de todos los trozos');
    for (let i = 16; i <= 19; i++) s.rejilla.set(i, 0, 0, 1);
    s.rejilla.tomarSucios(); eq(s.tension().size, 0, 'la reparación enfría el dintel');
    eq(s.rejilla.tomarSucios(), [V.claveDe(1, 0, 0)], 'también se ensucia al volver a cero');
  }
  {
    const w = V.crear();
    w.rejilla.set(0, 0, 0, V.MAT.hormigon);
    for (let i = 0; i <= 7; i++) w.rejilla.set(i, 0, 1, V.MAT.hormigon);
    const niveles = w.tension();
    eq(Array.from({ length: 8 }, (_, i) => niveles.get(V.K(i, 0, 1)) || 0),
      [0, 0, 0, 1, 2, 3, 4, 4], 'umbrales exactos del hormigón y extremo sin apoyo');
    const grueso = V.crear({ tam: 2 });
    grueso.rejilla.set(0, 0, 0, 1); grueso.rejilla.set(1, 0, 1, 1);
    eq([...grueso.tension()], [[V.K(1, 0, 1), 4]], 'voladizo de cero pasos con y sin camino al suelo');
  }
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
    ok(p.soportes.length && p.soportes.every(c => w.tension().get(c) >= 3), 'la bisagra marca sus apoyos');
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
    // Apuntalar por debajo deja el voladizo a cero: el nivel tres procede de la bisagra.
    const bisagra = h.piezas[0];
    for (const c of bisagra.soportes) {
      const [i, j, k] = V.deK(c);
      for (let z = 0; z < k; z++) h.rejilla.set(i, j, z, 1);
    }
    ok(bisagra.soportes.every(c => h.tension().get(c) === 3), 'un puntal bajo la unión conserva la señal de bisagra');
    const suave = h.romper(...bisagra.centro, .25, 0);
    eq([suave.quitados, suave.sueltas], [0, [bisagra.id]], 'se suelta sin cambiar celdas');
    ok(bisagra.soportes.every(c => !h.tension().has(c)), 'soltar la pieza invalida el tinte sin tocar la rejilla');
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
      const cantos = x.romper(104.5, 40, .45, 2.4, 2, { escombros: 0 });
      const datos = x.serializar();
      const medir = (conApoyo) => {
        const tiempos = [];
        for (let n = 0; n < 9; n++) {
          const copia = V.cargar(datos);
          if (conApoyo) copia.derrumbar();
          const ini = process.hrtime.bigint();
          copia.tension();
          tiempos.push(Number(process.hrtime.bigint() - ini) / 1e6);
        }
        return tiempos.sort((a, b) => a - b)[4];
      };
      console.log(`  tensión a ${tam} m, ${x.rejilla.total} vóxeles tras quitar ${cantos.quitados}: ${medir(true).toFixed(2)} ms con apoyos reutilizados, ${medir(false).toFixed(2)} ms con búsqueda (medianas)`);
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
    // Dos trozos vecinos, los seis materiales, caras ocultas, oclusión y tinte.
    const r = V.crearRejilla(), origen = [-4, 7, 2], tam = .5;
    for (const celda of [[14,0,0,1], [15,0,0,2], [16,0,0,3], [14,1,0,4], [15,0,1,5], [16,1,0,6]]) r.set(...celda);
    const huella = require('node:crypto').createHash('sha256');
    for (const clave of r.claves()) {
      const malla = V.mallar(r, clave, { tam, origen, tension: () => 3, rotura: false });
      eq(malla.materiales.length, malla.posiciones.length / 3, 'un id por posición');
      const esperados = [];
      for (let p = 0; p < malla.posiciones.length; p += 12) {
        // Las esquinas opuestas dan el centro de la cara. Retroceder por su normal da el vóxel dueño.
        const [x, y, z] = [0, 1, 2].map(a => (malla.posiciones[p + a] + malla.posiciones[p + 6 + a] - tam * malla.normales[p + a]) / 2);
        const id = r.get(Math.floor((x - origen[0]) / tam), Math.floor((z - origen[1]) / tam), Math.floor((y - origen[2]) / tam));
        esperados.push(id, id, id, id);
      }
      eq([...malla.materiales], esperados, 'las cuatro esquinas de cada cara llevan el id del vóxel');
      for (const campo of ['posiciones', 'normales', 'indices', 'colores']) huella.update(Buffer.from(malla[campo].buffer));
    }
    // SHA-256 medido sobre estos cuatro buffers antes de añadir el atributo.
    eq(huella.digest('hex'), '63ae235c7eaa29acd2f6a72ce3042c6aa3944be678105187be39377dfbf637c7', 'buffers anteriores idénticos byte por byte');
    eq(V.mallar(r, V.claveDe(-1, 0, 0)).materiales, new Uint8Array(0), 'atributo vacío para el trozo ausente');
  }
  {
    const r = V.crearRejilla();
    for (const [i, mat] of [1, 2, 3, 1, 4].entries()) r.set(i * 2, 0, 0, mat);
    const cl = V.claveDe(0, 0, 0);
    for (const piel of ['paisaje', 'batalla']) {
      const paleta = V.paletaBase();
      // Colores de piedra de conPiel en campaign-3d.js.
      if (piel === 'batalla') paleta[1].color = V.colorDe(0x5c6b75);
      const base = V.mallar(r, cl, { paleta });
      for (const nivel of [1, 2, 3, 4]) {
        const roja = V.mallar(r, cl, { paleta, tension: i => i === 6 ? 0 : nivel });
        for (const campo of ['posiciones', 'normales', 'indices']) eq(roja[campo], base[campo], `${campo} con tensión`);
        // Cinco cubos separados, seis caras con cuatro vértices por cubo.
        let bien = true;
        const luz = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;
        for (let v = 0; v < 5 * 24; v++) {
          const a = base.colores.subarray(v * 3, v * 3 + 3), b = roja.colores.subarray(v * 3, v * 3 + 3);
          if (v < 3 * 24) bien &&= b[0] / (b[1] + b[2]) > a[0] / (a[1] + a[2]) && luz(b) < luz(a);
          else bien &&= a.every((n, q) => n === b[q]);
        }
        ok(bien, `${piel} nivel ${nivel}: los tres materiales ganan rojo y pierden luz, solo donde corresponde`);
      }
    }
  }
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
  }

  // ---------- Acabado de rotura ----------
  const campos = ['posiciones', 'normales', 'indices', 'colores', 'materiales'];
  {
    const w = muralla(); w.construir(BASE);
    const t0 = performance.now();
    ok(w.enPared(...w.indice(104.5, 40, 1)), 'el volumen incluye el interior del muro');
    const msCache = performance.now() - t0;
    const huella = require('node:crypto').createHash('sha256');
    let caras = 0;
    for (const c of w.rejilla.claves()) {
      const g = V.mallar(w.rejilla, c);
      for (const campo of campos) huella.update(Buffer.from(g[campo].buffer));
      assert.ok(!g.deformada && !g.rotura.some(Boolean));
      caras += g.caras;
    }
    eq(caras, 4998, 'caras del boceto intacto, incluidas las almenas y los extremos');
    eq(huella.digest('hex'), 'bc3bd633e72406ab41438f7d48c24728d701657d9c0a8d18cf2e230a40fe5789',
      'cinco buffers del muro intacto idénticos byte por byte a los medidos antes de la tarea 04');
    w.romper(104.5, 40, .9, 1.65, 1.5, { derrumbe: false, escombros: .35 });
    const muestras = [[], []];
    for (let n = 0; n < 12; n++) for (const rotura of [Boolean(n % 2), !Boolean(n % 2)]) {
      const inicio = performance.now();
      for (const c of w.rejilla.claves()) V.mallar(w.rejilla, c, { rotura });
      if (n >= 3) muestras[Number(rotura)].push(performance.now() - inicio);
    }
    const [sin, con] = muestras.map(ts => ts.sort((a, b) => a - b)[4]);
    console.log(`  boceto a 0,5 m, túnel y cascajo: malla sin bordes ${sin.toFixed(2)} ms, con bordes ${con.toFixed(2)} ms (medianas de 9); primera consulta del volumen ${msCache.toFixed(2)} ms`);
    ok(con < 10 * sin, 'el coste de mallar el muro completo se mantiene en el mismo orden');
  }
  {
    const w = V.crear({ tam: 1 });
    w.eje('recta', [[12, 0], [21, 0]]);
    w.construir({ eje: 'recta', s0: -2, s1: 2, z1: 4 });
    const quitadas = new Set();
    for (const i of [15, 16]) for (let j = -2; j < 2; j++) for (const k of [1, 2]) {
      w.rejilla.set(i, j, k, 0);
      quitadas.add(V.K(i, j, k));
    }
    const datos = JSON.stringify(w.serializar()), copia = V.cargar(JSON.parse(datos));
    const red = new Map();
    let partidas = 0, originales = 0, normalesNuevas = 0, entreTrozos = 0;
    for (const c of w.rejilla.claves()) {
      const plana = V.mallar(w.rejilla, c, { tam: 1, rotura: false });
      const g = V.mallar(w.rejilla, c, { tam: 1 });
      const recargada = V.mallar(copia.rejilla, c, { tam: 1 });
      for (const campo of [...campos, 'rotura']) assert.deepEqual(g[campo], recargada[campo]);
      for (let v = 0; v < g.rotura.length; v += 4) {
        const p = v * 3, n = plana.normales.subarray(p, p + 3);
        const [x, z, y] = [0, 1, 2].map(e => Math.floor((plana.posiciones[p + e] + plana.posiciones[p + 6 + e] + n[e]) / 2));
        const partida = quitadas.has(V.K(x, y, z));
        if (partida) partidas++; else originales++;
        assert.deepEqual([...g.rotura.slice(v, v + 4)], Array(4).fill(Number(partida)));
        for (let e = p; e < p + 12; e += 3) {
          const punto = [...plana.posiciones.slice(e, e + 3)], clave = punto.join(',');
          const pos = [...g.posiciones.slice(e, e + 3)], anterior = red.get(clave);
          const mueve = pos.some((x, a) => x !== punto[a]);
          if (anterior) {
            assert.deepEqual(anterior.pos, pos);
            if (mueve && anterior.c !== c && punto[0] === 16) entreTrozos++;
          } else red.set(clave, { c, pos });
          const [i, k, j] = punto;
          let tocaHueco = false;
          for (const a of [i-1,i]) for (const b of [j-1,j]) for (const d of [k-1,k])
            if (quitadas.has(V.K(a,b,d))) tocaHueco = true;
          assert.equal(mueve, tocaHueco);
          assert.ok(pos.every((x, a) => Math.abs(x - punto[a]) < .18001));
        }
        const normal = g.normales.subarray(p, p + 3);
        assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-6);
        if (normal.some((x, a) => x !== n[a])) normalesNuevas++;
      }
    }
    eq(partidas, 32, 'solo las cuatro paredes interiores del túnel llevan piedra partida');
    ok(originales > partidas && normalesNuevas >= partidas, 'exterior original y caras desplazadas con normales unitarias recalculadas');
    ok(entreTrozos > 0, 'los duplicados de un vértice movido coinciden incluso en el plano x = 16 entre trozos');
    eq(JSON.stringify(w.serializar()), datos, 'mallar en ambos modos y cargar conserva el guardado');
    ok(!w.enPared(21, 0, 0), 'extremo exterior antes de ampliar');
    w.ampliar('recta', [23, 0]);
    ok(w.enPared(21, 0, 0), 'el volumen incluye el tramo ampliado antes de construirlo');
    w.planear({ ...w.hilada('recta', 1) });
    ok(w.enPared(21, 0, 4), 'el volumen se actualiza al planear la hilada');
    w.blindar({ eje: 'recta' });
    ok(!w.enPared(18, -3, 1), 'el blindaje no añade vóxeles al volumen');
  }
  {
    const r = V.crearRejilla();
    r.set(15, 0, 0, V.MAT.piedra); r.set(16, 0, 0, V.aEscombro(V.MAT.piedra));
    for (const c of r.claves()) {
      const lisa = V.mallar(r, c, { tam: 1, rotura: false });
      const g = V.mallar(r, c, { tam: 1 });
      let movidos = 0;
      for (let p = 0; p < g.posiciones.length; p += 3) {
        const cambio = [0, 1, 2].some(n => g.posiciones[p + n] !== lisa.posiciones[p + n]);
        assert.equal(cambio, lisa.posiciones[p] > 16);
        if (cambio) movidos++;
      }
      eq(movidos > 0, c === V.claveDe(1,0,0), 'el cascajo solo mueve sus esquinas libres y la pared conserva las suyas');
    }
    const esquina = V.crearRejilla();
    for (const i of [15,16]) for (const j of [15,16]) for (const k of [15,16]) esquina.set(i,j,k,1);
    esquina.set(30,30,30,1); esquina.set(32,32,32,1); esquina.tomarSucios();
    esquina.set(16,16,16,0);
    eq(esquina.tomarSucios().sort(), esquina.claves().filter(c => c !== V.claveDe(2,2,2)).sort(), 'el cambio de esquina ensucia exactamente los ocho trozos que comparten sus vértices');
  }

  // ---------- Blindaje ----------
  {
    const w = muralla(); w.construir(BASE);
    const o = w.blindar({ eje: 'principal' });
    eq(o.total, 318, '106 módulos completos por tres hiladas en el boceto');
    w.avanzar(V.BLINDAJE.unidades - 1);
    eq(w.paneles.length, 0, 'una fracción de panel permanece en plano');
    const h = V.cargar(w.serializar());
    eq(h.avanzar(1).paneles, 1, 'se conserva el avance parcial');
    eq(w.avanzar(1).paneles, 1, 'cuatro unidades colocan un panel');
    eq(w.blindar({ eje: 'principal' }).total, 0, 'no duplica los fijos ni los pendientes');
    eq(w.avanzar(Infinity).omitidos, 0, 'cada panel previsto tiene apoyo');
    ok(w.paneles.every(p => p.anclajes.length && p.anclajes.every(c => {
      const q = w.centro(...V.deK(c)), v = q.map((n, k) => n - p.origen[k]);
      const u = v[0] * p.tangente[0] + v[1] * p.tangente[1];
      const d = -(v[0] * p.normal[0] + v[1] * p.normal[1]);
      return u >= 0 && u < p.ancho && d >= 0 && d < 1.5 * w.tam && v[2] >= 0 && v[2] < p.alto;
    })), 'todos los anclajes están detrás, en la huella y al alcance');
    ok(Math.abs(w.paneles[0].origen[0] - 105.25 - V.BLINDAJE.holgura) < 1e-10, 'holgura exterior sobre la banda recta');
    w.completar(w.blindar({ eje: 'principal', lado: 'dentro', u1: 1 }).id);
    ok(Math.abs(w.paneles.at(-1).origen[0] - (103.5 - V.BLINDAJE.holgura)) < 1e-10, 'holgura sobre la cara interior rasterizada');
    const curva = w.paneles.find(p => p.u0 === 35 && p.z0 === 0);
    ok(curva.tangente[0] < 0 && curva.tangente[1] > 0, 'en la esquina sigue la cuerda');
    const antes = JSON.stringify(w.paneles);
    w.ampliar('principal', [45, 92.8]); w.avanzar(Infinity);
    eq(JSON.stringify(w.paneles), antes, 'ampliar conserva las chapas construidas');
    ok(w.blindar({ eje: 'principal' }).total > 0, 'se puede blindar el tramo ampliado');
    const sin = muralla(); sin.construir(BASE);
    sin.blindar({ eje: 'principal', u1: 1, z1: 1 });
    sin.rejilla.recorrer((i,j,k) => sin.rejilla.set(i,j,k,V.MAT['piedra-escombro']));
    eq(sin.avanzar(Infinity).omitidos, 1, 'obra omitida cuando solo queda escombro');
    eq(sin.paneles.length, 0, 'el panel sin anclajes sale del plano sin instalarse');
  }

  function recta(conBlindaje) {
    const w = V.crear();
    w.eje('recta', [[0, 0], [12, 0]]);
    w.construir({ eje: 'recta', s0: -.5, s1: .5, z1: 3 });
    if (conBlindaje) w.completar(w.blindar({ eje: 'recta', u0: 1, u1: 10, z0: 1, z1: 2 }).id);
    return w;
  }
  const seco = { escombros: 0, derrumbe: false };
  {
    const impacto = (blindaje, x, y) => recta(blindaje).romper(x, y, 1.5, 1, 1, seco).lista;
    ok(impacto(true, 4.5, -.65).length < impacto(false, 4.5, -.65).length, 'absorbe por delante');
    eq(impacto(true, 4.5, .1), impacto(false, 4.5, .1), 'desde dentro caen los mismos vóxeles');
    eq(impacto(true, 10.75, -.65), impacto(false, 10.75, -.65), 'el golpe por el hueco llega sin atenuar');
    const w = recta(true), p = w.paneles[0], q = V.puntoPanel(p, .5, .5, p.grosor);
    const golpear = poder => w.romper(...q, .1, poder, seco);
    golpear(.29); eq(p.dano, 0, 'un golpe débil no acumula daño');
    golpear(.45); eq(p.estado, 'fijo', 'con menos de medio aguante sigue liso');
    golpear(.45); eq(p.estado, 'abollado', 'abollado al superar medio aguante');
    ok(p.abolladura.profundidad > 0 && Math.abs(p.abolladura.u - .5) < 1e-9 && p.abolladura.h === .5, 'centro local y profundidad de abolladura');
    golpear(.8); eq(p.estado, 'cae', 'al agotar el aguante cae entero');
    w.paso(5); eq(p.estado, 'suelo', 'queda la chapa en el suelo');
  }
  {
    const puntoTransformado = (P, M) => [0, 2, 1].map(f => M[f] * P[0] + M[f+4] * P[2] + M[f+8] * P[1] + M[f+12]);
    for (const borde of ['izquierdo', 'derecho', 'superior']) {
      const w = recta(false);
      w.completar(w.blindar({ eje: 'recta', u1: 2, z0: 1, z1: 3, panel: [2, 2] }).id);
      const p = w.paneles[0];
      const mitad = p.anclajes.filter(c => {
        const [x,,z] = w.centro(...V.deK(c));
        return borde === 'superior' ? z >= 2 : borde === 'derecho' ? x >= 1 : x < 1;
      });
      for (const c of p.anclajes) if (!mitad.includes(c)) w.rejilla.set(...V.deK(c), 0);
      w.derrumbar(1); eq(p.estado, 'fijo', 'exactamente la mitad lo mantiene fijo');
      w.rejilla.set(...V.deK(mitad[0]), 0); w.derrumbar(2);
      eq([p.estado,p.bisagra], ['cuelga',borde], 'bisagra en el borde de los anclajes que quedan');
      ok(p.a1 > 0 && w.pose(p, 2+p.dur+.2).angulo !== p.a1, 'se mece sobre su bisagra');
      const t = 2+p.dur+.2, antes = w.matrizPieza(p,t);
      if (borde === 'izquierdo') {
        const contacto = puntoTransformado(V.puntoPanel(p, p.ancho, p.alto / 2, p.grosor), antes);
        w.romper(...contacto, .06, .1, { ...seco, t });
      } else {
        for (const c of p.anclajes) w.rejilla.set(...V.deK(c), V.MAT['piedra-escombro']);
        w.derrumbar(t);
      }
      eq(p.estado, 'cae', 'un golpe en la pose actual o perder el último apoyo lo suelta');
      ok(w.matrizPieza(p,t).every((x,i) => Math.abs(x-antes[i]) < 1e-9), 'al soltar la bisagra conserva su pose');
      const esquinas = [0,p.ancho].flatMap(u => [0,p.alto].flatMap(h => [0,p.grosor].map(d => V.puntoPanel(p,u,h,d))));
      let minima = Infinity;
      for (let i=0; i<=32; i++) for (const q of esquinas)
        minima = Math.min(minima, puntoTransformado(q, w.matrizPieza(p,t+p.dur*i/32))[2]);
      ok(minima >= -1e-9, 'ninguna esquina atraviesa el suelo al caer');
      const rejilla = w.rejilla.total;
      w.paso(t+p.dur+.01);
      eq(w.rejilla.total, rejilla, 'la chapa caída no crea escombro');
      ok(esquinas.every((q,i) => Math.abs(puntoTransformado(q,p.poseFinal)[2] - (i%2 ? p.grosor : 0)) < 1e-9), 'cara posterior tumbada en el suelo');
      eq(w.matrizPieza(p,100),p.poseFinal,'mantiene la pose final');
    }
  }
  {
    const secuencia = () => {
      const w = recta(true);
      const golpear = (i, t, fuerza) => {
        const p = w.paneles[i];
        w.romper(...V.puntoPanel(p,.5,.5,p.grosor),.12,fuerza,{ ...seco,t });
      };
      golpear(0,0,2); w.paso(3); golpear(1,4,2); golpear(2,4,.9);
      for (const c of w.paneles[3].anclajes.slice(1)) w.rejilla.set(...V.deK(c),0);
      w.derrumbar(4);
      w.blindar({ eje:'recta', lado:'dentro', u1:3 }); w.avanzar(6);
      return w;
    };
    const w = secuencia(), datos = JSON.stringify(w.serializar()), h = V.cargar(JSON.parse(datos));
    eq(w.serializar().v, 3, 'formato de blindaje v3');
    ok(Object.values(w.estadisticas().paneles).every(n => n > 0), 'guardado con todos los estados simultáneos');
    eq(JSON.stringify(h.serializar()),datos,'ida y vuelta idéntica, incluida la obra a medias');
    eq(JSON.stringify(secuencia().serializar()),datos,'mismas órdenes, guardado idéntico');
    for (const x of [h,w]) { x.paso(10); x.avanzar(Infinity); }
    eq(JSON.stringify(h.serializar()),JSON.stringify(w.serializar()),'las obras y las caídas continúan igual tras cargar');
    for (const v of [1,2]) {
      const viejo = recta(false);
      viejo.planear({ ...viejo.hilada('recta',1),material:'acero' }); viejo.avanzar(3);
      const d = viejo.serializar(); d.v = v; delete d.paneles;
      if (v === 1) delete d.piezas;
      const copia = V.cargar(d); copia.avanzar(Infinity);
      eq(copia.solido(.25,.25,3.25),V.MAT.acero,'carga obra histórica de acero en v'+v);
      eq(copia.paneles.length,0,'sin paneles implícitos en v'+v);
    }
  }

  // ---------- Determinismo ----------
  {
    const firma = (mostrar) => {
      const x = muralla(); x.construir(BASE);
      x.planear({ ...x.capa('principal', 'fuera', 1), material: 'hormigon' }); x.avanzar(500);
      if (mostrar) x.tension();
      x.romper(104.5, 45, 2.5, 1.5, 1, { t: 0 });
      if (mostrar) x.tension();
      x.romper(104.5, 27.5, .5, 1.6, 1.2, { t: .5 }); x.paso(.8);
      return [JSON.stringify(x.serializar()), [...x.tension()]];
    };
    const sin = firma(false), con = firma(true);
    eq(con[0], sin[0], 'misma secuencia con y sin consultar tensión entre golpes, mismo guardado byte por byte');
    eq(con[1], sin[1], 'misma secuencia, mismo mapa de tensión');
  }
} finally { Math.random = rnd; Date.now = now; }

// Adaptador real de Three r128 en CPU. Compara los buffers que recibe el renderizador.
{
  const THREE = require('../herramientas/muralla/vendor/three-r128.min.js');
  const materialMuro = require('../shared/muralla/material-three.js');
  const acabado = materialMuro.crear(THREE);
  const shader = { ...THREE.ShaderLib.lambert };
  acabado.onBeforeCompile(shader);
  for (const patron of ['SILLAR = vec2(0.86, 0.38)', 'MORTERO = 0.018', 'PANEL = vec2(1.2, 0.6)', 'PLANCHA = vec2(1.0, 2.0)', 'GRANO_CASCAJO = 0.065']) {
    ok(shader.fragmentShader.includes(patron), 'constante del patrón en GLSL: ' + patron);
  }
  ok(shader.vertexShader.includes('attribute float material;') && shader.vertexShader.includes('vCaraMuro = vec4(uvMuro, material, normal.y);'), 'r128 recibe la proyección de objeto y el id');
  ok(shader.fragmentShader.includes('#include <color_fragment>\n#ifdef HIGH_PRECISION\n  diffuseColor.rgb *= acabadoMuro(vCaraMuro);'), 'el patrón multiplica el color de vértice solo a alta precisión');
  for (const fuente of [shader.vertexShader, shader.fragmentShader]) {
    const pila = [];
    for (const c of fuente.replace(/\/\/[^\n]*/g, '').match(/[{}()]/g)) {
      if (c === '{' || c === '(') pila.push(c);
      else assert.equal(pila.pop(), c === '}' ? '{' : '(');
    }
    eq(pila.length, 0, 'llaves y paréntesis del shader equilibrados');
  }
  ok(shader.vertexShader.includes('attribute float rotura;') && shader.fragmentShader.includes('return piedraPartida(uv, pixel, cara.z > 1.5)'),
    'las caras rotas de piedra y hormigón reciben su patrón propio');
  const sinTextura = materialMuro.crear(THREE, { textura: false });
  ok(sinTextura.onBeforeCompile === THREE.Material.prototype.onBeforeCompile && sinTextura.vertexColors, 'textura apagada usa Lambert con los colores de vértice');
  const window = { CMGMuralla: V };
  const fuente = require('node:fs').readFileSync(path.join(__dirname, '../shared/muralla/vista-three.js'), 'utf8');
  require('node:vm').runInNewContext(fuente, { window, performance });
  const w = muralla(); w.construir(BASE);
  const vista = window.CMGMurallaVista.crear(THREE, w, { tension: false });
  for (const y of [27, 28]) w.romper(104.5, y, .45, 1.4, 1.3, { escombros: 0 });
  w.planear({ ...w.hilada('principal', 1), material: 'acero' });
  const datos = JSON.stringify(w.serializar());
  let llamadas = 0;
  const tension = w.tension;
  w.tension = () => { llamadas++; return tension(); };
  const pieza = () => vista.grupo.children.find(m => m.userData.pieza);
  const color = m => m.geometry.attributes.color.array;
  vista.actualizar();
  const lisa = color(pieza()), cantidad = vista.grupo.children.length;
  const plano = vista.grupo.children.find(m => m.userData.plano);
  const mallas = vista.grupo.children.map(obj => [obj, obj.geometry]), matPlano = plano.material;
  for (const nuevo of [acabado, sinTextura, acabado]) {
    vista.ponerMaterial(nuevo);
    eq(vista.actualizar().trozos, 0, 'intercambiar material conserva el mallado');
    ok(mallas.length === vista.grupo.children.length && mallas.every(([obj, g], n) =>
      vista.grupo.children[n] === obj && obj.geometry === g && obj.material === (obj.userData.plano ? matPlano : nuevo)),
    'trozos y pieza intercambian material en la misma geometría y el plano conserva el suyo');
  }
  ok([...vista.mallas(), pieza()].every(obj => {
    const a = obj.geometry.attributes;
    return a.material.count === a.position.count && a.material.itemSize === 1 && !a.material.normalized
      && a.material.array.every(id => id === V.MAT.piedra);
  }), 'trozos y pieza entregan al shader todos los ids de piedra sin normalizar');
  eq(llamadas, 0, 'la vista apagada no solicita tensión');
  vista.verTension(true);
  eq(vista.actualizar().trozos, w.rejilla.numTrozos, 'activar la tensión rehace cada trozo sólido una vez');
  const roja = pieza();
  ok(color(roja).some((v, n) => v !== lisa[n]), 'la pieza colgada nace teñida');
  ok(roja.material === acabado && vista.grupo.children.length === cantidad, 'misma cantidad de mallas y mismo material al teñir');
  ok(vista.grupo.children.includes(plano), 'el plano conserva su malla sin teñir');
  vista.verTension(true);
  eq(vista.actualizar(1).trozos, 0, 'el balanceo y repetir la opción conservan las mallas');
  ok(pieza() === roja && llamadas === 1, 'la vista no pide tensión por fotograma');
  const paleta = V.paletaBase(); paleta.colorTension = 0xb43220;
  vista.ponerPaleta(paleta); vista.actualizar(1);
  ok(color(pieza()).some((v, n) => v !== color(roja)[n]), 'la pieza usa la alerta de la piel');
  vista.verTension(false); vista.actualizar(1);
  eq(color(pieza()), lisa, 'apagar devuelve el color de la pieza');
  eq(JSON.stringify(w.serializar()), datos, 'alternar la vista y la piel conserva el guardado');
  vista.verTension(true); vista.actualizar(1);
  w.romper(...w.piezas[0].centro, .25, 0, { t: 1 });
  vista.actualizar(1);
  eq(color(pieza()), lisa, 'la pieza recupera el color del material al soltarse');
  vista.liberar();
  {
    const tunel = V.crear({ tam: 1 });
    tunel.eje('recta', [[12,0],[21,0]]);
    tunel.construir({ eje:'recta', s0:-1, s1:1, z1:4 });
    for (const j of [-1,0]) tunel.rejilla.set(16,j,1,0);
    const v = window.CMGMurallaVista.crear(THREE, tunel);
    const captura = rotura => {
      v.verRotura(rotura); v.actualizar(); v.grupo.updateMatrixWorld(true);
      const impactos = [];
      for (const x of [15.99,16.01,16.99,17.01]) for (const y of [.99,1.01,1.99,2.01]) {
        const r = new THREE.Raycaster(new THREE.Vector3(x,y,-3), new THREE.Vector3(0,0,1));
        const hit = r.intersectObjects(v.mallas())[0];
        impactos.push(hit ? v.voxelDe(hit) : null);
      }
      const partidas = v.mallas().some(m => m.geometry.attributes.rotura.array.some(Boolean));
      eq(partidas, rotura, 'la casilla conmuta el atributo de rotura en la vista');
      return impactos;
    };
    const datos = JSON.stringify(tunel.serializar());
    const impactos = captura(true);
    eq(captura(false), impactos, 'rayos a ambos lados de la boca eligen la misma celda y el mismo punto en los dos modos');
    ok(impactos.some(Boolean) && impactos.some(v => v === null), 'los rayos atraviesan el túnel y dan en sus bordes');
    eq(JSON.stringify(tunel.serializar()), datos, 'cambiar la casilla deja idéntico el guardado');
    v.liberar();
  }
  // Rayos y geometría del mismo Three r128 que carga el laboratorio, sin contexto WebGL.
  const placas = V.crear();
  placas.eje('prueba', [[0,0],[4,0]]);
  placas.construir({ eje:'prueba', s0:-.5, s1:.5, z1:2 });
  const obra = placas.blindar({ eje:'prueba', u1:3, z0:1, z1:2 });
  const v = window.CMGMurallaVista.crear(THREE, placas, { material:acabado });
  const actualizar = t => { v.actualizar(t); v.grupo.updateMatrixWorld(true); };
  const fijas = () => v.mallas().find(obj => obj.userData.paneles && obj.matrixAutoUpdate);
  const movil = () => v.mallas().find(obj => obj.userData.paneles && !obj.matrixAutoUpdate);
  const rayos = (origen, direccion) => new THREE.Raycaster(new THREE.Vector3(...origen),new THREE.Vector3(...direccion))
    .intersectObjects(v.mallas(),false);
  actualizar(0);
  const pendiente = v.grupo.children.find(obj => obj.userData.plano && obj.userData.paneles);
  ok(pendiente && pendiente.material.transparent && !v.mallas().includes(pendiente), 'el plano de chapas queda fuera del raycast');
  placas.completar(obra.id); actualizar(0);
  ok(!v.grupo.children.includes(pendiente) && fijas().userData.paneles.length === 3, 'los tres paneles pasan del plano a una sola malla');
  const original = fijas(), [uno,dos,tres] = placas.paneles;
  ok(original.geometry.attributes.material.array.every(id => id === V.MAT.acero) && original.material === acabado, 'misma instancia de material y todos los vértices de acero');
  const frente = () => rayos([1.5,1.5,-3],[0,0,1])[0];
  let hit = frente();
  eq(v.voxelDe(hit).panel,dos.id,'selecciona el segundo rectángulo de la malla combinada');
  ok(hit.face.normal.z < -.99 && v.voxelDe(hit).y < dos.origen[1], 'impacto en el exterior de la plancha');
  const quieta = original.geometry;
  actualizar(.5); ok(fijas().geometry === quieta,'no rehace paneles por fotograma');
  placas.romper(hit.point.x,hit.point.z,hit.point.y,.2,1.59,{ t:1,escombros:0 });
  actualizar(1); hit = frente();
  ok(fijas().geometry.attributes.position.count > quieta.attributes.position.count && hit.point.z > dos.origen[1] - dos.grosor + .02,
    'la cara subdividida se hunde en el centro del golpe');
  {
    const a = fijas().geometry.attributes, ids = a.remachePerdido.array;
    const frente = [];
    for (let i = 0; i < ids.length; i++) if (ids[i]) frente.push(i);
    const xy = i => [a.uv.getX(i) - 2, a.uv.getY(i)];
    const esCentro = i => xy(i).every(x => Math.abs(x - .5) < 1e-6);
    const centro = frente.find(esCentro);
    const exterior = dos.origen[1] - dos.grosor;
    const profundidad = a.position.getZ(centro) - exterior;
    ok(profundidad > .118 && profundidad <= .12, 'la cara visible se hunde hasta unos 12 cm');
    const historica = hit.point.z - exterior;
    ok(Math.abs(historica - dos.abolladura.profundidad) < 1e-6, 'el raycast de la chapa conserva la superficie lógica anterior');
    const hombro = frente.find(i => xy(i)[0] === .625 && xy(i)[1] === .5);
    ok(Math.abs(a.normal.getX(hombro)) > .2 && a.normal.getZ(hombro) < -.85, 'la pendiente del golpe inclina la normal Lambert');
    ok(a.color.getX(centro) < .8 * a.color.getX(frente[0]), 'el centro está chamuscado');
    eq(new Set(frente.map(i => ids[i])).size, 1, 'un único remache desaparece de la cara dañada');
    eq([...new Set(frente.map(i => xy(i)[0]))].sort((a,b) => a-b), Array.from({length:9}, (_,i) => i/8),
      'ocho divisiones de la chapa y costura UV en ambos bordes de 1 m');
    const copia = window.CMGMurallaVista.crear(THREE, V.cargar(placas.serializar()));
    copia.actualizar();
    const b = copia.mallas().find(obj => obj.userData.paneles).geometry.attributes;
    for (const campo of ['position','normal','color','uv','remachePerdido']) assert.deepEqual(b[campo].array, a[campo].array);
    copia.liberar();
  }
  const tintes = fijas().geometry.attributes.color.array.slice();
  v.verTension(false); actualizar(1);
  ok(fijas().geometry.attributes.color.array.some((a,i) => a !== tintes[i]), 'el tinte de la chapa abollada responde a Ver tensión');
  for (const c of tres.anclajes.slice(1)) placas.rejilla.set(...V.deK(c),0);
  placas.derrumbar(2); actualizar(3);
  const colgada = movil();
  ok(colgada && fijas().userData.paneles.length === 2, 'solo el panel colgado recibe malla propia');
  const centro = new THREE.Vector3(2.5,1.5,tres.origen[1]-tres.grosor).applyMatrix4(colgada.matrix);
  hit = rayos([centro.x,centro.y,-3],[0,0,1])[0];
  eq(v.voxelDe(hit).panel,tres.id,'acierta en la chapa que se ha separado de la pared');
  const matAntes = colgada.matrix.clone();
  actualizar(3.1);
  ok(movil() === colgada && !colgada.matrix.equals(matAntes), 'el balanceo solo actualiza la matriz');
  placas.romper(...V.puntoPanel(uno,.5,.5,uno.grosor),.1,2,{ t:4,escombros:0 });
  placas.paso(8); actualizar(8);
  hit = rayos([.5,3,uno.origen[1]-.5],[0,-1,0])[0];
  eq(v.voxelDe(hit).panel,uno.id,'la chapa en el suelo se selecciona en su pose final');
  eq(hit.object,fijas(),'vuelve a la malla combinada al asentarse');
  v.liberar();
  eq(v.grupo.children.length,0,'libera mallas de los paneles y del muro');
  acabado.dispose(); sinTextura.dispose();
}

console.log(`muralla-voxeles: ${checks} comprobaciones correctas`);
