import type { CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'

export type StrybldrBox = {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
  unit: 'percentage' | 'pixel'
}

export type StrybldrEvidenceKind =
  | 'source-metadata'
  | 'local-object-detection'
  | 'local-human-geometry'
  | 'modelark-visual-grounding'
  | 'user-edit'

export type StrybldrDetectionProvider =
  | 'fallback'
  | 'transformers-detr'
  | 'human'
  | 'byteplus-modelark'

export type StrybldrSource = {
  sourceUnitId: string
  workspacePath: string
  relativePath: string
  originalName: string
  mediaKind: CorpusSourceUnit['mediaKind']
  mimeHint: string | null
  byteSize: number
  textHash: string
  mediaUrl?: string | null
}

export type StrybldrElement = {
  id: string
  sourceUnitId: string
  label: string
  confidence: number
  sourceBox?: StrybldrBox | null
  evidenceKind: StrybldrEvidenceKind
  provider: StrybldrDetectionProvider
  order: number
  prompt?: string | null
  action?: string | null
  summary?: string | null
}

export type StrybldrStoryboardDocument = {
  version: 1
  runId: string
  createdAtMs: number
  sources: StrybldrSource[]
  elements: StrybldrElement[]
  notes?: string | null
}

export type StrybldrVideoHandoffCard = {
  id: string
  lane: string
  title: string
  summary: string
  action: string
  prompt: string
  references: string[]
  order: number
  sourceUnitId: string
}

export type StrybldrVideoHandoff = {
  cards: StrybldrVideoHandoffCard[]
  prompt: string
  referenceImageUrl: string | null
}
