import React from 'react'
import MainPanelFrame from '@/features/panels/ui/MainPanelFrame'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import HelpView from '@/features/panels/views/HelpView'
import GraphFieldsView from '@/features/panels/views/GraphFieldsView'
import PreviewPanelView from './views/PreviewPanelView'
import WorkflowSection from '@/features/panels/views/WorkflowSection'
import SettingsView from '@/features/panels/views/SettingsView'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelSettingsHeader from '@/features/panels/ui/MainPanelSettingsHeader'
import { UI_ANCHORS, UI_COPY, UI_LABELS } from '@/lib/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { HelpCircle, MonitorPlay, Settings, Workflow } from 'lucide-react'
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons'

type MainPanelTab = 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings'

function isMainPanelTab(key: string): key is MainPanelTab {
  return key === 'workflow' || key === 'help' || key === 'graphFields' || key === 'preview' || key === 'settings'
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
  onHeaderDragStart?: (ev: React.PointerEvent<HTMLDivElement>) => void
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

  const lastTraversalSummary = useGraphStore(s => s.lastTraversalSummary)
  const graphData = useGraphStore(s => s.graphData)
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  )
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
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
      onDragStart={onHeaderDragStart}
      collapsed={collapsed}
      searchVisible={searchOpen && (tab === 'help' || tab === 'graphFields' || tab === 'settings')}
      searchPlaceholder={
        tab === 'help'
          ? UI_COPY.searchShortcutsPlaceholder
          : tab === 'graphFields'
          ? UI_COPY.searchFieldsPlaceholder
          : tab === 'settings'
          ? UI_COPY.searchSettingsPlaceholder
          : 'Search'
      }
      searchQuery={search}
      onSearchChange={setSearch}
      tabs={[
        { key: 'workflow', label: 'Workflow' },
        { key: 'graphFields', label: UI_LABELS.graphFields },
        { key: 'preview', label: UI_LABELS.previewPanel },
        { key: 'settings', label: UI_LABELS.settings },
        { key: 'help', label: UI_LABELS.help },
      ]}
      tabVariant="icon"
      tabIconByKey={{
        workflow: Workflow,
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
        preview: MonitorPlay,
        settings: Settings,
        help: HelpCircle,
      }}
      activeTab={tab}
      onTabChange={(key) => {
        if (!isMainPanelTab(key)) return
        setSearchOpen(false)
        setTab(key)
      }}
      rightSlot={
        <HeaderActions
          onRestore={collapsed ? onRestore : undefined}
          onMinimize={!collapsed ? onMinimize : undefined}
          onPinToggle={onPinToggle}
          pinned={pinned}
          onSearchToggle={
            tab === 'help' || tab === 'graphFields' || tab === 'settings'
              ? () => setSearchOpen(v => !v)
              : undefined
          }
          onApply={tab === 'settings' ? settingsActions.apply : undefined}
          onReset={tab === 'settings' ? settingsActions.reset : undefined}
          onClose={onClose}
          applyDisabled={!(tab === 'settings' && settingsActions.apply)}
          resetDisabled={!(tab === 'settings' && settingsActions.reset)}
        />
      }
      footer={(
        <div
          className={
            [
              'w-full flex items-center justify-between text-gray-600',
              uiPanelKeyValueTextSizeClass,
              uiPanelTextFontClass,
            ].join(' ')
          }
        >
          <div>
            {tab === 'graphFields' ? graphFieldsStatus : (
              tab === 'workflow'
                ? UI_LABELS.ragGraphRAGWorkflow
                : tab === 'preview'
                ? UI_LABELS.previewPanel
                : tab === 'settings'
                ? UI_LABELS.settings
                : UI_LABELS.help
            )}
          </div>
          {traversalChip && (
            <div
              className={
                [
                  'inline-flex items-center px-2 py-[1px] rounded border border-gray-300 bg-gray-50 text-[9px] text-gray-600',
                  uiPanelTextFontClass,
                ].join(' ')
              }
            >
              <span className="font-semibold mr-1">Traversal</span>
              <span className="mr-1">{traversalChip.modeLabel}</span>
              <span className="mx-0.5">•</span>
              <span className={uiPanelMonospaceTextClass}>{traversalChip.edgesLabel}</span>
              {traversalChip.nodesLabel && (
                <>
                  <span className="mx-0.5">•</span>
                  <span className={uiPanelMonospaceTextClass}>{traversalChip.nodesLabel}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    >
      <div className="h-full min-h-0 px-3 py-2 overflow-hidden">
        {tab === 'help' && <HelpView searchQuery={search} />}
        {tab === 'workflow' && <WorkflowSection />}
        {tab === 'graphFields' && <GraphFieldsView onStatusChange={setGraphFieldsStatus} searchQuery={search} />}
        {tab === 'preview' && <PreviewPanelView />}
        {tab === 'settings' && (
          <MainPanelBody header={<MainPanelSettingsHeader settingsActions={settingsActions} />}>
            <div
              className={[
                'min-h-0 py-2 text-gray-600',
                uiPanelKeyValueTextSizeClass,
                uiPanelTextFontClass,
              ].join(' ')}
              data-kg-anchor={UI_ANCHORS.settingsPanel}
            >
              <SettingsView searchQuery={search} onRegisterActions={setSettingsActions} />
            </div>
          </MainPanelBody>
        )}
      </div>
    </MainPanelFrame>
  )
}
