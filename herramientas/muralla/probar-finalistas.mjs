// Prueba sin pantalla del escenario, las roturas y la vuelta a las obras originales.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import T from './vendor/three-r128.min.js';
import V from '../../shared/muralla/voxeles.js';
import {comparar,construir,golpear,golpes,nombres,restaurar} from './perfiles-finalistas.mjs';
globalThis.window={CMGMuralla:V};
await import('../../shared/muralla/vista-three.js');
const pagina=fs.readFileSync(new URL('finalistas.html',import.meta.url),'utf8');
for(const [,src] of pagina.matchAll(/<script[^>]* src="([^"]+)"/g)){
  assert(fs.existsSync(new URL(src,import.meta.url)),src);
}
for(const id of Object.keys(nombres)){
  const m=construir(V,id), original=V.cargar(m.serializar());
  assert.equal(m.derrumbar(0).length,0,'La maqueta intacta necesita apoyo: '+id);
  let alto=0,izquierda=Infinity,derecha=-Infinity;
  m.rejilla.recorrer((i,j,k)=>{alto=Math.max(alto,k+1);izquierda=Math.min(izquierda,i);derecha=Math.max(derecha,i+1)});
  assert.equal(alto*m.tam,16);assert.equal((derecha-izquierda)*m.tam,35);
  if(id==='B'||id==='C')assert.equal(m.solido(id==='B'?0:14,0,5),0);
  const impactos=comparar(m);
  assert(impactos.every(r=>r.quitados>0));
  const repetida=construir(V,id);
  comparar(repetida);
  assert.deepEqual(m.serializar(),repetida.serializar());
  for(const potencia of Object.keys(golpes)){
    const golpeada=V.cargar(original.serializar());
    assert(golpear(golpeada,-10,0,4,0,potencia).quitados>0);
  }
  const reparada=restaurar(V,m);
  original.rejilla.recorrer((i,j,k,v)=>assert.equal(reparada.rejilla.get(i,j,k),v));
  assert.equal(reparada.plano.total,0);
  const vista=window.CMGMurallaVista.crear(T,m);
  vista.actualizar(3);vista.grupo.updateMatrixWorld(true);
  for(const [w,h] of [[375,530],[1100,650]]){
    const cam=new T.PerspectiveCamera(31,w/h,.1,400);
    const d=Math.max(24,44*h/w)/(2*Math.tan(cam.fov*Math.PI/360));
    cam.position.set(d*Math.cos(.33)*Math.sin(.33),7+d*Math.sin(.33),d*Math.cos(.33)**2);
    cam.lookAt(0,7,0);cam.updateMatrixWorld();
    for(const x of [-17.5,17.5])for(const y of [0,16])for(const z of [-5.5,5.5]){
      const p=new T.Vector3(x,y,z).project(cam);
      assert(Math.abs(p.x)<1&&Math.abs(p.y)<1,'Encuadre '+id);
    }
    const punto=new T.Vector3(8,5,0).project(cam);
    const ray=new T.Raycaster();
    ray.setFromCamera(punto,cam);
    assert(ray.intersectObjects(vista.mallas()).length>0,'Selección '+id);
  }
  vista.liberar();
  console.log(id,nombres[id],'· impactos, determinismo, reparación, encuadre y selección correctos');
}
