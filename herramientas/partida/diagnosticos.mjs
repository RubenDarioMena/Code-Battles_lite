// Los mismos catálogos clásicos que carga el juego, sin DOM ni almacenamiento.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const catalogos = {};
const ventana = { CMGI18n: { registrar(idioma, textos) {
  Object.assign(catalogos[idioma] ??= {}, textos);
} } };
for (const archivo of ['juego-dinamico', 'campaign']) {
  const fuente = readFileSync(new URL(`../../shared/i18n/${archivo}.js`, import.meta.url), 'utf8');
  vm.runInNewContext(fuente, { window: ventana });
}
export function traducir(clave, datos = {}, idioma = 'es') {
  return (catalogos[idioma]?.[clave] ?? clave).replace(/\{(\w+)\}/g, (_, k) => String(datos[k] ?? `{${k}}`));
}
