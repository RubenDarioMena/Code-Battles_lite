// El arnés three-r180 proporciona el GLTFLoader del juego. Solo se emulan el renderer y la decodificación PNG.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearFicha3D, crearVistaCV2 } from '../paquetes/vista-3d/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { TIPOS } from '../paquetes/reglas-war/index.js';

export async function probarEscena(Three, Loader) {
  let escena;
  const THREE = { ...Three, WebGLRenderer: class {
    capabilities = { getMaxAnisotropy: () => 4 };
    setPixelRatio() {} setSize() {} dispose() {}
    render(s) { s.updateMatrixWorld(true); escena = s; }
  } };
  Object.assign(globalThis, { window: { devicePixelRatio: 1 }, innerWidth: 1024, innerHeight: 768,
    MutationObserver: class { observe() {} disconnect() {} },
    fetch: async url => ({ ok: true, json: async () => JSON.parse(await readFile(url, 'utf8')) }) });
  const cargas = [], leidos = [];
  class Disco extends Loader {
    constructor(manager = new THREE.LoadingManager()) {
      super(manager);
      manager.addHandler(/\.png$/, { load: (_url, ok) => ok(new THREE.Texture()) });
    }
    loadAsync(url) {
      leidos.push(new URL(url).pathname.split('/').at(-1));
      const carga = readFile(new URL(url)).then(b => this.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), url.slice(0, url.lastIndexOf('/') + 1)));
      cargas.push(carga);
      return carga;
    }
  }
  const rect = { width: 900, height: 530 };
  const canvas = { dataset: {}, addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => rect };
  const opciones = { THREE, cargarGLTFLoader: async () => Disco, dt: .05, canvas, $: () => canvas, TIPOS };
  for (const hito of ['b1', 'salida', 'h0']) {
    const fabrica = hito === 'h0';
    const c = componerCampaignV2(new URLSearchParams('serie=campaign-v2' + ('&ensayo=' + hito)));
    const p = crearPartida({ reglas: c.reglas, escenario: c.escenario(c.indiceInicial), semilla: 7 });
    if (hito === 'salida') p.ordenar({ paso: 0, origen: 'programa', unidad: 'VEH-01', verbo: 'moveTo', args: [{ x: 222, y: 81.5 }] });
    if (!fabrica) for (let i = 0; i < 100; i++) p.paso();
    const e = c.reglas.escenaMetros(p.mundo), vista = crearVistaCV2(canvas, { ...opciones, fabrica });
    vista.redimensionar();
    vista.dibujar(null, e, 0);
    // Dejar que la lectura del JSON programe la carga de los tramos y el torreón.
    for (let i = 0; i < 30 && !leidos.includes('opcion-07-nudo.glb'); i++) {
      await new Promise(ok => setTimeout(ok, 5));
    }
    await Promise.all(cargas); await new Promise(ok => setImmediate(ok));
    vista.dibujar(null, e, 0);
    const terreno = escena.getObjectByName('terreno-1-2');
    assert.ok(terreno?.material?.vertexColors && terreno.material.map && terreno.material.normalMap);
    assert.equal(escena.getObjectByName('terreno-1-1').material, terreno.material);
    assert.ok(escena.getObjectByName('opcion-03-tramo') && escena.getObjectByName('opcion-07-nudo'));
    assert.deepEqual(leidos.filter(n => n.includes('terreno')).sort(), ['terreno-1-1.glb', 'terreno-1-2.glb']);
    const u = fabrica ? e.maquinas[0] : e.lanzadores[0];
    const punto = vista.proyectarUnidad(u, .45);
    assert.ok(punto.visible && punto.x >= 0 && punto.x < 900 && punto.y >= 0 && punto.y < 530);
    assert.equal(vista.elegir(punto.x, punto.y), u.id);
    if (!fabrica) {
      assert.ok(escena.getObjectByName('L0_hoja_i').matrixAutoUpdate === false);
      const enemigo = e.enemigos[0], pe = vista.proyectarUnidad(enemigo, enemigo.z || .3);
      assert.equal(vista.elegir(pe.x, pe.y), enemigo.id);
      const pb = vista.proyectarBastion(e.bastiones[0]);
      assert.equal(vista.bastionEn(pb.x, pb.y), 0);
      const suelo = vista.proyectar(220, 0, 81), metros = vista.suelo(suelo.x, suelo.y);
      assert.ok(Math.hypot(metros.x - 220, metros.y - 81) < .01);
      // Límites del marco, llegada del dron y bastiones sobre el relieve cargado.
      for (const [width, height] of [[900, 530], [375, 812]]) {
        Object.assign(rect, { width, height });
        Object.assign(globalThis, { innerWidth: width, innerHeight: height });
        canvas.dataset.pantallaCompleta = String(width < height);
        vista.redimensionar(); vista.dibujar(null, e, 0);
        if (width < height) assert.ok(vista.proyectar(204, 0, 81).y > vista.proyectar(236, 0, 81).y);
        const puntos = e.bastiones.map(b => vista.proyectarBastion(b));
        for (const x of [204, 236.4]) for (const z of [72, 90])
          for (const alto of [0, 2.5]) puntos.push(vista.proyectar(x, alto, z));
        assert.ok(puntos.every(p => p.visible && p.x > 0 && p.x < width && p.y > 0 && p.y < height));
      }
      Object.assign(rect, { width: 900, height: 530 });
      Object.assign(globalThis, { innerWidth: 1024, innerHeight: 768 });
      canvas.dataset.pantallaCompleta = 'false';
    }
    if (hito === 'salida') {
      const veh = escena.getObjectByName('L0_VehiculoTubular');
      assert.ok(veh && !escena.getObjectByName('L1_VehiculoTubular').visible);
      let grupo = veh;
      while (grupo.userData.id !== 'VEH-01') grupo = grupo.parent;
      const salida = e.porId['VEH-01'];
      assert.deepEqual([grupo.position.x, grupo.position.z], [salida.cx, salida.cy]);
      vista.dibujar(null, { ...e, maquinas: e.maquinas.filter(m => m.id !== 'VEH-01') }, 0);
      assert.equal(grupo.visible, false);
      vista.dibujar(null, e, 0);
      assert.equal(grupo.visible, true);
      const tirador = e.enemigos.find(u => u.tipo === 'tirador');
      const punto = vista.proyectarUnidad(tirador, .3);
      assert.equal(vista.elegir(punto.x, punto.y), tirador.id);
    }
    const papel = terreno.material;
    vista.batalla(true);
    assert.equal(terreno.material.map, null);
    assert.ok(terreno.children.some(o => o.isLineSegments && o.visible));
    vista.batalla(false);
    assert.equal(terreno.material, papel);
    vista.destruir(); leidos.length = cargas.length = 0;
  }
  let fotograma;
  globalThis.requestAnimationFrame = fn => { fotograma = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { fotograma = null; };
  const ficha = crearFicha3D({ clientWidth: 300, clientHeight: 144 }, opciones, TIPOS);
  for (const unidad of [{ clase: 'lanzador' }, { tipo: 'crawler' }, { tipo: 'drone' }, { clase: 'reparador' }]) {
    await ficha.mostrar(unidad);
    fotograma(10);
    const soporte = escena.children[0], angulo = soporte.rotation.y;
    if (unidad.clase === 'lanzador') assert.ok(soporte.getObjectByName('L0_TorretaObservacion'));
    assert.ok(!new THREE.Box3().setFromObject(soporte).isEmpty());
    fotograma(1010);
    assert.ok(soporte.rotation.y > angulo);
    ficha.pausar(); assert.equal(fotograma, null);
  }
  console.log('P4a–P5a · H0, B1 y Salida con VEH y tirador, GLB reales, materiales, dos trozos, selección de enemigo, torreta y bastión, rayo al terreno.');
}
