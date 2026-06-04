import fs from 'node:fs'
import path from 'node:path'
import { KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME } from '@/features/agent-ready/mainPanelSuperAgentIntegrationContract'

const findKnowgrphRoot = (startDir: string): string => {
  let current = path.resolve(startDir)
  for (let i = 0; i < 8; i += 1) {
    if (
      fs.existsSync(path.join(current, 'canvas', 'src')) &&
      fs.existsSync(path.join(current, 'knowgrph_parser'))
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.resolve(startDir)
}

export function resolveResearchAgentDemoPath(startDir = process.cwd()): string {
  const explicitPath = String(process.env.KNOWGRPH_RESEARCH_AGENT_DEMO_PATH || '').trim()
  if (explicitPath) return path.resolve(explicitPath)

  const knowgrphRoot = findKnowgrphRoot(startDir)
  const publishedDocsRoot = String(process.env.KNOWGRPH_PUBLISHED_DOCS_ROOT || '').trim()
  const candidates = [
    publishedDocsRoot ? path.resolve(publishedDocsRoot, KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME) : '',
    path.resolve(knowgrphRoot, '..', 'huijoohwee', 'docs', KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME),
    path.resolve(knowgrphRoot, 'docs', 'documents', KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME),
  ].filter(Boolean)

  const found = candidates.find(candidate => fs.existsSync(candidate))
  return found || candidates[0] || path.resolve(startDir, KNOWGRPH_SUPERAGENT_RESEARCH_DEMO_BASENAME)
}

export function readResearchAgentDemoText(): string {
  const demoPath = resolveResearchAgentDemoPath()
  if (!fs.existsSync(demoPath)) {
    throw new Error(`expected research agent demo markdown at ${demoPath}`)
  }
  const text = fs.readFileSync(demoPath, 'utf8')
  if (!text.trim()) throw new Error(`expected research agent demo markdown at ${demoPath} to be non-empty`)
  return text
}
