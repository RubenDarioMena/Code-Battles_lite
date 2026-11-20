import { matriz, vector, punto, cruz, normalizar, direccion, ejeAngulo, producto, escalar, crearMezcla } from './matrices.js';

const ejes = [[1,0,0],[0,0,-1],[0,1,0],[-1,0,0],[0,0,1],[0,-1,0]];
const longitudinal = ejes[1];
const normaCol = (m,j) => Math.sqrt(m[j]**2 + m[j+1]**2 + m[j+2]**2);

function proyectar(v,normal) {
  const d=punto(v,normal);
  for (let i=0;i<3;i++) v[i]-=d*normal[i];
}

// orthogonalize_m4_stable con el eje longitudinal fijo. Corrige por igual
// ambos transversales y conserva el área de su paralelogramo proyectado.
function quitarCizalla(m,x,y,z) {
  direccion(x,m,ejes[0]); direccion(y,m,ejes[2]); direccion(z,m,longitudinal);
  normalizar(z); proyectar(x,z); proyectar(y,z);
  let sx=normalizar(x), sy=normalizar(y);
  const cos=punto(x,y);
  if (Math.abs(cos)>1e-4 && Math.abs(cos)<1-1.1920929e-7) {
    const ang=Math.acos(cos), medio=(ang-Math.PI/2)/2;
    // Suma y diferencia de las direcciones unitarias dan las bisectrices.
    const a=Math.cos(medio)-cos*Math.sin(medio)/Math.sin(ang), b=Math.sin(medio)/Math.sin(ang);
    for (let i=0;i<3;i++) {
      const u=x[i], v=y[i];
      x[i]=a*u+b*v; y[i]=a*v+b*u;
    }
    const area=Math.sqrt(Math.sin(ang)); sx*=area; sy*=area;
  }
  for (let i=0;i<3;i++) { m[i]=x[i]*sx; m[4+i]=y[i]*sy; }
}

export function crearRestricciones() {
  const destino=vector(), actual=vector(), normal=vector(), auxiliar=vector();
  const x=vector(), y=vector(), z=vector(), localCruz=vector();
  const rot=matriz(), antes=matriz(), mezclar=crearMezcla();

  function apuntar(m,eje) {
    direccion(actual,m,eje);
    if (!normalizar(actual)) actual.set(eje);
    cruz(normal,actual,destino);
    const seno=normalizar(normal), cos=punto(actual,destino);
    let ang=Math.atan2(seno,cos);
    if (seno<1.1920929e-7) {
      if (cos>=0) return;
      let indice=0;
      for (let i=1;i<6;i++) if (punto(ejes[i],eje)>punto(ejes[indice],eje)) indice=i;
      direccion(auxiliar,m,ejes[(indice+1)%6]);
      cruz(normal,actual,auxiliar);
      if (!normalizar(normal)) return;
      ang=Math.PI;
    }
    ejeAngulo(rot,normal,ang);
    const tx=m[12], ty=m[13], tz=m[14];
    producto(m,rot,m); m[12]=tx; m[13]=ty; m[14]=tz;
  }

  function bloqueado(m,r) {
    direccion(normal,m,r.bloqueo); normalizar(normal);
    proyectar(destino,normal);
    if (normalizar(destino)<1e-12) return;
    // Cambio entre las bases (eje, bloqueo, eje × bloqueo), con las
    // longitudes originales de las columnas, como Locked Track.
    cruz(auxiliar,destino,normal); cruz(localCruz,r.eje,r.bloqueo);
    for (let j=0;j<3;j++) {
      const s=normaCol(m,j*4);
      for (let i=0;i<3;i++) m[j*4+i]=s*(destino[i]*r.eje[j]+normal[i]*r.bloqueo[j]+auxiliar[i]*localCruz[j]);
    }
  }

  function estirar(m,r,distancia) {
    if (r.eje_fijo==='Y') quitarCizalla(m,x,y,z);
    const sx=normaCol(m,0), sy=normaCol(m,4), sz=normaCol(m,8);
    const factor=sz ? distancia/(sz*r.longitud_reposo) : 0;
    const volumen=r.volumen==='NO'?1:factor**(-r.abultamiento);
    const fx=r.volumen==='XZ'?Math.sqrt(volumen):r.volumen==='X'?volumen:1;
    const fy=r.volumen==='XZ'?Math.sqrt(volumen):r.volumen==='Z'?volumen:1;
    if (r.eje_fijo==='Y') {
      if (distancia) apuntar(m,longitudinal);
      escalar(m,fx,fy,factor);
    } else {
      for (let i=0;i<3;i++) z[i]=-destino[i];
      direccion(y,m,ejes[2]); cruz(x,y,z); normalizar(x); cruz(y,z,x);
      m.set(x,0); m.set(y,4); m.set(z,8); escalar(m,sx*fx,sy*fy,sz*factor);
    }
  }

  return (m,r,objetivo) => {
    const f=r.influencia;
    if (f===0) return;
    if (r.tipo==='COPIAR_POSICION') {
      for (let i=0;i<3;i++) if (r.ejes[i]) {
        const valor=objetivo[12+i]*(r.invertir[i]?-1:1);
        m[12+i]+=f*(valor-(r.desplazamiento?0:m[12+i]));
      }
      return;
    }
    for (let i=0;i<3;i++) destino[i]=objetivo[12+i]-m[12+i];
    const distancia=normalizar(destino);
    if (!distancia && r.tipo!=='ESTIRAR') return;
    if (f<1) antes.set(m);
    if (r.tipo==='APUNTAR') apuntar(m,r.eje);
    else if (r.tipo==='APUNTAR_BLOQUEADO') bloqueado(m,r);
    else estirar(m,r,distancia);
    if (f<1) mezclar(antes,m,f);
  };
}
