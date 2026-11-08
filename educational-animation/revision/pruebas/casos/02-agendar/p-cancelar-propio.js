const id = setInterval(() => {
  console.log("una");
  clearTimeout(id);
}, 1);
console.log("fin");
