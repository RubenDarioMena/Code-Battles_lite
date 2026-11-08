[1, 2].forEach(
  async x => console.log(await esperar(x * 0.01), x)
);
console.log("fin");
