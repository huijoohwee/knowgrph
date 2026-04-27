import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testCanvasViewportGeospatialPoiPreviewDoesNotAutoCreateRichMediaPanelNode = () => {
  const filePath = path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const text = readUtf8(filePath)
  if (!text.includes('if (!targetNodeId) return false')) {
    throw new Error('Expected geospatial POI preview render path to skip writeback when no Rich Media Panel node exists')
  }
  if (text.includes("createId('rich-media-panel')")) {
    throw new Error('Expected geospatial POI preview render path to avoid auto-creating Rich Media Panel nodes on hover/click')
  }
}
