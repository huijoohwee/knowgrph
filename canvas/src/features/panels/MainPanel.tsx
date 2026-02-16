import React from 'react'
import MainPanelFrame from '@/features/panels/ui/MainPanelFrame'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import HelpView from '@/features/panels/views/HelpView'
import GraphFieldsView from '@/features/panels/views/GraphFieldsView'
import DashboardView from '@/features/panels/views/DashboardView'
import PreviewPanelView from './views/PreviewPanelView'
import WorkflowSection from '@/features/panels/views/WorkflowSection'
import SettingsView from '@/features/panels/views/SettingsView'
import HistoryView from '@/features/panels/views/HistoryView'
import FlowEditorManagerView from '@/features/panels/views/FlowEditorManagerView'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelSettingsHeader from '@/features/panels/ui/MainPanelSettingsHeader'
import MainPanelWorkflowHeader from '@/features/panels/ui/MainPanelWorkflowHeader'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { BarChart3, HelpCircle, MonitorPlay, Settings, Workflow, History as HistoryIcon, Table } from 'lucide-react'
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useShallow } from 'zustand/react/shallow'

type MainPanelTab =
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

export default function MainPanel({
  onClose,
  onHeaderDragStart,
  requestedTab,
  collapsed,
  pinned,
  onMinimize,
  onRestore,
  onPinToggle,
}: {
  onClose?: () => void
  onHeaderDragStart?: (ev: React.PointerEvent<HTMLElement>) => void
  requestedTab?: MainPanelTab
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
  const { lastTraversalSummary, graphData } = useGraphStore(
    useShallow(s => ({ lastTraversalSummary: s.lastTraversalSummary, graphData: s.graphData })),
  )

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
    if (requestedTab === 'help') {
      setSearch('')
      setSearchOpen(false)
    } else {
      setSearchOpen(false)
    }
    setTab(requestedTab)
  }, [requestedTab])

  return (
    <MainPanelFrame
      ariaLabel="Main panel"
      onDragStart={onHeaderDragStart}
      collapsed={collapsed}
      searchVisible={
        searchOpen &&
        (tab === 'help' || tab === 'graphFields' || tab === 'settings' || tab === 'workflow' || tab === 'history' || tab === 'flowEditorManager')
      }
      searchPlaceholder={
        tab === 'help'
          ? UI_COPY.searchShortcutsPlaceholder
          : tab === 'graphFields'
          ? UI_COPY.searchFieldsPlaceholder
          : tab === 'settings'
          ? UI_COPY.searchSettingsPlaceholder
          : tab === 'history'
          ? UI_LABELS.search
          : tab === 'workflow'
          ? UI_LABELS.search
          : tab === 'flowEditorManager'
          ? UI_COPY.searchFlowEditorManagerRegistryPlaceholder
          : UI_LABELS.search
      }
      searchQuery={search}
      onSearchChange={setSearch}
      tabs={[
        { key: 'workflow', label: UI_LABELS.workflowManager },
        { key: 'flowEditorManager', label: UI_LABELS.flowEditorManager },
        { key: 'graphFields', label: UI_LABELS.graphFields },
        { key: 'dashboard', label: UI_LABELS.dashboard },
        { key: 'preview', label: UI_LABELS.previewPanel },
        { key: 'settings', label: UI_LABELS.settings },
        { key: 'history', label: UI_LABELS.history },
        { key: 'help', label: UI_LABELS.help },
      ]}
      tabVariant="icon"
      tabIconByKey={{
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
            tab === 'help' || tab === 'graphFields' || tab === 'settings' || tab === 'workflow' || tab === 'history' || tab === 'flowEditorManager'
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
        <footer className={`w-full flex items-center justify-between ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}>
          <p>
            {tab === 'graphFields'
              ? graphFieldsStatus
              : tab === 'dashboard'
              ? UI_LABELS.dashboard
              : tab === 'workflow'
              ? UI_LABELS.ragGraphRAGWorkflow
              : tab === 'flowEditorManager'
              ? UI_LABELS.flowEditorManager
              : tab === 'preview'
              ? UI_LABELS.previewPanel
              : tab === 'settings'
              ? UI_LABELS.settings
              : tab === 'history'
              ? UI_LABELS.history
              : UI_LABELS.help}
          </p>
          {traversalChip && (
            <section className={`inline-flex items-center px-2 py-[1px] rounded border ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} aria-label={UI_LABELS.graphTraversal}>
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
      <section className="h-full min-h-0 px-3 py-2 overflow-hidden" aria-label="Main panel content">
        <section role="tabpanel" id="main-panel-help-panel" aria-labelledby="main-panel-help-tab" hidden={tab !== 'help'}>
          {tab === 'help' && <HelpView searchQuery={search} />}
        </section>
        <section role="tabpanel" id="main-panel-workflow-panel" aria-labelledby="main-panel-workflow-tab" hidden={tab !== 'workflow'}>
          {tab === 'workflow' && (
            <MainPanelBody header={<MainPanelWorkflowHeader workflowActions={workflowActions} />}>
              <section
                className={`min-h-0 py-2 ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.workflowPanel}
              >
                <WorkflowSection searchQuery={search} onRegisterActions={setWorkflowActions} />
              </section>
            </MainPanelBody>
          )}
        </section>
        <section
          role="tabpanel"
          id="main-panel-flowEditorManager-panel"
          aria-labelledby="main-panel-flowEditorManager-tab"
          hidden={tab !== 'flowEditorManager'}
        >
          {tab === 'flowEditorManager' && (
            <FlowEditorManagerView searchQuery={search} onRegisterActions={setFlowEditorManagerActions} />
          )}
        </section>
        <section role="tabpanel" id="main-panel-graphFields-panel" aria-labelledby="main-panel-graphFields-tab" hidden={tab !== 'graphFields'}>
          {tab === 'graphFields' && <GraphFieldsView onStatusChange={setGraphFieldsStatus} searchQuery={search} />}
        </section>
        <section role="tabpanel" id="main-panel-dashboard-panel" aria-labelledby="main-panel-dashboard-tab" hidden={tab !== 'dashboard'}>
          {tab === 'dashboard' && <DashboardView />}
        </section>
        <section role="tabpanel" id="main-panel-preview-panel" aria-labelledby="main-panel-preview-tab" hidden={tab !== 'preview'}>
          {tab === 'preview' && <PreviewPanelView />}
        </section>
        <section role="tabpanel" id="main-panel-settings-panel" aria-labelledby="main-panel-settings-tab" hidden={tab !== 'settings'}>
          {tab === 'settings' && (
            <MainPanelBody header={<MainPanelSettingsHeader settingsActions={settingsActions} />}>
              <section
                className={`min-h-0 py-2 ${UI_THEME_TOKENS.text.secondary} ${panelTypography.panelTextClass}`}
                data-kg-anchor={UI_ANCHORS.settingsPanel}
              >
                <SettingsView searchQuery={search} onRegisterActions={setSettingsActions} />
              </section>
            </MainPanelBody>
          )}
        </section>
        <section role="tabpanel" id="main-panel-history-panel" aria-labelledby="main-panel-history-tab" hidden={tab !== 'history'}>
          {tab === 'history' && <HistoryView searchQuery={search} />}
        </section>
      </section>
    </MainPanelFrame>
  )
}
