import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildRuntimeStorageMediaAccessUrl, normalizeRuntimeStorageMediaUrl } from '@/lib/storage/runtimeMediaUrl'
import { buildRichMediaPanelOverlayState, buildRichMediaPanelPreviewSpec } from '@/lib/render/richMediaSsot'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/storyboardWidget/richMediaPanelConfig'

export function testCanvasEmbedMediaRebindsAndExposesSelectableSurfaces(): void {
  const staleLocalUrl = 'http://localhost:5181/api/storage/media/airvio/runs/upload-demo/image/example.jpg?kg_media_token=stale'
  const rebound = normalizeRuntimeStorageMediaUrl(staleLocalUrl, 'https://airvio.co')
  if (!rebound.startsWith('https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/example.jpg')) {
    throw new Error(`expected published embed media to rebind to the active runtime origin, got ${rebound}`)
  }
  const accessUrl = buildRuntimeStorageMediaAccessUrl({ publicUrl: rebound, runtimeOrigin: 'https://airvio.co' })
  if (!accessUrl.includes('kg_media_token=') || accessUrl.includes('kg_media_token=stale')) {
    throw new Error(`expected published embed media to receive a fresh runtime access token, got ${accessUrl}`)
  }

  const previousWindow = (globalThis as { window?: unknown }).window
  ;(globalThis as { window?: unknown }).window = { location: { origin: 'http://localhost:5173' } }
  try {
    const staleLocalMediaPanelNode = {
      id: 'rendered-local-media-artifact',
      type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
      label: 'Rendered local media artifact',
      properties: {
        imageUrl: 'http://localhost:5174/api/storage/media/airvio/runs/upload-demo/image/runtime-demo.jpg?kg_media_token=stale-token',
      },
    }
    const staleLocalMediaPanel = buildRichMediaPanelOverlayState({ node: staleLocalMediaPanelNode as never })
    const staleLocalMediaPreview = staleLocalMediaPanel
      ? buildRichMediaPanelPreviewSpec({ node: staleLocalMediaPanelNode as never, panel: staleLocalMediaPanel })
      : null
    const expectedRuntimePrefix = 'http://localhost:5173/api/storage/media/airvio/runs/upload-demo/image/runtime-demo.jpg?kg_media_token='
    if (!staleLocalMediaPreview || staleLocalMediaPreview.kind !== 'image' || !staleLocalMediaPreview.url.startsWith(expectedRuntimePrefix)) {
      throw new Error(`expected stale local Rich Media preview URL to remap to the current runtime origin, got ${JSON.stringify(staleLocalMediaPreview)}`)
    }
    if (staleLocalMediaPreview.url.includes('localhost:5174') || staleLocalMediaPreview.url.includes('stale-token')) {
      throw new Error(`expected stale local Rich Media preview URL to replace the prior dev origin and token, got ${JSON.stringify(staleLocalMediaPreview)}`)
    }
  } finally {
    ;(globalThis as { window?: unknown }).window = previousWindow
  }

  const richMediaState = readFileSync(resolve(process.cwd(), 'src/components/useRichMediaPanelSurfaceState.ts'), 'utf8')
  const directMedia = readFileSync(resolve(process.cwd(), 'src/components/RichMediaPanelDirectMediaSurface.tsx'), 'utf8')
  const cardMediaSlot = readFileSync(resolve(process.cwd(), 'src/components/StoryboardWidgetCanvas/StoryboardCardMediaDropSlot2d.tsx'), 'utf8')
  for (const contract of [
    "mediaState.kind === 'video' || mediaState.kind === 'audio'",
    "'data-kg-rich-media-selectable-surface': '1'",
    "role: 'group'",
  ]) {
    if (!richMediaState.includes(contract)) throw new Error(`expected Rich Media selection contract ${contract}`)
  }
  if (!directMedia.includes('{...model.directMediaPreviewCardProps}')) {
    throw new Error('expected audio to inherit the shared selectable media surface contract')
  }
  if (!cardMediaSlot.includes('mediaSelectableSurfaceDataAttr')) {
    throw new Error('expected Storyboard card media wrappers to remain visible to selection tooling')
  }
}
