import * as THREE from 'three'

const Z_NORMAL = new THREE.Vector3(0, 0, 1)

export const intersectRayWithZPlane = (ray: THREE.Ray, z = 0, out?: THREE.Vector3): THREE.Vector3 | null => {
  const plane = new THREE.Plane(Z_NORMAL, -z)
  const target = out || new THREE.Vector3()
  const hit = ray.intersectPlane(plane, target)
  return hit ? target : null
}
