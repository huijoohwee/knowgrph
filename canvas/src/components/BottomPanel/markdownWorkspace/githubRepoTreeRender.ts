type RepoTreeNode = { kind: 'folder' | 'file'; name: string; children?: Map<string, RepoTreeNode> }

const buildRepoTree = (paths: string[]) => {
  const root: RepoTreeNode = { kind: 'folder', name: '', children: new Map() }
  for (const p of paths) {
    const segs = String(p || '')
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
    if (!segs.length) continue
    let cur = root
    for (let index = 0; index < segs.length; index += 1) {
      const name = segs[index]
      const isLeaf = index === segs.length - 1
      const nextKind: RepoTreeNode['kind'] = isLeaf ? 'file' : 'folder'
      const children = cur.children || new Map<string, RepoTreeNode>()
      cur.children = children
      const existing = children.get(name)
      if (existing) {
        cur = existing
        continue
      }
      const node: RepoTreeNode = nextKind === 'folder' ? { kind: 'folder', name, children: new Map() } : { kind: 'file', name }
      children.set(name, node)
      cur = node
    }
  }
  return root
}

export const filterToLikelyFilePaths = (paths: string[]): string[] => {
  const cleaned = paths
    .map(p => String(p || '').replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
  const sorted = [...new Set(cleaned)].sort((a, b) => a.localeCompare(b))
  const out: string[] = []
  for (let index = 0; index < sorted.length; index += 1) {
    const p = sorted[index]
    const next = sorted[index + 1] || ''
    if (next && next.startsWith(`${p}/`)) continue
    out.push(p)
  }
  return out
}

export const renderRepoTreeAscii = (args: { rootName: string; paths: string[]; maxDepth: number; maxChildrenPerFolder: number }) => {
  const tree = buildRepoTree(args.paths)
  const lines: string[] = []
  lines.push(`${args.rootName}/`)
  const walk = (node: RepoTreeNode, prefix: string, depth: number) => {
    if (!node.children || depth >= args.maxDepth) return
    const entries = [...node.children.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    const shown = entries.slice(0, args.maxChildrenPerFolder)
    for (let index = 0; index < shown.length; index += 1) {
      const child = shown[index]
      const isLast = index === shown.length - 1
      const branch = isLast ? '└── ' : '├── '
      lines.push(`${prefix}${branch}${child.name}${child.kind === 'folder' ? '/' : ''}`)
      const nextPrefix = `${prefix}${isLast ? '    ' : '│   '}`
      if (child.kind === 'folder') walk(child, nextPrefix, depth + 1)
    }
    if (entries.length > shown.length) {
      const branch = '└── '
      lines.push(`${prefix}${branch}… (${entries.length - shown.length} more)`) 
    }
  }
  walk(tree, '', 0)
  return lines.join('\n')
}

export const renderTopLevelDirectoryTreeWithNotes = (args: { rootName: string; allTreePaths: string[]; maxDirs?: number }) => {
  const maxDirs = typeof args.maxDirs === 'number' && args.maxDirs > 0 ? Math.floor(args.maxDirs) : 40
  const topDirs = new Map<string, { fileCount: number }>()
  for (const p of args.allTreePaths) {
    const rel = String(p || '').replace(/^\/+/, '').replace(/\/+$/, '')
    if (!rel) continue
    const parts = rel.split('/').filter(Boolean)
    if (parts.length < 2) continue
    const top = parts[0]
    const cur = topDirs.get(top) || { fileCount: 0 }
    cur.fileCount += 1
    topDirs.set(top, cur)
  }
  const items = Array.from(topDirs.entries())
    .map(([name, v]) => ({ name, fileCount: v.fileCount }))
    .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name))
    .slice(0, maxDirs)

  const noteFor = (dir: string) => {
    const d = String(dir || '').toLowerCase()
    if (d.startsWith('.github')) return 'GitHub workflows and templates'
    if (d.startsWith('.ci') || d.includes('ci')) return 'CI/CD configurations'
    if (d.includes('test')) return 'Tests'
    if (d.includes('doc')) return 'Documentation'
    if (d.includes('script') || d.includes('tool')) return 'Scripts and tooling'
    if (d.includes('example') || d.includes('sample')) return 'Examples'
    if (d.includes('web') || d.includes('frontend') || d.includes('ui')) return 'Frontend'
    if (d.includes('api')) return 'API layer'
    if (d.includes('config')) return 'Configuration'
    if (d.includes('util')) return 'Utility functions'
    if (d.includes('middleware')) return 'Middleware'
    if (d.includes('model')) return 'Model/data assets'
    if (d.includes('app')) return 'Application logic'
    return 'Module'
  }

  const maxNameLen = Math.max(10, ...items.map(x => x.name.length))
  const lines: string[] = []
  lines.push(`${args.rootName}/`)
  for (let index = 0; index < items.length; index += 1) {
    const it = items[index]
    const isLast = index === items.length - 1
    const branch = isLast ? '└── ' : '├── '
    const name = `${it.name}/`.padEnd(maxNameLen + 1, ' ')
    lines.push(`${branch}${name} # ${noteFor(it.name)}`)
  }
  return lines.join('\n')
}

