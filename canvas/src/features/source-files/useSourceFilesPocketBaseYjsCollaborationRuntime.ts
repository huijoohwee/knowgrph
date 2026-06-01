import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  readWorkspaceSeedSyncEnabledSetting,
  subscribeWorkspaceStoreSyncSettingsChanged,
} from '@/lib/workspace/workspaceStoreSyncSettings'
import {
  buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState,
} from '@/features/source-files/sourceFilesStorageSync'
import {
  canEditRawJsonForKnowgrphCollaboration,
  resolveKnowgrphCollaborationDocumentKind,
  type KnowgrphCollaborationDocumentKind,
} from '@/features/source-files/sourceFilesCollaborationYjs'
import {
  createPocketBaseYjsSourceFileRoom,
  readKnowgrphCollaborationConfig,
  type KnowgrphPocketBaseYjsRoomHandle,
} from '@/features/source-files/sourceFilesPocketBaseYjsRoom'

type SaveBoundary = 'explicit' | 'autosave'

export type SourceFilesPocketBaseYjsCollaborationRuntime = {
  active: boolean
  activePeerCount: number
  rawJsonReadOnly: boolean
  saveSnapshot: (args?: { saveBoundary?: SaveBoundary; text?: string | null }) => Promise<void>
  onEditorCaretLine: (line: number) => void
}

const COLLAB_PEER_ID_STORAGE_KEY = 'kg:collaboration:pocketbase-yjs:peerId'

const normalizeString = (value: unknown): string => String(value || '').trim()

const readStablePeerId = (): string => {
  if (typeof window === 'undefined') return `peer:${Date.now().toString(36)}`
  try {
    const stored = normalizeString(window.localStorage?.getItem(COLLAB_PEER_ID_STORAGE_KEY))
    if (stored) return stored
    const cryptoValue = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    const next = `peer:${cryptoValue}`
    window.localStorage?.setItem(COLLAB_PEER_ID_STORAGE_KEY, next)
    return next
  } catch {
    return `peer:${Date.now().toString(36)}`
  }
}

const readWorkspaceId = (): string => {
  const state = useGraphStore.getState()
  return buildKnowgrphWorkspaceIdFromSourceFilesWorkspaceState({
    folderName: state.localMarkdownFolderName,
    accessMode: state.localMarkdownFolderAccessMode,
    folderCacheId: state.localMarkdownFolderCacheId,
    selectedFolderPath: state.localMarkdownSelectedFolderPath,
  })
}

const readDisplayName = (): string => {
  const state = useGraphStore.getState() as unknown as { displayName?: unknown }
  return normalizeString(state.displayName) || 'Collaborator'
}

export function useSourceFilesPocketBaseYjsCollaborationRuntime(args: {
  active: boolean
  activeEntryKind: string | null
  activeDocumentKey: string
  activeText: string
  setActiveTextProgrammatic: (next: string) => void
  setStatusInfo?: (label: string, opts?: { ttlMs?: number | null; dismissible?: boolean }) => void
  setStatusError?: (label: string) => void
}): SourceFilesPocketBaseYjsCollaborationRuntime {
  const [settingsRev, setSettingsRev] = React.useState(0)
  const [activePeerCount, setActivePeerCount] = React.useState(1)
  const [rawJsonReadOnly, setRawJsonReadOnly] = React.useState(false)
  const roomRef = React.useRef<KnowgrphPocketBaseYjsRoomHandle | null>(null)
  const applyingRemoteTextRef = React.useRef(false)
  const latestActiveTextRef = React.useRef('')
  latestActiveTextRef.current = String(args.activeText || '')

  React.useEffect(() => {
    return subscribeWorkspaceStoreSyncSettingsChanged(() => setSettingsRev(prev => prev + 1))
  }, [])

  const documentKind = React.useMemo<KnowgrphCollaborationDocumentKind | null>(
    () => resolveKnowgrphCollaborationDocumentKind(args.activeDocumentKey),
    [args.activeDocumentKey],
  )

  const workspaceId = React.useMemo(() => readWorkspaceId(), [settingsRev])
  const config = React.useMemo(() => readKnowgrphCollaborationConfig(), [settingsRev])
  const storageSyncEnabled = React.useMemo(() => readWorkspaceSeedSyncEnabledSetting(), [settingsRev])
  const shouldConnect = !!(
    args.active
    && args.activeEntryKind !== 'folder'
    && storageSyncEnabled
    && config.enabled
    && config.pocketBaseUrl
    && workspaceId
    && normalizeString(args.activeDocumentKey)
    && documentKind
  )

  React.useEffect(() => {
    let cancelled = false
    const previous = roomRef.current
    roomRef.current = null
    if (previous) void previous.disconnect()
    setActivePeerCount(1)
    setRawJsonReadOnly(false)
    if (!shouldConnect || !documentKind) return

    void createPocketBaseYjsSourceFileRoom({
      workspaceId,
      documentKey: args.activeDocumentKey,
      documentKind,
      initialText: latestActiveTextRef.current,
      peerId: readStablePeerId(),
      displayName: readDisplayName(),
      pocketBaseUrl: config.pocketBaseUrl,
      saveBridgeUrl: config.saveBridgeUrl,
      onRemoteText: text => {
        if (cancelled) return
        const next = String(text || '')
        if (next === latestActiveTextRef.current) return
        applyingRemoteTextRef.current = true
        args.setActiveTextProgrammatic(next)
        window.setTimeout(() => {
          applyingRemoteTextRef.current = false
        }, 0)
      },
      onPresenceChange: peers => {
        if (cancelled) return
        const count = Math.max(1, peers.length)
        setActivePeerCount(count)
        setRawJsonReadOnly(!canEditRawJsonForKnowgrphCollaboration({ documentKind, activePeerCount: count }))
      },
    }).then(room => {
      if (cancelled) {
        void room.disconnect()
        return
      }
      roomRef.current = room
      const snapshot = room.readSnapshot()
      setActivePeerCount(snapshot.activePeerCount)
      setRawJsonReadOnly(!snapshot.rawJsonEditable)
      args.setStatusInfo?.('Collaboration room connected', { ttlMs: 1800 })
    }).catch(err => {
      if (cancelled) return
      const message = err instanceof Error ? err.message : 'Collaboration room failed'
      args.setStatusError?.(message)
    })

    return () => {
      cancelled = true
      const room = roomRef.current
      roomRef.current = null
      if (room) void room.disconnect()
    }
  }, [
    args.activeDocumentKey,
    args.activeEntryKind,
    args.setActiveTextProgrammatic,
    args.setStatusError,
    args.setStatusInfo,
    config.enabled,
    config.pocketBaseUrl,
    config.saveBridgeUrl,
    documentKind,
    shouldConnect,
    workspaceId,
  ])

  React.useEffect(() => {
    const room = roomRef.current
    if (!room) return
    if (applyingRemoteTextRef.current) return
    room.applyLocalText(args.activeText)
  }, [args.activeText])

  const saveSnapshot = React.useCallback(async (saveArgs?: { saveBoundary?: SaveBoundary; text?: string | null }) => {
    const room = roomRef.current
    if (!room) return
    await room.saveSnapshot({
      saveBoundary: saveArgs?.saveBoundary || 'explicit',
      text: typeof saveArgs?.text === 'string' ? saveArgs.text : latestActiveTextRef.current,
    })
  }, [])

  const onEditorCaretLine = React.useCallback((line: number) => {
    const room = roomRef.current
    if (!room) return
    void room.updateLocalAwareness({
      caretLine: Number.isFinite(line) ? Math.max(1, Math.floor(line)) : null,
    }).catch(() => void 0)
  }, [])

  return {
    active: shouldConnect && !!roomRef.current,
    activePeerCount,
    rawJsonReadOnly,
    saveSnapshot,
    onEditorCaretLine,
  }
}
