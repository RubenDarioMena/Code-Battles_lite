[1, 2].forEach(async x => {
  await esperar(0.01);
  console.log(x);
});
console.log("fin");
