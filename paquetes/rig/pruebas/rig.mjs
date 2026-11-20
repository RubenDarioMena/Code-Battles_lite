// Oráculos numéricos de disco. La prueba con GLTFLoader se ejecuta en pruebas/three-r180.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { leerRig, crearSolver } from '../index.js';

const repo=new URL('../../../',import.meta.url);
function glb(nombre) {
  const b=readFileSync(new URL('Prototypes/Rocket Launcher/modelos/'+nombre+'.glb',repo));
  assert.equal(b.toString('ascii',0,4),'glTF'); assert.equal(b.readUInt32LE(4),2);
  assert.equal(b.readUInt32LE(8),b.length); assert.equal(b.toString('ascii',16,20),'JSON');
  return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
}
function producto(a,b) {
  return Array.from({length:16},(_,i)=>{
    let x=0;
    for (let k=0;k<4;k++) x+=a[i%4+4*k]*b[4*Math.floor(i/4)+k];
    return x;
  });
}
function error(a,b) {
  let e=0;
  for (let j=0;j<16;j++) e=Math.max(e,Math.abs(a[j]-b[j]));
  assert(Number.isFinite(e));
  return e;
}
function comparar(solver,muestras) {
  let peor={error:0,pivote:'',muestra:0};
  for (const [i,ref] of muestras.entries()) {
    const {mundo}=solver.evaluar(ref.controles);
    assert.deepEqual(Object.keys(mundo).sort(),Object.keys(ref.mundo).sort());
    for (const [k,m] of Object.entries(ref.mundo)) {
      const e=error(m,mundo[k]);
      if (e>peor.error) peor={error:e,pivote:k,muestra:i};
    }
  }
  return peor;
}
const vehiculo=glb('vehiculo_tubular');
let posesVehiculo;
for (const [archivo,cuenta,total] of [['vehiculo_tubular',181,57],['torreta_observacion',9,21],['t1',9,0]]) {
  const json=glb(archivo), rig=leerRig(json), raiz=rig.niveles[0].raiz;
  const muestras=total?JSON.parse(readFileSync(new URL('pruebas/rig/'+raiz+'-poses.json',repo),'utf8')).muestras:[];
  assert.equal(muestras.length,total);
  if (archivo==='vehiculo_tubular') posesVehiculo=muestras;
  // La TRS glTF está antes de la pila (el vehículo tiene guías sin orientar).
  const entrada=structuredClone(json);
  for (const nodo of entrada.nodes) if (nodo.extras?.rig) {
    const r=JSON.parse(nodo.extras.rig);
    r.reglas=r.reglas.filter(regla=>regla.tipo==='LOCAL');
    if (r.reglas.length) nodo.extras.rig=JSON.stringify(r);
    else delete nodo.extras.rig;
  }
  const sinRestricciones=leerRig(entrada);
  assert.equal(rig.niveles.length,3);
  for (const [nivel,n] of rig.niveles.entries()) {
    assert.equal(n.orden.length,cuenta);
    const solver=crearSolver(rig,nivel), pose=solver.evaluar();
    const crudas=crearSolver(sinRestricciones,nivel).evaluar().locales;
    for (const k of n.orden) {
      const p=n.pivotes[k];
      assert(error(crudas[k],p.reposo)<=1e-5,'TRS de entrada '+k);
      if (!p.reglas.some(r=>r.tipo!=='LOCAL')) assert(error(pose.locales[k],p.reposo)<=1e-5,k);
      assert(pose.locales[k] instanceof Float64Array && pose.mundo[k] instanceof Float64Array);
      const padre=p.padre;
      const cadena=padre?producto(pose.mundo[padre],pose.locales[k]):pose.locales[k];
      const esperado=padre?pose.mundo[k]:p.reposo;
      assert(error(cadena,esperado)<=1e-5,'cadena '+k);
      if (total && padre) assert(error(producto(muestras[0].mundo[padre],pose.locales[k]),
        muestras[0].mundo[k])<=1e-5,'reposo resuelto '+k);
    }
    if (total) {
      const peor=comparar(solver,muestras);
      console.log(raiz,'L'+nivel,peor);
      assert(peor.error<=1e-4,JSON.stringify(peor));
    }
    assert.equal(solver.evaluar(),pose);
  }
}

function mutar(tipo,cambio) {
  const rig=leerRig(vehiculo), nivel=rig.niveles[0];
  for (const p of Object.values(nivel.pivotes)) {
    const r=p.reglas.find(r=>r.tipo===tipo);
    if (!r) continue;
    cambio(r,p,nivel);
    const peor=comparar(crearSolver(rig,0),posesVehiculo);
    assert(peor.error>1e-4,'la mutación escapó: '+tipo);
    console.log('Mutación detectada',tipo,peor);
    return;
  }
  assert.fail('regla ausente '+tipo);
}
mutar('APUNTAR',r=>{r.eje=r.eje.map(x=>-x);});
mutar('ESTIRAR',r=>{r.volumen=r.volumen==='NO'?'XZ':'NO';});
mutar('COPIAR_POSICION',(r,p,n)=>{
  n.orden.splice(n.orden.indexOf(p.nombre),1);
  n.orden.splice(n.orden.indexOf(r.objetivo),0,p.nombre);
});

// Offset verdadero: el GLB del vehículo solo contiene copias absolutas.
// Oráculo de traslación a media influencia, con inversión y canal desactivado.
function ejemplo(regla) {
  return {scenes:[{nodes:[0]}],nodes:[
    {name:'L0_Prueba',extras:{rig_formato:'cbl-rig',rig_v:2,controles:[]},children:[1,2]},
    {name:'L0_meta',translation:[2,4,6]},
    {name:'L0_dueno',translation:[1,2,3],extras:{rig:JSON.stringify({v:2,reglas:[regla]})}}
  ]};
}
const copia={tipo:'COPIAR_POSICION',influencia:.5,objetivo:'meta',ejes:[true,false,true],
  invertir:[false,false,true],desplazamiento:true};
function dueno(r) { return crearSolver(leerRig(ejemplo(r)),0).evaluar().locales.dueno; }
const esperado=dueno(copia).slice();
assert.deepEqual(Array.from(esperado.slice(12,15)),[2,2,0]);
const sinOffset=dueno({...copia,desplazamiento:false});
assert(error(sinOffset,esperado)>1e-4);
console.log('Mutación detectada COPIAR_POSICION sin desplazamiento',error(sinOffset,esperado));

// Locked Track y mezcla polar: el dueño mira hacia X, gira sobre Z y conserva sus escalas.
const bloqueado={tipo:'APUNTAR_BLOQUEADO',influencia:.5,objetivo:'meta',eje:[1,0,0],bloqueo:[0,0,1]};
const sint=ejemplo(bloqueado);
sint.nodes[2].translation=[2,2,3]; sint.nodes[2].scale=[2,3,4];
const m=crearSolver(leerRig(sint),0).evaluar().locales.dueno;
assert(Math.abs(m[0]-Math.SQRT2)<1e-12 && Math.abs(m[1]-Math.SQRT2)<1e-12);
assert(Math.abs(m[4]+3*Math.SQRT1_2)<1e-12 && Math.abs(m[10]-4)<1e-12);
assert.throws(()=>leerRig(ejemplo({...copia,tipo:'OTRO'})),/Tipo desconocido/);
const version=ejemplo(copia); version.nodes[0].extras.rig_v=3;
assert.throws(()=>leerRig(version),/versión/);
const desconocido={tipo:'LOCAL',base:{t:[0,0,0],r:[0,0,0,1],s:[1,1,1]},
  rotaciones:[],escala:[1,1,1],traslacion:[['otro',1],0,0]};
assert.throws(()=>leerRig(ejemplo(desconocido)),/Operador desconocido/);

const solver=crearSolver(leerRig(vehiculo),0);
function iguales(a,b) {
  const esperado=structuredClone(solver.evaluar(a).mundo);
  const recibido=solver.evaluar(b).mundo;
  for (const k in esperado) assert(error(esperado[k],recibido[k])<1e-10,k);
}
for (const c of solver.controles) {
  iguales({[c.nombre]:c.reposo},{});
  if (!c.ciclico) {
    iguales({[c.nombre]:c.min-10},{[c.nombre]:c.min});
    iguales({[c.nombre]:c.max+10},{[c.nombre]:c.max});
  }
}
iguales({'rueda_dd.giro':.3},{'rueda_dd.giro':.3+200*Math.PI}); // supera su límite nominal con .3
iguales({'raiz.giro':.3},{'raiz.giro':.3+2*Math.PI});

// El arnés r180 resuelve el import map real con vm; el paquete puro no importa Three.
execFileSync(process.execPath, ['--experimental-vm-modules', '--disable-warning=ExperimentalWarning',
  fileURLToPath(new URL('pruebas/three-r180.mjs',repo)), '--rig'], {stdio:'inherit'});

const tiempos=new Float64Array(2500);
for (let i=-500;i<tiempos.length;i++) {
  const controles=posesVehiculo[Math.abs(i)%posesVehiculo.length].controles;
  const inicio=performance.now(); solver.evaluar(controles);
  if (i>=0) tiempos[i]=performance.now()-inicio;
}
console.log('Vehículo L0, 2500 llamadas, mediana',tiempos.sort()[1250].toFixed(4),'ms');
