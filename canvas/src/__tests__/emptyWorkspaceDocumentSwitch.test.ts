import {
  shouldAcceptWorkspaceDocumentSelectionText,
  shouldHydrateStableWorkspaceSelectionText,
} from '@/lib/markdown-workspace-runtime/useMarkdownWorkspaceSelection'
import { shouldCommitResolvedActiveMarkdownText } from '@/features/source-files/sourceFilesRuntimeMaterialization'

export function testWorkspaceDocumentSelectionAcceptsEmptyRealFileText() {
  const accepted = shouldAcceptWorkspaceDocumentSelectionText({
    activePath: '/sandbox/chat-log/kgc_20260527193000.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/sandbox/chat-log/kgc_20260527193000.md',
    text: '',
  })
  if (accepted !== true) {
    throw new Error(`expected empty real workspace file text to remain eligible for document-switch apply, got ${String(accepted)}`)
  }
}

export function testWorkspaceDocumentSelectionAcceptsEmptyPendingWorkspaceFileText() {
  const accepted = shouldAcceptWorkspaceDocumentSelectionText({
    activePath: '/sandbox/chat-log/kgc_20260527193000.md' as never,
    activeEntryKind: '' as never,
    activeDocumentKey: '/sandbox/chat-log/kgc_20260527193000.md',
    text: '',
  })
  if (accepted !== true) {
    throw new Error(`expected empty pending workspace file text to remain eligible for document-switch apply, got ${String(accepted)}`)
  }
}

export function testWorkspaceDocumentSelectionRejectsEmptyNonFileText() {
  const accepted = shouldAcceptWorkspaceDocumentSelectionText({
    activePath: '/sandbox/chat-log/kgc_20260527193000.md' as never,
    activeEntryKind: 'folder',
    activeDocumentKey: '/sandbox/chat-log/kgc_20260527193000.md',
    text: '',
  })
  if (accepted !== false) {
    throw new Error(`expected non-file workspace selection not to apply empty document text, got ${String(accepted)}`)
  }
}

export function testClosedPaneReapplyCommitsEmptyKnownWorkspaceFile() {
  const accepted = shouldCommitResolvedActiveMarkdownText({
    activePath: '/sandbox/chat-log/kgc_20260527193000.md' as never,
    resolvedText: '',
    activeWorkspaceEntriesSnapshot: [{
      path: '/sandbox/chat-log/kgc_20260527193000.md' as never,
      parentPath: '/sandbox/chat-log' as never,
      kind: 'file',
      name: 'kgc_20260527193000.md',
      text: '',
      updatedAtMs: 1,
    }],
  })
  if (accepted !== true) {
    throw new Error(`expected closed-pane reapply to commit an empty known workspace file, got ${String(accepted)}`)
  }
}

export function testWorkspaceSelectionHydratesStableActivePathAfterRefresh() {
  const accepted = shouldHydrateStableWorkspaceSelectionText({
    activePath: '/sandbox/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/sandbox/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md',
    currentText: '',
    nextText: '# restored after refresh',
    lastLoadedPath: null,
    userEditedActiveText: false,
  })
  if (accepted !== true) {
    throw new Error(`expected stable active workspace path hydration to restore visible text after refresh, got ${String(accepted)}`)
  }
}

export function testWorkspaceSelectionHydrationYieldsToUnsavedUserDraft() {
  const accepted = shouldHydrateStableWorkspaceSelectionText({
    activePath: '/sandbox/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md' as never,
    activeEntryKind: 'file',
    activeDocumentKey: '/sandbox/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md',
    currentText: 'my local draft',
    nextText: '# streamed text',
    lastLoadedPath: '/sandbox/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md' as never,
    userEditedActiveText: true,
  })
  if (accepted !== false) {
    throw new Error(`expected stable active workspace hydration to yield to an unsaved user draft, got ${String(accepted)}`)
  }
}
