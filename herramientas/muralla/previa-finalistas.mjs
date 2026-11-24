// Intercambio temporal con Blender: mallas del adaptador en su pose a los 3 s.
import fs from 'node:fs';
import path from 'node:path';
import T from './vendor/three-r128.min.js';
import V from '../../shared/muralla/voxeles.js';
import {construir,comparar,paleta,nombres} from './perfiles-finalistas.mjs';
globalThis.window={CMGMuralla:V};
await import('../../shared/muralla/vista-three.js');
const tintas=JSON.parse(fs.readFileSync(new URL('../../arte/blender/papercraft/paleta.json',import.meta.url)));
for(const id of Object.keys(nombres)){
  const m=construir(V,id);comparar(m);
  const v=window.CMGMurallaVista.crear(T,m,{paleta:paleta(V,tintas,id)});
  v.actualizar(3);v.grupo.updateMatrixWorld(true);
  const pos=[],color=[],caras=[],p=new T.Vector3();
  for(const o of v.grupo.children){
    if(o.userData.plano || !o.visible)continue;
    const g=o.geometry, ini=pos.length/3, c=g.getAttribute('color');
    for(let i=0;i<c.count;i++){
      p.fromBufferAttribute(g.getAttribute('position'),i).applyMatrix4(o.matrixWorld);
      pos.push(p.x,-p.z,p.y);color.push(c.getX(i),c.getY(i),c.getZ(i));
    }
    for(const i of g.index.array)caras.push(ini+i);
  }
  const escribir=a=>Buffer.from(a.buffer);
  fs.writeFileSync(path.join(process.argv[2],id+'.bin'),Buffer.concat([
    escribir(Uint32Array.of(pos.length/3,caras.length/3)),escribir(Float32Array.from(pos)),
    escribir(Float32Array.from(color)),escribir(Uint32Array.from(caras))]));
  v.liberar();
}
