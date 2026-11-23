import {construir,comparar,restaurar,paleta,nombres,golpear,golpes} from './perfiles-finalistas.mjs';
const T=window.THREE, V=window.CMGMuralla, $=s=>document.querySelector(s);
const aqui=new URL('../../arte/blender/papercraft/',import.meta.url);
const raiz=/(^|\.)githack\.com$/.test(aqui.hostname)?new URL(aqui.pathname,'https://raw.githubusercontent.com'):aqui;
async function iniciar(){
  const respuesta=await fetch(new URL('paleta.json',raiz));
  if(!respuesta.ok) throw Error('paleta.json');
  const tintas=await respuesta.json(), fibra=await new T.TextureLoader().loadAsync(new URL('texturas/fibra.png',raiz).href);
  fibra.wrapS=fibra.wrapT=T.RepeatWrapping;
  const canvas=$('canvas'), render=new T.WebGLRenderer({canvas,alpha:true,antialias:true});
  render.setPixelRatio(Math.min(devicePixelRatio,2));
  const escena=new T.Scene(), cam=new T.PerspectiveCamera(31,1,.1,400);
  escena.add(new T.HemisphereLight(0xffefcf,0xa9a4ad,.78));
  const sol=new T.DirectionalLight(0xffe7bf,.77);sol.position.set(-30,48,24);escena.add(sol);
  const tablero=new T.Mesh(new T.BoxGeometry(80,.5,65),new T.MeshLambertMaterial({color:0xc7b89c,map:fibra}));
  tablero.position.y=-.27;escena.add(tablero);
  const perfil=[[-.2,0],[-.04,0],[0,.73],[.07,0],[.21,0],[.15,1.17],[.24,.95],[.31,.98],[.2,1.42],[.09,1.48],[.13,1.66],[.07,1.8],[-.08,1.8],[-.14,1.66],[-.09,1.49],[-.21,1.42],[-.31,.98],[-.24,.95],[-.15,1.17]];
  const figura=new T.Mesh(new T.ShapeGeometry(new T.Shape(perfil.map(([x,y])=>new T.Vector2(x,y)))),new T.MeshBasicMaterial({color:0x322d28,side:T.DoubleSide}));
  figura.position.set(-16,0,6);escena.add(figura);
  const material=window.CMGMurallaMaterial.crear(T);
  const original=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    original(shader);
    shader.uniforms.fibra={value:fibra};
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D fibra;')
      .replace('diffuseColor.rgb *= acabadoMuro(vCaraMuro);',
      'diffuseColor.rgb *= mix(1., acabadoMuro(vCaraMuro), .35) * mix(vec3(1.), texture2D(fibra,vCaraMuro.xy/12.).rgb,.82);');
  };
  const params=new URLSearchParams(location.search), demo=params.get('demo')==='comparar';
  const estados=new Map(), ray=new T.Raycaster();
  let actual, vista, id, arrastre, azimut=.33, elevacion=.33, zoom=1;
  function colocarCamara(){
    const a=canvas.clientWidth/Math.max(canvas.clientHeight,1);
    const distancia=Math.max(24,44/a)*zoom/(2*Math.tan(cam.fov*Math.PI/360));
    cam.aspect=a;cam.updateProjectionMatrix();
    cam.position.set(distancia*Math.cos(elevacion)*Math.sin(azimut),7+distancia*Math.sin(elevacion),distancia*Math.cos(elevacion)*Math.cos(azimut));
    cam.lookAt(0,7,0);cam.updateMatrixWorld();
    figura.rotation.y=azimut;
  }
  function estadoInicial(letra,danado){
    const m=construir(V,letra);
    let nota='Muralla intacta';
    if(danado){
      const inicial=m.rejilla.total;
      comparar(m);
      let fijos=0;
      m.rejilla.recorrer((i,j,k,material)=>{if(!V.esEscombro(material))fijos++;});
      nota='Dos impactos de misil · '+Math.round(100*fijos/inicial)+' % en pie';
    }
    return {m,paso:danado?90:0,nota};
  }
  function abrir(letra){
    if(vista){escena.remove(vista.grupo);vista.liberar();}
    if(!estados.has(letra)) estados.set(letra,estadoInicial(letra,demo));
    id=letra;actual=estados.get(id);
    vista=window.CMGMurallaVista.crear(T,actual.m,{material,paleta:paleta(V,tintas,id)});
    escena.add(vista.grupo);vista.actualizar(actual.paso/30);
    for(const b of $('nav').children)b.setAttribute('aria-pressed',String(b.value===id));
    $('footer a').href='?demo=comparar&finalista='+letra;
    $('output').textContent=actual.nota;
  }
  for(const [letra,nombre] of Object.entries(nombres)){
    const b=document.createElement('button');b.textContent=letra+' · '+nombre;b.value=letra;b.onclick=()=>abrir(letra);$('nav').append(b);
  }
  $('#golpe').onchange=()=>{$('#radio').value=String(golpes[$('#golpe').value][0]);};
  $('#reiniciar').onclick=()=>{estados.set(id,estadoInicial(id,false));abrir(id);};
  $('#reparar').onclick=()=>{actual.m=restaurar(V,actual.m);actual.nota='Reparada · cascajo exterior conservado';abrir(id);};
  function tocar(e){
    const b=canvas.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((e.clientX-b.left)*2/b.width-1,1-(e.clientY-b.top)*2/b.height),cam);
    vista.grupo.updateMatrixWorld(true);
    const impactos=ray.intersectObjects(vista.mallas());
    for(const malla of vista.grupo.children) {
      if(malla.userData.pieza) T.Mesh.prototype.raycast.call(malla,ray,impactos);
    }
    const hit=impactos.sort((a,b)=>a.distance-b.distance)[0];
    if(!hit)return;
    const {x,y,z}=vista.voxelDe(hit);
    const g=golpear(actual.m,x,y,z,actual.paso/30,$('#golpe').value,Number($('#radio').value));
    vista.actualizar(actual.paso/30);
    actual.nota=g.quitados+' vóxeles retirados · '+actual.m.piezas.filter(p=>p.estado==='cuelga').length+' piezas colgadas';
    $('output').textContent=actual.nota;
  }
  canvas.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;canvas.setPointerCapture(e.pointerId);arrastre={x:e.clientX,y:e.clientY,azimut,elevacion,id:e.pointerId,movido:false};};
  canvas.onpointermove=e=>{
    if(arrastre?.id!==e.pointerId)return;
    const dx=e.clientX-arrastre.x,dy=e.clientY-arrastre.y;
    if(Math.hypot(dx,dy)>5)arrastre.movido=true;
    if(arrastre.movido){azimut=arrastre.azimut-dx*.009;elevacion=Math.max(.08,Math.min(1.3,arrastre.elevacion+dy*.006));colocarCamara();}
  };
  canvas.onpointerup=e=>{if(arrastre?.id===e.pointerId){if(!arrastre.movido)tocar(e);arrastre=null;}};
  canvas.onpointercancel=()=>{arrastre=null;};
  canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(.35,Math.min(2,zoom*Math.exp(e.deltaY*.001)));colocarCamara();};
  new ResizeObserver(()=>{render.setSize(canvas.clientWidth,canvas.clientHeight,false);colocarCamara();}).observe(canvas);
  abrir(Object.hasOwn(nombres,params.get('finalista'))?params.get('finalista'):'A');
  colocarCamara();
  let previo=0,resto=0;
  function cuadro(ms){
    resto+=Math.min(.1,(ms-previo)/1000);previo=ms;
    while(resto>=1/30){actual.m.paso(++actual.paso/30);resto-=1/30;}
    vista.actualizar(actual.paso/30);render.render(escena,cam);requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
}
iniciar().catch(e=>{$('output').textContent='No se pudo abrir la maqueta: '+e.message;console.error(e);});
