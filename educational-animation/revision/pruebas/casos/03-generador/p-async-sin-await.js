async function* g() {
  await esperar(0.01);
  yield 1;
}
const it = g();
it.next();
console.log("fin");
