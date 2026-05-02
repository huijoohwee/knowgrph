import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'

export type MarkdownExplorerViewPreferences = {
  markdownWordWrap: boolean
  markdownTextHighlight: boolean
}

const DEFAULT_MARKDOWN_EXPLORER_VIEW_PREFERENCES: MarkdownExplorerViewPreferences = {
  markdownWordWrap: true,
  markdownTextHighlight: false,
}

export function readMarkdownExplorerViewPreferences(
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerViewPreferences {
  return {
    markdownWordWrap: readBoolFromStorage(
      storage,
      LS_KEYS.markdownWordWrap,
      DEFAULT_MARKDOWN_EXPLORER_VIEW_PREFERENCES.markdownWordWrap,
    ),
    markdownTextHighlight: readBoolFromStorage(
      storage,
      LS_KEYS.markdownTextHighlight,
      DEFAULT_MARKDOWN_EXPLORER_VIEW_PREFERENCES.markdownTextHighlight,
    ),
  }
}

export function persistMarkdownExplorerViewPreferences(
  preferences: Partial<MarkdownExplorerViewPreferences>,
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerViewPreferences {
  const current = readMarkdownExplorerViewPreferences(storage)
  const next: MarkdownExplorerViewPreferences = {
    markdownWordWrap:
      typeof preferences.markdownWordWrap === 'boolean' ? preferences.markdownWordWrap : current.markdownWordWrap,
    markdownTextHighlight:
      typeof preferences.markdownTextHighlight === 'boolean'
        ? preferences.markdownTextHighlight
        : current.markdownTextHighlight,
  }
  writeBoolToStorage(storage, LS_KEYS.markdownWordWrap, next.markdownWordWrap)
  writeBoolToStorage(storage, LS_KEYS.markdownTextHighlight, next.markdownTextHighlight)
  return next
}
