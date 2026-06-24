import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

export function testVideoSequenceLocalImportAvoidsSuccessfulFsProbeAbortAndMediaRemounts() {
  const timelinePlanSyncText = readUtf8('src/components/timeline/timelinePlanSync.ts')
  const mediaCanvasText = readUtf8('src/components/MediaCanvas.tsx')
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
    !mediaCanvasText.includes('key: `video-sequence:${src}`') ||
    mediaCanvasText.includes('key: `video-sequence:${clean(source.id) || `${label}:${index}`}`')
  ) {
    throw new Error('expected Media Canvas video-sequence items to key by resolved source URL so repeated local imports do not remount the same media element')
  }
}

export function testVideoSequenceExportKeepsSuccessfulSourceProbesBound() {
  const videoSequenceExportText = readUtf8('src/components/timeline/videoSequenceExport.ts')
  const normalizedVideoSequenceExportText = normalizeWhitespace(videoSequenceExportText)
  const failureOnlyCleanupSnippet = normalizeWhitespace(`
    if (!duration) {
      probe.removeAttribute('src')
      probe.load()
      throw new Error('Unable to load source media.')
    }
    const gapMinutes = Math.max(0, segment.timelineStartMinutes - cursorMinutes)
  `)

  if (!normalizedVideoSequenceExportText.includes(failureOnlyCleanupSnippet)) {
    throw new Error('expected video sequence export source probes to reserve src cleanup for failed media loads so successful local @fs probes do not emit abort churn')
  }
}
