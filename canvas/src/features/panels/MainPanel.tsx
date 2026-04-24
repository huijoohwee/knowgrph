import React from 'react'
import MainPanelFrame from '@/features/panels/ui/MainPanelFrame'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import { UI_ANCHORS, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BarChart3, HelpCircle, MonitorPlay, Settings, History as HistoryIcon, Table, Plug, CreditCard, Map as MapIcon } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useShallow } from 'zustand/react/shallow'
import { useActiveGraphData } from '@/hooks/useActiveGraphData'
import {
  MAIN_PANEL_FOOTER_LABEL_BY_TAB,
  MAIN_PANEL_SEARCH_PLACEHOLDER_BY_TAB,
  MAIN_PANEL_TABS,
  SEARCHABLE_MAIN_PANEL_TABS,
  isMainPanelTabKey,
  type MainPanelTabKey,
} from '@/features/panels/mainPanelTabs'

const mainPanelTabSupportsSearch = (tab: MainPanelTabKey): boolean => SEARCHABLE_MAIN_PANEL_TABS.has(tab)

const IntegrationsHubViewLazy = React.lazy(() => import('./views/IntegrationsHubView'))
const MapsHubViewLazy = React.lazy(() => import('./views/MapsHubView'))
const PaymentsHubViewLazy = React.lazy(() => import('./views/PaymentsHubView'))
const FlowEditorManagerViewLazy = React.lazy(() => import('@/features/panels/views/FlowEditorManagerView'))
const PreviewPanelViewLazy = React.lazy(() => import('./views/PreviewPanelView'))
const SettingsViewLazy = React.lazy(() => import('@/features/panels/views/SettingsView'))
const HistoryViewLazy = React.lazy(() => import('@/features/panels/views/HistoryView'))
const HelpViewLazy = React.lazy(() => import('@/features/panels/views/HelpView'))
const DashboardViewLazy = React.lazy(() => import('@/features/panels/views/DashboardView'))

export default function MainPanel({
  onClose,
  onHeaderDragStart,
  requestedTab,
  requestedAnchorId,
  requestedAnchorSeq,
  requestedSearchQuery,
  requestedWorkflowManagerTab,
  collapsed,
  pinned,
  onMinimize,
  onRestore,
  onPinToggle,
}: {
  onClose?: () => void
  onHeaderDragStart?: (ev: React.PointerEvent<HTMLElement>) => void
  requestedTab?: MainPanelTabKey
  requestedAnchorId?: string
  requestedAnchorSeq?: number
  requestedSearchQuery?: string
  requestedWorkflowManagerTab?: 'graph' | 'mapping'
  collapsed?: boolean
  pinned?: boolean
  onMinimize?: () => void
  onRestore?: () => void
  onPinToggle?: () => void
}) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [tab, setTab] = React.useState<MainPanelTabKey>('help')
  const [settingsActions, setSettingsActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })
  const [integrationsActions, setIntegrationsActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })
  const [mapsActions, setMapsActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })
  const [paymentsActions, setPaymentsActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    globalReset?: () => void
    collapseAll?: () => void
    expandAll?: () => void
    allCollapsed?: boolean
  }>({ allCollapsed: true })

  const [workflowManagerActions, setWorkflowManagerActions] = React.useState<{
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }>({ applyDisabled: true, resetDisabled: true })

  const panelTypography = usePanelTypography()
  const setWorkflowManagerActionsStable = React.useCallback((next: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => {
    setWorkflowManagerActions(prev => {
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
  const footerLabel = MAIN_PANEL_FOOTER_LABEL_BY_TAB[tab]

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
  }, [requestedAnchorId, requestedAnchorSeq, requestedSearchQuery, requestedTab])

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
        maps: MapIcon,
        payments: CreditCard,
        workflowManager: Table,
        dashboard: BarChart3,
        preview: MonitorPlay,
        settings: Settings,
        history: HistoryIcon,
        help: HelpCircle,
      }}
      activeTab={tab}
      onTabChange={(key) => {
        if (!isMainPanelTabKey(key)) return
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
              : tab === 'integrations'
                ? integrationsActions.apply
                : tab === 'maps'
                  ? mapsActions.apply
                : tab === 'payments'
                  ? paymentsActions.apply
              : tab === 'workflowManager'
                ? workflowManagerActions.apply
                : undefined
          }
          onReset={
            tab === 'settings'
              ? settingsActions.reset
              : tab === 'integrations'
                ? integrationsActions.reset
                : tab === 'maps'
                  ? mapsActions.reset
                : tab === 'payments'
                  ? paymentsActions.reset
              : tab === 'workflowManager'
                ? workflowManagerActions.reset
                : undefined
          }
          onClose={onClose}
          applyDisabled={
            tab === 'settings'
              ? !settingsActions.apply
              : tab === 'integrations'
                ? !integrationsActions.apply
                : tab === 'maps'
                  ? !mapsActions.apply
                : tab === 'payments'
                  ? !paymentsActions.apply
              : tab === 'workflowManager'
                ? workflowManagerActions.applyDisabled
                : true
          }
          resetDisabled={
            tab === 'settings'
              ? !settingsActions.reset
              : tab === 'integrations'
                ? !integrationsActions.reset
                : tab === 'maps'
                  ? !mapsActions.reset
                : tab === 'payments'
                  ? !paymentsActions.reset
              : tab === 'workflowManager'
                ? workflowManagerActions.resetDisabled
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
            <MainPanelBody header={null}>
              <section
                className={`h-full min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <React.Suspense fallback={null}>
                  <IntegrationsHubViewLazy
                    searchQuery={search}
                    requestedAnchorId={requestedAnchorId}
                    requestedAnchorSeq={requestedAnchorSeq}
                    onRegisterActions={setIntegrationsActions}
                  />
                </React.Suspense>
              </section>
            </MainPanelBody>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-maps-panel" aria-labelledby="main-panel-maps-tab" hidden={tab !== 'maps'}>
          {tab === 'maps' && (
            <MainPanelBody header={null}>
              <section
                className={`h-full min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <React.Suspense fallback={null}>
                  <MapsHubViewLazy
                    searchQuery={search}
                    requestedAnchorId={requestedAnchorId}
                    requestedAnchorSeq={requestedAnchorSeq}
                    onRegisterActions={setMapsActions}
                  />
                </React.Suspense>
              </section>
            </MainPanelBody>
          )}
        </section>
        <section className="h-full min-h-0" role="tabpanel" id="main-panel-payments-panel" aria-labelledby="main-panel-payments-tab" hidden={tab !== 'payments'}>
          {tab === 'payments' && (
            <MainPanelBody header={null}>
              <section
                className={`h-full min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <React.Suspense fallback={null}>
                  <PaymentsHubViewLazy
                    searchQuery={search}
                    requestedAnchorId={requestedAnchorId}
                    requestedAnchorSeq={requestedAnchorSeq}
                    onRegisterActions={setPaymentsActions}
                  />
                </React.Suspense>
              </section>
            </MainPanelBody>
          )}
        </section>
        <section
          className="h-full min-h-0"
          role="tabpanel"
          id="main-panel-workflowManager-panel"
          aria-labelledby="main-panel-workflowManager-tab"
          hidden={tab !== 'workflowManager'}
        >
          {tab === 'workflowManager' && (
            <React.Suspense fallback={null}>
              <FlowEditorManagerViewLazy
                searchQuery={search}
                requestedTab={requestedWorkflowManagerTab}
                onRegisterActions={setWorkflowManagerActionsStable}
              />
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
            <MainPanelBody header={null}>
              <section
                className={`h-full min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <React.Suspense fallback={null}>
                  <SettingsViewLazy
                    searchQuery={search}
                    requestedAnchorId={requestedAnchorId}
                    requestedAnchorSeq={requestedAnchorSeq}
                    onRegisterActions={setSettingsActions}
                  />
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
