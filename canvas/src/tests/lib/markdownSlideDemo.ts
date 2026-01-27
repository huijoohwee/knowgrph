import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REL = ['sandbox', 'demo', 'markdown-slide-demo.md'] as const

export const resolveMarkdownSlideDemoPath = (): string | null => {
  const envPath = String(process.env.KG_MARKDOWN_SLIDE_DEMO_PATH || '').trim()
  if (envPath) {
    try {
      if (existsSync(envPath)) return envPath
    } catch {
      void 0
    }
  }

  const starts = [
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url)),
  ].filter(Boolean)

  const checked = new Set<string>()
  for (const start of starts) {
    let dir = path.resolve(start)
    for (let i = 0; i < 10; i += 1) {
      if (checked.has(dir)) break
      checked.add(dir)
      const candidate = path.join(dir, ...REL)
      try {
        if (existsSync(candidate)) return candidate
      } catch {
        void 0
      }
      const parent = path.dirname(dir)
      if (!parent || parent === dir) break
      dir = parent
    }
  }

  return null
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

