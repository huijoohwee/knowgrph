import type { GraphSchema } from '@/lib/graph/schema'

export const readAllowGroupResize = (schema: GraphSchema | null | undefined): boolean => {
  const s = schema || null
  if (!s) return false
  const behavior = s.behavior as unknown as { allowGroupResize?: unknown }
  if (behavior && behavior.allowGroupResize === false) return false
  const cfg = s.layout?.groups as unknown as { resizable?: unknown } | null
  if (cfg && cfg.resizable === false) return false
  return true
}

