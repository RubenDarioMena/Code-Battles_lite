/* Acabado de la muralla sobre Lambert de Three r128. Las medidas están en metros.
 * Los factores de luz multiplican por igual los tres canales del color de vértice. */
(() => {
  "use strict";
  const parametros = `
const vec2 SILLAR = vec2(0.86, 0.38);
const vec2 ALBARDILLA = vec2(1.1, 0.55);
const float MORTERO = 0.018;
const float BISEL = 0.022;
const vec2 LUZ_BISEL = vec2(0.55, 0.83);
const float LUZ_PIEDRA = 1.035;
const float SOMBRA_MORTERO = 0.43;
const float TONO_SILLAR = 0.23;
const float LUZ_RELIEVE = 0.16;
const float ESCALA_MANCHA = 0.39;
const float TONO_MANCHA = 0.10;

const vec2 PANEL = vec2(1.2, 0.6);
const float JUNTA_PANEL = 0.012;
const float SOMBRA_PANEL = 0.30;
const vec2 POS_LATIGUILLO = vec2(0.42, 0.18); // desde el centro, cuatro por panel
const float RADIO_LATIGUILLO = 0.019;
const float SOMBRA_LATIGUILLO = 0.40;
const float PASO_VETA = 0.17;
const float TONO_VETA = 0.022;

const vec2 PLANCHA = vec2(1.0, 2.0);
const float COSTURA = 0.014;
const float SOMBRA_COSTURA = 0.34;
const float MARGEN_REMACHE = 0.05;
const float PASO_REMACHE = 0.25;
const float RADIO_REMACHE = 0.019;
const float LUZ_REMACHE = 0.25;
const float PASO_RAYADO = 0.075;
const float TONO_RAYADO = 0.018;

const float GRANO_CASCAJO = 0.065;
const float LUZ_CASCAJO = 0.97;
const float TONO_CASCAJO = 0.30;
const float SUAVIZADO_MIN = 0.003;
`;

  const funciones = `
float hashMuro(vec2 id) {
  vec3 p = fract(vec3(id.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float ruidoValor(vec2 p) {
  vec2 id = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashMuro(id), hashMuro(id + vec2(1.0, 0.0)), f.x),
             mix(hashMuro(id + vec2(0.0, 1.0)), hashMuro(id + vec2(1.0)), f.x), f.y);
}

// Cobertura aproximada de una junta centrada en el borde, incluso si mide menos de un píxel.
float juntaMuro(float distancia, float ancho, float pixel) {
  return clamp((0.5 * (ancho + pixel) - distancia) / pixel, 0.0, min(1.0, ancho / pixel));
}

float detalleVisible(float paso, float pixel) {
  return 1.0 - smoothstep(0.25 * paso, paso, pixel);
}

float piedra(vec2 uv, bool cima, float pixel) {
  vec2 tam = cima ? ALBARDILLA : SILLAR;
  vec2 celda = uv / tam;
  celda.x += 0.5 * mod(floor(celda.y), 2.0);
  vec2 centro = fract(celda) - 0.5;
  vec2 borde = (0.5 - abs(centro)) * tam;
  float d = min(borde.x, borde.y);
  float junta = juntaMuro(d, MORTERO, pixel);
  // El canto más cercano da el gradiente del perfil del bisel en este punto.
  float luz = borde.x < borde.y ? sign(centro.x) * LUZ_BISEL.x : sign(centro.y) * LUZ_BISEL.y;
  float bisel = (1.0 - junta) * (1.0 - smoothstep(0.5 * MORTERO, 0.5 * MORTERO + BISEL, d));
  float tono = (hashMuro(floor(celda)) - 0.5) * TONO_SILLAR;
  float mancha = (ruidoValor(uv / ESCALA_MANCHA) - 0.5) * TONO_MANCHA;
  return LUZ_PIEDRA + tono * detalleVisible(tam.y, pixel) + mancha - SOMBRA_MORTERO * junta
         + LUZ_RELIEVE * luz * bisel * detalleVisible(2.0 * BISEL, pixel);
}

float hormigon(vec2 uv, float pixel) {
  vec2 centro = abs(mod(uv, PANEL) - 0.5 * PANEL);
  vec2 borde = 0.5 * PANEL - centro;
  float junta = juntaMuro(min(borde.x, borde.y), JUNTA_PANEL, pixel);
  float agujero = juntaMuro(length(centro - POS_LATIGUILLO), 2.0 * RADIO_LATIGUILLO, pixel);
  float veta = sin(6.283185 * uv.x / PASO_VETA + 0.7 * sin(uv.y));
  return 1.0 - SOMBRA_PANEL * junta - SOMBRA_LATIGUILLO * agujero
         + TONO_VETA * veta * detalleVisible(PASO_VETA, pixel);
}

float piedraPartida(vec2 uv, float pixel, bool hormigonRoto) {
  float grano = (ruidoValor(uv / 0.055) - 0.5) * detalleVisible(0.055, pixel);
  vec2 veta = vec2(uv.x + 0.48 * uv.y + 0.10 * ruidoValor(uv / 0.14), uv.y);
  float distancia = abs(fract(veta.x / 0.73) - 0.5) * 0.73;
  float grieta = juntaMuro(distancia, 0.007, pixel) * smoothstep(0.44, 0.65, ruidoValor(veta / 0.35));
  if (hormigonRoto) {
    // Piedrecillas claras y oscuras de varios tamaños en la pasta del hormigón.
    float arido = smoothstep(0.58, 0.76, ruidoValor(uv / 0.045));
    return 1.09 + 0.35 * grano + 0.26 * (arido - 0.2) * detalleVisible(0.045, pixel) - 0.30 * grieta;
  }
  return 1.13 + 0.46 * grano - 0.45 * grieta;
}

float acero(vec2 uv, float pixel, vec2 medida) {
  vec2 local = mod(uv, medida);
  vec2 borde = min(local, medida - local);
  float d = min(borde.x, borde.y);
  float lateral = borde.x < borde.y ? local.y : local.x;
  vec2 alRemache = vec2(d - MARGEN_REMACHE, mod(lateral, PASO_REMACHE) - 0.5 * PASO_REMACHE);
  float remache = juntaMuro(length(alRemache), 2.0 * RADIO_REMACHE, pixel);
  float canto = borde.x < borde.y ? step(0.5 * medida.x, local.x) : 2.0 + step(0.5 * medida.y, local.y);
  float id = 1.0 + 4.0 * canto + floor(lateral / PASO_REMACHE);
  if (abs(id - vDetalleMuro.y) < 0.5) remache = 0.0;
  float raya = sin(6.283185 * uv.y / PASO_RAYADO);
  return 1.0 - SOMBRA_COSTURA * juntaMuro(d, COSTURA, pixel) + LUZ_REMACHE * remache
         + TONO_RAYADO * raya * detalleVisible(PASO_RAYADO, pixel);
}

float acabadoMuro(vec4 cara) {
  vec2 uv = cara.xy;
  float pixel = SUAVIZADO_MIN;
#if __VERSION__ >= 300 || defined(GL_OES_standard_derivatives)
  vec2 huella = fwidth(uv);
  pixel = max(pixel, max(huella.x, huella.y));
#endif
  if (vDetalleMuro.x > 0.5 && cara.z < 2.5) return piedraPartida(uv, pixel, cara.z > 1.5);
  if (cara.z < 1.5) return piedra(uv, cara.w > 0.5, pixel);
  if (cara.z < 2.5) return hormigon(uv, pixel);
  if (cara.z < 3.5) return acero(uv, pixel, cara.w < -1.5 ? vec2(1.0) : PLANCHA);
  float grano = ruidoValor(uv / GRANO_CASCAJO) - 0.5;
  return LUZ_CASCAJO + TONO_CASCAJO * grano * detalleVisible(GRANO_CASCAJO, pixel);
}`;

  function crear(THREE, op = {}) {
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    if (op.textura === false) return material;
    material.defaultAttributeValues = { uv: [0, 0], rotura: [0], remachePerdido: [0] };
    material.extensions = { derivatives: true };
    // r128 define HIGH_PRECISION en ambas etapas si admite highp en el fragmento.
    // Cada cara tiene cuatro vértices propios, así que su plano y su id son constantes.
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
#ifdef HIGH_PRECISION
attribute float material;
attribute float rotura;
attribute float remachePerdido;
varying vec4 vCaraMuro;
varying vec2 vDetalleMuro;
#endif`).replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef HIGH_PRECISION
  vec3 eje = abs(normal);
  vec2 uvMuro = eje.y >= max(eje.x, eje.z) ? position.xz : (eje.x >= eje.z ? position.zy : position.xy);
  vDetalleMuro = vec2(rotura, remachePerdido);
  vCaraMuro = vec4(uvMuro, material, normal.y);
  if (material == 3.0 && uv.x >= 2.0) vCaraMuro = vec4(uv - vec2(2.0, 0.0), material, -2.0);
#endif`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
#ifdef HIGH_PRECISION
varying vec4 vCaraMuro;
varying vec2 vDetalleMuro;
${parametros}
${funciones}
#endif`).replace("#include <color_fragment>", `#include <color_fragment>
#ifdef HIGH_PRECISION
  diffuseColor.rgb *= acabadoMuro(vCaraMuro);
#endif`);
    };
    return material;
  }
  if (typeof window !== "undefined") window.CMGMurallaMaterial = { crear };
  if (typeof module !== "undefined" && module.exports) module.exports = { crear };
})();
