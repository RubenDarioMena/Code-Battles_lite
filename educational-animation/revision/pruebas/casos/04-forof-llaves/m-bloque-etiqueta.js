for (const x of [1, 2]) {
  b: {
    if (x === 1) break b;
    console.log("dentro");
  }
  console.log("despues", x);
}
console.log("fin");
