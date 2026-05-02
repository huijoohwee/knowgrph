import React from 'react'
import { LS_KEYS } from '@/lib/config'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'

export type MarkdownExplorerSectionCollapseState = {
  sourceFilesCollapsed: boolean
  outlineCollapsed: boolean
  backlinksCollapsed: boolean
}

const DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE: MarkdownExplorerSectionCollapseState = {
  sourceFilesCollapsed: false,
  outlineCollapsed: false,
  backlinksCollapsed: false,
}

const MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS = {
  sourceFilesCollapsed: LS_KEYS.markdownExplorerSourceFilesCollapsed,
  outlineCollapsed: LS_KEYS.markdownExplorerOutlineCollapsed,
  backlinksCollapsed: LS_KEYS.markdownExplorerBacklinksCollapsed,
} as const

function normalizeMarkdownExplorerSectionCollapseState(
  state?: Partial<MarkdownExplorerSectionCollapseState> | null,
): MarkdownExplorerSectionCollapseState {
  return {
    sourceFilesCollapsed:
      typeof state?.sourceFilesCollapsed === 'boolean'
        ? state.sourceFilesCollapsed
        : DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.sourceFilesCollapsed,
    outlineCollapsed:
      typeof state?.outlineCollapsed === 'boolean'
        ? state.outlineCollapsed
        : DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.outlineCollapsed,
    backlinksCollapsed:
      typeof state?.backlinksCollapsed === 'boolean'
        ? state.backlinksCollapsed
        : DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.backlinksCollapsed,
  }
}

export function readMarkdownExplorerSectionCollapseState(
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerSectionCollapseState {
  return {
    sourceFilesCollapsed: readBoolFromStorage(
      storage,
      MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.sourceFilesCollapsed,
      DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.sourceFilesCollapsed,
    ),
    outlineCollapsed: readBoolFromStorage(
      storage,
      MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.outlineCollapsed,
      DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.outlineCollapsed,
    ),
    backlinksCollapsed: readBoolFromStorage(
      storage,
      MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.backlinksCollapsed,
      DEFAULT_MARKDOWN_EXPLORER_SECTION_COLLAPSE_STATE.backlinksCollapsed,
    ),
  }
}

export function persistMarkdownExplorerSectionCollapseState(
  state: Partial<MarkdownExplorerSectionCollapseState>,
  storage: Storage | null = getLocalStorage(),
): MarkdownExplorerSectionCollapseState {
  const next = normalizeMarkdownExplorerSectionCollapseState(state)
  writeBoolToStorage(storage, MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.sourceFilesCollapsed, next.sourceFilesCollapsed)
  writeBoolToStorage(storage, MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.outlineCollapsed, next.outlineCollapsed)
  writeBoolToStorage(storage, MARKDOWN_EXPLORER_SECTION_COLLAPSE_KEYS.backlinksCollapsed, next.backlinksCollapsed)
  return next
}

export function useMarkdownExplorerSectionCollapseState() {
  const [state, setState] = React.useState<MarkdownExplorerSectionCollapseState>(() =>
    readMarkdownExplorerSectionCollapseState(),
  )

  React.useEffect(() => {
    persistMarkdownExplorerSectionCollapseState(state)
  }, [state])

  const setSourceFilesCollapsed = React.useCallback((next: boolean) => {
    setState(prev => (prev.sourceFilesCollapsed === !!next ? prev : { ...prev, sourceFilesCollapsed: !!next }))
  }, [])

  const setOutlineCollapsed = React.useCallback((next: boolean) => {
    setState(prev => (prev.outlineCollapsed === !!next ? prev : { ...prev, outlineCollapsed: !!next }))
  }, [])

  const setBacklinksCollapsed = React.useCallback((next: boolean) => {
    setState(prev => (prev.backlinksCollapsed === !!next ? prev : { ...prev, backlinksCollapsed: !!next }))
  }, [])

  const toggleSourceFilesCollapsed = React.useCallback(() => {
    setState(prev => ({ ...prev, sourceFilesCollapsed: !prev.sourceFilesCollapsed }))
  }, [])

  const toggleOutlineCollapsed = React.useCallback(() => {
    setState(prev => ({ ...prev, outlineCollapsed: !prev.outlineCollapsed }))
  }, [])

  const toggleBacklinksCollapsed = React.useCallback(() => {
    setState(prev => ({ ...prev, backlinksCollapsed: !prev.backlinksCollapsed }))
  }, [])

  return {
    ...state,
    setSourceFilesCollapsed,
    setOutlineCollapsed,
    setBacklinksCollapsed,
    toggleSourceFilesCollapsed,
    toggleOutlineCollapsed,
    toggleBacklinksCollapsed,
  }
}
