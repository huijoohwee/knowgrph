import React from 'react'
import type { GraphState } from '@/hooks/store/types'
import { normalizeWebpageFrontmatterView, preferCanonicalYamlFrontmatterFencedText } from '@/lib/markdown/frontmatter'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_MARKDOWN_EDITOR_SSOT_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_MARKDOWN_EDITOR_SSOT,
} from '@/lib/async/workspaceSyncKeys'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { workspaceDocumentKey } from '@/features/workspace-fs/path'
import { isMarkdownPath } from './markdownWorkspaceUtils'

export function isMarkdownEditorSsotPath(path: string | null | undefined): boolean {
  const key = String(path || '').trim()
  return !!key && isMarkdownPath(key)
}

export function shouldScheduleMarkdownEditorSsotSync(args: {
  activeDocumentKey: string
  activeTextOwnedByActivePath: boolean
  paused?: boolean
}): boolean {
  const key = String(args.activeDocumentKey || '').trim()
  if (!key) return false
  if (args.paused) return false
  if (!isMarkdownEditorSsotPath(key)) return false
  if (args.activeTextOwnedByActivePath !== true) return false
  return true
}

export function shouldCommitMarkdownEditorSsotSync(args: {
  scheduledDocumentKey: string
  activeDocumentKey: string
  activeText: string
  activeTextOwnedByActivePath: boolean
  liveExplorerDocumentKey?: string
}): boolean {
  const scheduledKey = String(args.scheduledDocumentKey || '').trim()
  const currentKey = String(args.activeDocumentKey || '').trim()
  if (!scheduledKey || currentKey !== scheduledKey) return false
  if (
    Object.prototype.hasOwnProperty.call(args, 'liveExplorerDocumentKey')
    && String(args.liveExplorerDocumentKey || '').trim() !== scheduledKey
  ) return false
  if (!isMarkdownEditorSsotPath(currentKey)) return false
  if (args.activeTextOwnedByActivePath !== true) return false
  return !!String(args.activeText || '').trim()
}

export function useMarkdownEditorSsotSync(args: {
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  activeText: string
  activeTextOwnedByActivePath: boolean
  canonicalMarkdownText?: string
  setActiveMarkdownDocument: GraphState['setActiveMarkdownDocument']
  paused?: boolean
}): void {
  const {
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
    activeTextOwnedByActivePath,
    canonicalMarkdownText,
    setActiveMarkdownDocument,
    paused,
  } = args
  const lastPushedRef = React.useRef<{ key: string; textHash: string } | null>(null)
  const lastSeenRef = React.useRef<{ key: string; signature: string } | null>(null)
  const idleRef = React.useRef<number | null>(null)
  const scheduleTaskKeyRef = React.useRef<string | null>(null)
  const liveArgsRef = React.useRef({
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
    activeTextOwnedByActivePath,
    canonicalMarkdownText,
    setActiveMarkdownDocument,
  })
  liveArgsRef.current = {
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
    activeTextOwnedByActivePath,
    canonicalMarkdownText,
    setActiveMarkdownDocument,
  }

  React.useEffect(() => {
    if (scheduleTaskKeyRef.current) {
      cancelWorkspaceSyncTask(scheduleTaskKeyRef.current)
      scheduleTaskKeyRef.current = null
    }
    if (idleRef.current != null) {
      try {
        ;(window as any).cancelIdleCallback?.(idleRef.current)
      } catch {
        void 0
      }
      idleRef.current = null
    }

    const key = String(activeDocumentKey || '').trim()
    const textRaw = String(activeText || '')
    if (!shouldScheduleMarkdownEditorSsotSync({
      activeDocumentKey: key,
      activeTextOwnedByActivePath,
      paused,
    })) return
    const scheduleTaskKey = `${WORKSPACE_SYNC_TASK_MARKDOWN_EDITOR_SSOT}:${key}`
    scheduleTaskKeyRef.current = scheduleTaskKey
    const textHash = hashStringToHexCached(`markdown-editor-ssot:${key}`, textRaw)
    const signature = [
      key,
      textRaw.length,
      textHash,
    ].join('|')

    const lastSeen = lastSeenRef.current
    if (lastSeen && lastSeen.key === key && lastSeen.signature === signature) return
    lastSeenRef.current = { key, signature }

    const commit = () => {
      const live = liveArgsRef.current
      const rawNow = String(live.activeText || '')
      const explorerPath = useMarkdownExplorerStore.getState().activePath
      if (!shouldCommitMarkdownEditorSsotSync({
        scheduledDocumentKey: key,
        activeDocumentKey: live.activeDocumentKey,
        activeText: rawNow,
        activeTextOwnedByActivePath: live.activeTextOwnedByActivePath,
        liveExplorerDocumentKey: explorerPath ? workspaceDocumentKey(explorerPath) : '',
      })) return

      const normalizedRaw = normalizeWebpageFrontmatterView(rawNow, 'markdown')
      const normalized = preferCanonicalYamlFrontmatterFencedText({
        candidateText: normalizedRaw,
        canonicalText: live.canonicalMarkdownText || '',
      })
      const normalizedHash = hashStringToHexCached(`markdown-editor-ssot-normalized:${key}`, normalized)
      const prev = lastPushedRef.current
      if (prev && prev.key === key && prev.textHash === normalizedHash) return
      try {
        void live.setActiveMarkdownDocument({
          name: key,
          text: normalized,
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          applyViewPreset: false,
          sourceUrl: live.activeDocumentSourceUrl,
        })
        lastPushedRef.current = { key, textHash: normalizedHash }
      } catch {
        void 0
      }
    }

    const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: { timeout?: number }) => number)
    if (typeof ric === 'function') {
      idleRef.current = ric(() => {
        idleRef.current = null
        scheduleWorkspaceSyncTask(scheduleTaskKey, () => {
          commit()
        }, 0, {
          scopeKey: WORKSPACE_SYNC_SCOPE_MARKDOWN_EDITOR_SSOT_RUNTIME_PERSISTENCE,
          signature,
        })
      }, { timeout: 1200 })
    } else {
      scheduleWorkspaceSyncTask(scheduleTaskKey, () => {
        commit()
      }, 800, {
        scopeKey: WORKSPACE_SYNC_SCOPE_MARKDOWN_EDITOR_SSOT_RUNTIME_PERSISTENCE,
        signature,
      })
    }

    return () => {
      if (scheduleTaskKeyRef.current) {
        cancelWorkspaceSyncTask(scheduleTaskKeyRef.current)
        scheduleTaskKeyRef.current = null
      }
      if (idleRef.current != null) {
        try {
          ;(window as any).cancelIdleCallback?.(idleRef.current)
        } catch {
          void 0
        }
        idleRef.current = null
      }
    }
  }, [activeDocumentKey, activeDocumentSourceUrl, activeText, activeTextOwnedByActivePath, canonicalMarkdownText, paused, setActiveMarkdownDocument])
}
