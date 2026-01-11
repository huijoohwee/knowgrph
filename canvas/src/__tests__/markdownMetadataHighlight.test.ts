import {
  computeHighlightedRangeFromLines,
  getDocumentLocationFromMetadata,
  getLineRangeFromMetadata,
} from '@/lib/graph/markdownMetadata'

export function testGetLineRangeFromMetadataParsesAndNormalizes() {
  const meta = {
    lineStart: '5',
    lineEnd: 2,
  }
  const range = getLineRangeFromMetadata(meta)
  if (!range) {
    throw new Error('expected range from metadata with lineStart and lineEnd')
  }
  if (range.start !== 2 || range.end !== 5) {
    throw new Error(`expected normalized range 2-5, got ${range.start}-${range.end}`)
  }
  const metaSingle = {
    lineStart: 10,
  }
  const singleRange = getLineRangeFromMetadata(metaSingle)
  if (!singleRange) {
    throw new Error('expected range from metadata with only lineStart')
  }
  if (singleRange.start !== 10 || singleRange.end !== 10) {
    throw new Error(
      `expected single-line range 10-10, got ${singleRange.start}-${singleRange.end}`,
    )
  }
}

export function testGetLineRangeFromMetadataMissingStartReturnsNull() {
  const meta = {
    lineEnd: 5,
  }
  const range = getLineRangeFromMetadata(meta)
  if (range !== null) {
    throw new Error('expected null range when lineStart is missing')
  }
}

export function testGetDocumentLocationFromMetadataUsesDocumentPathAndFallback() {
  const primaryMeta = {
    documentPath: 'docs/example.md',
    lineStart: 3,
    lineEnd: 7,
  }
  const primaryLocation = getDocumentLocationFromMetadata(primaryMeta)
  if (!primaryLocation) {
    throw new Error('expected location for metadata with documentPath')
  }
  if (primaryLocation.documentPath !== 'docs/example.md') {
    throw new Error(
      `expected documentPath "docs/example.md", got "${primaryLocation.documentPath}"`,
    )
  }
  if (primaryLocation.lineStart !== 3 || primaryLocation.lineEnd !== 7) {
    throw new Error(
      `expected line range 3-7, got ${primaryLocation.lineStart}-${primaryLocation.lineEnd}`,
    )
  }
  const fallbackMeta = {
    codebaseRelPath: 'fallback.md',
    lineStart: '1',
    lineEnd: '2',
  }
  const fallbackLocation = getDocumentLocationFromMetadata(fallbackMeta)
  if (!fallbackLocation) {
    throw new Error('expected location for metadata with codebaseRelPath fallback')
  }
  if (fallbackLocation.documentPath !== 'fallback.md') {
    throw new Error(
      `expected documentPath "fallback.md", got "${fallbackLocation.documentPath}"`,
    )
  }
  if (fallbackLocation.lineStart !== 1 || fallbackLocation.lineEnd !== 2) {
    throw new Error(
      `expected line range 1-2, got ${fallbackLocation.lineStart}-${fallbackLocation.lineEnd}`,
    )
  }
}

export function testGetDocumentLocationFromMetadataAllowsEmptyDocumentPathString() {
  const meta = {
    documentPath: '',
    lineStart: 5,
    lineEnd: 6,
  }
  const location = getDocumentLocationFromMetadata(meta)
  if (!location) {
    throw new Error('expected location object even when documentPath is empty string')
  }
  if (location.documentPath !== '') {
    throw new Error(
      `expected empty documentPath string, got "${location.documentPath}" instead`,
    )
  }
  if (location.lineStart !== 5 || location.lineEnd !== 6) {
    throw new Error(
      `expected line range 5-6, got ${location.lineStart}-${location.lineEnd}`,
    )
  }
}

export function testComputeHighlightedRangeFromLinesClampsToEditorBounds() {
  const editorLineCount = 50
  const range = computeHighlightedRangeFromLines(editorLineCount, 0, 100)
  if (!range) {
    throw new Error('expected highlighted range for numeric lineStart/lineEnd')
  }
  if (range.start !== 1 || range.end !== 50) {
    throw new Error(
      `expected clamped range 1-50, got ${range.start}-${range.end}`,
    )
  }
}

export function testComputeHighlightedRangeFromLinesReturnsNullWithoutStart() {
  const editorLineCount = 20
  const range = computeHighlightedRangeFromLines(editorLineCount, null, 10)
  if (range !== null) {
    throw new Error('expected null highlighted range when start line is null')
  }
}

