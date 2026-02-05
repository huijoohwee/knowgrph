import fs from 'node:fs'
import path from 'node:path'

export function testCollapsibleDefaultsCompactAndAnchoredToLsKeys() {
  const thisFilePath = new URL(import.meta.url).pathname
  const thisDir = path.dirname(thisFilePath)
  const srcRoot = path.resolve(thisDir, '..')

  const pattern = 'defaultCollapsed={false}'
  const matches: string[] = []

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const fullPath = path.join(dir, entry.name)
      if (fullPath === thisFilePath) continue
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
        const text = fs.readFileSync(fullPath, 'utf8')
        if (text.includes(pattern)) {
          matches.push(fullPath)
        }
      }
    }
  }

  walk(srcRoot)

  if (matches.length > 0) {
    throw new Error(`defaultCollapsed={false} is not allowed; found in ${matches.join(', ')}`)
  }

  const orchestratorHookPath = path.join(
    srcRoot,
    'features',
    'panels',
    'hooks',
    'useOrchestratorPanelState.ts',
  )
  const hookText = fs.readFileSync(orchestratorHookPath, 'utf8')

  const requiredSnippets = [
    'LS_KEYS.orchestratorGraphRagCollapsed, true',
    'LS_KEYS.orchestratorPresetsCollapsed, true',
    'LS_KEYS.orchestratorEditorCollapsed, true',
    'LS_KEYS.orchestratorContextCollapsed, true',
    'LS_KEYS.orchestratorWorkflowIndexingCollapsed, true',
    'LS_KEYS.orchestratorWorkflowTracingCollapsed, true',
  ]

  for (const snippet of requiredSnippets) {
    if (!hookText.includes(snippet)) {
      throw new Error(`Missing compact default snippet in useOrchestratorPanelState: ${snippet}`)
    }
  }
}
