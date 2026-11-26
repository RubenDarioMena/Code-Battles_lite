import { arrancarJuego } from '../../../paquetes/app/campaign-v2.js';
import { crearPlataformaWeb } from '../../../cascaras/web/plataforma.js';
import { servicios } from './servicios.js';

// ?pruebas=1 abre el menú de pruebas (pruebas.html) en lugar del juego.
const params = new URLSearchParams(location.search);
const aPruebas = params.has('pruebas');
if (aPruebas) location.replace(new URL('pruebas.html', location.href).href);
const plataforma = globalThis.cblCascara?.plataforma ?? crearPlataformaWeb();
// El editor y el layout usan las mismas claves lógicas en ambas páginas.
function aislar(almacen) {
  const propia = clave => clave.startsWith('campaign-v2-') ? clave : 'campaign-v2:' + clave;
  return {
    leer: clave => almacen.leer(propia(clave)),
    escribir: (clave, valor) => almacen.escribir(propia(clave), valor),
    borrar: clave => almacen.borrar(propia(clave)),
  };
}
if (!aPruebas) arrancarJuego({ serie: 'campaign-v2', servicios, plataforma: {
  ...plataforma, almacen: aislar(plataforma.almacen), sesion: aislar(plataforma.sesion),
} });
