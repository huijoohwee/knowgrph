import {
  buildKnowgrphVdeoxplnRoutingPlan,
  buildKnowgrphVdeoxplnRunManifestMarkdown,
} from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'
import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { toCanonicalKgcWorkspacePath } from './chatHistoryWorkspace.paths'
import { mergeKgcCanonicalSection } from './chatKgcConsolidatedArtifacts'

export const resolveKnowgrphVdeoxplnRunManifestWorkspacePath = (
  workspacePath: string | null | undefined,
): string | null => {
  const normalized = normalizeWorkspacePath(String(workspacePath || '').trim())
  if (!normalized || normalized === '/') return null
  return toCanonicalKgcWorkspacePath(normalized)
}

export async function persistKnowgrphVdeoxplnRunManifestForChat(args: {
  workspacePath: string | null | undefined
  requestText: string
  status: 'ok' | 'error'
  timestampMs: number
  providerSummary: string
  modelId: string | null | undefined
  usageSummary?: string | null
  finishReason?: string | null
  canvasApplied?: boolean | null
  errorMessage?: string | null
}): Promise<string | null> {
  const manifestPath = resolveKnowgrphVdeoxplnRunManifestWorkspacePath(args.workspacePath)
  if (!manifestPath) return null
  const plan = buildKnowgrphVdeoxplnRoutingPlan({
    intentText: args.requestText,
    chatStorageTarget: 'chatKnowgrph',
    contentTypes: ['kgc markdown', 'workspace document markdown'],
    requestedOutputs: ['validated KGC Markdown', 'workspace artifact', 'GraphData', 'canvas topology snapshot'],
    stateSignals: ['FloatingPanel Chat', 'KGC validation', 'Workspace FS', 'Source Files', 'Canvas apply'],
    hasWorkspaceDocument: true,
    hasGraphData: true,
  })
  const text = buildKnowgrphVdeoxplnRunManifestMarkdown(plan, {
    status: args.status,
    workspacePath: normalizeWorkspacePath(String(args.workspacePath || '').trim()),
    timestamp: new Date(Number.isFinite(args.timestampMs) ? args.timestampMs : Date.now()).toISOString(),
    providerSummary: args.providerSummary,
    modelId: args.modelId || '',
    usageSummary: args.usageSummary || '',
    finishReason: args.finishReason || '',
    canvasApplied: args.canvasApplied,
    errorMessage: args.errorMessage || '',
  })
  return await mergeKgcCanonicalSection({
    workspacePath: manifestPath,
    sectionKey: 'vdeoxpln-run',
    title: 'Vdeoxpln Run Manifest',
    text,
    fenceLanguage: 'markdown',
  })
}
