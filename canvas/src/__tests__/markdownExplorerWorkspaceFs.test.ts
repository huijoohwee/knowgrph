import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { computeMarkdownOutline } from '@/features/markdown-explorer/outline'
import { computeBacklinks, computeWorkspaceBacklinks, summarizeWorkspaceBacklinksBySource } from '@/features/markdown-explorer/backlinks'

export const testWorkspaceFsSeedAndCrud = async () => {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const entries = await fs.listEntries()
  const fileCount = entries.filter(e => e.kind === 'file').length
  if (fileCount < 2) throw new Error(`Expected at least 2 seed files, got ${fileCount}`)

  const folder = await fs.createFolder({ parentPath: WORKSPACE_ROOT_PATH, name: 'docs' })
  if (!folder.startsWith('/docs')) throw new Error('Expected docs folder under root')

  const file = await fs.createFile({ parentPath: folder, name: 'a.md', text: '# A\n\nhello' })
  const read = await fs.readFileText(file)
  if (read !== '# A\n\nhello') throw new Error('Read-after-write failed')

  await fs.writeFileText(file, '# A\n\nupdated')
  const updated = await fs.readFileText(file)
  if (updated !== '# A\n\nupdated') throw new Error('WriteFileText failed')
}

export const testMarkdownOutlineAndBacklinks = () => {
  const outline = computeMarkdownOutline(['# Title', '', '## Two', '', '```', '# Not', '```', '### Three'].join('\n'))
  const lines = outline.map(o => o.line)
  if (lines.join(',') !== '1,3,8') throw new Error(`Unexpected outline lines: ${lines.join(',')}`)

  const backlinks = computeBacklinks({
    activePath: '/index.md',
    entries: [
      { path: '/index.md', parentPath: '/', kind: 'file', name: 'index.md', text: 'x', updatedAtMs: 0 },
      { path: '/a.md', parentPath: '/', kind: 'file', name: 'a.md', text: 'see [[index]]', updatedAtMs: 0 },
      { path: '/b.md', parentPath: '/', kind: 'file', name: 'b.md', text: 'see ](/index.md)', updatedAtMs: 0 },
    ],
  })
  if (backlinks.length !== 2) throw new Error(`Expected 2 backlinks, got ${backlinks.length}`)

  const docKeyBacklinks = computeWorkspaceBacklinks({
    targetDocKey: 'index.md',
    entries: [
      { path: 'index.md', kind: 'file', name: 'index.md', text: 'x' },
      { path: 'notes-a.md', kind: 'file', name: 'notes-a.md', text: 'see [[index]]' },
      { path: 'notes-b.md', kind: 'file', name: 'notes-b.md', text: 'see ](index.md)' },
    ],
  })
  if (docKeyBacklinks.length !== 2) {
    throw new Error(`Expected 2 doc-key backlinks, got ${docKeyBacklinks.length}`)
  }

  const summarized = summarizeWorkspaceBacklinksBySource([
    { fromPath: 'notes-b.md', line: 5, lineText: 'see ](index.md)' },
    { fromPath: 'notes-a.md', line: 2, lineText: 'see [[index]]' },
    { fromPath: 'notes-a.md', line: 8, lineText: 'see [[index]] again' },
  ])
  if (summarized.length !== 2) {
    throw new Error(`Expected 2 backlink source summaries, got ${summarized.length}`)
  }
  if (summarized[0]?.sourceDocKey !== 'notes-a.md' || summarized[0]?.count !== 2) {
    throw new Error(`Expected notes-a.md summary first with count 2, got ${JSON.stringify(summarized[0] || null)}`)
  }
  if (summarized[1]?.sourceDocKey !== 'notes-b.md' || summarized[1]?.count !== 1) {
    throw new Error(`Expected notes-b.md summary second with count 1, got ${JSON.stringify(summarized[1] || null)}`)
  }
}
