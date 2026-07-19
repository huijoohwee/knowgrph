import {
  invokeExternalMcpArtifactCreation,
  type ExternalMcpInvocationOutcome,
} from '@/features/agent-ready/externalMcpClient'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { FinancialModelWorkbookPersistedArtifact } from './financialModelWorkbookArtifact'

export type RichMediaDeliverablesExternalMcpResult = {
  enabled: boolean
  slideDeck: ExternalMcpInvocationOutcome | null
  spreadsheet: ExternalMcpInvocationOutcome | null
  errors: Array<{ artifactKind: 'slide-deck' | 'spreadsheet'; message: string }>
}

const readString = (value: unknown): string => {
  const scalar = unwrapGraphCellValue(value)
  return typeof scalar === 'string' ? scalar.trim() : ''
}

const readBoolean = (value: unknown): boolean => {
  const scalar = unwrapGraphCellValue(value)
  if (typeof scalar === 'boolean') return scalar
  return String(scalar || '').trim().toLowerCase() === 'true'
}

const invokeOne = async (args: Parameters<typeof invokeExternalMcpArtifactCreation>[0]): Promise<{
  outcome: ExternalMcpInvocationOutcome | null
  error: string
}> => {
  try {
    return { outcome: await invokeExternalMcpArtifactCreation(args), error: '' }
  } catch (error) {
    return { outcome: null, error: (error instanceof Error ? error.message : String(error)).slice(0, 640) }
  }
}

const isCompleteExternalOutcome = (outcome: ExternalMcpInvocationOutcome | null): boolean =>
  outcome?.status === 'created'

export async function createRichMediaDeliverablesWithExternalMcp(args: {
  properties: Record<string, unknown>
  slideDeckMarkdown: string
  financialModelMarkdown: string
  workbook: FinancialModelWorkbookPersistedArtifact
}): Promise<RichMediaDeliverablesExternalMcpResult> {
  const enabled = readBoolean(args.properties.externalMcpCreateArtifacts)
  if (!enabled) return { enabled: false, slideDeck: null, spreadsheet: null, errors: [] }
  const slideDeck = await invokeOne({
    capabilityId: readString(args.properties.externalSlidesMcpCapability),
    artifact: {
      artifactKind: 'slide-deck',
      title: 'Slide Deck',
      content: args.slideDeckMarkdown,
      contentType: 'text/markdown',
      fileName: 'slide-deck.md',
    },
  })
  const spreadsheet = await invokeOne({
    capabilityId: readString(args.properties.externalSheetsMcpCapability),
    artifact: {
      artifactKind: 'spreadsheet',
      title: 'Financial Model',
      content: args.financialModelMarkdown,
      contentType: 'text/markdown',
      fileName: args.workbook.fileName,
      ...(args.workbook.storageUrl?.startsWith('https://') ? { sourceUrl: args.workbook.storageUrl } : {}),
    },
  })
  const errors = [
    ...(slideDeck.error ? [{ artifactKind: 'slide-deck' as const, message: slideDeck.error }] : []),
    ...(spreadsheet.error ? [{ artifactKind: 'spreadsheet' as const, message: spreadsheet.error }] : []),
  ]
  if (readBoolean(args.properties.externalMcpRequired)) {
    if (errors.length > 0) throw new Error(errors.map(error => error.message).join(' '))
    if (!isCompleteExternalOutcome(slideDeck.outcome) || !isCompleteExternalOutcome(spreadsheet.outcome)) {
      throw new Error('Both approved external Slides and Sheets MCP artifacts are required for this Run.')
    }
  }
  return {
    enabled,
    slideDeck: slideDeck.outcome,
    spreadsheet: spreadsheet.outcome,
    errors,
  }
}

export const readCreatedExternalMcpReceipt = (outcome: ExternalMcpInvocationOutcome | null) =>
  outcome?.status === 'created' ? outcome.receipt : null
