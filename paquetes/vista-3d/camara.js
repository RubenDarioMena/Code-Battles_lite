import { idDeImpacto } from './instancias-war.js';
import { escucharEn } from './recursos.js';
/* Posturas, proyección, selección y gestos del visor común, antes en js/vistas.js. */
export function crearCamara3D(ctx) {
    const { THREE, estado, $, ES_FACTORY, renderer, escena, camara, horizonte, fijo, movil } = ctx;
    const zona = ctx.zona;
    const ZOOM = zona ? [8, 160] : ES_FACTORY ? [2.5, 30] : [8, 70];
    // Una cámara por postura de la pantalla (horizontal, vertical y vertical con el campo girado 90°, la de
    // pantalla completa): cada una recuerda durante la sesión dónde la dejó el jugador.
    const camaras = {};
    let camActual = null, cam = null, cam0 = null, anchoCampo = 1, altoCampo = 1;
    function colocarCamara(c = cam) {
      const cp = Math.cos(c.pitch);
      camara.position.set(c.x + c.dist * cp * Math.sin(c.yaw), (c.alto || 0) + c.dist * Math.sin(c.pitch), c.z + c.dist * cp * Math.cos(c.yaw));
      camara.lookAt(c.x, c.alto || 0, c.z);
      camara.updateMatrixWorld();
    }
    // Campo girado 90°: la base queda abajo y los enemigos llegan desde arriba. Se usa en pantalla completa
    // con la pantalla en vertical (se puede desactivar en Ajustes); al girar a horizontal vuelve la normal.
    const app = $("app");
    function claveCamara() {
      if (innerHeight <= innerWidth) return "horizontal";
      const girar = app.dataset.pantallaCompleta === "true" && app.dataset.girarCampo !== "false" && altoCampo > anchoCampo;
      return girar ? "girada" : "vertical";
    }
    // Distancia mínima para que las cuatro esquinas del campo quepan en pantalla (con margen para el HUD).
    function encuadrar(c, mx, my) {
      const { x0, x1, z0, z1 } = zona ?? { x0: 0, x1: estado.cols, z0: 0, z1: estado.rows };
      const esquinas = zona?.puntos ?? [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      let lo = 6, hi = 160;
      for (let k = 0; k < 24; k++) {
        c.dist = (lo + hi) / 2; colocarCamara(c);
        const cabe = esquinas.every(e => { const q = e.clone().project(camara); return Math.abs(q.x) <= mx && Math.abs(q.y) <= my && q.z < 1; });
        if (cabe) hi = c.dist; else lo = c.dist;
      }
      c.dist = hi;
      return c;
    }
    function camaraInicial(k) {
      // En pantallas estrechas la cámara se aleja para que quepan las 32 columnas.
      // Algo inclinada y mirando un poco más al norte: deja ver la cordillera detrás del campo.
      if (zona) return encuadrar({ yaw: zona.yaw - (k === "girada" ? Math.PI / 2 : 0), pitch: zona.pitch ?? 1,
        dist: 32, alto: zona.alto ?? 0, x: (zona.x0 + zona.x1) / 2, z: (zona.z0 + zona.z1) / 2 }, .92, .78);
      if (ES_FACTORY) return encuadrar({ yaw: k === "girada" ? -Math.PI / 2 : 0, pitch: .9, dist: 12, x: estado.cols / 2, z: estado.rows / 2 }, .92, .82);
      if (k !== "girada") return { yaw: 0, pitch: .93, dist: camara.aspect < 1.5 ? 33 * 1.5 / camara.aspect : 33, x: estado.cols / 2, z: estado.rows / 2 - .8 };
      return encuadrar({ yaw: -Math.PI / 2, pitch: .98, dist: 30, x: estado.cols / 2 - .6, z: estado.rows / 2 }, .98, .8);
    }
    function elegirCamara() {
      const k = claveCamara();
      const c = camaras[k] || (camaras[k] = { k, cam: null, movida: false });
      c.cam0 = camaraInicial(k);
      if (!c.cam) c.cam = { ...c.cam0 };
      else if (!c.movida) Object.assign(c.cam, c.cam0);
      camActual = c; cam = c.cam; cam0 = c.cam0;
    }
    const moverCamara = () => { if (camActual) camActual.movida = true; };
    function tamano(w, h) {
      anchoCampo = w; altoCampo = h;
      renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
      elegirCamara();
    }
    // Activar o salir de pantalla completa, o cambiar el ajuste, cambia de cámara sin cambiar de tamaño.
    const observador = new MutationObserver(() => { if (cam) elegirCamara(); });
    observador.observe(app, { attributes: true, attributeFilter: ["data-pantalla-completa", "data-girar-campo"] });
    function render() {
      if (!cam) elegirCamara();
      colocarCamara();
      if (escena.fog === horizonte) { horizonte.near = cam.dist + (ES_FACTORY ? 8 : 24); horizonte.far = cam.dist + (ES_FACTORY ? 40 : 110); }
      else if (escena.fog) { escena.fog.near = cam.dist * .55; escena.fog.far = cam.dist * 1.75; }
      renderer.render(escena, camara);
    }
    const v = new THREE.Vector3();
    function proyectar(x, alto, y, w, h) {
      v.set(x, alto, y).project(camara);
      return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: v.z < 1 && v.z > -1 };
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function elegir(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
      ray.setFromCamera(ndc, camara);
      const hits = ray.intersectObjects([...fijo.children, ...movil.children], true);
      for (const hit of hits) { const id = idDeImpacto(hit); if (id != null) return id; }
      return null;
    }
    function suelo(px, py, w, h) {
      ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
      ray.setFromCamera(ndc, camara);
      const punto = ctx.interseccionTerreno?.(ray) ?? ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      return punto ? { x: punto.x, y: punto.z, z: 0 } : null;
    }
    function centrar(x, y) {
      // Acerca la cámara a la unidad un poco hacia el lado desde el que mira.
      cam.x = x + Math.sin(cam.yaw); cam.z = y + Math.cos(cam.yaw); cam.dist = Math.min(cam.dist, ES_FACTORY ? 5 : 22); moverCamara();
    }
    function recentrar() { Object.assign(cam, cam0); camActual.movida = false; }

    // Cámara: rueda presionada = orbitar · botón derecho o dos dedos = desplazar.
    // El botón izquierdo y la selección táctil se manejan juntos en el campo.
    const canvas = $("c3d"), punteros = new Map();
    let gesto = null;
    const oyentes = escucharEn(canvas), escuchar = oyentes.escuchar;
    escuchar("contextmenu", (ev) => ev.preventDefault());
    escuchar("pointerdown", (ev) => {
      if (ev.pointerType !== "touch" && ev.button !== 1 && ev.button !== 2) return;
      canvas.setPointerCapture(ev.pointerId);
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      gesto = { movido: 0, desplazar: ev.button === 2, tactil: ev.pointerType === "touch", dist0: null, ang0: null, giro: 0, girando: false };
    });
    escuchar("pointermove", (ev) => {
      const p = punteros.get(ev.pointerId); if (!p || !gesto) return;
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      gesto.movido += Math.abs(dx) + Math.abs(dy);
      if (estado.camaraDosDedos && gesto.tactil && punteros.size === 1) return;
      if (dx || dy) moverCamara();
      if (punteros.size >= 2) {
        const [a, b] = [...punteros.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (gesto.dist0) cam.dist = Math.min(ZOOM[1], Math.max(ZOOM[0], cam.dist * gesto.dist0 / d));
        gesto.dist0 = d;
        desplazar(dx / 2, dy / 2);
        // Girar dos dedos gira el escenario alrededor del punto entre ellos. Un umbral pequeño evita
        // girar sin querer al pellizcar para acercar.
        if (gesto.ang0 != null) {
          const da = Math.atan2(Math.sin(ang - gesto.ang0), Math.cos(ang - gesto.ang0));
          gesto.giro += da;
          if (gesto.girando || Math.abs(gesto.giro) > .12) {
            const r = canvas.getBoundingClientRect();
            girar(gesto.girando ? da : gesto.giro, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, r.width, r.height);
            gesto.girando = true;
          }
        }
        gesto.ang0 = ang;
      } else if (gesto.tactil && estado.arrastreCampo && estado.arrastreCampo.cajaTactil) return;
      else if (gesto.desplazar || gesto.tactil) desplazar(dx, dy);
      else { cam.yaw -= dx * .006; cam.pitch = Math.min(1.5, Math.max(zona ? .78 : .28, cam.pitch + dy * .005)); }
    });
    const soltar = (ev) => {
      punteros.delete(ev.pointerId);
      if (gesto && punteros.size === 0) {
        gesto = null;
      } else if (gesto) { gesto.dist0 = null; gesto.ang0 = null; }
    };
    escuchar("pointerup", soltar);
    escuchar("pointercancel", (ev) => { punteros.delete(ev.pointerId); gesto = null; });
    escuchar("wheel", (ev) => { ev.preventDefault(); moverCamara(); cam.dist = Math.min(ZOOM[1], Math.max(ZOOM[0], cam.dist * Math.exp(ev.deltaY * .0012))); }, { passive: false });
    const limitar = () => {
      if (zona) {
        cam.x = Math.min(zona.x1, Math.max(zona.x0, cam.x));
        cam.z = Math.min(zona.z1, Math.max(zona.z0, cam.z));
        return;
      }
      cam.x = Math.min(estado.cols + 4, Math.max(-4, cam.x)); cam.z = Math.min(estado.rows + 4, Math.max(-6, cam.z)); };
    function desplazar(dx, dy) {
      const k = cam.dist * .0022;
      const sx = Math.cos(cam.yaw), sz = -Math.sin(cam.yaw);
      cam.x -= (dx * sx + dy * Math.sin(cam.yaw)) * k;
      cam.z -= (dx * sz + dy * Math.cos(cam.yaw)) * k;
      limitar();
    }
    // El giro mantiene fijo el punto del suelo que queda entre los dedos.
    function girar(da, px, py, w, h) {
      colocarCamara();
      const antes = suelo(px, py, w, h);
      cam.yaw = Math.atan2(Math.sin(cam.yaw + da), Math.cos(cam.yaw + da));
      colocarCamara();
      const despues = suelo(px, py, w, h);
      if (antes && despues) { cam.x += antes.x - despues.x; cam.z += antes.y - despues.y; limitar(); }
    }
    return { destruir() { oyentes.destruir(); observador.disconnect(); punteros.clear(); }, render, tamano, proyectar, elegir, suelo, centrar, recentrar, girar,
      altoPx: () => altoCampo,
      camara: () => { const factory = ctx.factory; return ({ clave: camActual && camActual.k, ...cam, dibujo: { calls: renderer.info?.render.calls ?? 0, triangles: renderer.info?.render.triangles ?? 0 }, ...(factory ? { lod: factory.robot.nivel, px: factory.robot.px } : {}) }); },
    };
}
