async function* g() {
  await esperar(0.01);
  yield 1;
}
const it = g();
console.log(await it.next());
console.log("fin");
