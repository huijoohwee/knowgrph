import { isPlainObject } from '@/lib/graph/value'

export const SVG_NS = 'http://www.w3.org/2000/svg'

export const clampFinite = (n: unknown, min: number, max: number): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : NaN
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export const escapeXml = (s: string): string => {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const readCssVar = (name: string, fallback: string): string => {
  try {
    if (typeof document === 'undefined') return fallback
    const el = document.documentElement
    const direct = String(el.style.getPropertyValue(name) || '').trim()
    if (direct) return direct
    const raw = String(getComputedStyle(el).getPropertyValue(name) || '').trim()
    return raw || fallback
  } catch {
    return fallback
  }
}

export const resolveCssColor = (value: string, fallback: string): string => {
  let v = String(value || '').trim()
  if (!v) return fallback
  if (v.startsWith('--')) {
    v = readCssVar(v as `--${string}`, fallback || v)
  }
  for (let depth = 0; depth < 6; depth += 1) {
    const m = v.match(/^var\(\s*(--[^,\s\)]+)\s*(?:,\s*([^)]+)\s*)?\)$/i)
    if (!m) break
    const varName = String(m[1] || '').trim()
    const varFallback = String(m[2] || '').trim()
    const resolved = varName ? readCssVar(varName, varFallback || fallback || v) : ''
    const next = String(resolved || '').trim()
    if (!next || next === v) break
    v = next
  }
  if (v.startsWith('--')) {
    v = readCssVar(v as `--${string}`, fallback || v)
  }
  try {
    if (typeof document === 'undefined') return v
    const body = document.body
    if (!body) return v
    const el = document.createElement('span')
    el.style.color = v
    el.style.display = 'none'
    body.appendChild(el)
    const computed = String(getComputedStyle(el).color || '').trim()
    body.removeChild(el)
    return computed || v
  } catch {
    return v
  }
}

export const estimateLabelWidthPx = (label: string, fontSizePx: number) => {
  const len = Math.max(0, String(label || '').length)
  return Math.max(0, Math.round(len * fontSizePx * 0.56))
}

export const formatSvgNumber = (n: number) => {
  const v = Math.round(n * 100) / 100
  return Number.isFinite(v) ? String(v) : '0'
}

export const formatSvgOpacity = (n: number) => {
  const v = Math.max(0, Math.min(1, Math.round(n * 1000) / 1000))
  return String(v)
}

export type Vec3 = [number, number, number]

export const rotateY = (p: Vec3, a: number): Vec3 => {
  const [x, y, z] = p
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

export const rotateX = (p: Vec3, a: number): Vec3 => {
  const [x, y, z] = p
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x, y * c - z * s, y * s + z * c]
}

export const projectPerspective = (p: Vec3, cameraZ: number): { x: number; y: number; k: number; z: number } => {
  const z = p[2]
  const denom = Math.max(1e-3, cameraZ - z)
  const k = cameraZ / denom
  return { x: p[0] * k, y: p[1] * k, k, z }
}

const parseRgba = (value: string): { color: string; alpha: number } | null => {
  const m = String(value || '')
    .trim()
    .match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (!m) return null
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  const a = Number(m[4])
  if (![r, g, b, a].every(Number.isFinite)) return null
  const rr = Math.max(0, Math.min(255, Math.floor(r)))
  const gg = Math.max(0, Math.min(255, Math.floor(g)))
  const bb = Math.max(0, Math.min(255, Math.floor(b)))
  const aa = Math.max(0, Math.min(1, a))
  return { color: `rgb(${rr}, ${gg}, ${bb})`, alpha: aa }
}

const parseHsla = (value: string): { color: string; alpha: number } | null => {
  const m = String(value || '')
    .trim()
    .match(/^hsla\(\s*([-0-9.]+)\s*(?:deg)?\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i)
  if (!m) return null
  const h = Number(m[1])
  const s = Number(m[2])
  const l = Number(m[3])
  const a = Number(m[4])
  if (![h, s, l, a].every(Number.isFinite)) return null
  const hh = Math.round(h * 1000) / 1000
  const ss = Math.max(0, Math.min(100, Math.round(s * 1000) / 1000))
  const ll = Math.max(0, Math.min(100, Math.round(l * 1000) / 1000))
  const aa = Math.max(0, Math.min(1, a))
  return { color: `hsl(${hh}deg ${ss}% ${ll}%)`, alpha: aa }
}

export const splitCssColorAlpha = (value: string): { color: string; alpha: number } => {
  const v = String(value || '').trim()
  const rgba = parseRgba(v)
  if (rgba) return rgba
  const hsla = parseHsla(v)
  if (hsla) return hsla
  return { color: v, alpha: 1 }
}

export const createCssColorAlphaResolver = () => {
  const cache = new Map<string, { color: string; alpha: number }>()
  return (raw: string): { color: string; alpha: number } => {
    const key = String(raw || '').trim()
    if (!key) return { color: '', alpha: 1 }
    const cached = cache.get(key)
    if (cached) return cached
    const resolved = resolveCssColor(key, key)
    const parsed = splitCssColorAlpha(resolved)
    cache.set(key, parsed)
    return parsed
  }
}

export const createDepthOpacity = (args: {
  minZ: number
  maxZ: number
  opacityMin: unknown
  opacityMax: unknown
}) => {
  const span = Math.max(1e-6, args.maxZ - args.minZ)
  const oMinRaw = typeof args.opacityMin === 'number' && Number.isFinite(args.opacityMin) ? args.opacityMin : 0.35
  const oMaxRaw = typeof args.opacityMax === 'number' && Number.isFinite(args.opacityMax) ? args.opacityMax : 1
  const oMin = Math.max(0, Math.min(1, oMinRaw))
  const oMax = Math.max(oMin, Math.min(1, oMaxRaw))
  return (z: number) => {
    const t = Math.max(0, Math.min(1, (z - args.minZ) / span))
    return oMin + (oMax - oMin) * t
  }
}

export const readCameraPoseTargetCenter = (cameraPose: unknown): { x: number; y: number; z: number } | null => {
  const pose = isPlainObject(cameraPose) ? (cameraPose as Record<string, unknown>) : null
  const target = isPlainObject(pose?.target) ? (pose.target as Record<string, unknown>) : null
  if (!target) return null
  const x = Number(target.x)
  const y = Number(target.y)
  const z = Number(target.z)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null
  return { x, y, z }
}

export const computeCenteredViewBoxForAspect = (args: {
  halfW: number
  halfH: number
  outAspect: number
  padding: number
}): { x: number; y: number; w: number; h: number } => {
  const padding = Math.max(0, args.padding)
  const baseHalfW = Math.max(1, args.halfW + padding)
  const baseHalfH = Math.max(1, args.halfH + padding)

  const outAspect = Number.isFinite(args.outAspect) && args.outAspect > 0 ? args.outAspect : 16 / 9
  let halfW = baseHalfW
  let halfH = baseHalfH
  const boxAspect = halfW / halfH
  if (boxAspect < outAspect) {
    halfW = halfH * outAspect
  } else if (boxAspect > outAspect) {
    halfH = halfW / outAspect
  }
  const w = halfW * 2
  const h = halfH * 2
  return { x: -halfW, y: -halfH, w, h }
}
