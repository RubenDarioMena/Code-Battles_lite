# Pares dentro del comentario: ([{ }])
def resumir(valores):
    total = 0
    for valor in valores:
        if valor > 1:
            total += valor
    return total

datos = [1, 2, 3]
print(resumir(datos))  # 5
print("á 😀 <b> [texto]")
