import type { GraphData } from '@/lib/graph/types'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { notifyWorkspaceFsChanged } from '@/features/workspace-fs/workspaceFsEvents'
import { WORKSPACE_ROOT_PATH } from '@/features/workspace-fs/path'
import {
  buildStrybldrVideoHandoffFromGraphData,
  buildStrybldrVideoHandoffMarkdown,
} from './strybldrStoryboard'

export type StrybldrLocalVideoArtifactResult =
  | { ok: true; path: string; cardCount: number }
  | { ok: false; reason: string }

export async function createStrybldrLocalVideoArtifactFromGraphData(
  graphData: GraphData | null | undefined,
): Promise<StrybldrLocalVideoArtifactResult> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const handoff = buildStrybldrVideoHandoffFromGraphData(graphData)
  if (handoff.cards.length === 0 || !handoff.prompt) {
    return { ok: false, reason: 'No approved Strybldr cards to send.' }
  }
  if (!handoff.localAnimaticHtml) {
    return { ok: false, reason: 'No local Strybldr animatic could be generated.' }
  }
  const fs = await getWorkspaceFs()
  await fs.ensureSeed()
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const path = await fs.createFile({
    parentPath: WORKSPACE_ROOT_PATH,
    name: `strybldr-video-${Date.now().toString(36)}.md`,
    text: buildStrybldrVideoHandoffMarkdown({
      handoff,
      status: 'generated',
      provider: 'knowgrph-local-animatic',
      model: 'strybldr-local-animatic-v1',
      renderUrl: handoff.renderVideoUrl,
      sourceUrl: handoff.sourceVideoUrl,
      elapsedMs: now - started,
      paidCallCount: 0,
      cacheHit: false,
    }),
  })
  notifyWorkspaceFsChanged({ op: 'createFile', path })
  return { ok: true, path, cardCount: handoff.cards.length }
}
