const f = []; let i;
for (i = 0; i < 2; i++) { f.push(() => i); }
i = 7;
console.log(f[0](), f[1]());
