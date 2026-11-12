// Verifica los archivos PNG reales sin navegador: node pruebas/terreno-png.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);
const fuente = readFileSync(new URL('herramientas/terreno/png.js', raiz));
const { texturas } = await import('data:text/javascript;base64,' + fuente.toString('base64'));

// CRC calculado bit a bit, independiente de la tabla del exportador.
function crc32(datos) {
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function leerPNG(blob, ancho, alto, bits, tipo) {
  assert.equal(blob.type, 'image/png');
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const bloques = [], idat = [];
  let cabecera, offset = 8;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, 'Cabecera de bloque PNG completa.');
    const largo = bytes.readUInt32BE(offset), nombre = bytes.toString('ascii', offset + 4, offset + 8);
    assert.ok(offset + largo + 12 <= bytes.length, nombre + ': bloque completo.');
    const contenido = bytes.subarray(offset + 8, offset + largo + 8);
    assert.equal(bytes.readUInt32BE(offset + largo + 8), crc32(bytes.subarray(offset + 4, offset + largo + 8)), nombre + ': CRC32 válido.');
    bloques.push(nombre);
    if (nombre === 'IHDR') { assert.equal(largo, 13); cabecera = contenido; }
    if (nombre === 'IDAT') idat.push(contenido);
    if (nombre === 'IEND') assert.equal(largo, 0);
    offset += largo + 12;
  }
  assert.equal(bloques[0], 'IHDR'); assert.equal(bloques.at(-1), 'IEND');
  assert.equal(bloques.filter(n => n === 'IHDR').length, 1);
  assert.equal(bloques.filter(n => n === 'IEND').length, 1);
  assert.ok(idat.length > 0);
  assert.deepEqual([
    cabecera.readUInt32BE(0), cabecera.readUInt32BE(4), ...cabecera.subarray(8),
  ], [ancho, alto, bits, tipo, 0, 0, 0], 'IHDR: dimensiones, color, compresión, filtro e interlace.');
  // inflateSync exige un flujo zlib válido; no basta con que tenga firma PNG.
  const datos = inflateSync(Buffer.concat(idat));
  const canales = tipo === 0 ? 1 : 4, paso = ancho * canales * bits / 8 + 1;
  assert.equal(datos.length, alto * paso);
  for (let fila = 0; fila < alto; fila++) assert.equal(datos[fila * paso], 0, 'Fila PNG sin filtro.');
  return { datos, paso };
}

const muestra = {
  columnas: 3, filas: 2, origen: { x: -16, z: -18 },
  alturas: [-2, 0, 20, -1, 9, 19],
  pesos: [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
    0, 0, 0, 1, .25, .25, .25, .25, .1, .2, .3, .4,
  ],
};
const antes = JSON.stringify(muestra);
const png = await texturas(muestra);
const gris = await leerPNG(png.heightmap, 3, 2, 16, 0);
const mezcla = await leerPNG(png.splatmap, 3, 2, 8, 6);
const aguaLegada = await leerPNG(png.watermap, 3, 2, 8, 0);
assert.ok(aguaLegada.datos.every(byte => byte === 0), 'Sin máscara se exporta agua vacía, también en mapas anteriores.');

// Máscara independiente de los cuatro materiales: gris de ocho bits sin alfa.
const conAgua = { ...muestra, agua: { nivel: .35, mascara: [0, .5, 1, 1, .25, .75] } };
const aguaAntes = JSON.stringify(conAgua);
const aguaMuestra = await leerPNG((await texturas(conAgua)).watermap, 3, 2, 8, 0);
assert.deepEqual([...aguaMuestra.datos], [0, 0, 128, 255, 0, 255, 64, 191], 'Agua: redondeo, filtro y orientación de ambas filas.');
assert.equal(JSON.stringify(conAgua), aguaAntes, 'Exportar la máscara no modifica el mapa.');

// Extremos y una muestra intermedia con sus bytes en orden de red (big endian).
assert.deepEqual([...gris.datos.subarray(1, 7)], [0, 0, 23, 70, 255, 255]);
for (let fila = 0; fila < 2; fila++) for (let col = 0; col < 3; col++) {
  const i = fila * 3 + col, valor = gris.datos.readUInt16BE(fila * gris.paso + 1 + col * 2);
  assert.ok(Math.abs(-2 + valor / 65535 * 22 - muestra.alturas[i]) <= 11 / 65535 + 1e-12, 'Altura con error máximo de media unidad de 16 bits.');
}

// Primera fila = Z mínima; cada fila avanza hacia +Z y cada píxel hacia +X.
// A guarda arena: incluso con A=0 los pesos RGB deben sobrevivir en el PNG.
assert.deepEqual([...mezcla.datos.subarray(1, 13)], [255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 0]);
assert.deepEqual([...mezcla.datos.subarray(14)], [0, 0, 0, 255, 63, 63, 63, 66, 25, 51, 76, 103]);
assert.equal(JSON.stringify(muestra), antes, 'Exportar no modifica los datos de origen.');

// Mapa completo del mismo generador utilizado por el editor y el juego.
const contexto = vm.createContext({ window: {} });
vm.runInContext(readFileSync(new URL('shared/terreno/datos.js', raiz), 'utf8'), contexto);
const T = contexto.window.CMGTerreno, mapa = T.crear();
const original = T.serializar(mapa), salida = await texturas(mapa);
const alturaReal = await leerPNG(salida.heightmap, mapa.columnas, mapa.filas, 16, 0);
const mezclaReal = await leerPNG(salida.splatmap, mapa.columnas, mapa.filas, 8, 6);
const aguaReal = await leerPNG(salida.watermap, mapa.columnas, mapa.filas, 8, 0);
for (let fila = 0; fila < mapa.filas; fila++) for (let col = 0; col < mapa.columnas; col++) {
  const i = fila * mapa.columnas + col;
  assert.equal(aguaReal.datos[fila * aguaReal.paso + 1 + col], 0, `Agua inicial vacía en muestra ${i}.`);
  const altura = -2 + alturaReal.datos.readUInt16BE(fila * alturaReal.paso + 1 + col * 2) / 65535 * 22;
  assert.ok(Math.abs(altura - mapa.alturas[i]) <= 11 / 65535 + 1e-12, `Altura de muestra ${i}.`);
  const offset = fila * mezclaReal.paso + 1 + col * 4;
  const rgba = [...mezclaReal.datos.subarray(offset, offset + 4)];
  assert.equal(rgba.reduce((a, b) => a + b, 0), 255, `Pesos normalizados de muestra ${i}.`);
  for (let canal = 0; canal < 4; canal++) {
    assert.ok(Math.abs(rgba[canal] / 255 - mapa.pesos[i * 4 + canal]) <= 3 / 255 + 1e-12, `Peso ${canal} de muestra ${i}.`);
  }
}
assert.equal(T.serializar(mapa), original);

// Patrón asimétrico en X/Z para detectar transposición o inversión de filas.
const patron = [0, .5, 1];
for (let fila = 0; fila < mapa.filas; fila++) for (let col = 0; col < mapa.columnas; col++) {
  mapa.agua.mascara[fila * mapa.columnas + col] = patron[(fila + col * 2) % patron.length];
}
const conPatron = T.serializar(mapa);
const aguaPatron = await leerPNG((await texturas(mapa)).watermap, 129, 97, 8, 0);
for (let fila = 0; fila < mapa.filas; fila++) for (let col = 0; col < mapa.columnas; col++) {
  const esperado = Math.round(patron[(fila + col * 2) % patron.length] * 255);
  assert.equal(aguaPatron.datos[fila * aguaPatron.paso + 1 + col], esperado, `Agua gris8 y orientación en (${col}, ${fila}).`);
}
assert.equal(T.serializar(mapa), conPatron, 'Exportar agua conserva la máscara y el resto del mapa.');

const mapaV1 = JSON.parse(original); mapaV1.version = 1;
delete mapaV1.agua; delete mapaV1.bloques;
const aguaV1 = await leerPNG((await texturas(mapaV1)).watermap, 129, 97, 8, 0);
assert.ok(aguaV1.datos.every(byte => byte === 0), 'Un mapa v1 sin agua exporta una máscara gris8 vacía de 129 × 97.');
console.log('PNG terreno: estructura, CRC, zlib, altura16, RGBA, agua gris8, compatibilidad v1 y 12.513 muestras correctas.');
