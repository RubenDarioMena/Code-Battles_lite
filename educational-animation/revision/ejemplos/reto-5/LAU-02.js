// Un solo reparador para LAU-01 y LAU-02
while (true) {
  const pos = autoTarget("drone", "visual")
    ?? autoTarget("stealth", "visual")
    ?? autoTarget("crawler", "visual")
  if (LAU_01.jammed) {
    // El reparador está ocupado
    regularShoot(pos)
  } else if (failureRate < 0.12) {
    burstFire(pos)
  } else {
    // Que baje el failureRate
    regularShoot(pos)
  }
  await esperar(0.25)
}
