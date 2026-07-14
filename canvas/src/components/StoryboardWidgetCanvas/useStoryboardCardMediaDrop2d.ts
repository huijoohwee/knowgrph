import React from 'react'
import { updateStrybldrStoryboardMarkdownCardOverride } from '@/features/strybldr/strybldrStoryboard'
import { useGraphStore } from '@/hooks/useGraphStore'
import { writeActiveMarkdownDocumentTextIfPresent } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import { buildNodeMediaProperties } from '@/lib/canvas/graph-elements/mediaSpec'
import { applyStoryboardCardMediaDropGraph } from '@/components/StoryboardWidgetCanvas/storyboardCardMediaDropGraph'
import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { MediaDragPayload } from '@/lib/ui/mediaDragPayload'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import {
  appendStoryboardMediaAlbumItem,
  STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY,
  toStoryboardMediaAlbumItem,
} from '@/components/StoryboardCanvas/storyboardCardMediaAlbum'

const STORYBOARD_DROPPED_PRIMARY_MEDIA_CLEAR_KEYS = [
  'renderUrl',
  'embedUrl',
  'media_url',
  'image',
  'imageUrl',
  'video',
  'videoUrl',
  'audio',
  'audioUrl',
  'audio_url',
  'src',
  'outputSrcDoc',
  'thumbnailUrl',
  'thumbnail_url',
  'posterUrl',
] as const

const readStoryboardScalar2d = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

export function useStoryboardCardMediaDrop2d(args: {
  cards: readonly StoryboardCardModel[]
  commitGraphData?: (graphData: GraphData) => void
  graphData: GraphData | null
  markdownDocumentName: string | null
  markdownDocumentText: string | null
  nodeById: ReadonlyMap<string, GraphNode>
}) {
  const { cards, commitGraphData, graphData, markdownDocumentName, markdownDocumentText, nodeById } = args
  const addHistory = useGraphStore(s => s.addHistory)
  const setGraphDataPreservingLayout = useGraphStore(s => s.setGraphDataPreservingLayout)
  const setMarkdownDocument = useGraphStore(s => s.setMarkdownDocument)
  const updateNode = useGraphStore(s => s.updateNode)
  const [pendingMediaByCardId, setPendingMediaByCardId] = React.useState<Record<string, NonNullable<StoryboardCardModel['media']>>>({})

  React.useEffect(() => {
    setPendingMediaByCardId(current => {
      let changed = false
      const next = { ...current }
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i]!
        const pending = next[card.id]
        if (!pending || card.media?.url !== pending.url) continue
        delete next[card.id]
        changed = true
      }
      return changed ? next : current
    })
  }, [cards])

  const dropCardMedia = React.useCallback((card: StoryboardCardModel, payload: MediaDragPayload) => {
    const url = readStoryboardScalar2d(payload.url)
    if (!url) return
    const liveGraphData = useGraphStore.getState().graphData || graphData
    const node = resolveGraphNodeByCanonicalId(liveGraphData, card.id)
      || nodeById.get(card.id)
      || resolveGraphNodeByCanonicalId(graphData, card.id)
    if (!node) return
    setPendingMediaByCardId(current => ({
      ...current,
      [card.id]: {
        kind: payload.kind,
        url,
        sourceUrl: url,
        thumbnailUrl: payload.thumbnailUrl || null,
      },
    }))
    const currentProperties = { ...((node.properties || {}) as Record<string, unknown>) }
    const droppedMedia = toStoryboardMediaAlbumItem({
      kind: payload.kind,
      url,
      sourceUrl: url,
      thumbnailUrl: payload.thumbnailUrl || null,
    })
    const mediaAlbumItems = droppedMedia
      ? appendStoryboardMediaAlbumItem({
          existing: currentProperties[STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY],
          current: toStoryboardMediaAlbumItem(card.media),
          dropped: droppedMedia,
        })
      : readStoryboardScalar2d(currentProperties[STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY])
    STORYBOARD_DROPPED_PRIMARY_MEDIA_CLEAR_KEYS.forEach(key => {
      delete currentProperties[key]
    })
    const nextProperties = buildNodeMediaProperties({
      extra: {
        ...currentProperties,
        ...(Array.isArray(mediaAlbumItems) ? { [STORYBOARD_CARD_MEDIA_ALBUM_PROPERTY]: mediaAlbumItems } : {}),
        ...(payload.thumbnailUrl ? { thumbnailUrl: payload.thumbnailUrl } : {}),
      },
      kind: payload.kind,
      url,
      includeCamelGeneric: true,
    })
    const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({
      text: markdownDocumentText || '',
      nodeId: card.id,
      patch: {
        imageUrl: '',
        mediaKind: payload.kind,
        mediaUrl: url,
        outputSrcDoc: '',
        renderUrl: '',
      },
    })
    if (nextMarkdownText && markdownDocumentName && nextMarkdownText !== markdownDocumentText) {
      setMarkdownDocument(markdownDocumentName, nextMarkdownText, { applyViewPreset: false })
      writeActiveMarkdownDocumentTextIfPresent({
        state: useGraphStore.getState(),
        sourceFiles: useGraphStore.getState().sourceFiles || [],
        text: nextMarkdownText,
        label: 'Storyboard media',
      })
    }
    const nextGraph = resolveGraphNodeByCanonicalId(liveGraphData, card.id)
      ? applyStoryboardCardMediaDropGraph({ cardId: card.id, cardProperties: nextProperties, graphData: liveGraphData, media: { ...payload, url } })
      : null
    if (nextGraph) {
      if (commitGraphData) commitGraphData(nextGraph.graphData)
      else setGraphDataPreservingLayout(nextGraph.graphData)
      addHistory('Storyboard media')
      return
    }
    updateNode(card.id, { properties: nextProperties as never })
    addHistory('Storyboard media')
  }, [addHistory, commitGraphData, graphData, markdownDocumentName, markdownDocumentText, nodeById, setGraphDataPreservingLayout, setMarkdownDocument, updateNode])

  return { dropCardMedia, pendingMediaByCardId }
}
