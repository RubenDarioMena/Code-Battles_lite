function* g() { yield 1; }
g = () => console.log("normal");
g();
console.log("fin");
