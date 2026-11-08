queueMicrotask(() => console.log("callback"));
await null;
console.log("fin");
