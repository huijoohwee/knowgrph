import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { requestMarkdownExplorerSourceFilesOpen } from '@/features/markdown/ui/useMarkdownExplorerSectionCollapseState'
import { LS_KEYS } from '@/lib/config'
import { readEnvString } from '@/lib/config.env'
import { lsRemove } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { uiToolbarToggleActiveClassName } from '@/features/toolbar/ui/toolbarStyles'

const SOURCE_FILE_MANAGEMENT_SEARCH_INDEX = [
  'source file management',
  'source files',
  'd1 docs hydration',
  'cloudflare d1',
  'kgws canonical docs',
  'manual import local files',
  'workspace sync source files docs only',
  'workspace import default source url',
].join(' ')

const matchesSourceFileManagementQuery = (query: string): boolean => {
  const terms = query.split(/\s+/).map(term => term.trim()).filter(Boolean)
  if (terms.length === 0) return true
  return terms.every(term => SOURCE_FILE_MANAGEMENT_SEARCH_INDEX.includes(term))
}

type SourceFileManagementSettingsPanelProps = {
  normalizedQuery: string
  values: Record<string, string | number | boolean>
}

const readBooleanValue = (
  values: Record<string, string | number | boolean>,
  key: string,
  fallback: boolean,
): boolean => {
  const value = values[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

export function SourceFileManagementSettingsPanel({
  normalizedQuery,
  values,
}: SourceFileManagementSettingsPanelProps) {
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const pushUiToast = useGraphStore(s => s.pushUiToast)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const setEditorWorkspacePane = useGraphStore(s => s.setEditorWorkspacePane)
  const [isRestoringDefaults, setIsRestoringDefaults] = React.useState(false)

  const shouldShow = matchesSourceFileManagementQuery(normalizedQuery)
  const storageWorkspaceId = String(readEnvString('VITE_KNOWGRPH_STORAGE_WORKSPACE_ID', 'kgws:canonical-docs') || 'kgws:canonical-docs').trim()
  const storageBaseUrl = String(readEnvString('VITE_KNOWGRPH_STORAGE_BASE_URL', '') || '').trim() || 'same-origin storage route'
  const docsOnly = readBooleanValue(values, 'workspace.sync.sourceFiles.docsOnly', true)
  const seedSync = readBooleanValue(values, 'workspace.sync.seed.enabled', true)
  const autoRefresh = readBooleanValue(values, 'workspace.sync.autoRefresh.enabled', true)
  const defaultSourceUrl = String(values['workspace.import.defaultSourceUrl'] || '').trim()

  const summary = React.useMemo(() => {
    const list = Array.isArray(sourceFiles) ? sourceFiles : []
    let enabled = 0
    let parsed = 0
    let errors = 0
    let workspaceBacked = 0
    let remoteUrl = 0
    let manualLocal = 0
    for (const file of list) {
      if (!file) continue
      if (file.enabled) enabled += 1
      if (file.status === 'parsed') parsed += 1
      if (file.status === 'error') errors += 1
      const sourcePath = String(file.source?.path || '')
      const sourceUrl = String(file.source?.url || '')
      if (sourcePath.startsWith('workspace:')) workspaceBacked += 1
      else if (sourceUrl) remoteUrl += 1
      else if (sourcePath) manualLocal += 1
    }
    return {
      enabled,
      errors,
      manualLocal,
      parsed,
      remoteUrl,
      total: list.length,
      workspaceBacked,
    }
  }, [sourceFiles])

  const openSourceFiles = React.useCallback(() => {
    requestMarkdownExplorerSourceFilesOpen()
    setWorkspaceViewMode('editor')
    setEditorWorkspacePane('markdown')
  }, [setEditorWorkspacePane, setWorkspaceViewMode])

  const recomposeSourceFiles = React.useCallback(async () => {
    try {
      const mod = (await import('@/features/source-files/applyComposedGraphFromSourceFiles')) as typeof import('@/features/source-files/applyComposedGraphFromSourceFiles')
      mod.scheduleApplyComposedGraphFromSourceFiles({ includeWorkspaceBacked: true })
      pushUiToast({
        id: `source-files-recompose-${Date.now().toString(36)}`,
        kind: 'neutral',
        message: 'Queued Source Files recomposition.',
        ttlMs: 2600,
        dismissible: true,
      })
    } catch (err) {
      pushUiToast({
        id: 'source-files-recompose-failed',
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to queue Source Files recomposition.',
        ttlMs: 5000,
        dismissible: true,
      })
    }
  }, [pushUiToast])

  const restoreDefaultSourceFiles = React.useCallback(async () => {
    if (isRestoringDefaults) return
    setIsRestoringDefaults(true)
    try {
      lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      lsRemove(LS_KEYS.markdownWorkspaceSeeded)
      const mod = (await import('@/features/workspace-fs/workspaceFs')) as typeof import('@/features/workspace-fs/workspaceFs')
      const fs = await mod.getWorkspaceFs()
      await fs.ensureSeed()
      requestMarkdownExplorerSourceFilesOpen()
      setWorkspaceViewMode('editor')
      setEditorWorkspacePane('markdown')
      const composeMod = (await import('@/features/source-files/applyComposedGraphFromSourceFiles')) as typeof import('@/features/source-files/applyComposedGraphFromSourceFiles')
      composeMod.scheduleApplyComposedGraphFromSourceFiles({ includeWorkspaceBacked: true })
      pushUiToast({
        id: 'source-files-defaults-restored',
        kind: 'success',
        message: 'Default D1/docs Source Files restored.',
        ttlMs: 3000,
        dismissible: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore default Source Files.'
      pushUiToast({
        id: 'source-files-defaults-restore-failed',
        kind: 'error',
        message,
        ttlMs: 5000,
        dismissible: true,
      })
    } finally {
      setIsRestoringDefaults(false)
    }
  }, [isRestoringDefaults, pushUiToast, setEditorWorkspacePane, setWorkspaceViewMode])

  if (!shouldShow) return null

  const statClassName = `rounded-lg border px-2 py-1 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`
  const labelClassName = `text-[10px] uppercase tracking-wide ${UI_THEME_TOKENS.text.tertiary}`
  const valueClassName = `text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`
  const secondaryTextClassName = `text-xs ${UI_THEME_TOKENS.text.secondary}`
  const chipClassName = `inline-flex min-h-6 items-center rounded-full border px-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`

  return (
    <section className={`border-b p-2 ${UI_THEME_TOKENS.panel.border}`} aria-label="Source File Management">
      <div className={`rounded-xl border p-3 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary}`}>Source File Management</h2>
            <p className={`mt-1 max-w-3xl ${secondaryTextClassName}`}>
              Automated defaults hydrate Source Files from the D1/docs storage path. Import local files remains an explicit manual action, not a hidden bootstrap path.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`} onClick={openSourceFiles}>
              Open Source Files
            </button>
            <button type="button" className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`} onClick={() => { void recomposeSourceFiles() }}>
              Recompose now
            </button>
            <button
              type="button"
              className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
              disabled={isRestoringDefaults}
              onClick={() => { void restoreDefaultSourceFiles() }}
            >
              {isRestoringDefaults ? 'Restoring...' : 'Restore D1/docs defaults'}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={statClassName}>
            <div className={labelClassName}>Total</div>
            <div className={valueClassName}>{summary.total}</div>
          </div>
          <div className={statClassName}>
            <div className={labelClassName}>Enabled</div>
            <div className={valueClassName}>{summary.enabled}</div>
          </div>
          <div className={statClassName}>
            <div className={labelClassName}>Parsed</div>
            <div className={valueClassName}>{summary.parsed}</div>
          </div>
          <div className={statClassName}>
            <div className={labelClassName}>Errors</div>
            <div className={valueClassName}>{summary.errors}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className={chipClassName}>D1 workspace: {storageWorkspaceId}</span>
          <span className={chipClassName}>Storage base: {storageBaseUrl}</span>
          <span className={chipClassName}>Docs only: {docsOnly ? 'on' : 'off'}</span>
          <span className={chipClassName}>Seed sync: {seedSync ? 'on' : 'off'}</span>
          <span className={chipClassName}>Auto refresh: {autoRefresh ? 'on' : 'off'}</span>
          {defaultSourceUrl ? <span className={chipClassName}>Default source: {defaultSourceUrl}</span> : null}
          <span className={chipClassName}>Workspace-backed: {summary.workspaceBacked}</span>
          <span className={chipClassName}>Manual local: {summary.manualLocal}</span>
          <span className={chipClassName}>URL imports: {summary.remoteUrl}</span>
        </div>
      </div>
    </section>
  )
}
