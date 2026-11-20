import { crearTramos } from './chorro-vista.js';
import { ARMAS, CHARCO, radioDelCharco } from '../../paquetes/destruccion/index.js';

function decal(T, c) {
  const geo = new T.CircleGeometry(1, 64), pos = geo.attributes.position;
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tiempo: { value: 0 }, secado: { value: 0 }, activo: { value: 1 }, fase: { value: (c.id % 379) / 17 } },
    vertexShader: `
      varying vec2 disco;
      void main(){ disco=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 disco;
      uniform float tiempo, secado, activo, fase;
      float h(vec2 v){return fract(sin(dot(v,vec2(41.3,79.1))+fase)*4857.2);}
      void main(){
        float r=length(disco), borde=smoothstep(.84,.98,r);
        vec2 p=disco*5., i=floor(p);
        vec2 centro=.23+.54*vec2(h(i),h(i+17.));
        float ciclo=fract(tiempo*.32+h(i+2.));
        float d=length(fract(p)-centro), radio=.16*sqrt(ciclo);
        float burbuja=(1.-smoothstep(.014,.042,abs(d-radio)))*sin(3.14159*ciclo);
        float brillo=pow(.5+.5*sin(disco.x*18.+disco.y*29.+sin(disco.y*12.+tiempo*.7)),9.);
        vec3 liquido=mix(vec3(.068,.26,.019),vec3(.39,.77,.064),borde)+vec3(.16,.27,.08)*brillo+vec3(.47,.64,.2)*burbuja;
        vec3 costra=vec3(.12,.075,.033)*(.8+.2*brillo);
        gl_FragColor=vec4(mix(costra,liquido,activo),(1.-secado)*(.94-.1*borde));
        #include <colorspace_fragment>
      }`
  });
  const mesh = new T.Mesh(geo, material);
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.name = 'charco';
  let radio = -1;
  function actualizar(c, tiempo) {
    mesh.position.set(c.centro[0], c.centro[1], .003);
    if (radio !== c.radio) {
      radio = c.radio;
      for (let i = 1; i < pos.count; i++) {
        const angulo = (i - 1) * Math.PI / 32, x = Math.cos(angulo), y = Math.sin(angulo);
        const r = radioDelCharco(c, x, y);
        pos.setXYZ(i, x*r, y*r, 0);
      }
      pos.needsUpdate = true;
    }
    material.uniforms.tiempo.value = tiempo;
    material.uniforms.activo.value = Number(c.activo);
    material.uniforms.secado.value = Math.min(1, (c.inactivoDesde ?? 0) / CHARCO.mancha);
  }
  return { mesh, actualizar, destruir() { geo.dispose(); material.dispose(); } };
}
export function crearAcidoVista(T, grupo) {
  const decales = new Map(), explosiones = [], auxiliar = new T.Object3D();
  const eje = new T.Vector3(0, 1, 0), dir = new T.Vector3();
  const geo = new T.SphereGeometry(1, 12, 8);
  const material = new T.MeshStandardMaterial({ color: '#b1fa43', emissive: '#7bdd22', emissiveIntensity: 1.1,
    roughness: .15, transparent: true, opacity: .82, depthWrite: false });
  const emisores = new Map(), tramos = crearTramos(T, grupo);
  const tubo = new T.CylinderGeometry(.043, .065, .29, 12);
  const acero = new T.MeshStandardMaterial({ color: '#84989b', metalness: .35, roughness: .34 });
  const luz = new T.PointLight(0x9dff4d, 0, 1.8); grupo.add(luz);
  let lote;
  function reservar(n) {
    if (lote && lote.instanceMatrix.count >= n) return;
    if (lote) { grupo.remove(lote); lote.dispose(); }
    lote = new T.InstancedMesh(geo, material, Math.max(n, ARMAS.chorro.gotasMax));
    lote.frustumCulled = false; lote.renderOrder = 2; lote.name = 'acido-en-vuelo'; grupo.add(lote);
  }
  let i = 0;
  function esfera(pos, r, largo = r, velocidad = [0, 0, 1], retroceso = 0) {
    dir.fromArray(velocidad).normalize();
    auxiliar.position.fromArray(pos).addScaledVector(dir, -retroceso);
    auxiliar.quaternion.setFromUnitVectors(eje, dir); auxiliar.scale.set(r, largo, r);
    auxiliar.updateMatrix(); lote.setMatrixAt(i++, auxiliar.matrix);
  }
  function montarEmisor(em) {
    if (emisores.has(em.disparo)) return;
    const m = new T.Mesh(tubo, acero); m.name = 'emisor-chorro';
    dir.fromArray(em.direccion); m.position.fromArray(em.origen).addScaledVector(dir, -.145);
    m.quaternion.setFromUnitVectors(eje, dir);
    grupo.add(m); emisores.set(em.disparo, m);
  }
  function limpiar() {
    tramos.limpiar(); explosiones.length = 0; luz.intensity = 0;
    for (const m of emisores.values()) grupo.remove(m);
    emisores.clear();
    for (const d of decales.values()) { grupo.remove(d.mesh); d.destruir(); }
    decales.clear(); if (lote) lote.count = 0;
  }
  function dibujar(e, sucesos) {
    for (const s of sucesos) if (s.tipo === 'salpicadura' && e.paso - s.paso < 18) explosiones.push(s);
    while (explosiones.length && e.paso - explosiones[0].paso >= 18) explosiones.shift();
    reservar(e.proyectiles.length*2 + e.emisores.length + explosiones.length*(ARMAS.granada.satelites+1)); i = 0;
    for (const q of e.proyectiles) {
      if (q.tipo === 'granada') {
        esfera(q.pos, .053);
        esfera(q.pos, .024, .10, q.velocidad, .09);
      }
    }
    tramos.dibujar(e, sucesos, esfera);
    const activos = new Set(e.proyectiles.filter(q => q.tipo === 'gota').map(q => q.disparo));
    for (const em of e.emisores) {
      activos.add(em.disparo);
      montarEmisor(em);
      esfera(em.origen, .035*em.presion, .025, em.direccion);
    }
    for (const [id, m] of emisores) if (!activos.has(id)) { grupo.remove(m); emisores.delete(id); }
    luz.intensity = 0;
    for (const s of explosiones) {
      const f = (e.paso-s.paso)/18, pos = s.datos.pos;
      esfera(pos, .1*(1-f)**3);
      luz.position.fromArray(pos); luz.position.z += .1; luz.intensity = 3*(1-f)**3;
      for (const h of s.datos.impactos) {
        const p = pos.map((v, k) => v+(h.fin[k]-v)*f);
        const n = s.datos.normal ?? [0, 0, 1];
        for (let k = 0; k < 3; k++) p[k] += n[k] * ARMAS.granada.alturaRebote * Math.sin(Math.PI*f);
        esfera(p, .024*(1-f));
      }
    }
    lote.count = i; lote.instanceMatrix.needsUpdate = true;
    const presentes = new Set();
    for (const c of e.charcos) {
      presentes.add(c.id);
      if (!decales.has(c.id)) {
        const d = decal(T, c); decales.set(c.id, d); grupo.add(d.mesh);
      }
      decales.get(c.id).actualizar(c, e.tiempo);
    }
    for (const [id, d] of decales) if (!presentes.has(id)) {
      grupo.remove(d.mesh); d.destruir(); decales.delete(id);
    }
  }
  return { limpiar, dibujar, montarEmisor };
}
