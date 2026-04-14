import React from 'react'
import MainPanelFrame from '@/features/panels/ui/MainPanelFrame'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelSettingsHeader from '@/features/panels/ui/MainPanelSettingsHeader'
import MainPanelWorkflowHeader from '@/features/panels/ui/MainPanelWorkflowHeader'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BarChart3, HelpCircle, MonitorPlay, Settings, Workflow, History as HistoryIcon, Table, Plug } from 'lucide-react'
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'

type MainPanelTab =
  | 'integrations'
  | 'workflow'
  | 'flowEditorManager'
  | 'help'
  | 'graphFields'
  | 'dashboard'
  | 'preview'
  | 'settings'
  | 'history'

function isMainPanelTab(key: string): key is MainPanelTab {
  return (
    key === 'integrations' ||
    key === 'workflow' ||
    key === 'flowEditorManager' ||
    key === 'help' ||
    key === 'graphFields' ||
    key === 'dashboard' ||
    key === 'preview' ||
    key === 'settings' ||
    key === 'history'
  )
}

const SEARCHABLE_MAIN_PANEL_TABS = new Set<MainPanelTab>([
  'help',
  'graphFields',
  'settings',
  'workflow',
  'history',
  'flowEditorManager',
])

const MAIN_PANEL_TABS: Array<{ key: MainPanelTab; label: string }> = [
  { key: 'integrations', label: UI_LABELS.integrations },
  { key: 'workflow', label: UI_LABELS.workflowManager },
  { key: 'flowEditorManager', label: UI_LABELS.flowEditorManager },
  { key: 'graphFields', label: UI_LABELS.graphFields },
  { key: 'dashboard', label: UI_LABELS.dashboard },
  { key: 'preview', label: UI_LABELS.previewPanel },
  { key: 'settings', label: UI_LABELS.settings },
  { key: 'history', label: UI_LABELS.history },
  { key: 'help', label: UI_LABELS.help },
]

const MAIN_PANEL_SEARCH_PLACEHOLDER_BY_TAB: Partial<Record<MainPanelTab, string>> = {
  help: UI_COPY.searchShortcutsPlaceholder,
  graphFields: UI_COPY.searchFieldsPlaceholder,
  settings: UI_COPY.searchSettingsPlaceholder,
  history: UI_LABELS.search,
  workflow: UI_LABELS.search,
  flowEditorManager: UI_COPY.searchFlowEditorManagerRegistryPlaceholder,
}

const MAIN_PANEL_FOOTER_LABEL_BY_TAB: Record<Exclude<MainPanelTab, 'graphFields'>, string> = {
  integrations: UI_LABELS.integrations,
  workflow: UI_LABELS.ragGraphRAGWorkflow,
  flowEditorManager: UI_LABELS.flowEditorManager,
  help: UI_LABELS.help,
  dashboard: UI_LABELS.dashboard,
  preview: UI_LABELS.previewPanel,
  settings: UI_LABELS.settings,
  history: UI_LABELS.history,
}

const mainPanelTabSupportsSearch = (tab: MainPanelTab): boolean => SEARCHABLE_MAIN_PANEL_TABS.has(tab)

const IntegrationsHubViewLazy = React.lazy(() => import('./views/IntegrationsHubView'))
const FlowEditorManagerViewLazy = React.lazy(() => import('@/features/panels/views/FlowEditorManagerView'))
const GraphFieldsViewLazy = React.lazy(() => import('@/features/panels/views/GraphFieldsView'))
const PreviewPanelViewLazy = React.lazy(() => import('./views/PreviewPanelView'))
const SettingsViewLazy = React.lazy(() => import('@/features/panels/views/SettingsView'))
const HistoryViewLazy = React.lazy(() => import('@/features/panels/views/HistoryView'))
const HelpViewLazy = React.lazy(() => import('@/features/panels/views/HelpView'))
const DashboardViewLazy = React.lazy(() => import('@/features/panels/views/DashboardView'))
const WorkflowSectionLazy = React.lazy(() => import('@/features/panels/views/WorkflowSection'))

export default function MainPanel({
  onClose,
  onHeaderDragStart,
  requestedTab,
  requestedSearchQuery,
  collapsed,
  pinned,
  onMinimize,
  onRestore,
  onPinToggle,
}: {
  onClose?: () => void
  onHeaderDragStart?: (ev: React.PointerEvent<HTMLElement>) => void
  requestedTab?: MainPanelTab
  requestedSearchQuery?: string
  collapsed?: boolean
  pinned?: boolean
  onMinimize?: () => void
  onRestore?: () => void
  onPinToggle?: () => void
}) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [tab, setTab] = React.useState<MainPanelTab>('help')
  const [graphFieldsStatus, setGraphFieldsStatus] = React.useState<string>(UI_COPY.noGraphLoaded)
  const [settingsActions, setSettingsActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })

  const [flowEditorManagerActions, setFlowEditorManagerActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }>({ applyDisabled: true, resetDisabled: true })

  const [workflowActions, setWorkflowActions] = React.useState<{
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })

  const panelTypography = usePanelTypography()
  const setGraphFieldsStatusStable = React.useCallback((next: string) => {
    setGraphFieldsStatus(prev => (prev === next ? prev : next))
  }, [])
  const setFlowEditorManagerActionsStable = React.useCallback((next: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => {
    setFlowEditorManagerActions(prev => {
      const same =
        prev.apply === next.apply &&
        prev.reset === next.reset &&
        prev.applyDisabled === next.applyDisabled &&
        prev.resetDisabled === next.resetDisabled
      return same ? prev : next
    })
  }, [])
  const { lastTraversalSummary } = useGraphStore(
    useShallow(s => ({ lastTraversalSummary: s.lastTraversalSummary })),
  )
  const graphData = useActiveGraphData()
  const searchVisible = searchOpen && mainPanelTabSupportsSearch(tab)
  const searchPlaceholder = MAIN_PANEL_SEARCH_PLACEHOLDER_BY_TAB[tab] || UI_LABELS.search
  const footerLabel = tab === 'graphFields' ? graphFieldsStatus : MAIN_PANEL_FOOTER_LABEL_BY_TAB[tab]

  const traversalChip = React.useMemo(() => {
    const summary = lastTraversalSummary
    const graph = graphData
    if (!summary || !summary.edgeIds || summary.edgeIds.length === 0) return null
    const edgesCount = summary.edgeIds.length
    let nodesCount: number | null = null
    if (graph && Array.isArray(graph.edges)) {
      const edgeIdSet = new Set(summary.edgeIds.map(id => String(id)))
      const nodeIdSet = new Set<string>()
      graph.edges.forEach(edge => {
        const id = String(edge.id)
        if (!edgeIdSet.has(id)) return
        nodeIdSet.add(String(edge.source))
        nodeIdSet.add(String(edge.target))
      })
      nodesCount = nodeIdSet.size
    }
    const modeLabel = summary.mode === 'graphRag' ? 'AgenticRAG' : 'Generic'
    const edgesLabel = edgesCount === 1 ? '1 edge' : `${edgesCount} edges`
    const nodesLabel =
      nodesCount == null ? null : nodesCount === 1 ? '1 node' : `${nodesCount} nodes`
    return {
      modeLabel,
      edgesLabel,
      nodesLabel,
    }
  }, [graphData, lastTraversalSummary])

  React.useEffect(() => {
    if (!requestedTab) return
    const nextSearch = typeof requestedSearchQuery === 'string' ? requestedSearchQuery : ''
    if (requestedTab === 'help') {
      setSearch(nextSearch)
      setSearchOpen(nextSearch.length > 0)
    } else {
      setSearch(nextSearch)
      setSearchOpen(nextSearch.length > 0)
    }
    setTab(requestedTab)
  }, [requestedSearchQuery, requestedTab])

  return (
    <MainPanelFrame
      ariaLabel="Main panel"
      onDragStart={onHeaderDragStart}
      collapsed={collapsed}
      searchVisible={searchVisible}
      searchPlaceholder={searchPlaceholder}
      searchQuery={search}
      onSearchChange={setSearch}
      tabs={MAIN_PANEL_TABS}
      tabVariant="icon"
      tabIconByKey={{
        integrations: Plug,
        workflow: Workflow,
        flowEditorManager: Table,
        graphFields: ({ className, strokeWidth }) => {
          const resolvedStrokeWidth =
            typeof strokeWidth === 'number'
              ? strokeWidth
              : typeof strokeWidth === 'string'
                ? Number(strokeWidth)
              : undefined

          return (
            <GraphFieldsIcon
              className={className}
              strokeWidth={Number.isFinite(resolvedStrokeWidth) ? resolvedStrokeWidth : 2}
            />
          )
        },
        dashboard: BarChart3,
        preview: MonitorPlay,
        settings: Settings,
        history: HistoryIcon,
        help: HelpCircle,
      }}
      activeTab={tab}
      onTabChange={(key) => {
        if (!isMainPanelTab(key)) return
        setSearchOpen(false)
        setTab(key)
      }}
      tabIdBase="main-panel"
      rightSlot={
        <HeaderActions
          onRestore={collapsed ? onRestore : undefined}
          onMinimize={!collapsed ? onMinimize : undefined}
          onPinToggle={onPinToggle}
          pinned={pinned}
          onSearchToggle={
            mainPanelTabSupportsSearch(tab)
              ? () => setSearchOpen(v => !v)
              : undefined
          }
          onApply={
            tab === 'settings'
              ? settingsActions.apply
              : tab === 'flowEditorManager'
                ? flowEditorManagerActions.apply
                : undefined
          }
          onReset={
            tab === 'settings'
              ? settingsActions.reset
              : tab === 'flowEditorManager'
                ? flowEditorManagerActions.reset
                : undefined
          }
          onClose={onClose}
          applyDisabled={
            tab === 'settings'
              ? !settingsActions.apply
              : tab === 'flowEditorManager'
                ? flowEditorManagerActions.applyDisabled
                : true
          }
          resetDisabled={
            tab === 'settings'
              ? !settingsActions.reset
              : tab === 'flowEditorManager'
                ? flowEditorManagerActions.resetDisabled
                : true
          }
        />
      }
      footer={(
        <footer className={`w-full flex flex-wrap items-center justify-between gap-1 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}>
          <p className="min-w-0 flex-1 truncate">{footerLabel}</p>
          {traversalChip && (
            <section className={`inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-[1px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} aria-label={UI_LABELS.graphTraversal}>
              <span className="font-semibold mr-1">{UI_LABELS.graphTraversal}</span>
              <span className="mr-1">{traversalChip.modeLabel}</span>
              <span className="mx-0.5">•</span>
              <span className={panelTypography.monospaceTextClass}>{traversalChip.edgesLabel}</span>
              {traversalChip.nodesLabel && (
                <>
                  <span className="mx-0.5">•</span>
                  <span className={panelTypography.monospaceTextClass}>{traversalChip.nodesLabel}</span>
                </>
              )}
            </section>
          )}
        </footer>
      )}
    >
      <section className="h-full min-h-0 px-2 py-2 sm:px-3 overflow-hidden" aria-label="Main panel content">
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-help-panel" aria-labelledby="main-panel-help-tab" hidden={tab !== 'help'}>
          {tab === 'help' && (
            <React.Suspense fallback={null}>
              <HelpViewLazy searchQuery={search} />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-integrations-panel" aria-labelledby="main-panel-integrations-tab" hidden={tab !== 'integrations'}>
          {tab === 'integrations' && (
            <React.Suspense fallback={null}>
              <IntegrationsHubViewLazy />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-workflow-panel" aria-labelledby="main-panel-workflow-tab" hidden={tab !== 'workflow'}>
          {tab === 'workflow' && (
            <MainPanelBody header={<MainPanelWorkflowHeader workflowActions={workflowActions} />}>
              <section
                className={`min-h-0 py-2 ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.workflowPanel}
              >
                <React.Suspense fallback={null}>
                  <WorkflowSectionLazy searchQuery={search} onRegisterActions={setWorkflowActions} />
                </React.Suspense>
              </section>
            </MainPanelBody>
          )}
        </section>
        <section
          className="h-full min-h-0"
          role="tabpanel"
          id="main-panel-flowEditorManager-panel"
          aria-labelledby="main-panel-flowEditorManager-tab"
          hidden={tab !== 'flowEditorManager'}
        >
          {tab === 'flowEditorManager' && (
            <React.Suspense fallback={null}>
              <FlowEditorManagerViewLazy searchQuery={search} onRegisterActions={setFlowEditorManagerActionsStable} />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-graphFields-panel" aria-labelledby="main-panel-graphFields-tab" hidden={tab !== 'graphFields'}>
          {tab === 'graphFields' && (
            <React.Suspense fallback={null}>
              <GraphFieldsViewLazy onStatusChange={setGraphFieldsStatusStable} searchQuery={search} />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-dashboard-panel" aria-labelledby="main-panel-dashboard-tab" hidden={tab !== 'dashboard'}>
          {tab === 'dashboard' && (
            <React.Suspense fallback={null}>
              <DashboardViewLazy />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-preview-panel" aria-labelledby="main-panel-preview-tab" hidden={tab !== 'preview'}>
          {tab === 'preview' && (
            <React.Suspense fallback={null}>
              <PreviewPanelViewLazy />
            </React.Suspense>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-settings-panel" aria-labelledby="main-panel-settings-tab" hidden={tab !== 'settings'}>
          {tab === 'settings' && (
            <MainPanelBody header={<MainPanelSettingsHeader settingsActions={settingsActions} />}>
              <section
                className={`h-full min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <React.Suspense fallback={null}>
                  <SettingsViewLazy searchQuery={search} onRegisterActions={setSettingsActions} />
                </React.Suspense>
              </section>
            </MainPanelBody>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-history-panel" aria-labelledby="main-panel-history-tab" hidden={tab !== 'history'}>
          {tab === 'history' && (
            <React.Suspense fallback={null}>
              <HistoryViewLazy searchQuery={search} />
            </React.Suspense>
          )}
        </section>
      </section>
    </MainPanelFrame>
  )
}
