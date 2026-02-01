import React from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, Link as LinkIcon } from 'lucide-react'
import type { WorkspaceEntry, WorkspacePath } from '@/features/workspace-fs/types'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { WorkspaceSourceIndex } from '@/features/workspace-fs/sourceIndex'

type Node = {
  entry: WorkspaceEntry
  children: Node[]
}

const buildTree = (entries: WorkspaceEntry[]): Node => {
  const byParent = new Map<string, WorkspaceEntry[]>()
  const byPath = new Map<string, WorkspaceEntry>()
  for (const e of entries || []) {
    if (!e) continue
    byPath.set(e.path, e)
    const parent = e.parentPath ?? '__root__'
    const arr = byParent.get(parent) || []
    arr.push(e)
    byParent.set(parent, arr)
  }
  const root =
    byPath.get(WORKSPACE_ROOT_PATH) ||
    ({ path: WORKSPACE_ROOT_PATH, parentPath: null, kind: 'folder', name: '', updatedAtMs: 0 } satisfies WorkspaceEntry)

  const walk = (entry: WorkspaceEntry): Node => {
    const kids = byParent.get(entry.path) || []
    const folders = kids.filter(k => k.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name))
    const files = kids.filter(k => k.kind === 'file').sort((a, b) => a.name.localeCompare(b.name))
    return { entry, children: [...folders, ...files].map(walk) }
  }
  return walk(root)
}

export const MarkdownFileTree = React.memo(function MarkdownFileTree(props: {
  entries: WorkspaceEntry[]
  expandedPaths: Set<string>
  toggleExpanded: (path: WorkspacePath) => void
  activePath: WorkspacePath | null
  onSelectFile: (path: WorkspacePath) => void
  sourcesByPath?: WorkspaceSourceIndex | null
}) {
  const { entries, expandedPaths, toggleExpanded, activePath, onSelectFile, sourcesByPath } = props
  const tree = React.useMemo(() => buildTree(entries), [entries])

  const renderNode = (node: Node, depth: number) => {
    const entry = node.entry
    const isRoot = entry.path === WORKSPACE_ROOT_PATH
    if (isRoot && node.children.length === 0) {
      return (
        <p key={entry.path} className={`px-2 py-1 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
          No files yet.
        </p>
      )
    }
    if (isRoot) {
      return (
        <ul key={entry.path} className="list-none m-0 p-0">
          {node.children.map(child => renderNode(child, depth))}
        </ul>
      )
    }

    const indent = Math.min(28, depth * 12)
    const isFolder = entry.kind === 'folder'
    const isExpanded = expandedPaths.has(entry.path)
    const isActive = activePath === entry.path
    const source = sourcesByPath ? sourcesByPath[entry.path] : null
    const isUrlSource = source && source.kind === 'url'

    return (
      <li key={entry.path} className="list-none">
        <section className="group flex items-center" aria-label={isFolder ? `Folder ${entry.name}` : `File ${entry.name}`}>
          <button
            type="button"
            className={`flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-[2px] text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${
              isActive ? 'bg-zinc-200/70' : ''
            }`}
            style={{ paddingLeft: 6 + indent }}
            onClick={() => {
              if (isFolder) {
                toggleExpanded(entry.path)
                return
              } else {
                onSelectFile(entry.path)
              }
            }}
          >
            {isFolder ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )
            ) : (
              <span className="w-3 h-3 shrink-0" />
            )}
            {isFolder ? <Folder className="w-3 h-3 shrink-0" /> : <FileText className="w-3 h-3 shrink-0" />}
            <span className="truncate">{entry.name || (isFolder ? 'folder' : 'file')}</span>
            {isUrlSource ? <LinkIcon className="w-3 h-3 shrink-0 opacity-70" aria-label="Imported from URL" /> : null}
          </button>
        </section>
        {isFolder && isExpanded && node.children.length > 0 ? (
          <ul className="list-none m-0 p-0">{node.children.map(child => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    )
  }

  return <nav className="min-h-0 overflow-auto" aria-label="Source files">{renderNode(tree, 0)}</nav>
})
