const readViteEnvString = (key: string): string => {
  if (typeof import.meta !== 'undefined') {
    const meta = import.meta as unknown as { env?: Record<string, unknown> }
    const env = meta.env
    const val = env && env[key]
    if (typeof val === 'string') return val
  }
  if (typeof process !== 'undefined' && process.env) {
    const pv = process.env[key]
    return typeof pv === 'string' ? pv : ''
  }
  return ''
}

const normalizeSlashes = (value: string): string => String(value || '').replace(/\\/g, '/')

const stripFileScheme = (value: string): string => {
  const v = String(value || '').trim()
  if (!v) return ''
  if (v.startsWith('file://')) return v.slice('file://'.length)
  return v
}

const normalizeRelSegments = (value: string): string => {
  const input = normalizeSlashes(value).trim().replace(/^\/+/, '')
  if (!input) return ''
  const parts = input.split('/').filter(Boolean)
  const out: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      out.pop()
      continue
    }
    out.push(part)
  }
  return out.join('/')
}

export const getViteCodebaseRoot = (): string => {
  const raw = readViteEnvString('VITE_CODEBASE_ROOT')
  const normalized = normalizeSlashes(raw).trim().replace(/\/+$/, '')
  return normalized
}

const basenameOf = (value: string): string => {
  const s = normalizeSlashes(value)
  const noFrag = s.split('#')[0] || ''
  const trimmed = noFrag.trim().replace(/\/+$/, '')
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

const looksLikeHostAbsoluteFsPath = (value: string): boolean => {
  const s = normalizeSlashes(value)
  if (/^[a-zA-Z]:\//.test(s)) return true
  return (
    s.startsWith('/Users/') ||
    s.startsWith('/home/') ||
    s.startsWith('/Volumes/') ||
    s.startsWith('/private/') ||
    s.startsWith('/tmp/') ||
    s.startsWith('/var/')
  )
}

export const coerceCodebaseRelPath = (raw: unknown): string => {
  const inputRaw = stripFileScheme(String(raw ?? ''))
  const input = normalizeSlashes(inputRaw).trim()
  if (!input) return ''
  if (/^https?:\/\//i.test(input)) return input

  const withoutFsPrefix = (() => {
    const s = input.startsWith('/@fs') ? input.slice('/@fs'.length) : input
    return s.trim()
  })()

  const root = getViteCodebaseRoot()
  const candidateAbs = normalizeSlashes(withoutFsPrefix)
  if (root) {
    const rootPrefix = root.endsWith('/') ? root : `${root}/`
    if (candidateAbs === root) return ''
    if (candidateAbs.startsWith(rootPrefix)) {
      const rel = candidateAbs.slice(rootPrefix.length)
      return normalizeRelSegments(rel)
    }
  }

  const isAbsLike = candidateAbs.startsWith('/') || /^[a-zA-Z]:\//.test(candidateAbs)
  if (isAbsLike && looksLikeHostAbsoluteFsPath(candidateAbs)) {
    return normalizeRelSegments(candidateAbs)
  }

  return normalizeRelSegments(candidateAbs)
}
