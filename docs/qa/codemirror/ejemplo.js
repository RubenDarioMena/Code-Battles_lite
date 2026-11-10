// Pares dentro del comentario: ([{ }])
// Los colores y el plegado deben conservar las líneas y el texto original.
function resumir(valores) {
  let total = 0;
  for (const valor of valores) {
    if (valor > 1) {
      total += valor;
    }
  }
  return { total, etiqueta: "á 😀 <b> [texto]" };
}

const datos = [1, 2, 3];
const resultado = resumir(datos);
console.log(resultado.total); // 5
console.log(resultado.etiqueta);
