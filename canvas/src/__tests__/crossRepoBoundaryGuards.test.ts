import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function listFilesRecursively(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...listFilesRecursively(p))
    else out.push(p)
  }
  return out
}

const SRC_DIR = resolve(process.cwd(), 'src')

export function testForbidSiblingRepoSourceImports() {
  const files = listFilesRecursively(SRC_DIR).filter(f => /\.(ts|tsx)$/.test(f))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\bimport\(\s*['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\brequire\(\s*['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\bfrom\s+['"][^'"]*grph-shared\/src\//,
    /\bimport\(\s*['"][^'"]*grph-shared\/src\//,
    /\brequire\(\s*['"][^'"]*grph-shared\/src\//,
  ]
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      if (re.test(text)) {
        violations.push({ file, pattern: String(re) })
      }
    }
  }
  if (violations.length) {
    const msg = violations.map(v => `${v.file} matches ${v.pattern}`).join('\n')
    throw new Error(`Forbidden sibling-repo source imports detected:\n${msg}`)
  }
}

export function testHostGympgrphIntegrationUsesPackageRootOnly() {
  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"]gympgrph\/[^'"]+['"]/,
    /\bimport\(\s*['"]gympgrph\/[^'"]+['"]/,
    /\brequire\(\s*['"]gympgrph\/[^'"]+['"]/,
  ]
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      if (re.test(text)) violations.push({ file, pattern: String(re) })
    }
  }
  if (violations.length) {
    const msg = violations.map(v => `${v.file} matches ${v.pattern}`).join('\n')
    throw new Error(`Knowgrph must import gympgrph via package root only:\n${msg}`)
  }
}

export function testForbidGympgrphHookUsageInHost() {
  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: string[] = []
  const re = /\buseGympgrphStore\s*\(/g
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    if (re.test(text)) violations.push(file)
  }
  if (violations.length) {
    throw new Error(`Host code must not call gympgrph React hooks directly (avoid duplicate React instances). Use the host external-store adapter instead:\n${violations.join('\n')}`)
  }
}

export function testForbidMagicLocalStorageKeysOutsideCentralConstants() {
  const lsConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.ls.ts')
  const lsConfigText = readFileSync(lsConfigPath, 'utf8')
  const knownKeys = (() => {
    const out = new Set<string>()
    const re = /:\s*(['"])(kg:[^'"]+)\1/g
    let m: RegExpExecArray | null = null
    while ((m = re.exec(lsConfigText))) {
      const key = m[2]
      if (typeof key !== 'string') continue
      const trimmed = key.trim()
      if (!trimmed) continue
      if (trimmed.split(':').length < 3) continue
      out.add(trimmed)
    }
    return out
  })()

  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
    .filter(f => !f.endsWith(join('src', 'lib', 'config.ls.ts')))
  const violations: Array<{ file: string }> = []
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const key of knownKeys) {
      if (text.includes(`'${key}'`) || text.includes(`"${key}"`)) {
        violations.push({ file })
        break
      }
    }
  }
  if (violations.length) {
    const msg = violations.map(v => v.file).join('\n')
    throw new Error(`Hardcoded LocalStorage keys found outside config.ls.ts:\n${msg}`)
  }
}

export function testCuragrphAliasContractInViteConfig() {
  const viteConfigPath = resolve(process.cwd(), 'vite.config.ts')
  const text = readFileSync(viteConfigPath, 'utf8')
  const requiredSnippets = [
    "./node_modules/curagrph/src/components/BottomPanel/$1",
    "./node_modules/curagrph/src/features/graph-data-table/$1",
    "./node_modules/curagrph/src/features/json/$1",
    "./node_modules/curagrph/src/features/markdown/$1",
    "./node_modules/curagrph/src/features/panels/views/preview-panel/ui/$1",
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`Curagrph alias contract missing in vite.config.ts:\n${msg}`)
  }
}
