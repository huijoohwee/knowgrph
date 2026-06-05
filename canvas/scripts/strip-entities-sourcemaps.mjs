import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'

const SOURCE_MAP_RE = /^\/\/\# sourceMappingURL=.*\n?/gm

async function walkJsFiles(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full)
    }
  }
  return out
}

async function stripSourcemapComments(dir) {
  if (!existsSync(dir)) return { scanned: 0, changed: 0 }
  const files = await walkJsFiles(dir)
  let changed = 0
  for (const file of files) {
    let raw
    try {
      raw = await fs.readFile(file, 'utf8')
    } catch {
      continue
    }
    const next = raw.replace(SOURCE_MAP_RE, '')
    if (next === raw) continue
    try {
      await fs.writeFile(file, next, 'utf8')
      changed += 1
    } catch {
      void 0
    }
  }
  return { scanned: files.length, changed }
}

const packageRoot = process.cwd()
const repoRoot = path.resolve(packageRoot, '..')
const roots = [
  path.resolve(packageRoot, 'node_modules/entities/lib/esm'),
  path.resolve(packageRoot, 'node_modules/markdown-it/node_modules/entities/lib/esm'),
  path.resolve(repoRoot, 'node_modules/entities/lib/esm'),
  path.resolve(repoRoot, 'node_modules/markdown-it/node_modules/entities/lib/esm'),
]

for (const root of roots) {
  const { scanned, changed } = await stripSourcemapComments(root)
  if (scanned > 0) {
    process.stdout.write(`[strip-entities-sourcemaps] ${root} scanned=${scanned} changed=${changed}\n`)
  }
}
