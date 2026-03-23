import { Sphere, type Vec3, type Box3 as LocalBox3 } from '@/lib/math/Sphere'

const abs = (n: number) => (n < 0 ? -n : n)

const makeRng = (seed: number) => {
  let s = seed | 0
  return () => {
    s = (1103515245 * s + 12345) | 0
    const u = (s >>> 0) / 0xffffffff
    return u
  }
}

const refContainsPoint = (center: Vec3, radius: number, point: Vec3) => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dz = point.z - center.z
  return (dx * dx + dy * dy + dz * dz) <= (radius * radius)
}

const refClampPoint = (center: Vec3, radius: number, point: Vec3): Vec3 => {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const dz = point.z - center.z
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 <= (radius * radius)) return { x: point.x, y: point.y, z: point.z }
  const d = Math.sqrt(Math.max(1e-12, d2))
  const k = radius / d
  return { x: center.x + dx * k, y: center.y + dy * k, z: center.z + dz * k }
}

const refIntersectsBox = (center: Vec3, radius: number, box: LocalBox3) => {
  const x = Math.max(box.min.x, Math.min(center.x, box.max.x))
  const y = Math.max(box.min.y, Math.min(center.y, box.max.y))
  const z = Math.max(box.min.z, Math.min(center.z, box.max.z))
  const dx = x - center.x
  const dy = y - center.y
  const dz = z - center.z
  return (dx * dx + dy * dy + dz * dz) <= (radius * radius)
}

const expectCloseVec3 = (a: Vec3, b: Vec3, eps: number) => {
  if (abs(a.x - b.x) > eps || abs(a.y - b.y) > eps || abs(a.z - b.z) > eps) {
    throw new Error(`vec3 mismatch: a=(${a.x},${a.y},${a.z}) b=(${b.x},${b.y},${b.z})`)
  }
}

export const testThreeSphereLocalMatchesThreeJsClampAndContains = () => {
  const rnd = makeRng(1337)
  const eps = 1e-6

  for (let k = 0; k < 80; k += 1) {
    const center: Vec3 = {
      x: (rnd() * 2 - 1) * 200,
      y: (rnd() * 2 - 1) * 200,
      z: (rnd() * 2 - 1) * 200,
    }
    const radius = rnd() * 160
    const local = new Sphere(center, radius)

    for (let i = 0; i < 40; i += 1) {
      const p: Vec3 = {
        x: (rnd() * 2 - 1) * 400,
        y: (rnd() * 2 - 1) * 400,
        z: (rnd() * 2 - 1) * 400,
      }
      const containsLocal = local.containsPoint(p)
      const containsThree = refContainsPoint(center, radius, p)
      if (containsLocal !== containsThree) {
        throw new Error(`containsPoint mismatch: local=${containsLocal} three=${containsThree}`)
      }

      const clLocal = local.clampPoint(p)
      const clThree = refClampPoint(center, radius, p)
      expectCloseVec3(clLocal, clThree, eps)
    }

    const box: LocalBox3 = {
      min: { x: (rnd() * 2 - 1) * 200, y: (rnd() * 2 - 1) * 200, z: (rnd() * 2 - 1) * 200 },
      max: { x: (rnd() * 2 - 1) * 200, y: (rnd() * 2 - 1) * 200, z: (rnd() * 2 - 1) * 200 },
    }
    const min = {
      x: Math.min(box.min.x, box.max.x),
      y: Math.min(box.min.y, box.max.y),
      z: Math.min(box.min.z, box.max.z),
    }
    const max = {
      x: Math.max(box.min.x, box.max.x),
      y: Math.max(box.min.y, box.max.y),
      z: Math.max(box.min.z, box.max.z),
    }
    const normalizedBox: LocalBox3 = { min, max }
    const boxLocal = local.intersectsBox(normalizedBox)
    const boxThree = refIntersectsBox(center, radius, normalizedBox)
    if (boxLocal !== boxThree) {
      throw new Error(`intersectsBox mismatch: local=${boxLocal} three=${boxThree}`)
    }
  }
}
