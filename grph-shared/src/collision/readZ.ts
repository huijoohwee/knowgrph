export type ExplicitZ = { z: number; hasZ: boolean }

export function readExplicitZ(obj: unknown): ExplicitZ {
  if (!obj || typeof obj !== 'object') return { z: 0, hasZ: false }

  const anyObj = obj as { z?: unknown; properties?: unknown }
  const rawZ = anyObj.z
  if (typeof rawZ === 'number' && Number.isFinite(rawZ)) return { z: rawZ, hasZ: true }

  const rawProps = anyObj.properties
  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) return { z: 0, hasZ: false }

  const props = rawProps as Record<string, unknown>
  const pos3d = props['pos3d']
  if (!Array.isArray(pos3d) || pos3d.length !== 3) return { z: 0, hasZ: false }

  const v = pos3d[2]
  if (typeof v === 'number' && Number.isFinite(v)) return { z: v, hasZ: true }
  return { z: 0, hasZ: false }
}

