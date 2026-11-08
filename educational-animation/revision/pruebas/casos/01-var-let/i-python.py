f = []
for i in range(3):
    f.append(lambda: i)
print(f[0](), f[1](), f[2]())
