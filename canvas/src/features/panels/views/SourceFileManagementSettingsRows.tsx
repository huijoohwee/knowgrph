import React from 'react'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { requestMarkdownExplorerSourceFilesOpen } from '@/features/markdown/ui/useMarkdownExplorerSectionCollapseState'
import { LS_KEYS } from '@/lib/config'
import { readEnvString } from '@/lib/config.env'
import { lsRemove } from '@/lib/persistence'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { uiToolbarToggleActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { buildSettingsRowAnchorId } from './settingsRowAnchor'

const SOURCE_FILE_MANAGEMENT_SEARCH_INDEX = [
  'source file management',
  'source files',
  'd1 docs hydration',
  'cloudflare d1',
  'kgws canonical docs',
  'manual import local files',
  'd1 docs contract',
  'storage defaults',
  'source mix',
  'workspace sync source files docs only',
  'workspace sync source files debounce ms',
  'workspace import default source url',
].join(' ')

export const SOURCE_FILE_MANAGEMENT_SETTINGS_ROW_COUNT = 5

const SOURCE_FILE_MANAGEMENT_ROW_ANCHORS = {
  actions: buildSettingsRowAnchorId('source-file-management-row', 'actions'),
  contract: buildSettingsRowAnchorId('source-file-management-row', 'contract'),
  counts: buildSettingsRowAnchorId('source-file-management-row', 'counts'),
  sources: buildSettingsRowAnchorId('source-file-management-row', 'sources'),
  storage: buildSettingsRowAnchorId('source-file-management-row', 'storage'),
} as const
const SOURCE_FILE_ROW_VALUE_CLASS_NAME = 'flex flex-1 flex-wrap items-center gap-1'
const SOURCE_FILE_ROW_DESCRIPTION_CLASS_NAME = `min-w-0 ${UI_THEME_TOKENS.text.secondary}`

export const matchesSourceFileManagementQuery = (query: string): boolean => {
  const terms = query.split(/\s+/).map(term => term.trim()).filter(Boolean)
  if (terms.length === 0) return true
  return terms.every(term => SOURCE_FILE_MANAGEMENT_SEARCH_INDEX.includes(term))
}

type SourceFileManagementSettingsRowsProps = {
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

function SourceFileValuePill({ children }: { children: React.ReactNode }) {
  return (
    <span className={`inline-flex min-h-6 max-w-full items-center rounded-full border px-2 text-xs ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}>
      <span className="truncate">{children}</span>
    </span>
  )
}

function SourceFileSettingsActionButton({
  children,
  disabled,
  onClick,
  primary,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  primary?: boolean
}) {
  const className = primary
    ? `App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`
    : `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

export function SourceFileManagementSettingsRows({
  normalizedQuery,
  values,
}: SourceFileManagementSettingsRowsProps) {
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

  return (
    <>
      <li>
        <KeyTypeValueRow
          id={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.actions}
          dataKgAnchor={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.actions}
          keyNode={<span className="font-semibold">Source File Management</span>}
          typeNode={<span className={UI_THEME_TOKENS.text.secondary}>actions</span>}
          valueNode={(
            <div className={SOURCE_FILE_ROW_VALUE_CLASS_NAME}>
              <SourceFileSettingsActionButton primary onClick={openSourceFiles}>
                Open Source Files
              </SourceFileSettingsActionButton>
              <SourceFileSettingsActionButton onClick={() => { void recomposeSourceFiles() }}>
                Recompose now
              </SourceFileSettingsActionButton>
              <SourceFileSettingsActionButton disabled={isRestoringDefaults} onClick={() => { void restoreDefaultSourceFiles() }}>
                {isRestoringDefaults ? 'Restoring...' : 'Restore D1/docs defaults'}
              </SourceFileSettingsActionButton>
            </div>
          )}
          align="start"
        />
      </li>
      <li>
        <KeyTypeValueRow
          id={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.contract}
          dataKgAnchor={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.contract}
          keyNode="D1/docs contract"
          typeNode={<span className={UI_THEME_TOKENS.text.secondary}>policy</span>}
          valueNode={(
            <div className={SOURCE_FILE_ROW_DESCRIPTION_CLASS_NAME}>
              Automated defaults hydrate Source Files from the D1/docs storage path. Import local files remains an explicit manual action, not a hidden bootstrap path.
            </div>
          )}
          align="start"
        />
      </li>
      <li>
        <KeyTypeValueRow
          id={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.counts}
          dataKgAnchor={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.counts}
          keyNode="Source Files"
          typeNode={<span className={UI_THEME_TOKENS.text.secondary}>summary</span>}
          valueNode={(
            <div className={SOURCE_FILE_ROW_VALUE_CLASS_NAME}>
              <SourceFileValuePill>Total: {summary.total}</SourceFileValuePill>
              <SourceFileValuePill>Enabled: {summary.enabled}</SourceFileValuePill>
              <SourceFileValuePill>Parsed: {summary.parsed}</SourceFileValuePill>
              <SourceFileValuePill>Errors: {summary.errors}</SourceFileValuePill>
            </div>
          )}
          align="start"
        />
      </li>
      <li>
        <KeyTypeValueRow
          id={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.storage}
          dataKgAnchor={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.storage}
          keyNode="Storage defaults"
          typeNode={<span className={UI_THEME_TOKENS.text.secondary}>D1</span>}
          valueNode={(
            <div className={SOURCE_FILE_ROW_VALUE_CLASS_NAME}>
              <SourceFileValuePill>Workspace: {storageWorkspaceId}</SourceFileValuePill>
              <SourceFileValuePill>Base: {storageBaseUrl}</SourceFileValuePill>
              <SourceFileValuePill>Docs only: {docsOnly ? 'on' : 'off'}</SourceFileValuePill>
              <SourceFileValuePill>Seed sync: {seedSync ? 'on' : 'off'}</SourceFileValuePill>
              <SourceFileValuePill>Auto refresh: {autoRefresh ? 'on' : 'off'}</SourceFileValuePill>
            </div>
          )}
          align="start"
        />
      </li>
      <li>
        <KeyTypeValueRow
          id={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.sources}
          dataKgAnchor={SOURCE_FILE_MANAGEMENT_ROW_ANCHORS.sources}
          keyNode="Source mix"
          typeNode={<span className={UI_THEME_TOKENS.text.secondary}>origin</span>}
          valueNode={(
            <div className={SOURCE_FILE_ROW_VALUE_CLASS_NAME}>
              <SourceFileValuePill>Workspace-backed: {summary.workspaceBacked}</SourceFileValuePill>
              <SourceFileValuePill>Manual local: {summary.manualLocal}</SourceFileValuePill>
              <SourceFileValuePill>URL imports: {summary.remoteUrl}</SourceFileValuePill>
              {defaultSourceUrl ? <SourceFileValuePill>Default source: {defaultSourceUrl}</SourceFileValuePill> : null}
            </div>
          )}
          align="start"
        />
      </li>
    </>
  )
}
