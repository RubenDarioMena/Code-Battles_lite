let n = 0;
const id = setInterval(() => { n++; if (n === 3) clearInterval(id); }, 100);
await esperar(0.25);
console.log("n =", n);
