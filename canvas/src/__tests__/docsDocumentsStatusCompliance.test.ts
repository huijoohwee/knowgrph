import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const docsRoot = resolve(repoRoot, 'docs/documents')

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const abs = resolve(dir, entry)
    const stat = statSync(abs)
    if (stat.isDirectory()) {
      out.push(...listMarkdownFiles(abs))
      continue
    }
    if (stat.isFile() && entry.endsWith('.md')) out.push(abs)
  }
  return out
}

export function testDocsDocumentsForbidDraftAndProposedPrdTadMarkers(): void {
  const forbidden = [
    { label: 'draft frontmatter status', pattern: /^status:\s*["']?draft["']?\s*$/im },
    { label: 'proposed frontmatter status', pattern: /^status:\s*["']?proposed["']?\s*$/im },
    { label: 'draft display status', pattern: /^\*\*Status\*\*:\s*Draft\b/im },
    { label: 'proposed display status', pattern: /^\*\*Status\*\*:\s*Proposed\b/im },
    { label: 'proposed PRD/TAD filename token', pattern: /prd-tad-proposed/i },
    { label: 'pending-review draft marker', pattern: /Draft\s*->\s*Pending Review|Draft\s*→\s*Pending Review/i },
    { label: 'proposed title marker', pattern: /\(Proposed\)/i },
  ]

  const matches: string[] = []
  for (const filePath of listMarkdownFiles(docsRoot)) {
    const text = readFileSync(filePath, 'utf8')
    for (const item of forbidden) {
      if (item.pattern.test(text)) {
        matches.push(`${relative(repoRoot, filePath)}: ${item.label}`)
      }
    }
  }

  if (matches.length > 0) {
    throw new Error(`docs/documents contains draft/proposed PRD/TAD markers:\n${matches.join('\n')}`)
  }
}
