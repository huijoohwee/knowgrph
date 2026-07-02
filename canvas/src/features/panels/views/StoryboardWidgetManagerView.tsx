import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { UI_LABELS } from '@/lib/config'
import MainPanelBody from '@/features/panels/ui/MainPanelBody'
import MainPanelStoryboardWidgetManagerHeader, { type StoryboardWidgetManagerTabKey } from '@/features/panels/ui/MainPanelStoryboardWidgetManagerHeader'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'

import StoryboardWidgetGraphTab from '@/features/storyboard-widget-manager/StoryboardWidgetGraphTab'
import StoryboardWidgetMappingTab from '@/features/storyboard-widget-manager/StoryboardWidgetMappingTab'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const hasWorkflowSectionsInFrontmatterMeta = (graphData: unknown): boolean => {
  if (!isRecord(graphData)) return false
  const metadata = isRecord(graphData.metadata) ? (graphData.metadata as Record<string, unknown>) : null
  if (!metadata) return false
  const fm = isRecord(metadata.frontmatterMeta) ? (metadata.frontmatterMeta as Record<string, unknown>) : null
  if (!fm) return false
  if (Array.isArray(fm.pipeline)) return true
  if (typeof fm.mermaid === 'string' && fm.mermaid.trim()) return true
  if (isRecord(fm.runtime)) return true
  if (isRecord(fm.flow)) return true
  const tierBKeys = ['product', 'domain', 'subject', 'objective', 'artifact', 'owner', 'version', 'status']
  for (let i = 0; i < tierBKeys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(fm, tierBKeys[i])) return true
  }
  return false
}

export default function StoryboardWidgetManagerView({
  searchQuery,
  requestedTab,
  requestedEntryLabel,
  requestedEntryToken,
  onRegisterActions,
}: {
  searchQuery: string
  requestedTab?: StoryboardWidgetManagerTabKey
  requestedEntryLabel?: string
  requestedEntryToken?: number
  onRegisterActions?: (actions: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => void
}) {
  const panelTypography = usePanelTypography()
  const { graphData } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
    })),
  )
  const workflowMode = React.useMemo(
    () => Boolean(graphData && (isFrontmatterFlowGraph(graphData) || hasWorkflowSectionsInFrontmatterMeta(graphData))),
    [graphData],
  )
  const [tab, setTab] = React.useState<StoryboardWidgetManagerTabKey>(requestedTab === 'mapping' ? 'mapping' : 'graph')

  React.useEffect(() => {
    if (workflowMode && tab !== 'graph') {
      setTab('graph')
      return
    }
    const nextTab: StoryboardWidgetManagerTabKey = requestedTab === 'mapping' ? 'mapping' : 'graph'
    if (workflowMode && nextTab !== 'graph') return
    if (tab !== nextTab) setTab(nextTab)
  }, [requestedTab, tab, workflowMode])

  React.useEffect(() => {
    if (!onRegisterActions) return
    if (tab === 'mapping' && !workflowMode) return
    onRegisterActions({
      apply: undefined,
      reset: undefined,
      applyDisabled: true,
      resetDisabled: true,
    })
  }, [onRegisterActions, tab, workflowMode])

  return (
    <MainPanelBody
      header={
        <MainPanelStoryboardWidgetManagerHeader
          activeTab={tab}
          workflowMode={workflowMode}
          onTabChange={workflowMode ? undefined : setTab}
        />
      }
      scrollable={false}
    >
      <section
        className={`min-h-0 py-2 ${UI_THEME_TOKENS.text.primary} ${panelTypography.panelTextClass} h-full overflow-hidden`}
        aria-label={UI_LABELS.workflowManager}
      >
        {tab === 'mapping' && !workflowMode ? (
          <section role="tabpanel" aria-label={UI_LABELS.storyboardWidgetMapping} className="h-full">
            <StoryboardWidgetMappingTab searchQuery={searchQuery} onRegisterActions={onRegisterActions} />
          </section>
        ) : (
          <section role="tabpanel" aria-label={UI_LABELS.storyboardWidgetGraph} className="h-full">
            <StoryboardWidgetGraphTab
              searchQuery={searchQuery}
              workflowMode={workflowMode}
              requestedEntryLabel={requestedEntryLabel}
              requestedEntryToken={requestedEntryToken}
            />
          </section>
        )}
      </section>
    </MainPanelBody>
  )
}
