import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readRepoFile = (repoRelativePath: string): string =>
  readFileSync(resolve(process.cwd(), '..', repoRelativePath), 'utf8')

export function testAgentReadyDocsUseCanonicalImplementedContractNames() {
  const mainPath = resolve(process.cwd(), '..', 'docs/documents/knowgrph-agent-ready-prd-tad.md')
  const companionPath = resolve(process.cwd(), '..', 'docs/documents/knowgrph-agent-ready-prd-tad.companion.md')
  const runtimePath = resolve(process.cwd(), '..', 'docs/documents/knowgrph-agent-ready-prd-tad.runtime.md')
  if (!existsSync(mainPath) || !existsSync(companionPath) || !existsSync(runtimePath)) {
    throw new Error('Expected canonical agent-ready PRD/TAD and companion files to exist')
  }

  const docs = [
    readFileSync(mainPath, 'utf8'),
    readFileSync(companionPath, 'utf8'),
    readFileSync(runtimePath, 'utf8'),
    readRepoFile('docs/documents/knowgrph-agent-ready-webmcp-release-note-20260522.md'),
    readRepoFile('docs/documents/knowgrph-mcp/knowgrph-mcp-service-prd-tad.md'),
  ].join('\n')

  const required = [
    'id: knowgrph-agent-ready-prd-tad',
    'status: implemented',
    '`knowgrph-agent-ready-prd-tad.companion.md`',
    '`knowgrph-agent-ready-prd-tad.runtime.md`',
    'parent: docs/documents/knowgrph-agent-ready-prd-tad.md',
    '{{md:knowgrph-agent-ready-prd-tad}}',
  ]
  required.forEach(snippet => {
    if (!docs.includes(snippet)) {
      throw new Error(`Expected agent-ready docs to include ${JSON.stringify(snippet)}`)
    }
  })

  const staleId = 'knowgrph-agent-ready-prd-tad-' + 'proposed'
  if (docs.includes(staleId)) {
    throw new Error('Expected agent-ready docs to avoid stale proposed document identity')
  }
}
