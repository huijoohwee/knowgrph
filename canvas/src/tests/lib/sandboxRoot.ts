import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const isDirectory = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

export const isFile = (p: string): boolean => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

export const resolveSandboxRoot = (): string | null => {
  const envRoot = String(process.env.KG_SANDBOX_ROOT || '').trim()
  if (envRoot && isDirectory(envRoot)) return envRoot

  const sandboxDirName = String(process.env.KG_SANDBOX_DIRNAME || '').trim() || 'sandbox'
  const starts = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))].filter(Boolean)
  const checked = new Set<string>()
  for (const start of starts) {
    let dir = path.resolve(start)
    for (let i = 0; i < 10; i += 1) {
      if (checked.has(dir)) break
      checked.add(dir)
      const candidate = path.join(dir, sandboxDirName)
      if (isDirectory(candidate)) return candidate
      const parent = path.dirname(dir)
      if (!parent || parent === dir) break
      dir = parent
    }
  }
  return null
}

export const resolveSandboxDemoDir = (): string | null => {
  const sandboxRoot = resolveSandboxRoot()
  if (!sandboxRoot) return null
  const demoSubdir = String(process.env.KG_SANDBOX_DEMO_SUBDIR || '').trim() || 'demo'
  const demoDir = path.join(sandboxRoot, demoSubdir)
  return isDirectory(demoDir) ? demoDir : null
}

export const pickSandboxDemoMarkdownFile = (args: {
  preferBasename?: string
  predicate?: (text: string) => boolean
  envVarPathKey?: string
}): string | null => {
  const envVarKey = String(args.envVarPathKey || '').trim()
  if (envVarKey) {
    const explicit = String(process.env[envVarKey] || '').trim()
    if (explicit && existsSync(explicit) && isFile(explicit)) return explicit
  }

  const demoDir = resolveSandboxDemoDir()
  if (!demoDir) return null

  let entries: string[] = []
  try {
    entries = readdirSync(demoDir)
  } catch {
    entries = []
  }

  const candidates = entries
    .filter(name => name.toLowerCase().endsWith('.md'))
    .map(name => path.join(demoDir, name))
    .filter(p => isFile(p))

  const prefer = String(args.preferBasename || '').trim()
  if (prefer) {
    const match = candidates.find(p => path.basename(p) === prefer)
    if (match) return match
  }

  if (typeof args.predicate === 'function') {
    for (const p of candidates) {
      try {
        const text = readFileSync(p, 'utf8')
        if (args.predicate(text)) return p
      } catch {
        void 0
      }
    }
  }

  return candidates[0] || null
}

export const readSandboxDemoText = (args: {
  preferBasename?: string
  predicate?: (text: string) => boolean
  envVarPathKey?: string
}): { path: string; text: string } | null => {
  const p = pickSandboxDemoMarkdownFile(args)
  if (!p) return null
  try {
    return { path: p, text: readFileSync(p, 'utf8') }
  } catch {
    return null
  }
}

export const toDocumentPath = (p: string): string => {
  const normalized = String(p || '').replace(/\\/g, '/').trim()
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  return path.isAbsolute(normalized) ? path.basename(normalized) : normalized
}

