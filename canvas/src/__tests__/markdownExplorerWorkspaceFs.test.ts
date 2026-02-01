import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { computeMarkdownOutline } from '@/features/markdown-explorer/outline'
import { computeBacklinks } from '@/features/markdown-explorer/backlinks'

export const testWorkspaceFsSeedAndCrud = async () => {
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const entries = await fs.listEntries()
  const hasReadme = entries.some(e => e.kind === 'file' && e.path === '/README.md')
  if (!hasReadme) throw new Error('Expected /README.md seed file')

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
    activePath: '/README.md',
    entries: [
      { path: '/README.md', parentPath: '/', kind: 'file', name: 'README.md', text: 'x', updatedAtMs: 0 },
      { path: '/a.md', parentPath: '/', kind: 'file', name: 'a.md', text: 'see [[README]]', updatedAtMs: 0 },
      { path: '/b.md', parentPath: '/', kind: 'file', name: 'b.md', text: 'see ](/README.md)', updatedAtMs: 0 },
    ],
  })
  if (backlinks.length !== 2) throw new Error(`Expected 2 backlinks, got ${backlinks.length}`)
}

