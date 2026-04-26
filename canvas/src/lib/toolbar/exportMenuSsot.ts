export type ExportMenuActionKey =
  | 'duplicateInWorkspace'
  | 'workspaceFileJsonLd'
  | 'markdown'
  | 'png'
  | 'htmlViewer'
  | 'htmlCanvas'
  | 'json'
  | 'svg'
  | 'pdf'

export type ExportMenuItem = {
  id: ExportMenuActionKey
  menuLabel: string
  toastLabel: string
}

export const WORKSPACE_EXPORT_MENU_ITEMS: readonly ExportMenuItem[] = [
  { id: 'duplicateInWorkspace', menuLabel: 'Duplicate in workspace', toastLabel: 'Duplicate in workspace' },
  { id: 'workspaceFileJsonLd', menuLabel: 'Workspace file (.jsonld)', toastLabel: 'Workspace file' },
  { id: 'markdown', menuLabel: 'Markdown (.md)', toastLabel: 'Markdown' },
  { id: 'png', menuLabel: 'PNG (.png)', toastLabel: 'PNG' },
  { id: 'htmlViewer', menuLabel: 'HTML (.html) — Viewer', toastLabel: 'HTML Viewer' },
  { id: 'htmlCanvas', menuLabel: 'HTML (.html) — Canvas', toastLabel: 'HTML Canvas' },
  { id: 'json', menuLabel: 'JSON (.json)', toastLabel: 'JSON' },
  { id: 'svg', menuLabel: 'SVG (.svg)', toastLabel: 'SVG' },
  { id: 'pdf', menuLabel: 'PDF (Print…)', toastLabel: 'PDF' },
]

