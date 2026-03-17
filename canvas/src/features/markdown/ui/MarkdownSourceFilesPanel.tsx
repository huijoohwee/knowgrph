import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsJson, lsSetJson } from '@/lib/persistence'
import { parseStringArray } from '@/lib/persistence.parsers'
import { ChevronDown, ChevronRight, FileText, Trash2 } from 'lucide-react'

export type MarkdownSourceFileListItem = {
  id: string
  name: string
  active?: boolean
}

export type MarkdownSourceFilesPanelIntegration = {
  iconClassName: string
  folderName: string | null
  canWrite: boolean
  accessMode: string | null
  selectedFolderPath?: string | null
  onOpenFolder: () => void | Promise<void>
  onRefreshFiles?: () => void | Promise<void>
  onCreateFolder?: (parentPath: string | null) => Promise<string | null> | string | null
  onCreateFile?: (parentPath: string | null) => void
  onDeleteFile?: (path: string) => void | Promise<void>
  onReorderSourceFiles?: (fromId: string, toId: string) => void
  onAfterReorderSourceFiles?: () => void
  onSelectedFolderPathChange?: (path: string) => void
}

const normalizeFolderPath = (v: unknown): string => {
  const raw = String(v || '').trim()
  if (!raw) return ''
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  return normalized || ''
}

type TreeNode = {
  kind: 'folder' | 'file'
  key: string
  label: string
  path: string
  depth: number
  fileId?: string
  active?: boolean
  children?: TreeNode[]
}

type VisibleNode = {
  kind: 'folder' | 'file'
  key: string
  label: string
  path: string
  depth: number
  fileId?: string
  active?: boolean
  hasChildren?: boolean
}

const normalizePath = (name: string): string => String(name || '').trim().replace(/\\/g, '/').replace(/\/+$/g, '')

const buildTree = (sourceFiles: MarkdownSourceFileListItem[] | undefined): { root: TreeNode } => {
  const root: TreeNode = { kind: 'folder', key: '', label: '', path: '', depth: 0, children: [] }
  const byPath = new Map<string, TreeNode>()
  byPath.set('', root)

  const list = Array.isArray(sourceFiles) ? sourceFiles : []
  for (const f of list) {
    const rawName = normalizePath(String(f?.name || ''))
    if (!rawName) continue
    const parts = rawName.split('/').filter(Boolean)
    if (parts.length === 0) continue

    let parentPath = ''
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = String(parts[i] || '').trim()
      if (!seg) continue
      const nextPath = parentPath ? `${parentPath}/${seg}` : seg
      if (!byPath.has(nextPath)) {
        const node: TreeNode = {
          kind: 'folder',
          key: `folder:${nextPath}`,
          label: seg,
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
      key: `file:${String(f.id || rawName)}`,
      label: leafLabel,
      path: rawName,
      depth: parts.length,
      fileId: String(f.id || ''),
      active: !!f.active,
    })
  }

  return { root }
}

const flattenVisible = (root: TreeNode, expanded: Set<string>): VisibleNode[] => {
  const out: VisibleNode[] = []
  const walk = (node: TreeNode) => {
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
        hasChildren,
      })
      if (isFolder && expanded.has(String(child.path || ''))) {
        walk(child)
      }
    }
  }
  walk(root)
  return out
}

export function MarkdownSourceFilesPanel(props: {
  uiPanelTextFontClass: string
  sourceFiles?: MarkdownSourceFileListItem[]
  onSourceFileSelect?: (id: string) => void
  integration: MarkdownSourceFilesPanelIntegration
}) {
  const {
    uiPanelTextFontClass,
    sourceFiles,
    onSourceFileSelect,
    integration,
  } = props

  const [draggingSourceFileId, setDraggingSourceFileId] = React.useState<string | null>(null)
  const [dragOverSourceFileId, setDragOverSourceFileId] = React.useState<string | null>(null)
  const [selectedSourceFolderPath, setSelectedSourceFolderPath] = React.useState<string>(() =>
    normalizeFolderPath(integration.selectedFolderPath),
  )
  const [expandedSourceFolderPaths, setExpandedSourceFolderPaths] = React.useState<Set<string>>(() => {
    const saved = lsJson<string[]>(
      LS_KEYS.markdownExplorerSourceFilesExpandedPaths,
      [''],
      parseStringArray,
    )
    const next = new Set<string>()
    for (const p of saved) {
      const np = normalizeFolderPath(p)
      if (np) next.add(np)
    }
    next.add('')
    return next
  })

  React.useEffect(() => {
    const next = normalizeFolderPath(integration.selectedFolderPath)
    if (!next) return
    setSelectedSourceFolderPath(prev => (prev === next ? prev : next))
  }, [integration.selectedFolderPath])

  React.useEffect(() => {
    if (!selectedSourceFolderPath) return
    const parts = selectedSourceFolderPath.split('/').filter(Boolean)
    if (parts.length === 0) return
    setExpandedSourceFolderPaths(prev => {
      const next = new Set(prev)
      let acc = ''
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part
        next.add(acc)
      }
      next.add('')
      return next
    })
  }, [selectedSourceFolderPath])

  React.useEffect(() => {
    const list = Array.from(expandedSourceFolderPaths)
      .map(p => normalizeFolderPath(p))
      .filter(Boolean)
    list.sort((a, b) => a.localeCompare(b))
    lsSetJson(LS_KEYS.markdownExplorerSourceFilesExpandedPaths, list)
  }, [expandedSourceFolderPaths])

  const tree = React.useMemo(() => buildTree(sourceFiles), [sourceFiles])
  const visible = React.useMemo(
    () => flattenVisible(tree.root, expandedSourceFolderPaths),
    [expandedSourceFolderPaths, tree.root],
  )

  const handleToggleSourceFolder = React.useCallback((path: string) => {
    const nextPath = normalizeFolderPath(path)
    setExpandedSourceFolderPaths(prev => {
      const next = new Set(prev)
      if (next.has(nextPath)) next.delete(nextPath)
      else next.add(nextPath)
      next.add('')
      return next
    })
  }, [])

  const treeIndentBasePx = 6
  const treeIndentStepPx = 12
  const hasAny = visible.length > 0
  return (
    hasAny ? (
      <nav aria-label="Source Files tree" className="min-h-0">
        <ul className="flex flex-col" role="tree" aria-label={UI_COPY.markdownPreviewSourceFilesLabel}>
          {visible.map(node => {
              const isFolder = node.kind === 'folder'
              const expanded = isFolder && expandedSourceFolderPaths.has(node.path)
              const isSelectedFolder = isFolder && selectedSourceFolderPath === node.path
              const indentPx = Math.max(0, node.depth - 1) * treeIndentStepPx
              const rowClassName = [
                `border-b ${UI_THEME_TOKENS.panel.divider} last:border-b-0 px-2 py-1`,
                'flex items-center gap-2 border-l-2',
                node.active ? UI_THEME_TOKENS.table.rowSelected : UI_THEME_TOKENS.table.rowHoverAmber,
                dragOverSourceFileId === node.fileId ? UI_THEME_TOKENS.table.rowSelectedBorder : '',
                isSelectedFolder ? UI_THEME_TOKENS.table.rowSelected : '',
                'min-w-0 overflow-hidden cursor-pointer select-none',
              ]
                .filter(Boolean)
                .join(' ')

              const icon = isFolder ? (
                node.hasChildren ? (
                  expanded ? (
                    <ChevronDown className={integration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ChevronRight className={integration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                  )
                ) : (
                  <ChevronRight className={`${integration.iconClassName} opacity-30`} strokeWidth={1.5} aria-hidden="true" />
                )
              ) : (
                <FileText className={integration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
              )

              if (isFolder) {
                return (
                  <li key={node.key} role="none">
                    <button
                      type="button"
                      role="treeitem"
                      aria-expanded={expanded}
                      aria-selected={isSelectedFolder}
                      className={rowClassName}
                      style={{ paddingLeft: treeIndentBasePx + indentPx }}
                      onClick={() => {
                        setSelectedSourceFolderPath(node.path)
                        integration.onSelectedFolderPathChange?.(node.path)
                        handleToggleSourceFolder(node.path)
                      }}
                      title={node.path}
                    >
                      {icon}
                      <span
                        className={[
                          'min-w-0 flex-1 text-[12px] truncate transition-colors font-semibold',
                          UI_THEME_TOKENS.text.primary,
                          uiPanelTextFontClass,
                        ].join(' ')}
                      >
                        {node.label}
                      </span>
                    </button>
                  </li>
                )
              }
              return (
                <li key={node.key} role="none">
                  <article className={rowClassName} style={{ paddingLeft: treeIndentBasePx + indentPx }}>
                    <button
                      type="button"
                      role="treeitem"
                      aria-selected={!!node.active}
                      className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden"
                      draggable
                      onClick={() => {
                        if (node.fileId) onSourceFileSelect?.(node.fileId)
                        const parentPath = String(node.path || '').split('/').slice(0, -1).join('/')
                        setSelectedSourceFolderPath(parentPath)
                        integration.onSelectedFolderPathChange?.(parentPath)
                        if (parentPath) {
                          setExpandedSourceFolderPaths(prev => {
                            const next = new Set(prev)
                            next.add(parentPath)
                            next.add('')
                            return next
                          })
                        }
                      }}
                      onDragStart={e => {
                        const t = e.target as HTMLElement | null
                        if (t?.tagName && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL'].includes(t.tagName)) {
                          e.preventDefault()
                          return
                        }
                        const id = String(node.fileId || '')
                        if (!id) return
                        setDraggingSourceFileId(id)
                        setDragOverSourceFileId(id)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', id)
                      }}
                      onDragOver={e => {
                        e.preventDefault()
                        if (!draggingSourceFileId) return
                        e.dataTransfer.dropEffect = 'move'
                        if (node.fileId) setDragOverSourceFileId(node.fileId)
                      }}
                      onDrop={e => {
                        e.preventDefault()
                        const toId = String(node.fileId || '')
                        if (!toId) return
                        const from = draggingSourceFileId || e.dataTransfer.getData('text/plain')
                        if (!from || from === toId) return
                        integration.onReorderSourceFiles?.(from, toId)
                        integration.onAfterReorderSourceFiles?.()
                        setDraggingSourceFileId(null)
                        setDragOverSourceFileId(null)
                      }}
                      onDragEnd={() => {
                        setDraggingSourceFileId(null)
                        setDragOverSourceFileId(null)
                      }}
                      onDragLeave={e => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                          if (dragOverSourceFileId === node.fileId) setDragOverSourceFileId(null)
                        }
                      }}
                      title={node.path}
                    >
                      {icon}
                      <bdi
                        className={[
                          'min-w-0 flex-1 text-sm truncate transition-colors',
                          node.active ? 'font-medium' : UI_THEME_TOKENS.text.primary,
                          uiPanelTextFontClass,
                        ].join(' ')}
                      >
                        {node.label}
                      </bdi>
                    </button>
                    {integration.canWrite && node.fileId && integration.onDeleteFile ? (
                      <button
                        type="button"
                        className={`p-0.5 rounded-sm transition-colors ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                        aria-label="Delete file"
                        title="Delete file"
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          const confirmed = typeof window !== 'undefined' ? window.confirm(`Delete ${node.path}?`) : false
                          if (!confirmed) return
                          void integration.onDeleteFile?.(node.path)
                        }}
                      >
                        <Trash2 className={integration.iconClassName} strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    ) : null}
                  </article>
                </li>
              )
          })}
        </ul>
      </nav>
    ) : (
      <p className={[`px-2 py-2 ${UI_THEME_TOKENS.text.tertiary}`, uiPanelTextFontClass, 'text-xs'].join(' ')}>
        {integration.folderName ? 'No Markdown files found in this folder.' : 'Open a folder to load Markdown files.'}
      </p>
    )
  )
}
