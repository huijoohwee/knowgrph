import { readFileSync } from 'node:fs'
import path from 'node:path'
import { tryBuildJsonMarkdownDocumentFromText, tryBuildJsonMarkdownTablesFromText } from '@/features/markdown/jsonToMarkdownDocument'

export function testJsonMarkdownSsotUtilityConsistentOutput() {
  const text = JSON.stringify({
    records: [
      { id: 1, city: 'Singapore', geo: { lat: 1.29, lng: 103.85 } },
      { id: 2, city: 'Jurong', geo: { lat: 1.33, lng: 103.74 } },
    ],
  })
  const built = tryBuildJsonMarkdownDocumentFromText(text, 'table')
  if (!built || !built.markdown.trim()) {
    throw new Error('expected markdown output from ssot json markdown utility')
  }
  const tables = tryBuildJsonMarkdownTablesFromText(text, 'table')
  if (!tables || !tables.trim()) {
    throw new Error('expected markdown table output from ssot json markdown helper')
  }
  if (tables !== built.markdown) {
    throw new Error('expected ssot json markdown helpers to produce identical markdown output')
  }
}

export function testJsonImportActionSupportsGeojsonLocalExtension() {
  const filePath = path.resolve(process.cwd(), 'src', 'features', 'toolbar', 'jsonImportAction.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("['.json', '.jsonld', '.geojson']")) {
    throw new Error('expected local JSON import picker to include .geojson extension')
  }
  if (!text.includes('readWidgetRegistryMetadataEntries(meta).length > 0')) {
    throw new Error('expected JSON import action to reuse the shared widget-registry metadata reader when deciding Flow Editor preference')
  }
  if (text.includes('FLOW_WIDGET_REGISTRY_METADATA_KEY')) {
    throw new Error('expected JSON import action to stop parsing the widget registry metadata key inline')
  }
}
