import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SANDBOX_DIR_NAME = String(process.env.KG_SANDBOX_DIRNAME || '').trim() || 'sandbox'
const SANDBOX_DEMO_SUBDIR_NAME = String(process.env.KG_SANDBOX_DEMO_SUBDIR || '').trim() || 'demo'

const isDirectory = (p: string): boolean => {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

const isFile = (p: string): boolean => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

const resolveSandboxRoot = (): string | null => {
  const envRoot = String(process.env.KG_SANDBOX_ROOT || '').trim()
  if (envRoot && isDirectory(envRoot)) return envRoot

  const starts = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))].filter(Boolean)
  const checked = new Set<string>()
  for (const start of starts) {
    let dir = path.resolve(start)
    for (let i = 0; i < 10; i += 1) {
      if (checked.has(dir)) break
      checked.add(dir)
      const candidate = path.join(dir, SANDBOX_DIR_NAME)
      if (isDirectory(candidate)) return candidate
      const parent = path.dirname(dir)
      if (!parent || parent === dir) break
      dir = parent
    }
  }
  return null
}

const looksLikeFrontmatterMermaidMarkdown = (text: string): boolean => {
  const raw = String(text || '')
  if (!raw.startsWith('---\n')) return false
  const end = raw.indexOf('\n---')
  if (end < 0) return false
  const fm = raw.slice(0, Math.min(end + 4, 8000))
  return /\nmermaid\s*:\s*(\||>|\S)/.test(fm)
}

const pickDemoMarkdownFile = (sandboxRoot: string): string | null => {
  const explicit = String(process.env.KG_MARKDOWN_SLIDE_DEMO_PATH || '').trim()
  if (explicit && existsSync(explicit) && isFile(explicit)) return explicit

  const demoDir = path.join(sandboxRoot, SANDBOX_DEMO_SUBDIR_NAME)
  if (!isDirectory(demoDir)) return null

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

  for (const p of candidates) {
    try {
      const text = readFileSync(p, 'utf8')
      if (looksLikeFrontmatterMermaidMarkdown(text)) return p
    } catch {
      void 0
    }
  }

  return candidates[0] || null
}

export const resolveMarkdownSlideDemoPath = (): string | null => {
  const sandboxRoot = resolveSandboxRoot()
  if (!sandboxRoot) return null
  return pickDemoMarkdownFile(sandboxRoot)
}

export const resolveMarkdownSlideDemoDocumentPath = (): string | null => {
  const p = resolveMarkdownSlideDemoPath()
  if (!p) return null
  const normalized = String(p || '').replace(/\\/g, '/').trim()
  if (!normalized) return null
  if (/^https?:\/\//i.test(normalized)) return normalized
  return path.isAbsolute(normalized) ? path.basename(normalized) : normalized
}

export const readMarkdownSlideDemo = (): string | null => {
  const p = resolveMarkdownSlideDemoPath()
  if (!p) return null
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}
