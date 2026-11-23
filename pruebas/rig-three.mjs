// GLTFLoader y Three se inyectan desde la prueba del grafo vendorizado r180.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { leerRig, crearSolver } from '../paquetes/rig/index.js';
import { conectarRig, factory3d } from '../paquetes/vista-3d/index.js';

function medir(peor,a,b,nombre,muestra) {
  const error=Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
  assert(Number.isFinite(error));
  if (error>peor.error) Object.assign(peor,{error,nombre,muestra});
}

export function equivalenciaFactory(THREE,gltf,contenido) {
  let semilla=0xcb120003;
  function azar() { semilla=(Math.imul(1664525,semilla)+1013904223)>>>0; return semilla/2**32; }
  const oraculos=contenido.robot.niveles.map((_,n)=>{
    const raiz=gltf.scene.getObjectByName('L'+n+'_RobotTransporte').clone(true);
    raiz.position.set(0,0,0); raiz.scale.setScalar(.8);
    const nodo=k=>raiz.getObjectByName('L'+n+'_'+k);
    return {raiz,torreta:nodo('torreta'),hombro:nodo('hombro'),codo:nodo('codo'),muneca:nodo('muneca'),
      dedoI:nodo('dedo_i'),dedoD:nodo('dedo_d')};
  });
  const ctx={THREE,estado:{escena:{entidades:[],robot:{cx:0,cy:0}}},camara:new THREE.PerspectiveCamera(),altoPx:()=>600};
  ctx.camara.position.set(0,5,5);
  const nombres=leerRig(gltf.parser.json).niveles[0].orden;
  const peor={error:0,nombre:'',muestra:0};
  for (let i=0;i<200;i++) {
    const ang=()=>4*Math.PI*(azar()-.5);
    const p={giro:ang(),a1:ang(),a2:ang(),a3:ang(),pinza:azar()*16*Math.PI/180};
    Object.assign(contenido.robot.pose,p);
    // dt=0 conserva esta pose al pasar por el mapeo pose → controles real del juego.
    factory3d.actualizar(contenido,ctx,0);
    contenido.robot.grupo.updateMatrixWorld(true);
    for (const [n,l] of oraculos.entries()) {
      l.torreta.rotation.y = p.giro; l.hombro.rotation.x = p.a1; l.codo.rotation.x = p.a2; l.muneca.rotation.x = p.a3;
      l.dedoI.rotation.z = p.pinza; l.dedoD.rotation.z = -p.pinza;
      l.raiz.updateMatrixWorld(true);
      for (const k of nombres) {
        const nombre='L'+n+'_'+k;
        const nuevo=contenido.robot.niveles[n].raiz.getObjectByName(nombre);
        const viejo=l.raiz.getObjectByName(nombre);
        const esperado=new THREE.Matrix4().multiplyMatrices(contenido.robot.grupo.matrixWorld,viejo.matrixWorld);
        medir(peor,nuevo.matrixWorld.elements,esperado.elements,k,i);
      }
    }
  }
  assert(peor.error<=1e-6,JSON.stringify(peor));
  console.log('Factory T1 · 200 poses × 3 niveles',peor);
}

export async function comprobarAdaptador(THREE,GLTFLoader,t1) {
  for (const archivo of ['t1','vehiculo_tubular','torreta_observacion']) {
    let gltf=t1;
    if (archivo!=='t1') {
      const b=await readFile(new URL('../Prototypes/Rocket Launcher/modelos/'+archivo+'.glb',import.meta.url));
      gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
    }
    const rig=leerRig(gltf.parser.json), nombre=rig.niveles[0].raiz;
    const muestras=archivo==='t1'?[{controles:{'hombro.giro':.37}}]:JSON.parse(await readFile(
      new URL('./rig/'+nombre+'-poses.json',import.meta.url),'utf8')).muestras;
    const peor={error:0,nombre:'',muestra:0};
    // Marco externo ajeno al rig. La comparación también cubre raíces animadas.
    gltf.scene.position.set(4,2,-1); gltf.scene.rotation.y=.27; gltf.scene.scale.set(.8,1.1,.9);
    gltf.scene.updateMatrixWorld(true);
    for (const [n,nivel] of rig.niveles.entries()) {
      const raiz=gltf.scene.getObjectByName('L'+n+'_'+nombre);
      const marco=raiz.matrixWorld.clone().invert();
      const adaptador=conectarRig(THREE,raiz,rig,n), solver=crearSolver(rig,n);
      const nodos=nivel.orden.map(k=>raiz.getObjectByName('L'+n+'_'+k));
      assert(nodos.every(o=>o.matrixAutoUpdate===false));
      for (const [i,{controles}] of muestras.entries()) {
        adaptador.aplicar(controles); gltf.scene.updateMatrixWorld();
        const pose=solver.evaluar(controles), relativa=new THREE.Matrix4();
        for (const [j,k] of nivel.orden.entries()) {
          relativa.multiplyMatrices(marco,nodos[j].matrixWorld);
          medir(peor,relativa.elements,pose.mundo[k],k,i);
        }
      }
    }
    assert(peor.error<=1e-6,JSON.stringify(peor));
    console.log('Adaptador r180',nombre,peor);
  }
}
