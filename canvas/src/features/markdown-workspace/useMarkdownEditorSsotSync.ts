import React from 'react'
import type { GraphState } from '@/hooks/store/types'
import { normalizeWebpageFrontmatterView } from '@/lib/markdown/frontmatter'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_MARKDOWN_EDITOR_SSOT_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_MARKDOWN_EDITOR_SSOT,
} from '@/lib/async/workspaceSyncKeys'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'
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
}): boolean {
  const scheduledKey = String(args.scheduledDocumentKey || '').trim()
  const currentKey = String(args.activeDocumentKey || '').trim()
  if (!scheduledKey || currentKey !== scheduledKey) return false
  if (!isMarkdownEditorSsotPath(currentKey)) return false
  if (args.activeTextOwnedByActivePath !== true) return false
  return !!String(args.activeText || '').trim()
}

export function useMarkdownEditorSsotSync(args: {
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  activeText: string
  activeTextOwnedByActivePath: boolean
  setActiveMarkdownDocument: GraphState['setActiveMarkdownDocument']
  paused?: boolean
}): void {
  const {
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
    activeTextOwnedByActivePath,
    setActiveMarkdownDocument,
    paused,
  } = args
  const lastPushedRef = React.useRef<{ key: string; textHash: string } | null>(null)
  const lastSeenRef = React.useRef<{ key: string; signature: string } | null>(null)
  const idleRef = React.useRef<number | null>(null)
  const scheduleTaskKeyRef = React.useRef<string | null>(null)

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
      const rawNow = String(activeText || '')
      if (!shouldCommitMarkdownEditorSsotSync({
        scheduledDocumentKey: key,
        activeDocumentKey,
        activeText: rawNow,
        activeTextOwnedByActivePath,
      })) return

      const normalized = normalizeWebpageFrontmatterView(rawNow, 'markdown')
      const normalizedHash = hashStringToHexCached(`markdown-editor-ssot-normalized:${key}`, normalized)
      const prev = lastPushedRef.current
      if (prev && prev.key === key && prev.textHash === normalizedHash) return
      try {
        void setActiveMarkdownDocument({
          name: key,
          text: normalized,
          normalizeMermaidMmd: false,
          autoEnableFrontmatter: false,
          applyViewPreset: false,
          sourceUrl: activeDocumentSourceUrl,
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
  }, [activeDocumentKey, activeDocumentSourceUrl, activeText, activeTextOwnedByActivePath, paused, setActiveMarkdownDocument])
}
