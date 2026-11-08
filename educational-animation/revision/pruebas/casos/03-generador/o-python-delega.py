def g():
    yield from [1, 2]

print(next(g()))
