import React from 'react'
import type { InlineMediaCommandCandidate } from '@/lib/command-menu/inlineCommandMenuCatalog'

export type CommandMenuMediaNameDrafts = Record<string, string>

let commandMenuMediaNameDrafts: CommandMenuMediaNameDrafts = {}
const listeners = new Set<() => void>()

export function buildCommandMenuMediaNameSyncKey(raw: unknown): string {
  return String(raw || '').trim()
}

export function subscribeCommandMenuMediaNameDrafts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getCommandMenuMediaNameDraftsSnapshot(): CommandMenuMediaNameDrafts {
  return commandMenuMediaNameDrafts
}

export function writeCommandMenuMediaNameDraft(rawKey: unknown, nextName: unknown): void {
  const key = buildCommandMenuMediaNameSyncKey(rawKey)
  if (!key) return
  const next = String(nextName || '')
  if (commandMenuMediaNameDrafts[key] === next) return
  commandMenuMediaNameDrafts = { ...commandMenuMediaNameDrafts, [key]: next }
  listeners.forEach(listener => listener())
}

export function useCommandMenuMediaNameDrafts(): CommandMenuMediaNameDrafts {
  return React.useSyncExternalStore(
    subscribeCommandMenuMediaNameDrafts,
    getCommandMenuMediaNameDraftsSnapshot,
    getCommandMenuMediaNameDraftsSnapshot,
  )
}

export function readCommandMenuMediaNameDraft(drafts: CommandMenuMediaNameDrafts, rawKey: unknown): string {
  const key = buildCommandMenuMediaNameSyncKey(rawKey)
  return key ? String(drafts[key] || '') : ''
}

export function applyCommandMenuMediaNameDraftsToInlineCandidates(
  candidates: InlineMediaCommandCandidate[],
  drafts: CommandMenuMediaNameDrafts,
): InlineMediaCommandCandidate[] {
  return candidates.map(candidate => {
    const draft = readCommandMenuMediaNameDraft(drafts, candidate.url).trim()
    if (!draft || draft === candidate.label) return candidate
    return {
      ...candidate,
      label: draft,
      keywords: Array.from(new Set([draft, ...candidate.keywords])),
    }
  })
}
