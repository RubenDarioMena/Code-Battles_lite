// PNG sin dependencias: altura en gris de 16 bits y mezcla RGBA de 8 bits.
// La altura se reconstruye como -2 + (muestra / 65535) * 22 metros.
const tabla = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function bloque(tipo, datos) {
  const salida = new Uint8Array(datos.length + 12), vista = new DataView(salida.buffer);
  vista.setUint32(0, datos.length);
  salida.set(new TextEncoder().encode(tipo), 4); salida.set(datos, 8);
  let crc = 0xffffffff;
  for (const byte of salida.subarray(4, -4)) crc = tabla[(crc ^ byte) & 255] ^ (crc >>> 8);
  vista.setUint32(salida.length - 4, (crc ^ 0xffffffff) >>> 0);
  return salida;
}
async function png(ancho, alto, profundidad, tipo, datos) {
  const cabecera = new Uint8Array(13), vista = new DataView(cabecera.buffer);
  vista.setUint32(0, ancho); vista.setUint32(4, alto); cabecera[8] = profundidad; cabecera[9] = tipo;
  const comprimido = new Uint8Array(await new Response(new Blob([datos]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]), bloque('IHDR', cabecera), bloque('IDAT', comprimido), bloque('IEND', new Uint8Array())], { type: 'image/png' });
}
export async function texturas(mapa) {
  const { columnas: w, filas: h, alturas, pesos } = mapa;
  const altura = new Uint8Array(h * (w * 2 + 1)), mezcla = new Uint8Array(h * (w * 4 + 1)), agua = new Uint8Array(h * (w + 1));
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const i = z * w + x, a = z * (w * 2 + 1) + 1 + x * 2, p = z * (w * 4 + 1) + 1 + x * 4;
    const v = Math.round(Math.max(0, Math.min(1, (alturas[i] + 2) / 22)) * 65535);
    altura[a] = v >>> 8; altura[a + 1] = v & 255;
    let restante = 255;
    for (let k = 0; k < 3; k++) { mezcla[p + k] = Math.floor(pesos[i * 4 + k] * 255); restante -= mezcla[p + k]; }
    mezcla[p + 3] = restante;
    agua[z * (w + 1) + 1 + x] = Math.round((mapa.agua?.mascara[i] || 0) * 255);
  }
  const [heightmap, splatmap, watermap] = await Promise.all([png(w, h, 16, 0, altura), png(w, h, 8, 6, mezcla), png(w, h, 8, 0, agua)]);
  return { heightmap, splatmap, watermap };
}
