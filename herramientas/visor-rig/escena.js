import * as THREE from 'three';
import { OrbitControls } from '../../shared/vendor/three-r180/OrbitControls.js';
import { GLTFLoader } from '../../shared/vendor/three-r180/loaders/GLTFLoader.js';
import { leerRig } from '../../paquetes/rig/index.js';
import { conectarRig } from '../../paquetes/vista-3d/index.js';

const referencias={vehiculo_tubular:'VehiculoTubular',torreta_observacion:'TorretaObservacion'};
const cache=new Map();
export function cargar(archivo) {
  if (!cache.has(archivo)) {
    const modelo=new GLTFLoader().loadAsync('../../Prototypes/Rocket%20Launcher/modelos/'+archivo+'.glb');
    const poses=referencias[archivo]?fetch('../../pruebas/rig/'+referencias[archivo]+'-poses.json').then(async r=>{
      if (!r.ok) throw Error(r.status+' '+r.url);
      return (await r.json()).muestras;
    }):[];
    cache.set(archivo,Promise.all([modelo,poses]).then(([gltf,muestras])=>({
      gltf,rig:leerRig(gltf.parser.json),muestras
    })).catch(e=>{cache.delete(archivo); throw e;}));
  }
  return cache.get(archivo);
}

export function crearEscena(canvas,captura) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const escena=new THREE.Scene();
  escena.background=new THREE.Color(0x243139);
  const camara=new THREE.PerspectiveCamera(35,1,.01,200);
  const orbita=new OrbitControls(camara,canvas);
  orbita.enabled=!captura;
  escena.add(new THREE.HemisphereLight(0xfffaf0,0xaebfc9,2.1));
  const luz=new THREE.DirectionalLight(0xffefd3,2.6);
  luz.position.set(4,6,3); escena.add(luz);
  const relleno=new THREE.DirectionalLight(0xc3e6ff,1.6);
  relleno.position.set(-3,2,-3); escena.add(relleno);
  const suelo=new THREE.GridHelper(12,48,0x627780,0x3d5058); escena.add(suelo);
  let raiz,ejes,radio=1;
  function dibujar() { renderer.render(escena,camara); }
  function encuadrar() {
    const fov=THREE.MathUtils.degToRad(camara.fov)/2;
    const distancia=1.1*radio/Math.sin(Math.min(fov,Math.atan(Math.tan(fov)*camara.aspect)));
    camara.position.set(.95,.55,-1.3).normalize().multiplyScalar(distancia).add(orbita.target);
    orbita.update();
  }
  new ResizeObserver(()=>{
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    camara.aspect=canvas.clientWidth/canvas.clientHeight; camara.updateProjectionMatrix();
    if (captura) encuadrar();
    dibujar();
  }).observe(canvas);
  orbita.addEventListener('change',dibujar);

  function limpiarEjes() {
    if (!ejes) return;
    escena.remove(ejes); ejes.geometry.dispose(); ejes.material.dispose(); ejes=null;
  }
  function seleccionar({gltf,rig},nivel) {
    if (raiz) escena.remove(raiz);
    limpiarEjes();
    const datos=rig.niveles[nivel];
    raiz=gltf.scene.getObjectByName('L'+nivel+'_'+datos.raiz).clone(true);
    // Los ejes de referencia se expresan en el marco de la raíz en reposo.
    const adaptador=conectarRig(THREE,raiz,rig,nivel);
    escena.add(raiz); raiz.updateMatrixWorld(true);
    const marco=raiz.matrixWorld.clone(), inv=marco.clone().invert();
    const nodos=datos.orden.map(k=>raiz.getObjectByName('L'+nivel+'_'+k));
    const caja=new THREE.Box3().setFromObject(raiz,true), esfera=caja.getBoundingSphere(new THREE.Sphere());
    orbita.target.copy(esfera.center); radio=esfera.radius;
    suelo.position.y=caja.min.y-.012; encuadrar();
    function referencia(muestra) {
      limpiarEjes();
      if (!muestra) return [];
      raiz.updateMatrixWorld(true);
      const errores=[], posiciones=[], colores=[];
      const relativa=new THREE.Matrix4(), v=new THREE.Vector3();
      datos.orden.forEach((k,j)=>{
        const ref=muestra.mundo[k];
        relativa.multiplyMatrices(inv,nodos[j].matrixWorld);
        errores.push([k,Math.max(...ref.map((x,i)=>Math.abs(relativa.elements[i]-x)))]);
        for (let eje=0;eje<3;eje++) {
          v.fromArray(ref,12); posiciones.push(v.x,v.y,v.z);
          v.x+=radio*.065*ref[4*eje]; v.y+=radio*.065*ref[4*eje+1]; v.z+=radio*.065*ref[4*eje+2];
          posiciones.push(v.x,v.y,v.z);
          const rgb=[[1,.13,.08],[.08,1,.22],[.14,.43,1]][eje]; colores.push(...rgb,...rgb);
        }
      });
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(posiciones,3));
      geo.setAttribute('color',new THREE.Float32BufferAttribute(colores,3));
      ejes=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({vertexColors:true,depthTest:false}));
      ejes.matrixAutoUpdate=false; ejes.matrix.copy(marco); ejes.renderOrder=1;
      escena.add(ejes);
      return errores.sort((a,b)=>b[1]-a[1]);
    }
    return {adaptador,referencia};
  }
  return {seleccionar,dibujar};
}
