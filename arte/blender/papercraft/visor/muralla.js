import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

// En raw.githack los binarios (GLB y sus texturas) responden 403: los datos se piden a
// raw.githubusercontent, que usa la misma ruta (usuario/repo/ref/…) y permite CORS.
const aqui = new URL('../', import.meta.url);
const raiz = /(^|\.)githack\.com$/.test(aqui.hostname) ? new URL(aqui.pathname, 'https://raw.githubusercontent.com') : aqui;
const salida = document.querySelector('output');
async function leer(archivo) {
  const r = await fetch(new URL(archivo,raiz));
  if (!r.ok) throw Error(archivo+' · '+r.status);
  return r;
}
async function mostrar() {
  const estudio = await (await leer('estudio.json')).json();
  const texto = await (await leer('MURALLA-OPCIONES.md')).text();
  const opciones = ['Muralla actual', ...Array.from(texto.matchAll(/^\d+\. \*\*(.+?)\*\*/gm), m=>m[1])];
  const canvas = document.querySelector('canvas');
  const render = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  render.setPixelRatio(Math.min(devicePixelRatio,2));
  render.toneMapping=THREE.AgXToneMapping;
  render.toneMappingExposure=estudio.exposicion;
  render.shadowMap.enabled=true;
  render.shadowMap.type=THREE.PCFSoftShadowMap;
  const escena=new THREE.Scene();
  const camara=new THREE.PerspectiveCamera(estudio.campoVertical,1,.1,1100);
  const control=new OrbitControls(camara,canvas);
  control.maxPolarAngle=Math.PI*.49;
  control.minDistance=4;
  control.maxDistance=750;
  const intervalo=34;
  for(const f of estudio.luces){
    const luz=new THREE.DirectionalLight(new THREE.Color(...f.color),f.energia);
    luz.target.position.set(intervalo*5,0,0);
    luz.position.copy(luz.target.position).addScaledVector(new THREE.Vector3(...f.direccion),300);
    luz.castShadow=f.sombras;
    Object.assign(luz.shadow.camera,{left:-205,right:205,top:130,bottom:-130,near:80,far:650});
    luz.shadow.camera.updateProjectionMatrix();
    luz.shadow.mapSize.setScalar(Math.min(4096,render.capabilities.maxTextureSize));
    luz.shadow.normalBias=.045;
    escena.add(luz,luz.target);
  }
  const dibujar=()=>render.render(escena,camara);
  control.addEventListener('change',dibujar);
  let seleccion=0;
  const botones=[];
  function enfocar(i){
    seleccion=i;
    control.target.set(i*intervalo,i===0?4.3:7.1,0);
    const alto=Math.max(25.5,27/camara.aspect);
    camara.position.copy(control.target).addScaledVector(new THREE.Vector3(.38,.42,1).normalize(),
      alto/(2*Math.tan(THREE.MathUtils.degToRad(camara.fov/2))));
    control.update();
    botones.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
    dibujar();
  }
  opciones.forEach((nombre,i)=>{
    const b=document.createElement('button'), numero=document.createElement('span');
    numero.textContent=i?String(i).padStart(2,'0'):'Ref.';
    b.append(numero,document.createTextNode(nombre));
    document.querySelector('nav').append(b);
    botones.push(b);
    b.onclick=()=>enfocar(i);
  });
  function ajustar(){
    camara.aspect=canvas.clientWidth/canvas.clientHeight;
    camara.updateProjectionMatrix();
    render.setSize(canvas.clientWidth,canvas.clientHeight,false);
    enfocar(seleccion);
  }
  new ResizeObserver(ajustar).observe(canvas);
  ajustar();

  // Una figura recortada de cuerpo entero. La altura de la silueta es 1,80 m.
  const contorno=new THREE.Shape();
  const perfil=[[-.19,0],[-.05,0],[0,.7],[.07,0],[.21,0],[.16,.9],[.18,1.25],[.24,.91],[.33,.94],[.24,1.43],[.11,1.49],[.1,1.55],[.14,1.65],[.1,1.76],[0,1.8],[-.1,1.76],[-.14,1.65],[-.1,1.55],[-.11,1.49],[-.24,1.43],[-.33,.94],[-.24,.91],[-.18,1.25],[-.15,.86]];
  perfil.forEach(([x,y],i)=>i?contorno.lineTo(x,y):contorno.moveTo(x,y));
  contorno.closePath();
  const figura=new THREE.Mesh(new THREE.ShapeGeometry(contorno),new THREE.MeshBasicMaterial({color:0x302d29,side:THREE.DoubleSide}));
  const fibra=await new THREE.TextureLoader().loadAsync(new URL('texturas/fibra.png',raiz).href);
  fibra.colorSpace=THREE.SRGBColorSpace;
  fibra.wrapS=fibra.wrapT=THREE.RepeatWrapping;fibra.repeat.set(3,2);
  const peana=new THREE.Mesh(new THREE.BoxGeometry(29,.3,17),new THREE.MeshStandardMaterial({map:fibra,color:0xc4bbaa,roughness:1}));
  peana.receiveShadow=true;
  const loader=new GLTFLoader();
  let papel;
  async function pieza(ruta){
    const gltf=await loader.loadAsync(new URL(ruta,raiz).href);
    const malla=gltf.scene.getObjectByProperty('isMesh',true);
    if (papel) {
      malla.material.map.dispose();
      malla.material.normalMap.dispose();
      malla.material.dispose();
      malla.material=papel;
    } else {
      papel=malla.material;
      for(const textura of [papel.map,papel.normalMap]){
        textura.anisotropy=Math.min(8,render.capabilities.getMaxAnisotropy());
      }
    }
    malla.castShadow=malla.receiveShadow=true;
    return malla;
  }
  for(let i=0;i<opciones.length;i++){
    const prefijo='glb/muralla/opcion-'+String(i).padStart(2,'0');
    const [tramo,nudo]=await Promise.all([
      pieza(i?prefijo+'-tramo.glb':'glb/kit/lienzo.glb'),
      pieza(i?prefijo+'-nudo.glb':'glb/kit/torre.glb')
    ]);
    const x=i*intervalo;
    const apoyo=peana.clone();apoyo.position.set(x,-.15,0);
    const persona=figura.clone();persona.position.set(x-4.5,0,5.7);
    const ancho=new THREE.Box3().setFromObject(nudo).getSize(new THREE.Vector3()).x;
    const largo=new THREE.Box3().setFromObject(tramo).getSize(new THREE.Vector3()).x;
    const mitad=(ancho+largo)/2;
    const otro=tramo.clone();
    tramo.position.x=x-mitad;nudo.position.x=x;otro.position.x=x+mitad;
    escena.add(apoyo,persona,tramo,nudo,otro);
    dibujar();
  }
  salida.textContent='';
}
mostrar().catch(error=>{salida.textContent='No se pudo cargar la comparación.';console.error(error);});
