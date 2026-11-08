let id;
id = setTimeout(() => console.log("nunca"), 50);
clearTimeout(id);
console.log("fin");
