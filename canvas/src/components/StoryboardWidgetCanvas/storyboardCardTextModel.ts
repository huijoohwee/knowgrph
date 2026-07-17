import { readStoryboardCardSummaryText } from '@/components/StoryboardWidgetCanvas/storyboardCardSummaryText'
import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import {
  GRAPH_NODE_CARD_TEXT_FIELDS,
  type GraphNodeCardTextFieldId,
  type GraphNodeCardTextFieldSpec,
} from '@/lib/cards/graphNodeCardFields'

export type StoryboardCardTextModel = {
  primaryRaw: string
  primaryDisplay: string
  primaryField: GraphNodeCardTextFieldSpec
  secondaryRaw: string
  secondaryDisplay: string
  secondaryField: GraphNodeCardTextFieldSpec | null
  secondaryEditable: boolean
}
type StoryboardCardTextSource = Partial<Pick<StoryboardCardModel, 'summary' | 'output' | 'action' | 'dialogue' | 'prompt' | 'style' | 'typeLabel'>>

type StoryboardCardPrimaryTextCandidate = {
  raw: string
  field: GraphNodeCardTextFieldSpec
}

const STORYBOARD_CARD_FALLBACK_TEXT_FIELD = GRAPH_NODE_CARD_TEXT_FIELDS[0]

const readStoryboardCardTextFieldSpec = (id: GraphNodeCardTextFieldId): GraphNodeCardTextFieldSpec => {
  return GRAPH_NODE_CARD_TEXT_FIELDS.find(field => field.id === id) || STORYBOARD_CARD_FALLBACK_TEXT_FIELD
}

export const buildStoryboardCardTextModel = (card: StoryboardCardTextSource): StoryboardCardTextModel => {
  if (card.typeLabel === 'Probe-Tree Card' || card.probeTreeMultiSelect) {
    const primaryField = readStoryboardCardTextFieldSpec('summary')
    const secondaryField = readStoryboardCardTextFieldSpec('output')
    const primaryRaw = card.summary || ''
    const secondaryRaw = card.output || ''
    return {
      primaryRaw,
      primaryDisplay: readStoryboardCardSummaryText(primaryRaw),
      primaryField,
      secondaryRaw,
      secondaryDisplay: readStoryboardCardSummaryText(secondaryRaw),
      secondaryField,
      secondaryEditable: true,
    }
  }
  const candidates: StoryboardCardPrimaryTextCandidate[] = [
    { raw: card.summary || '', field: readStoryboardCardTextFieldSpec('summary') },
    { raw: card.output || '', field: readStoryboardCardTextFieldSpec('output') },
    { raw: card.action || '', field: readStoryboardCardTextFieldSpec('action') },
    { raw: card.prompt || '', field: readStoryboardCardTextFieldSpec('prompt') },
    { raw: card.dialogue || '', field: readStoryboardCardTextFieldSpec('dialogue') },
    { raw: card.style || '', field: readStoryboardCardTextFieldSpec('style') },
  ].filter(candidate => !!candidate.raw)
  const primaryCandidate = candidates[0]
  const primaryRaw = primaryCandidate?.raw || ''
  const primaryField = primaryCandidate?.field || STORYBOARD_CARD_FALLBACK_TEXT_FIELD
  const secondaryCandidate = candidates.find(candidate => candidate.field.id !== primaryField.id) || null
  const secondaryRaw = secondaryCandidate?.raw || ''
  return {
    primaryRaw,
    // The media album already owns embedded asset previews; keep the text column readable.
    primaryDisplay: readStoryboardCardSummaryText(primaryRaw),
    primaryField,
    secondaryRaw,
    secondaryDisplay: readStoryboardCardSummaryText(secondaryRaw),
    secondaryField: secondaryCandidate?.field || null,
    secondaryEditable: false,
  }
}
