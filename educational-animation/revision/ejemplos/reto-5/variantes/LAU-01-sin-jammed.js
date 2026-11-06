// Igual, pero sin mirar al otro lanzador
while (true) {
  const pos = autoTarget("drone", "visual")
    ?? autoTarget("stealth", "visual")
    ?? autoTarget("crawler", "visual")
  if (failureRate < 0.12) {
    burstFire(pos)
  } else {
    regularShoot(pos)
  }
  await esperar(0.25)
}
