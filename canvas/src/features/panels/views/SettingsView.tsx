import React from 'react'
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection'
import { KeyTypeValueRow } from '@/features/panels/ui/KeyTypeValueRow'
import ExpandCollapseAllButton from '@/features/panels/ui/ExpandCollapseAllButton'
import {
  uiDangerButtonClassName,
  uiToolbarToggleActiveClassName,
  UI_COLOR_DANGER_RED_BORDER,
} from '@/features/toolbar/ui/toolbarStyles'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import {
  UI_ANCHORS,
} from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useSettingsView } from './useSettingsView'
import { WorkspaceTableModeControl } from '@/features/workspace-table/ui/WorkspaceTableModeControl'
import { LS_KEYS } from '@/lib/config'
import { lsRemove } from '@/lib/persistence'
import { SOURCE_FILES_FORMATS } from '@/lib/config-copy/importExportCopy'
import { getIconSizeClass } from '@/lib/ui'
import { CHAT_DEFAULT_PROVIDER } from '@/lib/chatEndpoint'
import { PAYMENTS_PROVIDERS, DEFAULT_PAYMENT_PROVIDER_ID, resolvePaymentsProviderSpec } from '@/features/payments/providers'
import { INTEGRATIONS_SECTION_META, MAPS_SECTION_META, MCP_SECTION_META, type SectionMeta } from './settingsView.constants'
import { useSettingsChatAssist } from './useSettingsChatAssist'
import { SettingsSections, type SettingsSectionDescriptor } from './SettingsSections'
import { useSettingsRowBundles } from './useSettingsRowBundles'
import { useSettingsSync } from './useSettingsSync'
import { useSettingsWorkspaceActions } from './useSettingsWorkspaceActions'

const WORKSPACE_IMPORT_ACCEPT = [...SOURCE_FILES_FORMATS.import, '.mdx'].join(',')
const SETTINGS_MAIN_HEADER_STICKY_OFFSET_CLASS = 'top-9'

export default function SettingsView({
  searchQuery,
  requestedAnchorId,
  requestedAnchorSeq,
  onRegisterActions,
  mode = 'all',
}: {
  searchQuery: string
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  onRegisterActions?: (a: {
    apply: () => void
    reset: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }) => void
  mode?: 'all' | 'integrations' | 'payments' | 'maps' | 'mcp'
}) {
  const [paymentsProviderId, setPaymentsProviderId] = React.useState<string>(DEFAULT_PAYMENT_PROVIDER_ID)
  const {
    expanded,
    setExpanded,
    chatHealthOk,
    chatHealthDetails,
    isCheckingHealth,
    checkChatHealth,
    bytePlusHealthOk,
    bytePlusHealthDetails,
    isCheckingBytePlusHealth,
    checkBytePlusHealth,
    grabMapsHealthOk,
    grabMapsHealthDetails,
    isCheckingGrabMapsHealth,
    checkGrabMapsHealth,
    deerFlowHealthOk,
    deerFlowHealthDetails,
    isCheckingDeerFlowHealth,
    checkDeerFlowHealth,
    isCheckingBytePlusVideoModelPreview,
    checkBytePlusVideoModelPreview,
    onGlobalReset,
    renderInput,
    collapsedByArea,
    groupByArea,
    allCollapsed,
    collapseAll,
    expandAll,
    normalizedQuery,
    toggleArea,
    uiPanelKeyValueTextSizeClass,
    values,
    setValues,
    dirtyRef,
  } = useSettingsView({ searchQuery, onRegisterActions, mode, paymentsProviderId })
  const [isRestoringWorkspace, setIsRestoringWorkspace] = React.useState(false)
  const [stripeCheckoutStatus, setStripeCheckoutStatus] = React.useState<string | null>(null)
  const [isGeneratingStripeCheckout, setIsGeneratingStripeCheckout] = React.useState(false)
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  const onRestoreWorkspace = React.useCallback(async () => {
    if (isRestoringWorkspace) return
    setIsRestoringWorkspace(true)
    try {
      lsRemove(LS_KEYS.markdownWorkspaceUserClearedAllFiles)
      lsRemove(LS_KEYS.markdownWorkspaceSeeded)
      const { getWorkspaceFs } = await import('@/features/workspace-fs/workspaceFs') as typeof import('@/features/workspace-fs/workspaceFs')
      const fs = await getWorkspaceFs()
      await fs.ensureSeed()
      pushUiToast({ id: 'workspace-restored', kind: 'success', message: 'Workspace files restored.', ttlMs: 3000, dismissible: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore workspace'
      pushUiToast({ id: 'workspace-restore-error', kind: 'error', message, ttlMs: 5000, dismissible: true })
    } finally {
      setIsRestoringWorkspace(false)
    }
  }, [isRestoringWorkspace, pushUiToast])
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const headerStickyTopClass = mode === 'integrations' || mode === 'mcp' ? 'top-0' : '-top-[2px]'
  const headerDividerWidthClass = mode === 'integrations' || mode === 'mcp' ? 'border-b-[0.5px]' : 'border-b'
  const settingsTypeIconSizeClass = getIconSizeClass(uiIconScale)
  const normalizedChatProvider = React.useMemo(
    () => String(values.chatProvider || '').trim() || CHAT_DEFAULT_PROVIDER,
    [values.chatProvider],
  )

  const paymentsProviders = React.useMemo(() => [...PAYMENTS_PROVIDERS], [])
  const activePaymentsProvider = React.useMemo(
    () => resolvePaymentsProviderSpec(paymentsProviderId),
    [paymentsProviderId],
  )
  const applyUiPanelDensityPreset = React.useCallback(
    (preset: 'comfortable' | 'compact') => {
      const patches: Record<string, string> =
        preset === 'comfortable'
          ? {
              uiPanelKeyValueTextSizeClass: 'text-sm',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: `w-full h-6 px-2 text-sm border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
              uiPanelRowDensityDefaultClass: 'py-1',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-xs',
            }
          : {
              uiPanelKeyValueTextSizeClass: 'text-xs',
              uiPanelTextFontClass: 'font-sans',
              uiPanelKeyValueInputClass: `w-full h-6 px-2 text-xs border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} rounded text-right ${UI_THEME_TOKENS.focus.primaryBorderRing}`,
              uiPanelRowDensityDefaultClass: 'py-0.5',
              uiPanelMonospaceTextClass: 'font-mono text-xs',
              uiPanelMicroLabelTextSizeClass: 'text-[9px]',
            }
      Object.keys(patches).forEach(key => dirtyRef.current.add(key))
      setValues(prev => ({ ...prev, ...patches }))
    },
    [dirtyRef, setValues],
  )

  const patchChatValues = React.useCallback((patch: Record<string, string>) => {
    Object.keys(patch).forEach(key => dirtyRef.current.add(key))
    setValues(prev => ({ ...prev, ...patch }))
  }, [dirtyRef, setValues])
  const openLocalChatApiKeyEntry = React.useCallback(() => {
    patchChatValues({ chatAuthMode: 'byok' })
    setExpanded('chatApiKey')
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(`[data-kg-anchor="${UI_ANCHORS.settingsChatApiKey}"]`)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
        const input = target.querySelector<HTMLInputElement>('input[type="password"], input')
        input?.focus()
        input?.select?.()
      })
    }
  }, [patchChatValues, setExpanded])
  const { buildChatAssistNodes } = useSettingsChatAssist({
    dirtyRef,
    openLocalChatApiKeyEntry,
    setValues,
    values,
  })
  const {
    chatHistoryPathStatus,
    createAndSelectChatHistoryFile,
    createAndSelectKnowgrphFile,
    applyActiveWorkspaceFileAsChatHistory,
    applyActiveWorkspaceFileAsKnowgrph,
    importCloudUrlForChatHistory,
    importCloudUrlForKnowgrph,
    importLocalFilesForChatHistory,
    importLocalFilesForKnowgrph,
    isUpdatingChatHistoryPath,
    isUpdatingKnowgrphPath,
    kgcLocalImportInputRef,
    knowgrphPathStatus,
    localImportInputRef,
    setChatHistoryPathStatus,
    setKnowgrphPathStatus,
    openFilePicker,
    openWorkspaceFile,
  } = useSettingsWorkspaceActions({
    patchChatValues,
    chatLocalStorageRootPath: values.chatLocalStorageRootPath,
    chatHistoryCloudUrl: values.chatHistoryCloudUrl,
    chatKnowgrphCloudUrl: values.chatKnowgrphCloudUrl,
  })
  React.useEffect(() => {
    const anchorId = String(requestedAnchorId || '').trim()
    if (!anchorId || typeof window === 'undefined') return
    const rafId = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-kg-anchor="${anchorId}"]`)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [requestedAnchorId, requestedAnchorSeq, groupByArea])

  useSettingsSync({ dirtyRef, setValues, values })

  const buildSectionMetaAssistNodes = React.useCallback((sectionMeta: SectionMeta | undefined, isFirstRowInArea: boolean, rowKey: string): React.ReactNode[] => {
    if (!sectionMeta || !isFirstRowInArea) return []
    const nodes: React.ReactNode[] = [
      <button
        key={`${rowKey}-open-panel`}
        type="button"
        className={`App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`}
        onClick={e => {
          e.stopPropagation()
          sectionMeta.openPanel()
        }}
      >
        {sectionMeta.panelLabel}
      </button>,
    ]
    if (sectionMeta.docsUrl && sectionMeta.docsLabel) {
      nodes.push(
        <a
          key={`${rowKey}-docs-link`}
          className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
          href={sectionMeta.docsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
        >
          {sectionMeta.docsLabel}
        </a>,
      )
    }
    if (sectionMeta.note) {
      nodes.push(
        <span
          key={`${rowKey}-section-note`}
          className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {sectionMeta.note}
        </span>,
      )
    }
    sectionMeta.highlights?.forEach(highlight => {
      nodes.push(
        <span
          key={`${rowKey}-highlight-${highlight}`}
          className={`inline-flex min-h-6 items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary}`}
        >
          {highlight}
        </span>,
      )
    })
    return nodes
  }, [])
  const {
    actions: settingsRowActions,
    refs: settingsRowRefs,
    status: settingsRowStatus,
    ui: settingsRowUi,
  } = useSettingsRowBundles({
    applyActiveWorkspaceFileAsChatHistory,
    applyActiveWorkspaceFileAsKnowgrph,
    buildChatAssistNodes,
    buildSectionMetaAssistNodes,
    bytePlusHealthDetails,
    bytePlusHealthOk,
    chatHealthDetails,
    chatHealthOk,
    chatHistoryPathStatus,
    checkBytePlusHealth,
    checkBytePlusVideoModelPreview,
    checkChatHealth,
    checkDeerFlowHealth,
    checkGrabMapsHealth,
    createAndSelectChatHistoryFile,
    createAndSelectKnowgrphFile,
    dirtyRef,
    deerFlowHealthDetails,
    deerFlowHealthOk,
    grabMapsHealthDetails,
    grabMapsHealthOk,
    importCloudUrlForChatHistory,
    importCloudUrlForKnowgrph,
    isCheckingBytePlusHealth,
    isCheckingBytePlusVideoModelPreview,
    isCheckingDeerFlowHealth,
    isCheckingGrabMapsHealth,
    isCheckingHealth,
    isGeneratingStripeCheckout,
    isUpdatingChatHistoryPath,
    isUpdatingKnowgrphPath,
    kgcLocalImportInputRef,
    knowgrphPathStatus,
    localImportInputRef,
    normalizedChatProvider,
    openFilePicker,
    openWorkspaceFile,
    pushUiToast,
    renderInput,
    setChatHistoryPathStatus,
    setIsGeneratingStripeCheckout,
    setKnowgrphPathStatus,
    setStripeCheckoutStatus,
    setValues,
    settingsTypeIconSizeClass,
    stripeCheckoutStatus,
    uiIconStrokeWidth,
    uiPanelKeyValueTextSizeClass,
  })
  const sectionDescriptors = React.useMemo<SettingsSectionDescriptor[]>(() => groupByArea.map(([area, entries]) => ({
    area,
    collapsed: normalizedQuery ? false : !!collapsedByArea[area],
    entries,
    sectionMeta:
      INTEGRATIONS_SECTION_META[area]
      || MAPS_SECTION_META[area]
      || MCP_SECTION_META[area],
    showDensityPresets: area === 'UI Density: Panels',
  })), [collapsedByArea, groupByArea, normalizedQuery])
  return (
    <article className="min-h-full flex flex-col space-y-0">
      <input
        ref={kgcLocalImportInputRef}
        type="file"
        multiple
        accept={WORKSPACE_IMPORT_ACCEPT}
        className="hidden"
        onChange={e => {
          const files = e.currentTarget.files
          importLocalFilesForKnowgrph(files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={localImportInputRef}
        type="file"
        multiple
        accept={WORKSPACE_IMPORT_ACCEPT}
        className="hidden"
        onChange={e => {
          const files = e.currentTarget.files
          importLocalFilesForChatHistory(files)
          e.currentTarget.value = ''
        }}
      />
      <section className="space-y-0">
        <header className={`sticky ${headerStickyTopClass} z-20 ${headerDividerWidthClass} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.panel.border}`}>
          <div className="relative">
            <KeyTypeValueRow
              keyNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Key</span>}
              typeNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Type</span>}
              valueNode={<span className={`font-semibold ${UI_THEME_TOKENS.text.secondary}`}>Value</span>}
              density="compact"
              className="h-9 py-0"
            />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              <ExpandCollapseAllButton
                allCollapsed={allCollapsed}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                titleExpand="Expand"
                titleCollapse="Collapse (Default)"
              />
            </div>
          </div>
        </header>
        {mode === 'payments' && (
          <section className={`p-2 border-b border-white/10 ${UI_THEME_TOKENS.text.secondary}`}>
            <div className="flex flex-wrap items-center gap-1">
              <span className={`text-xs font-semibold ${UI_THEME_TOKENS.text.primary}`}>Providers</span>
              {paymentsProviders.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  data-main-panel-no-drag="true"
                  className={
                    provider.id === activePaymentsProvider.id
                      ? `App-toolbar__btn text-xs ${uiToolbarToggleActiveClassName}`
                      : `App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`
                  }
                  onClick={() => {
                    setPaymentsProviderId(provider.id)
                  }}
                >
                  {provider.label}
                </button>
              ))}
              {activePaymentsProvider.docsUrl && (
                <a
                  className={`App-toolbar__btn text-xs border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
                  href={activePaymentsProvider.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open docs
                </a>
              )}
            </div>
          </section>
        )}
        {mode === 'all' && (
          <section className="p-2 border-b border-white/10">
            <WorkspaceTableModeControl />
          </section>
        )}
        <SettingsSections
          applyUiPanelDensityPreset={applyUiPanelDensityPreset}
          descriptors={sectionDescriptors}
          expanded={expanded}
          normalizedQuery={normalizedQuery}
          rowActions={settingsRowActions}
          rowRefs={settingsRowRefs}
          rowStatus={settingsRowStatus}
          rowUi={settingsRowUi}
          setExpanded={setExpanded}
          stickyOffsetClassName={SETTINGS_MAIN_HEADER_STICKY_OFFSET_CLASS}
          toggleArea={toggleArea}
          values={values}
        />
        {mode === 'all' && (
          <CollapsibleSection
            title="Resets and data"
            collapsed={false}
            onToggle={() => void 0}
            className={`mt-2 pt-2 border-t ${UI_COLOR_DANGER_RED_BORDER}`}
          >
            <div className={`space-y-1 text-xs ${UI_THEME_TOKENS.text.primary}`}>
              <div>
                Reset all settings to defaults and clear canvas data. This action cannot be undone.
              </div>
              <button
                type="button"
                className={uiDangerButtonClassName}
                onClick={onGlobalReset}
              >
                Global Reset
              </button>
            </div>
            <div className={`mt-3 space-y-1 text-xs ${UI_THEME_TOKENS.text.primary}`}>
              <div>
                Restore default workspace seed files after clearing all workspace files in Source Files.
              </div>
              <button
                type="button"
                className={uiDangerButtonClassName}
                disabled={isRestoringWorkspace}
                onClick={onRestoreWorkspace}
              >
                {isRestoringWorkspace ? 'Restoring…' : 'Restore Workspace'}
              </button>
            </div>
          </CollapsibleSection>
        )}
      </section>
    </article>
  )
}
