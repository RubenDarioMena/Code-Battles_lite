def g():
    print("cuerpo")
    yield

next(g())
print("fin")
