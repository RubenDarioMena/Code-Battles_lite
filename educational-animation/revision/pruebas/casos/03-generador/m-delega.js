function* g() {
  yield* [1, 2];
}
const it = g();
console.log(it.next());
console.log(it.next());
