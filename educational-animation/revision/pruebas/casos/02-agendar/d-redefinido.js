function queueMicrotask(f) { f(); }
queueMicrotask(() => console.log("callback"));
console.log("fin");
