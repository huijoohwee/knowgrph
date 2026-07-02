import { normalizeWidgetRegistryEntries, readValidatedWidgetRegistryMetadataEntries } from '@/hooks/store/storyboardWidgetManagerSlice'
import { pickFilesWithExtensions } from '@/lib/graph/filePicker'
import { buildWidgetBundleJsonText } from '@/lib/graph/io/widgetBundle'
import { tryParseWidgetImportGraphData } from '@/lib/graph/io/widgetImport'
import { downloadBlob } from '@/lib/graph/save'
import type { WidgetRegistryEntry } from '@/features/storyboard-widget-manager/widgetRegistryTypes'

export async function importWidgetRegistryFromJson(args: {
  widgetRegistry: WidgetRegistryEntry[] | null | undefined
  setWidgetRegistry: (entries: WidgetRegistryEntry[]) => void
}): Promise<void> {
  const files = await pickFilesWithExtensions(['json'], false)
  const file = files && files[0] ? files[0] : null
  if (!file) return
  let json: unknown = null
  try {
    json = JSON.parse(await file.text())
  } catch {
    return
  }
  const parsed = tryParseWidgetImportGraphData(json)
  const meta = parsed?.graphData?.metadata
  const imported = readValidatedWidgetRegistryMetadataEntries(meta)
  if (imported.length === 0) return
  const merged = normalizeWidgetRegistryEntries([...(args.widgetRegistry || []), ...imported])
  args.setWidgetRegistry(merged)
}

export function exportWidgetRegistryAsJson(args: {
  selected: WidgetRegistryEntry | null
  widgetRegistry: WidgetRegistryEntry[] | null | undefined
}): void {
  const selectedEntry = args.selected
  const entries = selectedEntry ? [selectedEntry] : (args.widgetRegistry || [])
  if (!entries || entries.length === 0) return
  const bundleText = buildWidgetBundleJsonText({ registryEntries: entries, graphData: null })
  const blob = new Blob([bundleText], { type: 'application/json' })
  const filename = selectedEntry ? `widget-${selectedEntry.nodeTypeId}.json` : 'widget-registry.json'
  downloadBlob(blob, filename)
}
