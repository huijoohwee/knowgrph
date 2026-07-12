import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function assertRichMediaSsotWebpageContracts(args: {
  designWebpageWireframeText: string
  markdownMediaUiText: string
  markdownWorkspaceWebpageSurfaceText: string
  sharedWebpageSnapshotLogicText: string
  sharedWebpageSurfaceText: string
  webpageLayoutPresetsText: string
  webpageSnapshotPreviewText: string
}): void {
  if (!args.webpageLayoutPresetsText.includes('export function getUiWebpageSnapshotPreset(') || !args.webpageLayoutPresetsText.includes('export function getMarkdownWebpageSnapshotPreset(') || !args.webpageLayoutPresetsText.includes('export function getDesignWebpageWireframePreset(')) {
    throw new Error('expected webpage layout probe presets for ui, markdown, and design callers to be centralized upstream')
  }
  if (!args.sharedWebpageSurfaceText.includes("renderMode: 'snapshot' | 'iframe'")) {
    throw new Error('expected shared webpage surface helper to normalize snapshot and iframe rendering modes')
  }
  if (!args.webpageSnapshotPreviewText.includes("import { SharedWebpageSnapshotSurface } from '@/components/SharedWebpageSnapshotSurface'")) {
    throw new Error('expected WebpageSnapshotPreview to reuse the shared webpage snapshot surface helper')
  }
  if (!args.webpageSnapshotPreviewText.includes('useWebpageLayoutSnapshotLifecycle') || !args.webpageSnapshotPreviewText.includes('useWebpageSnapshotSurfaceAssets')) {
    throw new Error('expected WebpageSnapshotPreview to reuse shared webpage snapshot lifecycle and asset helpers')
  }
  if (!args.webpageSnapshotPreviewText.includes('allowNodeJsUserAgent: true') || !args.webpageSnapshotPreviewText.includes('requireProbeReady: true')) {
    throw new Error('expected WebpageSnapshotPreview to configure the shared snapshot lifecycle helper for deferred UI probing')
  }
  if (!args.webpageSnapshotPreviewText.includes('getUiWebpageSnapshotPreset') || !args.webpageSnapshotPreviewText.includes('buildWebpageLayoutCacheKey(layoutPreset)')) {
    throw new Error('expected WebpageSnapshotPreview to reuse the shared ui webpage layout preset and cache-key builder')
  }
  if (!args.markdownWorkspaceWebpageSurfaceText.includes("import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'")) {
    throw new Error('expected markdown workspace webpage surfaces to reuse the shared webpage surface helper')
  }
  if (args.markdownWorkspaceWebpageSurfaceText.includes("import WebpageSnapshotPreview from '@/components/WebpageSnapshotPreview'")) {
    throw new Error('expected markdown workspace webpage surfaces to stop rendering snapshot previews directly after shared-surface extraction')
  }
  if (!args.markdownMediaUiText.includes("import { SharedWebpageSurface } from '@/components/SharedWebpageSurface'")) {
    throw new Error('expected markdown media iframe rendering to reuse the shared webpage surface helper')
  }
  if (!args.markdownMediaUiText.includes("import { SharedWebpageSnapshotSurface } from '@/components/SharedWebpageSnapshotSurface'")) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared snapshot surface helper')
  }
  if (!args.markdownMediaUiText.includes('useWebpageLayoutSnapshotLifecycle') || !args.markdownMediaUiText.includes('useWebpageSnapshotSurfaceAssets')) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared webpage snapshot lifecycle and asset helpers')
  }
  if (!args.markdownMediaUiText.includes('isNoiseProneWebpagePreviewHost') || !args.markdownMediaUiText.includes('skipSnapshot = preferEmbedEffective || isNoiseProneWebpagePreviewHost(normalizedUrl)')) {
    throw new Error('expected markdown media webpage snapshot rendering to gate the shared lifecycle helper through shared host suppression and embed policy')
  }
  if (!args.markdownMediaUiText.includes('getMarkdownWebpageSnapshotPreset') || !args.markdownMediaUiText.includes('buildWebpageLayoutCacheKey(layoutPreset)')) {
    throw new Error('expected markdown media webpage snapshot rendering to reuse the shared markdown webpage layout preset and cache-key builder')
  }
  if (!args.markdownMediaUiText.includes('<SharedWebpageSurface')) {
    throw new Error('expected markdown media iframe rendering to mount the shared webpage surface helper')
  }
  if (!args.markdownMediaUiText.includes('<SharedWebpageSnapshotSurface')) {
    throw new Error('expected markdown media webpage snapshot rendering to mount the shared snapshot surface helper')
  }
  if (!args.designWebpageWireframeText.includes("from '@/lib/websites/webpageSnapshotShared'") || !args.designWebpageWireframeText.includes('loadWebpageLayoutSnapshotWithCache')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared webpage snapshot cached loader helper')
  }
  for (const contract of [
    'formatWebpageLayoutExportStatus',
    'resolveWebpageLayoutExportOutcome',
    'applyWebpageLayoutExportOutcome',
    'emitWebpageLayoutExportWarningToast',
    'createDefaultProgressSession',
    'runAsyncEffect',
  ]) {
    if (!args.designWebpageWireframeText.includes(contract)) {
      throw new Error(`expected DesignCanvas webpage wireframe export to reuse shared ${contract}`)
    }
  }
  if (!args.sharedWebpageSnapshotLogicText.includes('runAsyncEffect')) {
    throw new Error('expected shared webpage snapshot lifecycle logic to reuse the shared async effect runner')
  }
  const webpageDomExportText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'websites', 'webpageDomExport.ts'), 'utf8')
  if (!webpageDomExportText.includes("import { isNoiseProneWebpagePreviewHost } from '@/lib/websites/webpageSnapshotShared'")) {
    throw new Error('expected webpage DOM export to reuse the shared noise-prone-host helper instead of duplicating host suppression logic')
  }
  if (!args.designWebpageWireframeText.includes('getDesignWebpageWireframePreset') || !args.designWebpageWireframeText.includes('buildWebpageLayoutCacheKey(layoutPreset, { epoch })')) {
    throw new Error('expected DesignCanvas webpage wireframe export to reuse the shared design webpage layout preset and cache-key builder')
  }
}
