setTimeout(() => console.log("b"), 20);
setTimeout(() => { console.log("a"); queueMicrotask(() => console.log("a2")); }, 10);
console.log("fin");
