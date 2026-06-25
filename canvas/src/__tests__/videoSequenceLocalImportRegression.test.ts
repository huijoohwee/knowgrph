import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

export function testVideoSequenceLocalImportAvoidsSuccessfulFsProbeAbortAndMediaRemounts() {
  const timelinePlanSyncText = readUtf8('src/components/timeline/timelinePlanSync.ts')
  const previewMediaSessionText = readUtf8('src/components/timeline/useTimelinePreviewMediaSession.ts')
  const sourceRegistryText = readUtf8('src/components/timeline/videoSequenceSourceRegistry.ts')
  const normalizedTimelinePlanSyncText = normalizeWhitespace(timelinePlanSyncText)
  const failureOnlyCleanupSnippet = normalizeWhitespace(`
    if (!durationSeconds) {
      probe.removeAttribute('src')
      probe.load()
      return null
    }
    return { durationSeconds, url }
  `)

  if (!normalizedTimelinePlanSyncText.includes(failureOnlyCleanupSnippet)) {
    throw new Error('expected successful local @fs metadata probes to keep their source bound and reserve probe teardown for failed loads only')
  }

  if (
    !previewMediaSessionText.includes('key: `video-sequence:${src}`') ||
    previewMediaSessionText.includes('key: `video-sequence:${clean(source.id) || `${label}:${index}`}`')
  ) {
    throw new Error('expected preview-session video-sequence items to key by resolved source URL so repeated local imports do not remount the same media element')
  }

  if (
    !sourceRegistryText.includes('const registryBySignature = new Map<string, RegisteredVideoSequenceSourceFile>()') ||
    !sourceRegistryText.includes('buildVideoSequenceSourceFileSignature(file)') ||
    !sourceRegistryText.includes('const existing = registryBySignature.get(fileSignature) || null') ||
    !sourceRegistryText.includes('const objectUrl = existing?.objectUrl || createObjectUrl(file)') ||
    !sourceRegistryText.includes('OBJECT_URL_REVOKE_DELAY_MS = 2000') ||
    !sourceRegistryText.includes('scheduleObjectUrlRevoke(previous.objectUrl)') ||
    sourceRegistryText.includes('revokeObjectUrl(previous.objectUrl)')
  ) {
    throw new Error('expected video sequence source registry replacements to reuse canonical blob URLs and delay revocation so mounted media does not emit abort churn during valid source refreshes')
  }
}

export function testVideoSequenceExportKeepsSuccessfulSourceProbesBound() {
  const videoSequenceExportText = readUtf8('src/components/timeline/videoSequenceExport.ts')
  const normalizedVideoSequenceExportText = normalizeWhitespace(videoSequenceExportText)
  const failureOnlyCleanupSnippet = normalizeWhitespace(`
    if (!duration) {
      probe.removeAttribute('src')
      probe.load()
      throw createVideoSequenceExportError('source-load-failed')
    }
    const gapMinutes = Math.max(0, segment.timelineStartMinutes - cursorMinutes)
  `)

  if (!normalizedVideoSequenceExportText.includes(failureOnlyCleanupSnippet)) {
    throw new Error('expected video sequence export source probes to reserve src cleanup for failed media loads so successful local @fs probes do not emit abort churn')
  }
}
