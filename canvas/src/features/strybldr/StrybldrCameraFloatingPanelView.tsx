import React from 'react'
import { Camera } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { buildStoryboardBoardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { JSONValue } from '@/lib/graph/types'
import { PanelSelect } from '@/lib/ui/panelFormControls'
import { UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { StrybldrCameraPanel } from './StrybldrCameraPanel'
import { STRYBLDR_CAMERA_PROPERTY_KEY, serializeStrybldrCameraSettings, type StrybldrCameraSettings } from './strybldrCamera'

type StrybldrCameraStoryboardCard = ReturnType<typeof buildStoryboardBoardModel>['lanes'][number]['cards'][number]

const resolveStrybldrCameraPreviewImageUrl = (card: StrybldrCameraStoryboardCard | null): string | null => {
  if (!card) return null
  const media = card.media
  if (media?.thumbnailUrl) return media.thumbnailUrl
  if (media && (media.kind === 'image' || media.kind === 'svg') && media.url) return media.url
  const imageReference = card.references.find(reference => reference.kind === 'image' || reference.kind === 'svg')
  return imageReference?.url || null
}

export function StrybldrCameraFloatingPanelView() {
  const {
    graphData: rawGraphData,
    graphDataRevision,
    updateNode,
    addHistory,
    pushUiToast,
  } = useGraphStore(
    useShallow(s => ({
      graphData: s.graphData,
      graphDataRevision: s.graphDataRevision,
      updateNode: s.updateNode,
      addHistory: s.addHistory,
      pushUiToast: s.pushUiToast,
    })),
  )
  const activeGraphData = useActiveGraphRenderData(true)
  const graphData = activeGraphData || rawGraphData
  const [selectedCardId, setSelectedCardId] = React.useState('')
  const board = React.useMemo(
    () => buildStoryboardBoardModel({ graphData, graphRevision: graphDataRevision }),
    [graphData, graphDataRevision],
  )
  const cards = React.useMemo(() => board.lanes.flatMap(lane => lane.cards), [board])
  const editableCards = React.useMemo(() => {
    const elementCards = cards.filter(card => card.lane === 'Elements')
    return elementCards.length > 0 ? elementCards : cards
  }, [cards])
  const selectedCard = React.useMemo(
    () => editableCards.find(card => card.id === selectedCardId) || editableCards[0] || null,
    [editableCards, selectedCardId],
  )
  const selectedCardPreviewImageUrl = React.useMemo(
    () => resolveStrybldrCameraPreviewImageUrl(selectedCard),
    [selectedCard],
  )
  const selectedCardProperties = React.useMemo(() => {
    if (!graphData || !selectedCard) return {}
    const node = (Array.isArray(graphData.nodes) ? graphData.nodes : []).find(item => item.id === selectedCard.id)
    return node?.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
      ? node.properties as Record<string, unknown>
      : {}
  }, [graphData, selectedCard])

  React.useEffect(() => {
    if (selectedCard?.id && selectedCard.id !== selectedCardId) setSelectedCardId(selectedCard.id)
  }, [selectedCard?.id, selectedCardId])

  const reframeSelectedCardCamera = React.useCallback((cameraSettings: StrybldrCameraSettings) => {
    if (!graphData || !selectedCard) return
    const currentNode = (Array.isArray(graphData.nodes) ? graphData.nodes : []).find(node => node.id === selectedCard.id) || null
    const currentProps = currentNode?.properties && typeof currentNode.properties === 'object' && !Array.isArray(currentNode.properties)
      ? currentNode.properties as Record<string, JSONValue>
      : {}
    updateNode(selectedCard.id, {
      properties: {
        ...currentProps,
        [STRYBLDR_CAMERA_PROPERTY_KEY]: serializeStrybldrCameraSettings(cameraSettings),
        evidenceKind: 'user-edit',
        strybldrUserApprovedAtMs: Date.now(),
      },
    })
    addHistory('Strybldr camera reframe')
    pushUiToast({
      id: 'strybldr:camera:reframe',
      kind: 'success',
      message: 'Strybldr camera reframed.',
    })
  }, [addHistory, graphData, pushUiToast, selectedCard, updateNode])

  return (
    <section className="h-full flex flex-col" aria-label="Camera panel">
      <header className={cn('flex items-center justify-between gap-2 px-1 py-1', UI_THEME_TOKENS.panel.divider)}>
        <section className="flex min-w-0 items-center gap-2">
          <Camera className="h-4 w-4 shrink-0" strokeWidth={1.7} aria-hidden={true} />
          <section className="min-w-0 text-xs font-semibold">Camera</section>
        </section>
      </header>
      <section className={`${UI_RESPONSIVE_FLOATING_PANEL_SCROLL_CLASSNAME} px-1 pb-2`}>
        {selectedCard ? (
          <section className="space-y-2 py-1">
            <PanelSelect
              value={selectedCard.id}
              aria-label="Camera card"
              onChange={e => setSelectedCardId(e.target.value)}
            >
              {editableCards.map(card => (
                <option key={card.id} value={card.id}>
                  {card.lane}: {card.title}
                </option>
              ))}
            </PanelSelect>
            <StrybldrCameraPanel
              selectedCardId={selectedCard.id}
              selectedCardTitle={selectedCard.title}
              selectedCardProperties={selectedCardProperties}
              previewImageUrl={selectedCardPreviewImageUrl}
              onReframe={reframeSelectedCardCamera}
            />
          </section>
        ) : (
          <section className={cn('py-3 text-xs', UI_THEME_TOKENS.text.secondary)}>No storyboard card loaded.</section>
        )}
      </section>
    </section>
  )
}
