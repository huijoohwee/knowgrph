import React from 'react'
import type { GraphState } from '@/hooks/store/types'
import { normalizeWebpageFrontmatterView } from '@/lib/markdown/frontmatter'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_MARKDOWN_EDITOR_SSOT_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_MARKDOWN_EDITOR_SSOT,
} from '@/lib/async/workspaceSyncKeys'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'

export function useMarkdownEditorSsotSync(args: {
  activeDocumentKey: string
  activeDocumentSourceUrl: string | null
  activeText: string
  setActiveMarkdownDocument: GraphState['setActiveMarkdownDocument']
  paused?: boolean
}): void {
  const {
    activeDocumentKey,
    activeDocumentSourceUrl,
    activeText,
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
    if (!key) return
    if (paused) return
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
      const currentKey = String(activeDocumentKey || '').trim()
      if (currentKey !== key) return
      const rawNow = String(activeText || '')
      if (!rawNow.trim()) return

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
  }, [activeDocumentKey, activeDocumentSourceUrl, activeText, paused, setActiveMarkdownDocument])
}
