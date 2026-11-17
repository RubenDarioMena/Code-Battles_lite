const vertexShader = `
attribute float tam;
attribute float alfa;
attribute float forma;
attribute vec3 tinte;
uniform float escala;
uniform float maxPunto;
varying float vAlfa;
varying float vForma;
varying vec3 vColor;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(tam * escala / max(0.01, -mvPosition.z), 1.0, maxPunto);
  vAlfa = alfa; vForma = forma; vColor = tinte;
  #include <fog_vertex>
}`;
const fragmentShader = `
varying float vAlfa;
varying float vForma;
varying vec3 vColor;
uniform float aditiva;
#include <fog_pars_fragment>
void main() {
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (r > 1.0) discard;
  float sello = vForma < 0.5 ? pow(1.0-r, 2.0)
    : (vForma < 1.5 ? 1.0-smoothstep(0.75, 1.0, r) : pow(1.0-r*r, 3.0));
  gl_FragColor = vec4(vColor, vAlfa * sello);
  // Salida sRGB antes de la niebla, como los materiales de r180.
  #include <colorspace_fragment>
  // La luz aditiva se desvanece hacia negro, no hacia el color de niebla.
  #include <fog_fragment>
  #ifdef USE_FOG
    if (aditiva > 0.5) gl_FragColor.rgb -= fogColor * fogFactor;
  #endif
}`;

/** Dos búferes fijos; no consulta DOM ni crea un renderizador.
 * alturaBufer está en píxeles físicos; pixelRatio convierte alturaCss al redimensionar.
 * maxPunto debe venir de gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1].
 * @param {any} THREE @param {any} grupo
 * @param {{pixelRatio?: number, alturaBufer: number, fov: number, capacidad?: number, maxPunto?: number}} opciones */
export function crearDibujanteEfectos(THREE, grupo, { pixelRatio = 1, alturaBufer, fov, capacidad = 2000, maxPunto = 64 }) {
  if (!Number.isInteger(capacidad) || capacidad < 1) throw new Error('capacidad debe ser un entero positivo');
  const escala = alturaBufer / (2 * Math.tan(fov * Math.PI / 360));
  const nubes = ['normal', 'suma'].map((mezcla, i) => {
    const geometria = new THREE.BufferGeometry();
    for (const [nombre, ancho] of [['position', 3], ['tinte', 3], ['tam', 1], ['alfa', 1], ['forma', 1]]) {
      const atributo = new THREE.BufferAttribute(new Float32Array(capacidad * Number(ancho)), ancho);
      atributo.setUsage(THREE.DynamicDrawUsage);
      geometria.setAttribute(nombre, atributo);
    }
    geometria.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        escala: { value: escala }, maxPunto: { value: maxPunto }, aditiva: { value: i } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, fog: true,
      blending: mezcla === 'suma' ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const puntos = new THREE.Points(geometria, material);
    puntos.raycast = () => {};
    puntos.frustumCulled = false;
    puntos.renderOrder = 2 + i;
    grupo.add(puntos);
    return { mezcla, geometria, material, puntos, usados: 0 };
  });
  const color = new THREE.Color();
  let destruido = false;
  return {
    /** @param {import('../vfx/index.js').Particula[]} particulas */
    dibujar(particulas) {
      if (destruido) return;
      for (const n of nubes) n.usados = 0;
      for (const p of particulas) {
        const n = nubes[p.mezcla === 'suma' ? 1 : 0];
        if (n.usados >= capacidad) continue;
        const i = n.usados++, a = n.geometria.attributes;
        a.position.setXYZ(i, p.x, p.z, p.y);
        // VFX comparte RGB sRGB con el lienzo 2D; el shader necesita Linear-sRGB.
        color.setRGB(...p.color, THREE.SRGBColorSpace);
        a.tinte.setXYZ(i, color.r, color.g, color.b);
        a.tam.setX(i, p.tam); a.alfa.setX(i, p.alfa);
        a.forma.setX(i, p.forma === 'brillo' ? 0 : (p.forma === 'disco' ? 1 : 2));
      }
      for (const n of nubes) {
        for (const a of Object.values(n.geometria.attributes)) /** @type {any} */ (a).needsUpdate = true;
        n.geometria.setDrawRange(0, n.usados);
      }
    },
    redimensionar({ alturaCss, fov: nuevoFov = fov, pixelRatio: ratio = pixelRatio }) {
      const valor = alturaCss * ratio / (2 * Math.tan(nuevoFov * Math.PI / 360));
      for (const n of nubes) n.material.uniforms.escala.value = valor;
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      for (const n of nubes) { grupo.remove(n.puntos); n.geometria.dispose(); n.material.dispose(); }
    },
  };
}
