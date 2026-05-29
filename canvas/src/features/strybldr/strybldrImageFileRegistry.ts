import type { CorpusSourceUnit } from '@/features/queryable-corpus/corpusGraph'

type RegisteredStrybldrImageFile = {
  sourceUnitId: string
  workspacePath: string
  originalName: string
  file: File
  objectUrl: string
  registeredAtMs: number
}

const registry = new Map<string, RegisteredStrybldrImageFile>()

const clean = (value: unknown): string => String(value || '').trim()

const createObjectUrl = (file: File): string => {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  try {
    return URL.createObjectURL(file)
  } catch {
    return ''
  }
}

export function registerStrybldrImageFiles(args: {
  sourceUnits: readonly CorpusSourceUnit[]
  files: readonly File[]
}): Record<string, string> {
  const filesByName = new Map(args.files.map(file => [clean(file.name).toLowerCase(), file]))
  const mediaUrlBySourceUnitId: Record<string, string> = {}
  for (const unit of args.sourceUnits) {
    if (unit.mediaKind !== 'image') continue
    const file = filesByName.get(clean(unit.originalName).toLowerCase())
    if (!file) continue
    const sourceUnitId = clean(unit.id)
    if (!sourceUnitId) continue
    const previous = registry.get(sourceUnitId)
    if (previous?.objectUrl && previous.objectUrl.startsWith('blob:') && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(previous.objectUrl)
      } catch {
        void 0
      }
    }
    const objectUrl = createObjectUrl(file)
    registry.set(sourceUnitId, {
      sourceUnitId,
      workspacePath: clean(unit.workspacePath),
      originalName: clean(unit.originalName),
      file,
      objectUrl,
      registeredAtMs: Date.now(),
    })
    if (objectUrl) mediaUrlBySourceUnitId[sourceUnitId] = objectUrl
  }
  return mediaUrlBySourceUnitId
}

export function getStrybldrImageFile(sourceUnitId: string): RegisteredStrybldrImageFile | null {
  return registry.get(clean(sourceUnitId)) || null
}

export function listStrybldrImageFiles(): RegisteredStrybldrImageFile[] {
  return Array.from(registry.values()).sort((a, b) => b.registeredAtMs - a.registeredAtMs)
}

