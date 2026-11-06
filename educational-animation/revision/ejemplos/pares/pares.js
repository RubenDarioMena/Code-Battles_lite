// Cuenta los pares de una lista
function esPar(n) {
  return n % 2 === 0
}

const numeros = [3, 8, 5, 12]
let pares = 0
for (const n of numeros) {
  if (esPar(n)) {
    pares++
    console.log(n, 'es par')
  } else {
    console.log(n, 'es impar')
  }
}
console.log('Pares:', pares)
