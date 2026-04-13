import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function collectRepoLevelHardcodedMotionRecipeOffenders(args?: { repoRoot?: string; allowedHardcodedFallbacks?: string[] }): string[] {
  const repoRoot = resolve(args?.repoRoot || resolve(process.cwd(), '..'))
  const allowedHardcodedFallbacks = new Set(
    (args?.allowedHardcodedFallbacks || [resolve(process.cwd(), 'src/lib/graph/htmlViewer/buildGraphHtmlViewerMarkup.ts')]).map(filePath => resolve(filePath)),
  )
  const offenders: string[] = []

  const visit = (dirPath: string) => {
    for (const entry of readdirSync(dirPath)) {
      const nextPath = resolve(dirPath, entry)
      const stat = statSync(nextPath)
      if (stat.isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
        visit(nextPath)
        continue
      }
      if (!/\.(ts|tsx|css|html)$/.test(entry)) continue
      const text = readUtf8(nextPath)
      if (text.includes('140ms ease') && !allowedHardcodedFallbacks.has(nextPath)) offenders.push(nextPath)
    }
  }

  visit(repoRoot)
  return offenders
}
