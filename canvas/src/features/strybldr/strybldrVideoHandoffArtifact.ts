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

const readWorkspacePathName = (workspacePath: string): string => {
  const parts = String(workspacePath || '').split('/').filter(Boolean)
  return String(parts[parts.length - 1] || '').trim() || 'strybldr-video.md'
}

const readWorkspacePathParent = (workspacePath: string): string => {
  const parts = String(workspacePath || '').split('/').filter(Boolean)
  const parent = parts.slice(0, -1).join('/')
  return parent ? `/${parent}` : WORKSPACE_ROOT_PATH
}

const publishGeneratedStrybldrHandoffIfEnabled = async (args: {
  path: string
  text: string
}): Promise<void> => {
  try {
    const { readKnowgrphStorageRuntimeSyncEnabled } = await import('@/features/source-files/sourceFilesKnowgrphStorageSettings')
    if (!readKnowgrphStorageRuntimeSyncEnabled()) return
    const { publishGeneratedWorkspaceEntriesToKnowgrphStorage } = await import('@/features/source-files/sourceFileShareUrl')
    await publishGeneratedWorkspaceEntriesToKnowgrphStorage({
      entries: [{
        kind: 'file',
        path: args.path,
        parentPath: readWorkspacePathParent(args.path),
        name: readWorkspacePathName(args.path),
        text: args.text,
        updatedAtMs: Date.now(),
      }],
    })
  } catch {
    void 0
  }
}

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
  const text = buildStrybldrVideoHandoffMarkdown({
    handoff,
    status: 'generated',
    provider: 'knowgrph-local-animatic',
    model: 'strybldr-local-animatic-v1',
    renderUrl: handoff.renderVideoUrl,
    sourceUrl: handoff.sourceVideoUrl,
    elapsedMs: now - started,
    paidCallCount: 0,
    cacheHit: false,
  })
  const path = await fs.createFile({
    parentPath: WORKSPACE_ROOT_PATH,
    name: `strybldr-video-${Date.now().toString(36)}.md`,
    text,
  })
  notifyWorkspaceFsChanged({ op: 'createFile', path })
  await publishGeneratedStrybldrHandoffIfEnabled({ path, text })
  return { ok: true, path, cardCount: handoff.cards.length }
}
