function* g() {
  console.log("a");
  yield 1;
  console.log("b");
  yield 2;
}
const it = g();
console.log(it.next().value);
it.next();
console.log("fin");
