import fs from 'node:fs'
import path from 'node:path'

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonld',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])

const SKIP_DIRS = new Set([
  '.git',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

const FORBIDDEN_KTV_TERMINOLOGY = [
  ['KeyType', 'Config'].join(''),
  ['Key Type ', 'Config'].join(''),
  ['Key/Type/', 'Config'].join(''),
  ['ktvHeader', 'ConfiguredValueLabel'].join(''),
  ['testMcpHubKtvHeaderUses', 'ConfiguredValueLabel'].join(''),
  ['assertMcpHubUses', 'ConfiguredKtvValueHeader'].join(''),
  ['valueLabel: ', "'Config'"].join(''),
  ['valueLabel: ', '"Config"'].join(''),
]

const isTextFile = (absPath: string): boolean => {
  return TEXT_EXTENSIONS.has(path.extname(absPath).toLowerCase())
}

const findLineNumber = (text: string, token: string): number => {
  const index = text.indexOf(token)
  return index === -1 ? 1 : text.slice(0, index).split('\n').length
}

const scanKtvTerminology = (scanRoot: string, repoRoot: string): string[] => {
  if (!fs.existsSync(scanRoot)) {
    return []
  }

  const findings: string[] = []
  const visit = (absPath: string) => {
    const stat = fs.statSync(absPath)
    const relativePath = path.relative(repoRoot, absPath)
    for (const token of FORBIDDEN_KTV_TERMINOLOGY) {
      if (relativePath.includes(token)) {
        findings.push(`${relativePath}:filename`)
      }
    }

    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(absPath))) {
        return
      }
      for (const child of fs.readdirSync(absPath).sort()) {
        visit(path.join(absPath, child))
      }
      return
    }

    if (!stat.isFile() || !isTextFile(absPath)) {
      return
    }

    const text = fs.readFileSync(absPath, { encoding: 'utf8' })
    for (const token of FORBIDDEN_KTV_TERMINOLOGY) {
      if (text.includes(token)) {
        findings.push(`${relativePath}:${findLineNumber(text, token)}`)
      }
    }
  }

  visit(scanRoot)
  return findings
}

export const testMainPanelKtvTerminologyMaintainsKeyTypeValueVocabulary = () => {
  const root = process.cwd()
  const repoRoot = path.resolve(root, '..')
  const scanRoots = [
    path.resolve(root, 'src'),
    path.resolve(root, 'artifacts', 'live-verification'),
    path.resolve(repoRoot, 'cloudflare'),
    path.resolve(repoRoot, 'docs'),
    path.resolve(repoRoot, 'grph-shared', 'src'),
    path.resolve(repoRoot, 'mcp'),
    path.resolve(repoRoot, 'scripts'),
  ]
  const findings = scanRoots.flatMap(scanRoot => scanKtvTerminology(scanRoot, repoRoot))
  if (findings.length > 0) {
    throw new Error(`Expected MainPanel MCP KTV terminology to stay KeyTypeValue with configurable Value cells:\n${findings.join('\n')}`)
  }
}
