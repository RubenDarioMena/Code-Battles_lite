let drinkCoffee = 0

while (drinkCoffee < 10) {
  drinkCoffee = drinkCoffee + 1

  if (drinkCoffee === 8) { break }
  if (drinkCoffee === 5) { continue }

  console.log('Café')
}
