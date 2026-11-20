import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { ARMAS, CHARCO, FISICA, RENDIMIENTO, crearMundo, cargar } from '../index.js';
// Referencia independiente de la puntería del laboratorio. En estos bancos y
// es el eje de tiro. La solución continua con arrastre fija el ángulo esperado.
function apuntar(tipo, origen, blanco, potencia = 1, lateral = 0) {
  const granada = tipo === 'granada', modo = tipo === 'chorro-caotico' ? 'caotico' : 'directo';
  const k = granada ? 0 : ARMAS.chorro[modo].arrastre;
  const v = granada ? ARMAS.granada.velocidad : ARMAS.chorro.velocidad;
  const dy = blanco[1] - origen[1], dz = blanco[2] - origen[2];
  let angulo = 0;
  for (let i = 0; i < 8; i++) {
    const avance = dy / (v * Math.cos(angulo));
    const t = k ? -Math.log1p(-k * avance) / k : avance;
    const caida = FISICA.gravedad * (k ? (t - avance) / k : t*t/2);
    angulo = Math.atan2(dz + caida, dy);
  }
  return { arma: granada ? 'granada' : 'chorro', origen, direccion: [0, Math.cos(angulo), Math.sin(angulo)],
    potencia, modo, viento: [lateral, 0, 0] };
}

const { dt } = FISICA;
const nuevo = () => crearMundo({ semilla: 129 });
function placa(id, medidas, pos) {
  return { id, piezas: [{ id: 'placa', forma: { tipo: 'caja', medidas }, pos, rot: [0, 0, 0, 1],
    padre: null, union: { resistencia: .05 }, aguante: 20, funcion: null, color: '#889988',
    materiales: [{ material: 'acero', cantidad: 4 }, { material: 'cobre', cantidad: 2 }] }] };
}
const pieza = (m, id) => m.estado().piezas.find(p => p.robot === id);
const sucesos = (m, tipo) => m.sucesos().filter(e => e.tipo === tipo);
const vertical = (x, y, z) => ({ arma: 'granada', origen: [x, y, z], direccion: [0, 0, -1] });
const mask = p => p.mascara.flatMap((v, i, r) => i%2 ? [] : Array(r[i+1]).fill(v));
const media = a => a.reduce((s, n) => s+n, 0)/a.length;
const sigma = a => Math.sqrt(media(a.map(n => (n-media(a))**2)));
const cerca = (a, b) => assert(Math.abs(a-b) < 1e-8);

{
  const m = nuevo(), v = 9, origen = [2, -3, 1.3], direccion = [0, .8, .6];
  const informe = m.disparar({ arma: 'granada', origen, direccion, velocidad: v });
  assert.equal(informe.impacto, null); assert.deepEqual(informe.proyectil.pos, origen);
  assert.equal(m.sucesos().length, 0);
  m.avanzar(2);
  const t = (.6*v+Math.sqrt((.6*v)**2+2*FISICA.gravedad*origen[2]))/FISICA.gravedad;
  const [x,y,z] = sucesos(m, 'granada-estalla')[0].datos.pos;
  assert(Math.hypot(x-2,y+3-.8*v*t,z) < .01);
  const fuera = nuevo();
  fuera.disparar({ arma: 'granada', origen, direccion: [1,0,0], velocidad: 1000 });
  fuera.avanzar(2); assert.equal(fuera.estado().proyectiles.length, 0); assert.equal(fuera.sucesos().length, 0);
  const segmento = nuevo();
  segmento.agregarRobot(placa('Fina',[.04,.32,.40],[.52,0,.40]));
  segmento.disparar({ arma:'granada', origen:[0,0,.4], direccion:[1,0,0], velocidad:6 });
  segmento.avanzar(4*dt); assert.equal(sucesos(segmento,'granada-estalla').length,0);
  segmento.avanzar(2*dt); assert.equal(sucesos(segmento,'granada-estalla')[0].unidad,'Fina');
  const primero = nuevo();
  primero.agregarRobot(placa('Bajo suelo',[.24,.24,.12],[0,0,-.12]));
  primero.disparar({ ...vertical(0,0,.05), velocidad:20 }); primero.avanzar(dt);
  assert.equal(sucesos(primero,'granada-estalla')[0].unidad,null);
  console.log('✓ Parábola a menos de 1 cm y salida del radio sin efecto');
}

function salpicar() {
  const m = nuevo(), def = placa('Blanco', [.64,.36,.8], [0,0,.4]);
  m.agregarRobot(def);
  // Dos frentes casi contiguos. Los rayos tangenciales atraviesan la junta.
  m.agregarRobot(def, { pos: [.65,0,0] });
  m.disparar(apuntar('granada', [.3,-6.18,1], [.3,-.18,.47]));
  m.avanzar(.8);
  return m;
}
{
  const m = salpicar();
  assert.equal(m.serializar(), salpicar().serializar());
  const [estalla] = sucesos(m,'granada-estalla');
  assert.equal(estalla.unidad, 'Blanco');
  const [sal] = sucesos(m,'salpicadura');
  assert.equal(sal.datos.impactos.length, ARMAS.granada.satelites);
  const v = pieza(m,'Blanco').volumenes;
  assert(v.some(q=>q.fuente==='acido') && v.some(q=>q.fuente==='granada'));
  assert(sal.datos.impactos.some(h=>h.uid===1) && pieza(m,'Blanco#2').volumenes.some(q=>q.fuente==='granada'));
  console.log('✓ Granada reproducible con ácido principal, satélites locales y en el robot vecino');
}

function conCharco() {
  const m = nuevo();
  m.disparar(vertical(0,0,.1)); m.avanzar(dt);
  assert.equal(m.estado().charcos.length, 1);
  return m;
}
{
  const fusion = conCharco();
  const primero = fusion.estado().charcos[0];
  fusion.avanzar(1);
  fusion.disparar(vertical(.12,0,.1)); fusion.avanzar(dt);
  const unidos = fusion.estado().charcos;
  assert.equal(unidos.length, 1); assert.equal(unidos[0].id, primero.id);
  assert(unidos[0].final > primero.final && unidos[0].centro[0] > primero.centro[0]);

  const m = conCharco(), def = placa('Dentro',[.4,.4,.4],[0,0,.2]);
  m.agregarRobot(def); m.agregarRobot(def, { pos: [1,0,0] });
  const inicial = pieza(m,'Dentro');
  m.avanzar(CHARCO.crecimiento/2);
  const joven = m.estado().charcos[0];
  assert(joven.radio > 0 && joven.radio < joven.final && joven.activo);
  m.avanzar(CHARCO.duracion-CHARCO.crecimiento/2-dt);
  assert(m.estado().charcos[0].activo);
  const p = pieza(m,'Dentro'), mascara = mask(p);
  assert(p.celdas < inicial.celdas && p.estado === 'partida');
  assert.equal(pieza(m,'Dentro#2').celdas, inicial.celdas);
  mascara.forEach((v,i) => {
    const z = (Math.floor(i/(p.dim[0]*p.dim[1]))+.5)*p.celda;
    if (z > CHARCO.altura) assert(v, 'celda por encima del líquido');
  });
  m.avanzar(dt); assert(!m.estado().charcos[0].activo);
  m.agregarRobot(def); m.avanzar(CHARCO.mancha);
  assert.equal(pieza(m,'Dentro#3').celdas, inicial.celdas); assert.equal(m.estado().charcos.length, 0);

  const cae = conCharco();
  cae.avanzar(1); cae.agregarRobot(placa('Cae',[.24,.24,.36],[0,0,.7]));
  cae.disparar({ arma:'cinetico', origen:[0,0,1.2], direccion:[0,0,-1], potencia:.01 });
  const antes = pieza(cae,'Cae');
  assert.equal(antes.salida, 'vuelo');
  cae.avanzar(.1); assert.equal(pieza(cae,'Cae').celdas, antes.celdas);
  cae.avanzar(.55); assert(pieza(cae,'Cae').celdas < antes.celdas && pieza(cae,'Cae').volumenes.some(v=>v.fuente==='charco'));
  console.log('✓ Charco, fusión, crecimiento, límite de altura, caducidad y resto que cae dentro');
}

const blanco = [0,0,.52], origen = [0,-6,1];
const pared = placa('Pared',[2,.32,1.44],[0,.16,.72]);
function regar(arma, viento) {
  const m = nuevo(); m.agregarRobot(pared);
  const inf = m.disparar(apuntar(arma, origen, blanco, 1, viento));
  assert(inf.emisor && inf.impacto===null);
  m.avanzar(3.8);
  const gotas = sucesos(m,'gota').map(e=>e.datos);
  assert.equal(gotas.length, 72); assert.equal(sucesos(m,'chorro-fin').length, 1);
  assert.equal(m.estado().emisores.length + m.estado().proyectiles.length, 0);
  const p = pieza(m,'Pared'), analiticos = p.volumenes.filter(v=>v.fuente==='chorro');
  assert(analiticos.length > 0 && analiticos.length <= 6);
  assert(p.celdas < p.celdasIniciales);
  assert(analiticos.every(v=>v.radio <= ARMAS.chorro.radioMax+1e-9));
  if (arma === 'chorro') assert(analiticos.some(v=>v.radio > ARMAS.chorro.radio * 2));
  return { m, gotas, plenas: gotas.filter(g=>g.presion===1) };
}
const directo = regar('chorro',0), caotico = regar('chorro-caotico',0), aire = regar('chorro-caotico',3);
{
  const n = directo.plenas.filter(g=>g.pieza && Math.hypot(...g.pos.map((v,i)=>v-blanco[i]))<.10).length;
  assert(directo.plenas.length===48 && n/directo.plenas.length >= .8);
  const alcance = gotas => media(gotas.map(g=>g.pos[1]-origen[1]));
  const final = directo.gotas.filter(g=>g.presion<1);
  assert(final.length===24 && alcance(final)<.85*alcance(directo.plenas));
  const cola = final.filter(g=>g.presion<.6);
  assert(cola.length>5 && alcance(cola)<.75*alcance(directo.plenas)); cerca(Math.min(...cola.map(g=>g.presion)),1/3);
  const xs = s=>s.plenas.map(g=>g.pos[0]), factor = sigma(xs(caotico))/sigma(xs(directo));
  assert(factor>=3); assert(media(xs(aire))-media(xs(caotico))>.12);
  assert(Object.keys(pieza(caotico.m,'Pared').pelicula).length > 0);
  const m = nuevo();
  for (let i=0;i<170;i++) m.disparar({ arma:'chorro', origen:[0,0,1], direccion:[0,0,1] });
  m.avanzar(2*dt); assert.equal(m.estado().proyectiles.length,160);
  console.log('✓ Ráfagas de 72 gotas · '+n+'/48 a menos de 10 cm · alcance del último tercio '+alcance(final).toFixed(2)+' m frente a 6 m · dispersión ×'+factor.toFixed(1)+' · viento +'+(media(xs(aire))-media(xs(caotico))).toFixed(2)+' m · hasta 6 volúmenes por pieza y 160 gotas vivas');
}

// La máscara original menos las celdas perdidas se conserva en los restos.
// Una orden cinética mínima suelta la pieza para leer su botín sin quitar celdas.
{
  for (const medio of ['granada','charco','chorro']) {
    const m = medio === 'charco' ? conCharco() : nuevo(), def = placa('Botin',[.64,.48,.56],[0,0,.28]);
    m.agregarRobot(def);
    if (medio === 'granada') m.disparar(vertical(0,0,1));
    if (medio === 'chorro') m.disparar(apuntar('chorro',[0,-6.24,1],[0,-.24,.32]));
    m.avanzar(8);
    const antes = pieza(m,'Botin'); assert(antes.celdas < antes.celdasIniciales && antes.estado==='partida');
    m.disparar({ arma:'cinetico', origen:[-.28,-.15,1], direccion:[0,0,-1], potencia:.01 });
    m.terminarBatalla();
    const e = m.estado(), b = m.botin();
    const vivas = e.piezas.map(mask).reduce((s,p)=>s+p.filter(Boolean).length,0);
    assert.equal(vivas, antes.celdas);
    assert(e.piezas.every(p=>p.salida==='expuesto'));
    for (const mat of def.piezas[0].materiales) {
      const destruido = mat.cantidad*(1-vivas/antes.celdasIniciales);
      const presente = mat.cantidad-destruido, merma = presente*(1-RENDIMIENTO.partida);
      cerca(presente,b.total.materiales[mat.material]/RENDIMIENTO.partida);
      cerca(b.total.materiales[mat.material]+merma+destruido,mat.cantidad);
    }
  }
  console.log('✓ Acero y cobre conservados entre botín, calidad del resto y celdas perdidas en las tres presentaciones');
}

{
  const m = conCharco(); m.agregarRobot(pared);
  m.disparar(apuntar('chorro-caotico',origen,blanco,1,1)); m.avanzar(.67);
  m.disparar({ arma:'granada', origen:[1,-3,1], direccion:[0,1,1] }); m.avanzar(.079);
  const e = m.estado();
  assert(e.proyectiles.some(p=>p.tipo==='granada') && e.proyectiles.some(p=>p.tipo==='gota') && e.emisores[0].indice>0 && e.charcos.some(c=>c.activo));
  const c = cargar(m.serializar()); assert.equal(m.serializar(),c.serializar());
  m.avanzar(.75); for(let i=0;i<90;i++) c.avanzar(dt/2);
  assert.equal(m.serializar(),c.serializar());
  c.terminarBatalla(); m.terminarBatalla(); assert.equal(m.serializar(),c.serializar());
  assert(!m.estado().charcos.some(c=>c.activo) && !m.estado().emisores.length && !m.estado().proyectiles.length);
  const viejo = nuevo(); viejo.agregarRobot(pared);
  viejo.disparar({arma:'acido',origen,direccion:[0,1,0]}); viejo.avanzar(.2);
  const datos = JSON.parse(viejo.serializar()); datos.v=1;
  for (const k of ['emisores','proyectiles','charcos']) delete datos[k];
  const migrado = cargar(JSON.stringify(datos)); migrado.avanzar(.25); viejo.avanzar(.25);
  assert.equal(migrado.serializar(),viejo.serializar());
  console.log('✓ Continuación byte por byte con granada, gotas, emisor y charco activos, fin de batalla y migración v1');
}

{
  const ms = [];
  for (let tanda=0;tanda<12;tanda++) {
    const m=conCharco(); m.agregarRobot(placa('Banco',[.64,.36,.72],[0,0,.36]));
    m.disparar(apuntar('chorro',[0,-6.18,1],[0,-.18,.48])); m.avanzar(.5);
    const e=m.estado(); assert(e.emisores.length && e.charcos.some(c=>c.activo));
    for (let i=0;i<35;i++) {
      const t=performance.now(); m.avanzar(dt); const coste=performance.now()-t;
      if (tanda>=2) ms.push(coste);
    }
  }
  const mediana=ms.sort((a,b)=>a-b)[Math.floor(ms.length/2)];
  assert(mediana < 1.5, 'presupuesto del paso con chorro y charco');
  console.log('Mediana de '+ms.length+' pasos con emisor y charco activos · '+mediana.toFixed(3)+' ms (objetivo < 1,5 ms)');
}
