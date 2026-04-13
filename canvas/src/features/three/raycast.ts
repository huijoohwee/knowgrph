import { Plane, Ray, Vector3 } from 'three'

const Z_NORMAL = new Vector3(0, 0, 1)

export const intersectRayWithZPlane = (ray: Ray, z = 0, out?: Vector3): Vector3 | null => {
  const plane = new Plane(Z_NORMAL, -z)
  const target = out || new Vector3()
  const hit = ray.intersectPlane(plane, target)
  return hit ? target : null
}
