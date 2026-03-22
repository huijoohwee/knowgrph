export const projectPositionsToSphereShell = (args: {
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  targetRByIndex: Float32Array
  skipIndexSet?: Set<number> | null
}) => {
  const { px, py, pz, vx, vy, vz, targetRByIndex, skipIndexSet } = args
  const n = Math.min(px.length, py.length, pz.length, vx.length, vy.length, vz.length, targetRByIndex.length)
  for (let i = 0; i < n; i += 1) {
    if (skipIndexSet && skipIndexSet.has(i)) continue
    const targetR = targetRByIndex[i]
    if (!(typeof targetR === 'number' && Number.isFinite(targetR) && targetR > 0)) continue
    const x = px[i]
    const y = py[i]
    const z = pz[i]
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) continue
    const rlen = Math.sqrt(x * x + y * y + z * z)
    if (!(rlen > 1e-6)) {
      px[i] = targetR
      py[i] = 0
      pz[i] = 0
      vx[i] = 0
      vy[i] = 0
      vz[i] = 0
      continue
    }
    const nx = x / rlen
    const ny = y / rlen
    const nz = z / rlen
    px[i] = nx * targetR
    py[i] = ny * targetR
    pz[i] = nz * targetR
    const vr = vx[i] * nx + vy[i] * ny + vz[i] * nz
    vx[i] = vx[i] - nx * vr
    vy[i] = vy[i] - ny * vr
    vz[i] = vz[i] - nz * vr
  }
}

