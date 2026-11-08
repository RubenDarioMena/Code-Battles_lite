let i = 10; const f = [];
for (let k = 0; k < 2; k++) {
  { let i = k; }
  f.push(() => i);
}
console.log(f[0](), f[1]());
