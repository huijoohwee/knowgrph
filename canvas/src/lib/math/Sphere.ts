export type Vec3 = { x: number; y: number; z: number }

export type Box3 = { min: Vec3; max: Vec3 }

const isFiniteNumber = (n: unknown): n is number => {
  return typeof n === 'number' && Number.isFinite(n)
}

export const createVec3 = (x: unknown, y: unknown, z: unknown): Vec3 => {
  return {
    x: isFiniteNumber(x) ? x : 0,
    y: isFiniteNumber(y) ? y : 0,
    z: isFiniteNumber(z) ? z : 0,
  }
}

export class Sphere {
  center: Vec3
  radius: number

  constructor(center?: Vec3, radius?: number) {
    this.center = center ? { x: center.x, y: center.y, z: center.z } : { x: 0, y: 0, z: 0 }
    this.radius = isFiniteNumber(radius) ? radius : -1
  }

  set(center: Vec3, radius: number) {
    this.center.x = center.x
    this.center.y = center.y
    this.center.z = center.z
    this.radius = radius
    return this
  }

  copy(sphere: Sphere) {
    this.center.x = sphere.center.x
    this.center.y = sphere.center.y
    this.center.z = sphere.center.z
    this.radius = sphere.radius
    return this
  }

  clone() {
    return new Sphere(this.center, this.radius)
  }

  makeEmpty() {
    this.center.x = 0
    this.center.y = 0
    this.center.z = 0
    this.radius = -1
    return this
  }

  isEmpty() {
    return !(this.radius >= 0)
  }

  containsPoint(point: Vec3) {
    if (this.isEmpty()) return false
    const dx = point.x - this.center.x
    const dy = point.y - this.center.y
    const dz = point.z - this.center.z
    return (dx * dx + dy * dy + dz * dz) <= (this.radius * this.radius)
  }

  distanceToPoint(point: Vec3) {
    const dx = point.x - this.center.x
    const dy = point.y - this.center.y
    const dz = point.z - this.center.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - this.radius
  }

  intersectsSphere(sphere: Sphere) {
    const dx = sphere.center.x - this.center.x
    const dy = sphere.center.y - this.center.y
    const dz = sphere.center.z - this.center.z
    const r = this.radius + sphere.radius
    return (dx * dx + dy * dy + dz * dz) <= (r * r)
  }

  intersectsBox(box: Box3) {
    if (this.isEmpty()) return false
    const x = Math.max(box.min.x, Math.min(this.center.x, box.max.x))
    const y = Math.max(box.min.y, Math.min(this.center.y, box.max.y))
    const z = Math.max(box.min.z, Math.min(this.center.z, box.max.z))
    const dx = x - this.center.x
    const dy = y - this.center.y
    const dz = z - this.center.z
    return (dx * dx + dy * dy + dz * dz) <= (this.radius * this.radius)
  }

  clampPoint(point: Vec3, target?: Vec3) {
    const out = target || { x: 0, y: 0, z: 0 }
    const dx = point.x - this.center.x
    const dy = point.y - this.center.y
    const dz = point.z - this.center.z
    const d2 = dx * dx + dy * dy + dz * dz
    const r = this.radius
    if (!(r >= 0) || d2 <= (r * r)) {
      out.x = point.x
      out.y = point.y
      out.z = point.z
      return out
    }
    const d = Math.sqrt(Math.max(1e-12, d2))
    const k = r / d
    out.x = this.center.x + dx * k
    out.y = this.center.y + dy * k
    out.z = this.center.z + dz * k
    return out
  }

  getBoundingBox(target?: Box3) {
    const out = target || { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
    if (this.isEmpty()) {
      out.min.x = 0; out.min.y = 0; out.min.z = 0
      out.max.x = 0; out.max.y = 0; out.max.z = 0
      return out
    }
    const r = this.radius
    out.min.x = this.center.x - r
    out.min.y = this.center.y - r
    out.min.z = this.center.z - r
    out.max.x = this.center.x + r
    out.max.y = this.center.y + r
    out.max.z = this.center.z + r
    return out
  }
}

