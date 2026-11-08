function* g() {
  yield 1;
  yield 2;
}
for (const x of g()) console.log(x);
