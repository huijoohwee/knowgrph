export const MARKDOWN_SOURCE_FOLDER_ROOT_PATH = ''

export type MarkdownSourceFileListItemLike = {
  id: string
  name: string
  active?: boolean
  versionCount?: number
}

export type MarkdownSourceFileTreeNode = {
  kind: 'folder' | 'file'
  key: string
  label: string
  path: string
  depth: number
  fileId?: string
  active?: boolean
  versionCount?: number
  children?: MarkdownSourceFileTreeNode[]
}

export type VisibleMarkdownSourceFileTreeNode = {
  kind: 'folder' | 'file'
  key: string
  label: string
  path: string
  depth: number
  fileId?: string
  active?: boolean
  versionCount?: number
  hasChildren?: boolean
}

// Run evidence remains persisted and addressable, but it is not an authored source
// document and should not crowd the Explorer's root-level workspace inventory.
const LEGACY_GENERATED_SOURCE_ROOT_PATTERN = /^(?:chat-log|video-runs(?:-\d+)?)$/i

const normalizeMarkdownSourceFilePath = (name: string): string =>
  String(name || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '')

export function isLegacyGeneratedMarkdownSourcePath(name: string): boolean {
  const normalized = normalizeMarkdownSourceFilePath(name)
  const root = normalized.split('/').filter(Boolean)[0] || ''
  return LEGACY_GENERATED_SOURCE_ROOT_PATTERN.test(root)
}

export function normalizeMarkdownSourceFolderPath(v: unknown): string {
  const raw = String(v || '').trim()
  if (!raw) return MARKDOWN_SOURCE_FOLDER_ROOT_PATH
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  return normalized || MARKDOWN_SOURCE_FOLDER_ROOT_PATH
}

export function buildMarkdownSourceFileTree(
  sourceFiles: ReadonlyArray<MarkdownSourceFileListItemLike> | undefined,
): { root: MarkdownSourceFileTreeNode } {
  const root: MarkdownSourceFileTreeNode = {
    kind: 'folder',
    key: MARKDOWN_SOURCE_FOLDER_ROOT_PATH,
    label: MARKDOWN_SOURCE_FOLDER_ROOT_PATH,
    path: MARKDOWN_SOURCE_FOLDER_ROOT_PATH,
    depth: 0,
    children: [],
  }
  const byPath = new Map<string, MarkdownSourceFileTreeNode>()
  byPath.set(MARKDOWN_SOURCE_FOLDER_ROOT_PATH, root)

  const list = Array.isArray(sourceFiles) ? sourceFiles : []
  for (const sourceFile of list) {
    const rawName = normalizeMarkdownSourceFilePath(String(sourceFile?.name || ''))
    if (!rawName) continue
    if (isLegacyGeneratedMarkdownSourcePath(rawName)) continue
    const parts = rawName.split('/').filter(Boolean)
    if (parts.length === 0) continue

    let parentPath = MARKDOWN_SOURCE_FOLDER_ROOT_PATH
    for (let i = 0; i < parts.length - 1; i += 1) {
      const segment = String(parts[i] || '').trim()
      if (!segment) continue
      const nextPath = parentPath ? `${parentPath}/${segment}` : segment
      if (!byPath.has(nextPath)) {
        const node: MarkdownSourceFileTreeNode = {
          kind: 'folder',
          key: `folder:${nextPath}`,
          label: segment,
          path: nextPath,
          depth: nextPath.split('/').length,
          children: [],
        }
        byPath.set(nextPath, node)
        const parent = byPath.get(parentPath)
        if (parent?.children) parent.children.push(node)
      }
      parentPath = nextPath
    }

    const leafLabel = String(parts[parts.length - 1] || '').trim() || rawName
    const parent = byPath.get(parentPath)
    if (!parent?.children) continue
    parent.children.push({
      kind: 'file',
      key: `file:${String(sourceFile.id || rawName)}`,
      label: leafLabel,
      path: rawName,
      depth: parts.length,
      fileId: String(sourceFile.id || ''),
      active: !!sourceFile.active,
      versionCount: Math.max(0, Math.floor(Number(sourceFile.versionCount || 0))),
    })
  }

  return { root }
}

export function flattenVisibleMarkdownSourceFileTree(args: {
  root: MarkdownSourceFileTreeNode
  expandedPaths: ReadonlySet<string>
}): VisibleMarkdownSourceFileTreeNode[] {
  const out: VisibleMarkdownSourceFileTreeNode[] = []

  const walk = (node: MarkdownSourceFileTreeNode) => {
    const children = Array.isArray(node.children) ? node.children : []
    for (const child of children) {
      const isFolder = child.kind === 'folder'
      const hasChildren = isFolder && Array.isArray(child.children) && child.children.length > 0
      out.push({
        kind: child.kind,
        key: child.key,
        label: child.label,
        path: child.path,
        depth: child.depth,
        fileId: child.fileId,
        active: child.active,
        versionCount: child.versionCount,
        hasChildren,
      })
      if (isFolder && args.expandedPaths.has(String(child.path || MARKDOWN_SOURCE_FOLDER_ROOT_PATH))) {
        walk(child)
      }
    }
  }

  walk(args.root)
  return out
}

export function expandMarkdownSourceFolderAncestors(args: {
  expandedPaths: ReadonlySet<string>
  selectedFolderPath: string
}): Set<string> {
  const selectedFolderPath = normalizeMarkdownSourceFolderPath(args.selectedFolderPath)
  const next = new Set(args.expandedPaths)
  if (!selectedFolderPath) {
    next.add(MARKDOWN_SOURCE_FOLDER_ROOT_PATH)
    return next
  }

  let acc = MARKDOWN_SOURCE_FOLDER_ROOT_PATH
  for (const part of selectedFolderPath.split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${part}` : part
    next.add(acc)
  }
  next.add(MARKDOWN_SOURCE_FOLDER_ROOT_PATH)
  return next
}

export function toggleMarkdownSourceFolderPath(
  expandedPaths: ReadonlySet<string>,
  path: string,
): Set<string> {
  const nextPath = normalizeMarkdownSourceFolderPath(path)
  const next = new Set(expandedPaths)
  if (next.has(nextPath)) next.delete(nextPath)
  else next.add(nextPath)
  next.add(MARKDOWN_SOURCE_FOLDER_ROOT_PATH)
  return next
}

export function listPersistedMarkdownSourceFolderPaths(expandedPaths: Iterable<string>): string[] {
  const next = new Set<string>()
  for (const path of expandedPaths) {
    const normalized = normalizeMarkdownSourceFolderPath(path)
    if (normalized) next.add(normalized)
  }
  return Array.from(next).sort((a, b) => a.localeCompare(b))
}

export function resolveMarkdownSourceParentFolderPath(path: string): string {
  return normalizeMarkdownSourceFolderPath(String(path || '').split('/').slice(0, -1).join('/'))
}
