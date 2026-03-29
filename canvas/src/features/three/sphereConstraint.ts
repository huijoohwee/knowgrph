export const projectPositionsToSphereShell = (args: {
  px: Float32Array
  py: Float32Array
  pz: Float32Array
  vx: Float32Array
  vy: Float32Array
  vz: Float32Array
  targetRByIndex: Float32Array
  skipIndexSet?: Set<number> | null
  axisX?: number
  axisY?: number
  axisZ?: number
}) => {
  const { px, py, pz, vx, vy, vz, targetRByIndex, skipIndexSet } = args
  const axisX = Number.isFinite(args.axisX) && (args.axisX as number) > 0 ? Number(args.axisX) : 1
  const axisY = Number.isFinite(args.axisY) && (args.axisY as number) > 0 ? Number(args.axisY) : 1
  const axisZ = Number.isFinite(args.axisZ) && (args.axisZ as number) > 0 ? Number(args.axisZ) : 1
  const axisX2 = axisX * axisX
  const axisY2 = axisY * axisY
  const axisZ2 = axisZ * axisZ
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
    const denom = Math.sqrt(
      (nx * nx) / axisX2 +
      (ny * ny) / axisY2 +
      (nz * nz) / axisZ2,
    )
    const shellScale = denom > 1e-6 ? targetR / denom : targetR
    const ex = nx * shellScale
    const ey = ny * shellScale
    const ez = nz * shellScale
    px[i] = ex
    py[i] = ey
    pz[i] = ez
    const gnx = ex / Math.max(1e-6, targetR * targetR * axisX2)
    const gny = ey / Math.max(1e-6, targetR * targetR * axisY2)
    const gnz = ez / Math.max(1e-6, targetR * targetR * axisZ2)
    const gl = Math.sqrt(gnx * gnx + gny * gny + gnz * gnz)
    const nnx = gl > 1e-6 ? gnx / gl : nx
    const nny = gl > 1e-6 ? gny / gl : ny
    const nnz = gl > 1e-6 ? gnz / gl : nz
    const vr = vx[i] * nnx + vy[i] * nny + vz[i] * nnz
    vx[i] = vx[i] - nnx * vr
    vy[i] = vy[i] - nny * vr
    vz[i] = vz[i] - nnz * vr
  }
}
