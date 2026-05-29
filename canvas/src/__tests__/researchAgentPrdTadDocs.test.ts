import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const readRepoFile = (repoRelativePath: string): string =>
  readFileSync(resolve(repoRoot, repoRelativePath), 'utf8')

export function testResearchAgentPrdTadStaysReferenceOnlyUntilSourceOwnersExist(): void {
  const oldPath = resolve(repoRoot, 'docs/documents/knowgrph-research-agent-prd-tad-proposed.md')
  if (existsSync(oldPath)) {
    throw new Error('Expected research-agent PRD/TAD to remove the proposed document path')
  }

  const docs = readRepoFile('docs/documents/knowgrph-research-agent-prd-tad.md')

  const requiredDocTokens = [
    'doc_id: knowgrph-research-agent-prd-tad',
    'status: reference-only-not-implemented',
    'This document preserves the research-agent concept as a reference-only contract.',
    'The repo currently has no native research-agent seeder, no research-agent reasoner Worker, no skill-loop writer, and no simulator runtime.',
    'Use existing Import URL, queryable corpus, and Source Files paths for current ingestion.',
    'Any future research-agent work must reuse those owners where behavior already exists.',
    'This document can move from reference-only to implemented only when',
  ]
  for (const token of requiredDocTokens) {
    if (!docs.includes(token)) {
      throw new Error(`Expected research-agent PRD/TAD docs to include ${JSON.stringify(token)}`)
    }
  }

  const forbiddenDocTokens = [
    'prd-tad-proposed',
    'status: proposed',
    'PRD + TAD (Proposed)',
    '{{doc_id}}',
    'scripts/kgc_seed.py',
    'KGCSeedPipeline',
    'KGCReasoner',
    'KGCSkillLoop',
    'KGCSimulator',
    'Claude Haiku',
    'Claude Sonnet',
    'data/seeds/',
    'data/skills/',
  ]
  for (const token of forbiddenDocTokens) {
    if (docs.includes(token)) {
      throw new Error(`Expected research-agent PRD/TAD docs to remove ${JSON.stringify(token)}`)
    }
  }
}
