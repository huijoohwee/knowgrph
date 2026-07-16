import {
  XR_SCENE_MEDIA_DRAG_SCHEMA,
  normalizeXrSceneMediaDragProjection,
  type MediaDragPayload,
} from '@/lib/ui/mediaDragPayload'
import type { XrMotionReferenceStagePreset, XrSceneLibraryAsset } from './xrSceneLibrary'
import {
  controlLocalXrScene,
  type XrSceneAnimation,
  type XrSceneControlResult,
} from './xrSceneMcpRuntime'

const XR_RICH_MEDIA_PANEL_LABEL = '3D for XR'

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildXrMediaPreviewDataUrl(args: {
  entityKind: 'environment' | 'asset'
  label: string
  accent: string
}): string {
  const label = escapeSvgText(args.label.slice(0, 42))
  const kindLabel = args.entityKind === 'environment' ? 'ENVIRONMENT KIT' : 'SUBJECT / PROP'
  const glyph = args.entityKind === 'environment'
    ? '<path d="M28 82V39l35-17 35 17v43M42 82V53h42v29M55 82V65h16v17"/>'
    : '<circle cx="63" cy="34" r="12"/><path d="M39 81c2-22 10-33 24-33s22 11 24 33M63 48v33"/>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="250" viewBox="0 0 440 250"><rect width="440" height="250" fill="#f8fafc"/><rect x="12" y="12" width="416" height="226" rx="14" fill="#eef2f7" stroke="#cbd5e1"/><g transform="translate(28 48)" fill="none" stroke="${args.accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g><text x="145" y="82" fill="#64748b" font-family="ui-monospace,monospace" font-size="14" font-weight="700">3D FOR XR · ${kindLabel}</text><text x="145" y="117" fill="#0f172a" font-family="ui-sans-serif,system-ui,sans-serif" font-size="24" font-weight="700">${label}</text><text x="145" y="149" fill="#64748b" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15">Procedural grey-box scene media</text><path d="M28 202h384" stroke="#cbd5e1"/><text x="28" y="222" fill="#64748b" font-family="ui-monospace,monospace" font-size="12">${XR_SCENE_MEDIA_DRAG_SCHEMA}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function buildXrStageMediaDragPayload(stage: XrMotionReferenceStagePreset): MediaDragPayload {
  const previewUrl = buildXrMediaPreviewDataUrl({
    entityKind: 'environment',
    label: stage.label,
    accent: '#38bdf8',
  })
  return {
    kind: 'image',
    url: previewUrl,
    thumbnailUrl: previewUrl,
    label: XR_RICH_MEDIA_PANEL_LABEL,
    mimeHint: 'image/svg+xml',
    sourceKey: `xr:environment:${stage.id}`,
    xrScene: {
      schema: XR_SCENE_MEDIA_DRAG_SCHEMA,
      entityKind: 'environment',
      entityId: stage.id,
      label: stage.label,
      description: stage.description,
      category: 'environment',
    },
  }
}

export function buildXrAssetMediaDragPayload(asset: XrSceneLibraryAsset, motion: XrSceneAnimation): MediaDragPayload {
  const effectiveMotion: XrSceneAnimation = asset.mobile ? motion : 'hold'
  const previewUrl = buildXrMediaPreviewDataUrl({
    entityKind: 'asset',
    label: asset.label,
    accent: asset.defaultColor,
  })
  return {
    kind: 'image',
    url: previewUrl,
    thumbnailUrl: previewUrl,
    label: XR_RICH_MEDIA_PANEL_LABEL,
    mimeHint: 'image/svg+xml',
    sourceKey: `xr:asset:${asset.id}`,
    xrScene: {
      schema: XR_SCENE_MEDIA_DRAG_SCHEMA,
      entityKind: 'asset',
      entityId: asset.id,
      label: asset.label,
      description: asset.description,
      category: asset.category,
      motion: effectiveMotion,
    },
  }
}

export function controlXrSceneMediaDrop(payload: MediaDragPayload): XrSceneControlResult | null {
  const projection = normalizeXrSceneMediaDragProjection(payload.xrScene)
  if (!projection) return null
  if (projection.entityKind === 'environment') {
    return controlLocalXrScene({ action: 'stage', stageId: projection.entityId })
  }
  return controlLocalXrScene({
    action: 'place',
    assetId: projection.entityId,
    motion: projection.motion || 'travel',
  })
}
