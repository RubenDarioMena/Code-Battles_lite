// Maquetas de Campaign. Metros de tablero y unidades de daño del laboratorio.
export const nombres = { A:'Gavión', B:'Pie en T + Cordón', C:'Traba + Cordón', D:'Talud' };
export const golpes = { bajo:[1.6,1], medio:[3.5,1.4], misil:[5.5,2] };
const piedra='piedra', hormigon='hormigon', acero='acero';

export function construir(V,id) {
  if (!Object.hasOwn(nombres,id)) throw Error('Finalista desconocida');
  const m=V.crear({tam:.5});
  for(let i=0;i<5;i++) {
    const eje='módulo-'+i, x=i*7-17.5, nudo=i===2;
    m.eje(eje,[[x,0],[x+7,0]]);
    // El eje avanza al este. La distancia lateral positiva apunta al norte.
    function caja(u0,u1,y0,y1,z0,z1,material) {
      if(u1>u0 && y1>y0 && z1>z0) m.construir({eje,u0,u1,s0:-y1,s1:-y0,z0,z1,material});
    }
    function piso(z,h,d,mat) { caja(0,7,-d/2,d/2,z,h,mat); }
    function puesto(z,techo) {
      caja(1,6,-1.5,1.5,z,techo-2,piedra);
      caja(1,6,-1.5,1.5,techo-2,techo-.5,acero);
      caja(.5,6.5,-2,2,techo-.5,techo,hormigon);
    }
    if ((id==='B' && nudo) || (id==='C' && i===4)) {
      // Secciones de una corona ovalada. La zona central queda vacía hasta la base.
      for(let y=-3;y<3;y+=.5) {
        const cy=y+.25;
        const radio=(a,b)=>a*Math.sqrt(Math.max(0,1-(cy/b)**2));
        for(let z=0;z<16;z+=2) {
          const borde=radio(3.5,3), hueco=radio(2,1.5);
          caja(3.5-borde,3.5-hueco,y,y+.5,z,z+1.5,hormigon);
          caja(3.5+hueco,3.5+borde,y,y+.5,z,z+1.5,hormigon);
          caja(3.5-borde,3.5-hueco,y,y+.5,z+1.5,z+2,piedra);
          caja(3.5+hueco,3.5+borde,y,y+.5,z+1.5,z+2,piedra);
        }
      }
    } else if(id==='A') {
      for(let k=0;k<(nudo?4:3);k++) {
        const z=k*3.5, d=3.5-k*.5;
        piso(z,z+3.5,d*2,piedra);
        for(const lado of [-1,1]) {
          const y=lado>0?d:-d-.5;
          for(const u of [0,3.5]) caja(u,u+.5,y,y+.5,z,z+3.5,acero);
          caja(0,7,y,y+.5,z+1.5,z+2,acero);
        }
      }
      if(nudo) puesto(14,16);
    } else if(id==='B') {
      piso(0,1,4,hormigon); piso(1,2,2.5,hormigon);
      for(const [a,b] of [[0,2],[2.5,4.5],[5,7]]) caja(a,b,-.5,.5,2,10.5,hormigon);
    } else if(id==='C') {
      const alto=nudo?15:9.5;
      for(let z=0,k=0;z<alto;z+=2.5,k++) {
        const cortes=k%2?[0,2,5,7]:[0,3.5,7];
        for(let j=1;j<cortes.length;j++) {
          const a=cortes[j-1], b=cortes[j], d=nudo && !(k%2)?2.75:1.75;
          caja(a,b,-d,d,z,Math.min(z+2,alto),hormigon);
          caja(a,b,-d+.5,d-.5,Math.min(z+2,alto),Math.min(z+2.5,alto),piedra);
          if(j%2) caja(a,b-.5,d,d+.5,z,Math.min(z+2,alto),hormigon);
        }
      }
      for(const u of [0.5,2.5,4,6]) for(const y of [-1,.5])
        caja(u,u+1,y,y+1,alto,nudo?16:10.5,hormigon);
    } else {
      piso(0,2.5,10,piedra);
      caja(0,7,5,5.5,0,3,hormigon);
      for(let z=2.5;z<10;z+=.5) piso(z,z+.5,10-Math.floor(z-2)*1,piedra);
      piso(10,10.5,3,acero);
      if(nudo) {
        puesto(10.5,13.5);
        caja(1,1.5,-.5,0,13.5,16,acero);
      }
    }
  }
  return m;
}

export function paleta(V,tintas,id) {
  const colores={A:['tierra','dovela','pizarra'],B:['piedra','caliza','tinta'],
    C:['sillar','dovela','tinta'],D:['tierra','piedra','oliva']}[id];
  return V.paletaBase().map((m,i)=>{
    if (!m) return null;
    const rgb=V.colorDe(parseInt(tintas[colores[(i-1)%3]].slice(1),16));
    return {...m,color:rgb.map(c=>c*(i>3 ? .64 : 1))};
  });
}

export function golpear(m,x,y,z,t,tipo,radio=golpes[tipo][0]) {
  return m.romper(x,y,z,radio,golpes[tipo][1],{t,escombros:.08});
}

export function comparar(m) {
  const resultados=[];
  for(const [x,z,t] of [[-10.5,4,0],[0,6,.5]]) {
    m.paso(t);
    const r=golpear(m,x,1,z,t,"misil");
    resultados.push({quitados:r.quitados,estados:r.piezas.map(id=>m.piezas.find(p=>p.id===id).estado)});
  }
  m.paso(3);
  return resultados;
}

export function restaurar(V,m) {
  // Reintegrar los fragmentos móviles al reconstruir su volumen original.
  // El cascajo asentado fuera de la obra se conserva.
  const datos=m.serializar();
  datos.piezas=[];
  const reparada=V.cargar(datos);
  reparada.reparar();
  reparada.avanzar(Infinity);
  return reparada;
}
