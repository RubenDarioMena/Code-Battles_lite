// Restos de un vehículo dañado en 3D (P8; consolidado del 23-nov, 8.1, 9.1 y 13.B-4). Solo representa: la masa, la
// función y los fragmentos salen de las reglas (reglas-campaign-v2/danio) y llegan aquí como datos.
// - Cada componente es un bloque papercraft con contorno. Su máscara de daño va en el color de los vértices y se
//   calcula con el historial de golpes: tizne del explosivo, mancha verdosa del corrosivo y punto al rojo del preciso.
//   La máscara dice dónde y cuánto se golpeó, nunca qué función cayó (9.1): eso lo dice el contorno rojo, que sale de
//   la integridad lógica.
// - La masa que queda escala el bloque (raíz cúbica: el volumen sigue a la masa). Sin masa, desaparece.
// - Cada fragmento lógico cuelga de su propio grupo: el mayor se queda en su sitio y los demás se apartan y caen al
//   suelo. La chatarra se ve como unos pocos trozos alrededor, nunca uno por gramo (7.5).
// - `calidad` solo cambia la subdivisión de la máscara: el resultado lógico es el mismo (12.2, invariante 7).
// Ejes: las reglas usan x a proa, y a babor y z arriba; aquí x, z y -y (three tiene y arriba).

const COLOR = { blindaje: 0x6f7d3c, chasis: 0x56622f, motor: 0x474450, transmision: 0x23272f, arma: 0x9aa3b2, electronica: 0x1e9c9c };
const TIZNE = 0x1d1a17, ACIDO = 0x9aa12c, OXIDO = 0x6b4f2a, ASCUA = 0xff5a1f, CONTORNO = 0x171b26, DANO = 0xe5383b;
const SUELO = 0xd8cdb5, CHATARRA = 0x615e6c;
const UMBRAL_FUNCION = 0.5;

/** @param {any} THREE @param {{ perfiles: Record<string, { radio: number }>, calidad?: 'alta' | 'baja' }} op */
export function crearRestos3D(THREE, { perfiles, calidad = 'alta' }) {
  const grupo = new THREE.Group();
  const recursos = new Set();
  const guardar = x => { recursos.add(x); return x; };
  const tinta = guardar(new THREE.LineBasicMaterial({ color: CONTORNO }));
  const tintaDano = guardar(new THREE.LineBasicMaterial({ color: DANO }));
  const matCuerpo = guardar(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const matChatarra = guardar(new THREE.MeshLambertMaterial({ color: CHATARRA, flatShading: true }));
  const suelo = new THREE.Mesh(guardar(new THREE.CircleGeometry(4, 48)), guardar(new THREE.MeshLambertMaterial({ color: SUELO })));
  suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
  grupo.add(suelo);
  const enThree = ([x, y, z]) => new THREE.Vector3(x, z, -y);

  /** @type {Map<string, { malla: any, borde: any, base: any, caja: number[] }>} */
  const piezas = new Map();
  /** @type {Map<string, any>} grupo de cada fragmento, por su componente más pesado */
  let fragmentosVista = new Map();
  const chatarra = new THREE.Group();
  grupo.add(chatarra);
  let segmentos = calidad === 'alta' ? 10 : 2;

  function crearPieza(c) {
    const [, , , l, a, h] = c.caja;
    const g = guardar(new THREE.BoxGeometry(l, h, a, segmentos, segmentos, segmentos));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    const malla = new THREE.Mesh(g, matCuerpo);
    malla.castShadow = true;
    const borde = new THREE.LineSegments(guardar(new THREE.EdgesGeometry(g, 25)), tinta);
    borde.raycast = () => {};
    malla.add(borde);
    malla.userData.componente = c.id;
    return { malla, borde, base: new THREE.Color(COLOR[c.tipo] ?? 0x888888), caja: c.caja };
  }

  /** Máscara de daño en los colores de vértice, a partir del historial (posición original del componente). */
  function pintar(p, historial) {
    const pos = p.malla.geometry.attributes.position, col = p.malla.geometry.attributes.color;
    const centro = enThree(p.caja), v = new THREE.Vector3(), c = new THREE.Color();
    const golpes = historial.map(h => ({ ...h, en: enThree(h.punto), radio: perfiles[h.perfil]?.radio ?? 1 }));
    const tizne = new THREE.Color(TIZNE), acido = new THREE.Color(ACIDO), oxido = new THREE.Color(OXIDO), ascua = new THREE.Color(ASCUA);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).add(centro);
      let hollin = 0, corrosion = 0, calor = 0;
      for (const g of golpes) {
        const d = v.distanceTo(g.en), cerca = Math.max(0, 1 - d / g.radio);
        if (g.perfil === 'explosivo') hollin = Math.max(hollin, Math.min(1, cerca * 1.4 * Math.min(1, g.energia)));
        else if (g.perfil === 'corrosivo') corrosion = Math.min(1, corrosion + cerca * 0.45 * g.energia);
        else if (g.perfil === 'preciso') calor = Math.max(calor, d < 0.1 ? 1 : d < 0.2 ? -1 : 0);
      }
      c.copy(p.base);
      if (corrosion > 0) c.lerp(corrosion > 0.6 ? oxido : acido, Math.min(1, corrosion));
      if (hollin > 0) c.lerp(tizne, hollin * 0.85);
      if (calor === 1) c.copy(ascua); else if (calor === -1) c.lerp(tizne, 0.7);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
  }

  /** Rectángulo en planta (x, y de las reglas) que ocupan unas cajas. */
  function rectangulo(cajas) {
    return { x0: Math.min(...cajas.map(k => k[0] - k[3] / 2)), x1: Math.max(...cajas.map(k => k[0] + k[3] / 2)),
      y0: Math.min(...cajas.map(k => k[1] - k[4] / 2)), y1: Math.max(...cajas.map(k => k[1] + k[4] / 2)) };
  }
  /** ¿Las cajas desplazadas (dx, dy) pisan el rectángulo, con 5 cm de margen? */
  function solapa(cajas, dx, dy, h) {
    if (!h) return false;
    const r = rectangulo(cajas), m = 0.05;
    return r.x0 + dx < h.x1 + m && r.x1 + dx > h.x0 - m && r.y0 + dy < h.y1 + m && r.y1 + dy > h.y0 - m;
  }

  /** Coloca la pieza de chatarra número i (posiciones fijas en espiral: la misma chatarra, el mismo dibujo). */
  function trozo(i) {
    const g = guardar(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.035, 0));
    const t = new THREE.Mesh(g, matChatarra);
    const ang = i * 2.39996, r = 1.35 + (i % 4) * 0.12;
    t.position.set(Math.cos(ang) * r, 0.04, Math.sin(ang) * r);
    t.scale.y = 0.45; t.rotation.set(i * 0.7, i * 1.3, 0);
    t.castShadow = true;
    return t;
  }

  /**
   * @param {any} r restos de las reglas (componentes, historial)
   * @param {Array<{ componentes: string[], masa: number }>} frags fragmentos de las reglas, del más pesado al más ligero
   */
  function actualizar(r, frags) {
    for (const c of r.componentes) if (!piezas.has(c.id)) piezas.set(c.id, crearPieza(c));
    for (const c of r.componentes) {
      const p = piezas.get(c.id);
      pintar(p, r.historial);
      p.malla.visible = c.masa > 0;
      p.malla.scale.setScalar(Math.cbrt(c.masa / c.masa0) || 0.001);
      p.borde.material = c.integridad < UMBRAL_FUNCION ? tintaDano : tinta;
    }
    // Un grupo por fragmento. El nuevo grupo hereda la posición del que tenía su componente más pesado, y se aparta
    // desde ahí (la vista anima la separación en `animar`).
    const anteriores = fragmentosVista;
    fragmentosVista = new Map();
    const porMasa = id => r.componentes.find(c => c.id === id).masa;
    const huella = frags.length ? rectangulo(frags[0].componentes.map(id => piezas.get(id).caja)) : null;
    frags.forEach((f, i) => {
      const clave = [...f.componentes].sort((a, b) => porMasa(b) - porMasa(a) || a.localeCompare(b))[0];
      const previo = [...anteriores.values()].find(gf => gf.userData.ids.includes(clave));
      const gf = new THREE.Group();
      gf.userData.ids = f.componentes;
      if (previo) { gf.position.copy(previo.position); gf.rotation.y = previo.rotation.y; }
      // Destino: el mayor se queda; los demás se apartan del centro del vehículo y bajan hasta tocar el suelo.
      const cajas = f.componentes.map(id => piezas.get(id).caja);
      const cx = cajas.reduce((s, k) => s + k[0], 0) / cajas.length, cy = cajas.reduce((s, k) => s + k[1], 0) / cajas.length;
      const base = Math.min(...cajas.map(k => k[2] - k[5] / 2));
      let dx = cx, dy = cy;
      if (Math.hypot(dx, dy) < 0.05) { dx = Math.cos(i * 2.1); dy = Math.sin(i * 2.1); }
      const n = Math.hypot(dx, dy);
      let lejos = i === 0 ? 0 : 0.22 + 0.06 * i;
      // Lo que cae al suelo sale de la huella del fragmento mayor: si no, el motor o el arma sueltos quedarían bajo
      // el casco y no se verían.
      if (i > 0 && base > 0.05) while (lejos < 2.5 && solapa(cajas, dx / n * lejos, dy / n * lejos, huella)) lejos += 0.05;
      gf.userData.destino = { x: dx / n * lejos, y: i === 0 ? 0 : -base, z: -dy / n * lejos, giro: i === 0 ? 0 : (i % 2 ? 0.12 : -0.1) * Math.min(i, 4) };
      for (const id of f.componentes) {
        const p = piezas.get(id);
        p.malla.position.copy(enThree(p.caja));
        gf.add(p.malla);
      }
      grupo.add(gf);
      fragmentosVista.set(clave, gf);
    });
    for (const gf of anteriores.values()) grupo.remove(gf);
    // Componentes sin masa: fuera de cualquier fragmento.
    for (const c of r.componentes) if (c.masa === 0) grupo.remove(piezas.get(c.id).malla);
    // Chatarra visible: un trozo cada 2 kg, como mucho ocho.
    const kg = r.componentes.reduce((s, c) => s + c.chatarra, 0) / 1000;
    const quiero = Math.min(8, Math.floor(kg / 2));
    while (chatarra.children.length < quiero) chatarra.add(trozo(chatarra.children.length));
    while (chatarra.children.length > quiero) chatarra.remove(chatarra.children.at(-1));
  }

  /** Acerca cada fragmento a su destino; devuelve si algo se movió. */
  function animar(dt) {
    let movido = false;
    const k = 1 - Math.exp(-dt * 6);
    for (const gf of fragmentosVista.values()) {
      const d = gf.userData.destino;
      const antes = gf.position.clone();
      gf.position.x += (d.x - gf.position.x) * k; gf.position.y += (d.y - gf.position.y) * k; gf.position.z += (d.z - gf.position.z) * k;
      gf.rotation.y += (d.giro - gf.rotation.y) * k;
      if (antes.distanceTo(gf.position) > 1e-4) movido = true;
    }
    return movido;
  }

  /** Punto de un impacto en coordenadas de las reglas, a partir de una intersección del raycaster. */
  function puntoLocal(interseccion) {
    const malla = interseccion.object, gf = malla.parent;
    const v = gf.worldToLocal(interseccion.point.clone());
    return [v.x, -v.z, v.y].map(n => Math.round(n * 100) / 100 || 0);
  }

  /** Cambia la subdivisión de la máscara y reconstruye las piezas (el resultado lógico no cambia). */
  function fijarCalidad(nueva, r, frags) {
    segmentos = nueva === 'alta' ? 10 : 2;
    for (const p of piezas.values()) p.malla.removeFromParent();
    piezas.clear();
    actualizar(r, frags);
  }

  const mallas = () => [...piezas.values()].map(p => p.malla).filter(m => m.visible && m.parent);
  const liberar = () => { for (const x of recursos) x.dispose?.(); recursos.clear(); };
  return { grupo, actualizar, animar, puntoLocal, fijarCalidad, mallas, liberar, triangulos: () => segmentos };
}
