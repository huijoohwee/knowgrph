import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMarkdownWorkspaceSelectionDirtyStateReusesSharedRuntimeGuard() {
  const selectionPath = resolve(process.cwd(), 'src', 'lib', 'markdown-workspace-runtime', 'useMarkdownWorkspaceSelection.ts')
  const text = readFileSync(selectionPath, 'utf8')

  if (!text.includes("import { resolveWorkspaceDirtyState } from './markdownWorkspaceRuntime.shared'")) {
    throw new Error('expected markdown workspace selection to import the shared runtime dirty-state helper')
  }
  if (!text.includes('const hasUnsavedUserEdit = !!(')) {
    throw new Error('expected markdown workspace selection to keep the local unsaved-edit guard variable')
  }
  if (!text.includes('resolveWorkspaceDirtyState({')) {
    throw new Error('expected markdown workspace selection to reuse the shared runtime dirty-state helper inside graph writeback sync')
  }
}
