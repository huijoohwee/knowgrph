import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(process.cwd(), '..')
const DIV_TAG = 'di' + 'v'
const SCANNED_EXTENSIONS = new Set(['.cjs', '.html', '.js', '.json', '.jsonld', '.md', '.mjs', '.ts', '.tsx'])
const SKIPPED_DIRS = new Set([
  '.git',
  '.turbo',
  '.wrangler',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const FORBIDDEN_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'opening generic division tag', pattern: new RegExp(`${escapeRegExp(`<${DIV_TAG}`)}\\b`, 'i') },
  { label: 'closing generic division tag', pattern: new RegExp(escapeRegExp(`</${DIV_TAG}>`), 'i') },
  { label: 'document.createElement generic division host', pattern: new RegExp(`document\\.createElement\\((['"])${DIV_TAG}\\1\\)`, 'i') },
  { label: 'createElement generic division host', pattern: new RegExp(`createElement\\((['"])${DIV_TAG}\\1\\)`, 'i') },
  { label: 'HAST generic division tagName', pattern: new RegExp(`tagName:\\s*(['"])${DIV_TAG}\\1`, 'i') },
  { label: 'generic division element type', pattern: new RegExp(`HTML${DIV_TAG}Element`, 'i') },
  { label: 'component generic division alias', pattern: new RegExp(`\\bas(?:=|:)\\s*\\{?(['"])${DIV_TAG}\\1`, 'i') },
]

const shouldSkipDir = (dirName: string): boolean => SKIPPED_DIRS.has(dirName)

const walkFiles = (rootPath: string): string[] => {
  const out: string[] = []
  const visit = (currentPath: string) => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!shouldSkipDir(entry.name)) visit(path.join(currentPath, entry.name))
        continue
      }
      if (!entry.isFile()) continue
      const filePath = path.join(currentPath, entry.name)
      if (SCANNED_EXTENSIONS.has(path.extname(filePath))) out.push(filePath)
    }
  }
  visit(rootPath)
  return out
}

const lineNumberForIndex = (text: string, index: number): number => text.slice(0, Math.max(0, index)).split(/\r?\n/).length

export function testRepoSourcesForbidGenericDivisionMarkup() {
  const violations: string[] = []
  for (const filePath of walkFiles(REPO_ROOT)) {
    if (!statSync(filePath).isFile()) continue
    const text = readFileSync(filePath, 'utf8')
    for (const rule of FORBIDDEN_PATTERNS) {
      const match = rule.pattern.exec(text)
      if (!match || match.index < 0) continue
      const relPath = path.relative(REPO_ROOT, filePath)
      violations.push(`${relPath}:${lineNumberForIndex(text, match.index)} ${rule.label}`)
    }
  }

  if (violations.length > 0) {
    throw new Error(`Expected repo source/docs/tests to avoid generic division markup:\n${violations.join('\n')}`)
  }
}
