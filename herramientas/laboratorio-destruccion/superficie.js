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
uniform sampler3D mascara;
uniform vec3 caja, dim, tinte, interior, ojo, lente;
uniform float celda, edad, normalidad, opacidad, brillo, flash, tieneLente, duracionAcido;
uniform int tipoForma, ejeCil, n, usarMascara;
uniform vec4 inicio[${TOPE}], fin[${TOPE}];
uniform vec2 meta[${TOPE}];
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
  float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.0000001),0.,1.);
  return length(p-a-t*ab)-inicio[i].w;
}
// El ácido no recorta por su SDF: lo hace la máscara de celdas, que es la verdad del núcleo
// (su radio irregular sale de un hash por celda). El SDF del ácido solo colorea el borde.
bool materialVivo(vec3 p){
  if(usarMascara==1 && texture(mascara,p/(dim*celda)+.5).r<.47) return false;
  for(int i=0;i<${TOPE};i++){
    if(i>=n) break;
    if(meta[i].x!=2. && distancia(p,i)<0.) return false;
  }
  return true;
}
void main(){
  vec3 p=vLocal, dir=normalize(p-ojo), normalLocal=normalize(vNormal);
  bool tapa=!gl_FrontFacing;
  // En un corte, buscar la primera pared interior a lo largo del píxel.
  // Un canal abierto por ambos lados deja ver lo que hay detrás.
  if(!materialVivo(p)){
    if(tapa) discard;
    bool encontrado=false;
    float salto=max(celda*.22,length(caja)*2./240.);
    for(int j=0;j<250;j++){
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
    normalLocal=-dir; tapa=true;
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
  float px=length(fwidth(p));
  for(int i=0;i<${TOPE};i++){
    if(i>=n)break;
    float d=distancia(p,i), tiempo=max(0.,edad-meta[i].y);
    if(meta[i].x==1.){
      // Láser: un anillo estrecho (≈1,6 cm) que se enfría de naranja a carbón; dentro del canal, las paredes.
      float borde=1.-smoothstep(.002,.016,abs(d));
      rgb=mix(rgb,mix(vec3(1.9,.37,.018),vec3(.047,.028,.02),smoothstep(.18,3.5,tiempo)),borde);
    }
    if(meta[i].x==2.){
      // Ácido, de fuera adentro: metal sano, aureola mate y oscura con picaduras, borde verde con espuma, hueco.
      float activo=1.-smoothstep(duracionAcido,duracionAcido+3.,tiempo);
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
  const textura = new T.Data3DTexture(new Uint8Array(p.dim.reduce((a, b) => a * b, 1)), ...p.dim);
  textura.format = T.RedFormat; textura.minFilter = textura.magFilter = T.LinearFilter;
  textura.unpackAlignment = 1;
  const total = p.materiales.reduce((s, m) => s + m.cantidad, 0);
  const interior = new T.Color(0);
  let brillo = 0;
  for (const m of p.materiales) {
    const [color, reflejo] = acabados[m.material] ?? acabados.acero;
    const fraccion = m.cantidad / total;
    interior.add(new T.Color(color).multiplyScalar(fraccion)); brillo += reflejo * fraccion;
  }
  const uniformes = {
    mascara: textura, caja: geo.boundingBox.max.clone(), dim: vec(...p.dim), celda: p.celda,
    tinte: new T.Color(p.color), ojo: vec(), lente: vec(...(p.zonaFuncion?.pos ?? [0, 0, 0])),
    tieneLente: p.funcionOriginal === 'sensor' ? 1 : 0,
    brillo, interior, duracionAcido: 2.4,
    edad: 0, normalidad: 0, opacidad: 1, flash: 0, tipoForma: f.tipo === 'caja' ? 0 : f.tipo === 'esfera' ? 1 : 2, ejeCil: eje,
    usarMascara: 0, n: 0, inicio: Array.from({ length: TOPE }, () => new T.Vector4()),
    fin: Array.from({ length: TOPE }, () => new T.Vector4()), meta: Array.from({ length: TOPE }, () => new T.Vector2()),
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
  let version = -1;
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
          const n = q.mascara[i + 1]; textura.image.data.fill(q.mascara[i] ? 255 : 0, offset, offset + n); offset += n;
        }
        textura.needsUpdate = true;
        uniforms.usarMascara.value = Number(q.celdas < q.celdasIniciales);
      }
      const recientes = q.volumenes.slice(-TOPE);
      uniforms.n.value = recientes.length;
      recientes.forEach((v, i) => {
        uniforms.inicio.value[i].set(...v.a, v.radio); uniforms.fin.value[i].set(...v.b, 0);
        uniforms.meta.value[i].set(v.tipo === 'laser' ? 1 : v.tipo === 'acido' ? 2 : 0, v.paso / 60);
      });
    }, destruir() { textura.dispose(); material.dispose(); geo.dispose(); }
  };
}
