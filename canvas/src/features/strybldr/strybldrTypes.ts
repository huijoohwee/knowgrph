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

export type StrybldrWorkflowEdge = {
  id: string
  source: string
  target: string
  label: string
}

export type StrybldrWorkflow = {
  stages: string[]
  fork?: {
    id: string
    label?: string | null
    policy?: string | null
    branches: string[]
  } | null
  publish?: {
    id: string
    label?: string | null
    policy?: string | null
  } | null
}

export type StrytreeStoryNode = {
  nodeId: string
  parentNodeId?: string | null
  title: string
  synopsis: string
  prompt?: string | null
  authorName?: string | null
  status: 'active' | 'hot' | 'locked' | 'dropped' | 'draft'
  duration?: string | null
  ageDays?: number | null
  isFreeWindow?: boolean
  isProtected?: boolean
  unlockPriceCredits?: number
  likes?: number
  impressions?: number
  paidUnlocks?: number
  videoUrl?: string | null
  ownAssetIds?: string[]
}

export type StrytreeBranchCandidate = {
  candidateId: string
  title: string
  synopsis: string
  prompt?: string | null
  provider?: string | null
  status?: string | null
  creditCost?: number
  elapsedMs?: number
  fallbackStatus?: string | null
  moderationStatus?: string | null
  inheritedAssetCount?: number
  continuityScore?: number
  publishEligible?: boolean
  selected?: boolean
  videoUrl?: string | null
  thumbnailUrl?: string | null
  notes?: string | null
}

export type StrytreeCandidateRun = {
  candidateRunId: string
  parentNodeId: string
  status: string
  maxCandidates: number
  quotedCostCredits: number
  scorecardMode?: string | null
  candidates: StrytreeBranchCandidate[]
}

export type StrytreeStorySnapshot = {
  storyId: string
  title: string
  synopsis?: string | null
  tokenBalance?: number
  activeBranchCount?: number
  totalLikes?: number
  generationCostCredits?: number
  unlockCurrency?: string | null
  nodes: StrytreeStoryNode[]
  candidateRuns?: StrytreeCandidateRun[]
}

export type StrybldrExplainerVideoPanelTab = 'text' | 'image' | 'video'

export type StrybldrExplainerVideoPanel = {
  panelId: string
  title: string
  activeTab: StrybldrExplainerVideoPanelTab
  output?: string | null
  outputSrcDoc?: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  summary?: string | null
  prompt?: string | null
  sourceNodeId?: string | null
}

export type StrybldrExplainerVideoSnapshot = {
  mode?: 'xr' | '2d' | '3d' | null
  title: string
  summary?: string | null
  transcriptMarkdown?: string | null
  storyboardPrompt?: string | null
  referenceImageUrl?: string | null
  videoUrl?: string | null
  panels: StrybldrExplainerVideoPanel[]
}

export type StrybldrStoryboardDocument = {
  version: 1
  runId: string
  createdAtMs: number
  sources: StrybldrSource[]
  elements: StrybldrElement[]
  edges?: StrybldrWorkflowEdge[]
  workflow?: StrybldrWorkflow | null
  notes?: string | null
  storytree?: StrytreeStorySnapshot | null
  explainerVideo?: StrybldrExplainerVideoSnapshot | null
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
  sourceVideoUrl?: string | null
  renderVideoUrl?: string | null
  localAnimaticHtml?: string | null
}
