import { downloadBlob, saveBlobWithPicker } from '@/lib/graph/save'
import {
  resolveCsvJsonWorkspaceExport,
  type CsvJsonWorkspaceExportArtifact,
  type CsvJsonWorkspaceExportTargetFormat,
} from '../../workspaceImport/csvJsonConversion'

export async function resolveCsvJsonWorkspaceExportArtifact(args: {
  activeDocumentKey: string
  activeText: string
  targetFormat: CsvJsonWorkspaceExportTargetFormat
  jsonSourceText?: string | null
}): Promise<CsvJsonWorkspaceExportArtifact | null> {
  return await resolveCsvJsonWorkspaceExport({
    activeDocumentPath: args.activeDocumentKey,
    activeText: args.activeText,
    targetFormat: args.targetFormat,
    jsonSourceText: args.jsonSourceText,
  })
}

export async function exportCsvJsonWorkspaceDataFile(args: {
  activeDocumentKey: string
  activeText: string
  targetFormat: CsvJsonWorkspaceExportTargetFormat
  jsonSourceText?: string | null
}): Promise<boolean> {
  const artifact = await resolveCsvJsonWorkspaceExportArtifact(args)
  if (!artifact) return false
  const blob = new Blob([artifact.text], { type: artifact.mimeType })
  const saved = await saveBlobWithPicker(blob, artifact.name, {
    description: artifact.description,
    accept: artifact.accept,
  })
  if (saved === '') return true
  if (!saved) downloadBlob(blob, artifact.name)
  return true
}
