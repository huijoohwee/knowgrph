type LocalCanvasSnapshotInspectionArgs = {
  markdownDocumentName?: unknown
  canvasRenderMode?: unknown
  canvas2dRenderer?: unknown
  svgMarkup?: unknown
}

const normalizeString = (value: unknown): string => String(value || '').trim()

const readSvgAttribute = (svgMarkup: string, attributeName: string): string | null => {
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = svgMarkup.match(new RegExp(`${escapedAttributeName}="([^"]+)"`, 'i'))
  return match?.[1] ? String(match[1]).trim() || null : null
}

export const inspectLocalCanvasSnapshot = (args: LocalCanvasSnapshotInspectionArgs) => {
  const documentName = normalizeString(args.markdownDocumentName)
  const canvasRenderMode = normalizeString(args.canvasRenderMode) || '2d'
  const canvas2dRenderer = normalizeString(args.canvas2dRenderer) || 'flowEditor'
  const svgMarkup = typeof args.svgMarkup === 'string' ? args.svgMarkup.trim() : ''

  if (canvasRenderMode !== '2d') {
    return {
      available: false,
      sourceKind: 'browser-local-canvas-snapshot',
      documentName: documentName || '',
      canvasRenderMode,
      canvas2dRenderer,
      format: 'svg',
      svgMarkup: null,
      svgLength: 0,
      viewBox: null,
      width: null,
      height: null,
      message: 'Local canvas SVG snapshots are currently available only for 2d canvas modes.',
    }
  }

  if (!svgMarkup) {
    return {
      available: false,
      sourceKind: 'browser-local-canvas-snapshot',
      documentName: documentName || '',
      canvasRenderMode,
      canvas2dRenderer,
      format: 'svg',
      svgMarkup: null,
      svgLength: 0,
      viewBox: null,
      width: null,
      height: null,
      message: 'No active local 2d canvas snapshot is currently registered in the app runtime.',
    }
  }

  return {
    available: true,
    sourceKind: 'browser-local-canvas-snapshot',
    documentName: documentName || 'document.md',
    canvasRenderMode,
    canvas2dRenderer,
    format: 'svg',
    svgMarkup,
    svgLength: svgMarkup.length,
    viewBox: readSvgAttribute(svgMarkup, 'viewBox'),
    width: readSvgAttribute(svgMarkup, 'width'),
    height: readSvgAttribute(svgMarkup, 'height'),
    message: null,
  }
}
