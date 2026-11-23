// Matrices afines por columnas. Los destinos y el espacio de trabajo pertenecen al solver.
export const identidad = new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
export const matriz = () => identidad.slice();
export const vector = () => new Float64Array(3);
export const punto = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export function cruz(out,a,b) {
  const x = a[1]*b[2]-a[2]*b[1], y = a[2]*b[0]-a[0]*b[2], z = a[0]*b[1]-a[1]*b[0];
  out[0]=x; out[1]=y; out[2]=z;
}
export function normalizar(v) {
  const n = Math.sqrt(punto(v,v));
  if (n) for (let i=0;i<3;i++) v[i] /= n;
  return n;
}
export function direccion(out,m,v) {
  const x=v[0], y=v[1], z=v[2];
  for (let i=0;i<3;i++) out[i]=m[i]*x+m[4+i]*y+m[8+i]*z;
}
export function producto(out,a,b) {
  // Admite out === b. La traslación se compone solo en la cuarta columna.
  for (let j=0;j<16;j+=4) {
    const x=b[j], y=b[j+1], z=b[j+2];
    for (let i=0;i<3;i++) out[j+i]=a[i]*x+a[i+4]*y+a[i+8]*z+(j===12?a[i+12]:0);
  }
}
export function inversa(out,m) {
  const a=m[0], b=m[4], c=m[8], d=m[1], e=m[5], f=m[9], g=m[2], h=m[6], i=m[10];
  const A=e*i-f*h, B=f*g-d*i, C=d*h-e*g, det=a*A+b*B+c*C;
  if (!det) throw Error('Matriz de padre singular');
  out[0]=A/det; out[4]=(c*h-b*i)/det; out[8]=(b*f-c*e)/det;
  out[1]=B/det; out[5]=(a*i-c*g)/det; out[9]=(c*d-a*f)/det;
  out[2]=C/det; out[6]=(b*g-a*h)/det; out[10]=(a*e-b*d)/det;
  for (let k=0;k<3;k++) out[12+k]=-(out[k]*m[12]+out[4+k]*m[13]+out[8+k]*m[14]);
}
export function rotacion(m,x,y,z,w) {
  m[0]=1-2*(y*y+z*z); m[4]=2*(x*y-z*w); m[8]=2*(x*z+y*w);
  m[1]=2*(x*y+z*w); m[5]=1-2*(x*x+z*z); m[9]=2*(y*z-x*w);
  m[2]=2*(x*z-y*w); m[6]=2*(y*z+x*w); m[10]=1-2*(x*x+y*y);
}
export function ejeAngulo(m,eje,a) {
  const s=Math.sin(a/2);
  rotacion(m,eje[0]*s,eje[1]*s,eje[2]*s,Math.cos(a/2));
}
export function escalar(m,x,y,z) {
  for (let i=0;i<3;i++) { m[i]*=x; m[4+i]*=y; m[8+i]*=z; }
}
export function trs(t,r,s) {
  const m=matriz();
  rotacion(m,r[0],r[1],r[2],r[3]); escalar(m,s[0],s[1],s[2]); m.set(t,12);
  return m;
}

// glTF también permite codificar una TRS como matrix. Conservamos los 16
// elementos originales para evaluar y extraemos los canales solo al leer.
export function leerTransformacion(nodo) {
  if (!nodo.matrix) {
    const t = nodo.translation ?? [0,0,0], r = nodo.rotation ?? [0,0,0,1], s = nodo.scale ?? [1,1,1];
    return { t, r, s, reposo: trs(t,r,s) };
  }
  const reposo = new Float64Array(nodo.matrix);
  const columnas = [0,4,8].map(j => reposo.slice(j,j+3));
  const s = columnas.map(normalizar);
  const [x,y,z] = columnas;
  const normal = vector();
  cruz(normal,x,y);
  if (punto(normal,z)<0) {
    s[0] = -s[0];
    for (let i=0;i<3;i++) x[i] = -x[i];
  }
  // Completar la base si algún canal de escala vale cero.
  const vivos = s.map((valor,i)=>valor ? i : -1).filter(i=>i>=0);
  if (vivos.length === 1) {
    const i = vivos[0], eje = columnas[i], otro = columnas[(i+1)%3];
    const semilla = Math.abs(eje[0]) < .8 ? [1,0,0] : [0,1,0];
    cruz(otro,eje,semilla); normalizar(otro);
  }
  if (vivos.length) {
    for (let i=0;i<3;i++) if (!punto(columnas[i],columnas[i]))
      cruz(columnas[i],columnas[(i+1)%3],columnas[(i+2)%3]);
  } else { x[0]=1; y[1]=1; z[2]=1; }
  const diagonal = [1+x[0]-y[1]-z[2],1-x[0]+y[1]-z[2],1-x[0]-y[1]+z[2],1+x[0]+y[1]+z[2]];
  const i = diagonal.indexOf(Math.max(...diagonal));
  const productos = [
    [diagonal[0],x[1]+y[0],x[2]+z[0],y[2]-z[1]],
    [x[1]+y[0],diagonal[1],y[2]+z[1],z[0]-x[2]],
    [x[2]+z[0],y[2]+z[1],diagonal[2],x[1]-y[0]],
    [y[2]-z[1],z[0]-x[2],x[1]-y[0],diagonal[3]]
  ];
  const r = productos[i].map(valor => valor/(2*Math.sqrt(diagonal[i])));
  return { t: Array.from(reposo.slice(12,15)), r, s, reposo };
}

// Factor ortogonal de la descomposición polar. El cuaternión que maximiza
// tr(Rᵀ M) es el autovector máximo de la matriz simétrica de Davenport.
// Jacobi también permite descomponer una base singular, sin invertirla.
function polar(m,q,p,k,v,rot) {
  const a=m[0], b=m[4], c=m[8], d=m[1], e=m[5], f=m[9], g=m[2], h=m[6], i=m[10];
  const signo = a*(e*i-f*h)+b*(f*g-d*i)+c*(d*h-e*g)<0 ? -1 : 1;
  k[0]=a-e-i; k[5]=e-a-i; k[10]=i-a-e; k[15]=a+e+i;
  k[1]=k[4]=d+b; k[2]=k[8]=g+c; k[3]=k[12]=h-f;
  k[6]=k[9]=h+f; k[7]=k[13]=c-g; k[11]=k[14]=d-b;
  v.set(identidad);
  for (let iter=0;iter<48;iter++) {
    let u=0,w=1;
    for (let x=0;x<4;x++) for (let y=x+1;y<4;y++)
      if (Math.abs(k[4*x+y])>Math.abs(k[4*u+w])) { u=x; w=y; }
    const off=k[4*u+w];
    if (Math.abs(off)<1e-15) break;
    const ang=Math.atan2(2*off,k[5*w]-k[5*u])/2, cs=Math.cos(ang), sn=Math.sin(ang);
    for (let j=0;j<4;j++) {
      const x=k[4*u+j], y=k[4*w+j];
      k[4*u+j]=cs*x-sn*y; k[4*w+j]=sn*x+cs*y;
    }
    for (let j=0;j<4;j++) {
      const x=k[4*j+u], y=k[4*j+w];
      k[4*j+u]=cs*x-sn*y; k[4*j+w]=sn*x+cs*y;
      const vx=v[4*j+u], vy=v[4*j+w];
      v[4*j+u]=cs*vx-sn*vy; v[4*j+w]=sn*vx+cs*vy;
    }
    k[4*u+w]=k[4*w+u]=0;
  }
  let best=0;
  for (let j=1;j<4;j++) if (signo*k[5*j]>signo*k[5*best]) best=j;
  for (let j=0;j<4;j++) q[j]=v[4*j+best];
  rotacion(rot,q[0],q[1],q[2],q[3]);
  for (let col=0;col<3;col++) for (let row=0;row<3;row++)
    p[4*col+row]=rot[4*row]*m[4*col]+rot[4*row+1]*m[4*col+1]+rot[4*row+2]*m[4*col+2];
}

export function crearMezcla() {
  const qa=new Float64Array(4), qb=qa.slice(), pa=matriz(), pb=matriz();
  const k=matriz(), v=matriz(), rot=matriz();
  return (a,b,f) => {
    polar(a,qa,pa,k,v,rot); polar(b,qb,pb,k,v,rot);
    const d=punto(qa,qb)+qa[3]*qb[3], ang=Math.acos(Math.min(1,Math.abs(d)));
    const den=Math.sin(ang);
    const wa=den>1e-8?Math.sin((1-f)*ang)/den:1-f;
    const wb=(den>1e-8?Math.sin(f*ang)/den:f)*(d<0?-1:1);
    for (let j=0;j<4;j++) qa[j]=qa[j]*wa+qb[j]*wb;
    rotacion(rot,qa[0],qa[1],qa[2],qa[3]);
    for (let j=0;j<12;j++) pa[j]+=(pb[j]-pa[j])*f;
    producto(b,rot,pa);
    for (let j=12;j<15;j++) b[j]=a[j]; // estas restricciones conservan el origen
  };
}
