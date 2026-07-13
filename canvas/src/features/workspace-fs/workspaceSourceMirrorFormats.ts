import { SOURCE_FILES_FORMATS } from '../../lib/config-copy/importExportCopy'

const normalizeMirrorExtension = (value: string): string => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  return raw.startsWith('.') ? raw : `.${raw}`
}

const dedupeMirrorExtensions = (extensions: ReadonlyArray<string>): string[] => {
  const out = new Set<string>()
  for (const ext of extensions) {
    const normalized = normalizeMirrorExtension(ext)
    if (normalized) out.add(normalized)
  }
  return [...out]
}

const readMirrorFileExtension = (name: string): string => {
  const normalized = String(name || '').trim().toLowerCase()
  if (!normalized) return ''
  const basename = normalized.split('/').filter(Boolean).pop() || normalized
  const dot = basename.lastIndexOf('.')
  if (dot > 0) return basename.slice(dot)
  return normalizeMirrorExtension(basename)
}

export const WORKSPACE_SOURCE_MIRROR_TEXT_EXTENSIONS = dedupeMirrorExtensions([
  ...SOURCE_FILES_FORMATS.importLocalText,
  '.mdx',
  '.gltf',
])

export const WORKSPACE_SOURCE_MIRROR_BINARY_EXTENSIONS = ['.glb', '.ply', '.spz'] as const

export const WORKSPACE_SOURCE_PERSISTED_BINARY_EXTENSIONS = [
  ...WORKSPACE_SOURCE_MIRROR_BINARY_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.avif',
  '.mp4',
  '.mov',
  '.webm',
  '.m4v',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
] as const

export const WORKSPACE_SOURCE_MIRROR_EXTENSIONS = dedupeMirrorExtensions([
  ...WORKSPACE_SOURCE_MIRROR_TEXT_EXTENSIONS,
  ...WORKSPACE_SOURCE_MIRROR_BINARY_EXTENSIONS,
])

export const WORKSPACE_SOURCE_MIRROR_EXT_SET = new Set(WORKSPACE_SOURCE_MIRROR_EXTENSIONS)

export const isWorkspaceSourceMirrorFileName = (name: string): boolean => {
  const ext = readMirrorFileExtension(name)
  return !!ext && WORKSPACE_SOURCE_MIRROR_EXT_SET.has(ext)
}

export const shouldEncodeWorkspaceSourceMirrorAsBase64 = (name: string): boolean =>
  WORKSPACE_SOURCE_MIRROR_BINARY_EXTENSIONS.includes(readMirrorFileExtension(name) as typeof WORKSPACE_SOURCE_MIRROR_BINARY_EXTENSIONS[number])

export const isPersistedWorkspaceBinaryFileName = (name: string): boolean =>
  WORKSPACE_SOURCE_PERSISTED_BINARY_EXTENSIONS.includes(readMirrorFileExtension(name) as typeof WORKSPACE_SOURCE_PERSISTED_BINARY_EXTENSIONS[number])
