import { ARMAS } from '../../paquetes/destruccion/index.js';
// Las geometrías se crean directamente en los ejes locales del núcleo. El grupo
// de la escena hace la rotación única (x,y,z) -> (x,z,-y).
const TOPE = 12;
const acabados = {
  acero: ['#8696a2', .33], cobre: ['#bd794e', .47], circuito: ['#315e50', .15],
  cristal: ['#80dde7', .88], bateria: ['#9d9758', .20],
};
const vert = `
out vec3 vLocal;
out vec3 vNormal;
void main(){
  vLocal=position; vNormal=normal;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const frag = `
precision highp sampler3D;
uniform sampler3D mascara, pelicula;
uniform int tienePelicula;
uniform vec3 caja, dim, tinte, interior, ojo, lente;
uniform float celda, edad, normalidad, opacidad, brillo, flash, tieneLente, grosor;
uniform int tipoForma, ejeCil, n, usarMascara, casco;
uniform vec4 inicio[${TOPE}], fin[${TOPE}];
uniform vec3 meta[${TOPE}];
uniform mat4 alMundo, alClip;
uniform mat3 normales;
in vec3 vLocal;
in vec3 vNormal;
out vec4 color;
float forma(vec3 p){
  if(tipoForma==0) return max(max(abs(p.x)-caja.x,abs(p.y)-caja.y),abs(p.z)-caja.z);
  if(tipoForma==1) return length(p)-caja.x;
  vec2 radial=ejeCil==0?p.yz:ejeCil==1?p.xz:p.xy;
  float r=ejeCil==0?caja.y:caja.x;
  return max(length(radial)-r,abs(p[ejeCil])-caja[ejeCil]);
}
// Ruido de valor 3D suave (trilineal con curva quíntica) y su suma de octavas.
float h3(vec3 c){ return fract(sin(dot(c,vec3(127.1,311.7,74.7)))*43758.5453); }
float ruido(vec3 p){
  vec3 i=floor(p), f=fract(p), u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),u.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),u.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),u.x),u.y),u.z);
}
// Octavas que se apagan cuando su detalle es menor que un píxel (fwidth), para que no centelleen.
float fbm(vec3 p,float px){
  float s=0., a=.5, w=0.;
  for(int o=0;o<3;o++){
    float k=1.-smoothstep(.25,.6,px);
    s+=a*k*ruido(p); w+=a*k; p*=2.03; px*=2.03; a*=.5;
  }
  return w>0.?s/w:.5;
}
float distancia(vec3 p,int i){
  vec3 a=inicio[i].xyz, ab=fin[i].xyz-a;
  if(meta[i].x==3.){
    float h=max(.00001,length(ab));
    float z=dot(p-a,ab/h);
    return max(length(p-a-z*ab/h)-inicio[i].w,max(-z,z-h));
  }
  float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.0000001),0.,1.);
  return length(p-a-t*ab)-inicio[i].w;
}
// El ácido no recorta por su SDF: lo hace la máscara de celdas, que es la verdad del núcleo
// (su radio irregular sale de un hash por celda). El SDF del ácido solo colorea el borde.
vec2 voxel(vec3 p){
  ivec3 i=ivec3(clamp(floor(p/celda+dim*.5),vec3(0.),dim-1.));
  return texelFetch(mascara,i,0).rg;
}
bool materialVivo(vec3 p){
  // Una celda solo está quitada si tuvo material (canal g) y ya no lo tiene (canal r). Junto a la
  // superficie curva de un cilindro, las celdas de fuera de la forma bajan los dos canales a la vez al
  // filtrar: comparar r con g evita pintar allí franjas de corte.
  if(usarMascara==1){
    vec2 m=casco==1 ? voxel(p) : texture(mascara,p/(dim*celda)+.5).rg;
    if(casco==1 ? m.r<.47 : m.r<.47*m.g) return false;
  }
  for(int i=0;i<${TOPE};i++){
    if(i>=n) break;
    if(meta[i].x<2. && distancia(p,i)<0.) return false;
  }
  return true;
}
void main(){
  vec3 p=vLocal, dir=normalize(p-ojo), normalLocal=normalize(vNormal);
  bool tapa=!gl_FrontFacing, imprimacion=false;
  // En un corte, buscar la primera pared interior a lo largo del píxel.
  // Un canal abierto por ambos lados deja ver lo que hay detrás.
  if(!materialVivo(p)){
    if(tapa) discard;
    bool encontrado=false;
    float salto=celda*.22;
    int pasos=int(ceil(2.*length(caja)/salto))+1;
    for(int j=0;j<pasos;j++){
      p+=dir*salto;
      if(forma(p)>.0001) break;
      if(materialVivo(p)){encontrado=true;break;}
    }
    if(!encontrado) discard;
    vec3 anterior=p-dir*salto;
    for(int j=0;j<5;j++){
      vec3 m=(p+anterior)*.5;
      if(materialVivo(m))p=m;else anterior=m;
    }
    vec3 centroVecino=(floor(anterior/celda+dim*.5)+.5-dim*.5)*celda;
    imprimacion=casco==1 && voxel(anterior).g<.5 && forma(centroVecino)<-grosor;
    if(imprimacion){
      vec3 cambio=floor(anterior/celda+dim*.5)-floor(p/celda+dim*.5);
      normalLocal=length(cambio)>.5 ? normalize(cambio) : -dir;
    }else normalLocal=-dir;
    tapa=true;
  }
  vec4 mundo=alMundo*vec4(p,1.);
  if(mundo.y<0.) discard;
  vec4 clip=alClip*vec4(p,1.);
  gl_FragDepth=clip.z/clip.w*.5+.5;
  vec3 N=normalize(normales*normalLocal);
  float luz=max(dot(N,normalize(vec3(-.45,.9,.55))),0.);
  vec3 base=tinte;
  if(tieneLente>.5 && p.y<0. && abs(normalLocal.y)>.65){
    float r=length(p.xz-lente.xz);
    if(r<.089)base=vec3(.035,.055,.067);
    if(r<.068)base=mix(vec3(.025,.23,.28),vec3(.55,.97,1.),exp(-24.*length(p.xz-lente.xz-vec2(-.021,.023))));
  }
  vec3 rgb=base*(mix(.46,.85,normalidad)+luz*.72)
    + vec3(.95,.85,.67)*pow(max(dot(N,normalize(vec3(-.33,.68,.66))),0.),18.)*brillo;
  if(tapa)rgb=interior*.24+vec3(.015);
  if(imprimacion) rgb=vec3(.19,.115,.091)*(.6+.55*luz);
  float px=length(fwidth(p));
  for(int i=0;i<${TOPE};i++){
    if(i>=n || imprimacion)break;
    float d=distancia(p,i), tiempo=max(0.,edad-meta[i].y);
    if(meta[i].x==1.){
      // Láser: un anillo estrecho (≈1,6 cm) que se enfría de naranja a carbón; dentro del canal, las paredes.
      float borde=1.-smoothstep(.002,.016,abs(d));
      rgb=mix(rgb,mix(vec3(1.9,.37,.018),vec3(.047,.028,.02),smoothstep(.18,3.5,tiempo)),borde);
    }
    if(meta[i].x>=2.){
      // Ácido, de fuera adentro: metal sano, aureola mate y oscura con picaduras, borde verde con espuma, hueco.
      float activo=1.-smoothstep(meta[i].z,meta[i].z+3.,tiempo);
      float irregular=d+.022*(fbm(p*38.,px*38.)-.5);
      float aureola=1.-smoothstep(0.,.075,irregular);
      float picaduras=smoothstep(.62,.78,fbm(p*120.+7.,px*120.))*aureola;
      vec3 corroido=rgb*mix(.62,.28,aureola)+vec3(.035,.04,.02)*aureola;
      corroido*=1.-.55*picaduras;
      rgb=mix(rgb,corroido,aureola);
      float filo=1.-smoothstep(.0,.014,abs(irregular-.004));
      float espuma=fbm(p*70.+vec3(0.,tiempo*.35,tiempo*.2),px*70.);
      vec3 verde=vec3(.10,.34,.03)+vec3(.40,.70,.05)*smoothstep(.45,.85,espuma);
      vec3 costra=vec3(.16,.10,.05)+vec3(.08,.05,.02)*espuma;
      rgb=mix(rgb,mix(costra,verde,activo),filo);
      if(tapa) rgb=mix(rgb,mix(vec3(.05,.035,.02),vec3(.06,.16,.02),activo),.7*(1.-smoothstep(0.,.05,abs(d))));
    }
  }
  if(tienePelicula==1 && !imprimacion){
    vec2 huella=texture(pelicula,p/(dim*celda)+.5).rg;
    float d=(huella.r-.5)*4.*celda;
    float borde=1.-smoothstep(.003,.026,abs(d+.008*(fbm(p*38.,px*38.)-.5)));
    float espuma=fbm(p*70.+vec3(0.,edad*.35,0.),px*70.);
    rgb=mix(rgb,rgb*.48,1.-smoothstep(0.,.07,d));
    rgb=mix(rgb,mix(vec3(.16,.10,.05),vec3(.15,.44,.035)+espuma*.3,huella.g),borde);
  }
  color=vec4(rgb*(1.+flash*.65),opacidad);
  color=sRGBTransferOETF(color);
}`;
export function superficie(T, p) {
  const f = p.forma;
  let geo, eje = 2;
  if (f.tipo === 'caja') geo = new T.BoxGeometry(...f.medidas);
  else if (f.tipo === 'esfera') geo = new T.SphereGeometry(f.radio, 40, 28);
  else {
    geo = new T.CylinderGeometry(f.radio, f.radio, f.alto, 48);
    eje = ['x', 'y', 'z'].indexOf(f.eje);
    if (eje === 0) geo.rotateZ(Math.PI / 2);
    if (eje === 2) geo.rotateX(Math.PI / 2);
  }
  geo.computeBoundingBox();
  const vec = (...v) => new T.Vector3(...v);
  const textura = new T.Data3DTexture(new Uint8Array(2 * p.dim.reduce((a, b) => a * b, 1)), ...p.dim);
  textura.format = T.RGFormat; textura.minFilter = textura.magFilter = T.LinearFilter;
  textura.unpackAlignment = 1;
  let indice = 0;
  for (let i = 0; i < p.mascaraBase.length; i += 2) {
    const valor = p.mascaraBase[i] * 255;
    for (let j = 0; j < p.mascaraBase[i + 1]; j++, indice++) textura.image.data[2 * indice + 1] = valor;
  }
  const total = p.materiales.reduce((s, m) => s + m.cantidad, 0);
  const interior = new T.Color(0);
  let brillo = 0;
  for (const m of p.materiales) {
    const [color, reflejo] = acabados[m.material] ?? acabados.acero;
    const fraccion = m.cantidad / total;
    interior.add(new T.Color(color).multiplyScalar(fraccion)); brillo += reflejo * fraccion;
  }
  const uniformes = {
    tienePelicula: 0, pelicula: textura, mascara: textura, caja: geo.boundingBox.max.clone(), dim: vec(...p.dim), celda: p.celda,
    tinte: new T.Color(p.color), ojo: vec(), lente: vec(...(p.zonaFuncion?.pos ?? [0, 0, 0])),
    tieneLente: p.funcionOriginal === 'sensor' ? 1 : 0,
    brillo, interior, casco: Number(!!f.hueco), grosor: f.hueco ?? 0,
    edad: 0, normalidad: 0, opacidad: 1, flash: 0, tipoForma: f.tipo === 'caja' ? 0 : f.tipo === 'esfera' ? 1 : 2, ejeCil: eje,
    usarMascara: 0, n: 0, inicio: Array.from({ length: TOPE }, () => new T.Vector4()),
    fin: Array.from({ length: TOPE }, () => new T.Vector4()), meta: Array.from({ length: TOPE }, () => new T.Vector3()),
    alMundo: new T.Matrix4(), alClip: new T.Matrix4(), normales: new T.Matrix3(),
  };
  const uniforms = Object.fromEntries(Object.entries(uniformes).map(([k, value]) => [k, { value }]));
  const material = new T.ShaderMaterial({
    glslVersion: T.GLSL3, vertexShader: vert, fragmentShader: frag,
    uniforms, side: T.DoubleSide
  });
  const mesh = new T.Mesh(geo, material);
  mesh.onBeforeRender = (_r, _s, camera) => {
    uniforms.ojo.value.copy(camera.position); mesh.worldToLocal(uniforms.ojo.value);
    uniforms.alMundo.value.copy(mesh.matrixWorld);
    uniforms.alClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    uniforms.normales.value.getNormalMatrix(mesh.matrixWorld);
  };
  let version = -1, pelicula;
  return {
    mesh, actualizar(q, tiempo, terminada, flash) {
      mesh.visible = q.opacidad > 0;
      mesh.position.fromArray(q.pos); mesh.position.z -= q.hundimiento;
      mesh.quaternion.fromArray(q.rot);
      uniforms.opacidad.value = q.opacidad; uniforms.edad.value = tiempo;
      uniforms.normalidad.value = Number(terminada); uniforms.flash.value = flash;
      const transparente = q.opacidad < 1;
      if (material.transparent !== transparente) { material.transparent = transparente; material.depthWrite = !transparente; material.needsUpdate = true; }
      if (version !== q.version) {
        version = q.version;
        let offset = 0;
        for (let i = 0; i < q.mascara.length; i += 2) {
          const valor = q.mascara[i] ? 255 : 0;
          for (let j = 0; j < q.mascara[i + 1]; j++, offset++) textura.image.data[2 * offset] = valor;
        }
        textura.needsUpdate = true;
        uniforms.usarMascara.value = Number(!!f.hueco || q.celdas < q.celdasIniciales);
      }
      if (q.pelicula) {
        if (!pelicula) {
          const datos = new Uint8Array(textura.image.data.length);
          for (let i = 0; i < datos.length; i += 2) datos[i] = 255;
          pelicula = new T.Data3DTexture(datos, ...q.dim);
          pelicula.format = T.RGFormat; pelicula.unpackAlignment = 1;
          pelicula.minFilter = pelicula.magFilter = T.LinearFilter;
          uniforms.pelicula.value = pelicula; uniforms.tienePelicula.value = 1;
        }
        for (const [i, muestra] of Object.entries(q.pelicula)) {
          const offset = 2 * Number(i), [d, fin] = muestra;
          pelicula.image.data[offset] = Math.round(255 * Math.max(0, Math.min(1, .5 + d/(4*q.celda))));
          pelicula.image.data[offset+1] = Math.round(255 * Math.max(0, Math.min(1, 1-(tiempo-fin)/3)));
        }
        pelicula.needsUpdate = true;
      }
      const recientes = q.volumenes.slice(-TOPE);
      uniforms.n.value = recientes.length;
      recientes.forEach((v, i) => {
        uniforms.inicio.value[i].set(...v.a, v.radio); uniforms.fin.value[i].set(...v.b, 0);
        uniforms.meta.value[i].set(v.fuente === 'charco' ? 3 : v.tipo === 'laser' ? 1 : v.tipo === 'acido' ? 2 : 0, v.paso / 60, v.duracion ?? ARMAS.acido.duracion);
      });
    }, destruir() { pelicula?.dispose(); textura.dispose(); material.dispose(); geo.dispose(); }
  };
}
