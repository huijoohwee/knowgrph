import { inferCorpusMediaKind } from '@/features/queryable-corpus/corpusGraph'
import type { VideoSequenceTimelineSource } from './videoSequenceTimeline'

type RegisteredVideoSequenceSourceFile = {
  file: File
  objectUrl: string
  originalName: string
  relativePath: string
  mimeHint: string
  byteSize: number
  registeredAtMs: number
}

const registry = new Map<string, RegisteredVideoSequenceSourceFile>()

const clean = (value: unknown): string => String(value || '').trim()

const cleanKeyPart = (value: unknown): string => clean(value).replace(/\\/g, '/').toLowerCase()

const readFileRelativePath = (file: File): string => {
  const raw = (file as unknown as { webkitRelativePath?: unknown }).webkitRelativePath
  return typeof raw === 'string' ? clean(raw) : ''
}

const readByteSize = (value: unknown): number => {
  const size = Number(value)
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : 0
}

const createObjectUrl = (file: File): string => {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  try {
    return URL.createObjectURL(file)
  } catch {
    return ''
  }
}

const revokeObjectUrl = (value: string): void => {
  if (!value || !value.startsWith('blob:') || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
  try {
    URL.revokeObjectURL(value)
  } catch {
    void 0
  }
}

export function buildVideoSequenceSourceRegistryKeys(source: Pick<VideoSequenceTimelineSource, 'originalName' | 'relativePath' | 'mimeHint' | 'byteSize'>): string[] {
  const names = [
    cleanKeyPart(source.relativePath),
    cleanKeyPart(source.originalName),
    cleanKeyPart(source.relativePath).split('/').filter(Boolean).pop() || '',
  ].filter(Boolean)
  const uniqueNames = Array.from(new Set(names))
  const mimeHint = cleanKeyPart(source.mimeHint)
  const byteSize = readByteSize(source.byteSize)
  const keys: string[] = []
  for (const name of uniqueNames) {
    if (byteSize > 0 && mimeHint) keys.push(`${name}|${byteSize}|${mimeHint}`)
    if (byteSize > 0) keys.push(`${name}|${byteSize}`)
    if (mimeHint) keys.push(`${name}|${mimeHint}`)
    keys.push(name)
  }
  return Array.from(new Set(keys))
}

export function registerVideoSequenceSourceFiles(files: readonly File[]): void {
  for (const file of Array.from(files || [])) {
    if (inferCorpusMediaKind(file.name, file.type) !== 'video') continue
    const objectUrl = createObjectUrl(file)
    if (!objectUrl) continue
    const relativePath = readFileRelativePath(file)
    const registered: RegisteredVideoSequenceSourceFile = {
      file,
      objectUrl,
      originalName: clean(file.name),
      relativePath,
      mimeHint: clean(file.type),
      byteSize: readByteSize(file.size),
      registeredAtMs: Date.now(),
    }
    const keys = buildVideoSequenceSourceRegistryKeys({
      originalName: registered.originalName,
      relativePath: registered.relativePath,
      mimeHint: registered.mimeHint,
      byteSize: registered.byteSize,
    })
    const revoked = new Set<string>()
    for (const key of keys) {
      const previous = registry.get(key)
      if (previous?.objectUrl && previous.objectUrl !== objectUrl && !revoked.has(previous.objectUrl)) {
        revokeObjectUrl(previous.objectUrl)
        revoked.add(previous.objectUrl)
      }
      registry.set(key, registered)
    }
  }
}

export function resolveVideoSequenceSourceRuntimeUrl(source: VideoSequenceTimelineSource | null | undefined): string {
  if (!source) return ''
  for (const key of buildVideoSequenceSourceRegistryKeys(source)) {
    const registered = registry.get(key)
    if (registered?.objectUrl) return registered.objectUrl
  }
  return ''
}

export function listVideoSequenceSourceFiles(): RegisteredVideoSequenceSourceFile[] {
  const seen = new Set<string>()
  const out: RegisteredVideoSequenceSourceFile[] = []
  for (const entry of registry.values()) {
    if (!entry.objectUrl || seen.has(entry.objectUrl)) continue
    seen.add(entry.objectUrl)
    out.push(entry)
  }
  return out.sort((a, b) => b.registeredAtMs - a.registeredAtMs)
}
