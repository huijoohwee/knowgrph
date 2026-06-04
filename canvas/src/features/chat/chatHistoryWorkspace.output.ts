import { normalizeWorkspacePath } from '@/features/workspace-fs/path'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import type { WorkspaceFs } from '@/features/workspace-fs/types'
import { toKgcOutputWorkspacePath } from './chatHistoryWorkspace.paths'

const KG_FS_WRITE_PATH = '/__kg_fs_write'

const looksLikeMirrorableFsPath = (value: string): boolean => {
  const s = String(value || '').trim()
  if (!s) return false
  if (s.startsWith('/')) return true
  if (/^[a-zA-Z]:\\/.test(s) || /^[a-zA-Z]:\//.test(s)) return true
  return (
    s.startsWith('/Users/') ||
    s.startsWith('/home/') ||
    s.startsWith('/Volumes/') ||
    s.startsWith('/private/') ||
    s.startsWith('/tmp/') ||
    s.startsWith('/var/')
  )
}

const mirrorWorkspaceFileTextToHostFs = async (args: { absolutePath: string; text: string }): Promise<void> => {
  if (typeof window === 'undefined') return
  const abs = String(args.absolutePath || '').trim()
  if (!looksLikeMirrorableFsPath(abs)) return
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 5_000)
    try {
      const res = await fetch(KG_FS_WRITE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: abs, text: args.text }),
        signal: controller.signal,
      })
      if (!res.ok) return
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    void 0
  }
}

const blobToBase64 = async (blob: Blob): Promise<string | null> => {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(arrayBuffer)
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
  } catch {
    return null
  }
}

const mirrorWorkspaceFileBlobToHostFs = async (args: { absolutePath: string; blob: Blob }): Promise<void> => {
  if (typeof window === 'undefined') return
  const abs = String(args.absolutePath || '').trim()
  if (!looksLikeMirrorableFsPath(abs)) return
  const blob = args.blob
  const base64 = await blobToBase64(blob)
  if (!base64) return
  try {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      try {
        controller.abort()
      } catch {
        void 0
      }
    }, 10_000)
    try {
      const res = await fetch(KG_FS_WRITE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: abs,
          base64,
          encoding: 'base64',
          mimeType: String(blob.type || 'application/octet-stream'),
        }),
        signal: controller.signal,
      })
      if (!res.ok) return
    } finally {
      window.clearTimeout(timeoutId)
    }
  } catch {
    void 0
  }
}

const ensureWorkspaceTextFile = async (workspacePath: string, text: string, fsOverride?: WorkspaceFs | null): Promise<void> => {
  const fs = fsOverride || await getWorkspaceFs()
  await fs.ensureSeed()
  const normalized = normalizeWorkspacePath(workspacePath)
  const existing = await fs.readFileText(normalized)
  if (existing === null) {
    const parts = normalized.split('/').filter(Boolean)
    const name = String(parts[parts.length - 1] || '').trim()
    const parentPath = normalizeWorkspacePath(`/${parts.slice(0, -1).join('/') || ''}`) || '/'
    if (!name) return
    await fs.createFile({ parentPath, name, text })
    return
  }
  await fs.writeFileText(normalized, text)
}

export const resolveWorkspaceSiblingArtifactPath = (args: {
  workspacePath: string | null | undefined
  fileName: string | null | undefined
}): string | null => {
  const basePath = normalizeWorkspacePath(String(args.workspacePath || '').trim())
  const fileName = String(args.fileName || '').trim()
  if (!basePath || !fileName) return null
  const parts = basePath.split('/').filter(Boolean)
  if (parts.length === 0) return null
  const parent = parts.slice(0, -1).join('/')
  return normalizeWorkspacePath(`/${parent ? `${parent}/` : ''}${fileName}`) || null
}

export const writeWorkspaceTextArtifactAtPath = async (args: {
  absolutePath: string | null | undefined
  text: string
  fs?: WorkspaceFs | null
}): Promise<string | null> => {
  const outputPath = normalizeWorkspacePath(String(args.absolutePath || '').trim())
  if (!outputPath) return null
  const text = String(args.text || '')
  try {
    await ensureWorkspaceTextFile(outputPath, text, args.fs)
  } catch {
    void 0
  }
  await mirrorWorkspaceFileTextToHostFs({ absolutePath: outputPath, text })
  return outputPath
}

export const writeWorkspaceBlobArtifactAtPath = async (args: {
  absolutePath: string | null | undefined
  blob: Blob
}): Promise<string | null> => {
  const outputPath = normalizeWorkspacePath(String(args.absolutePath || '').trim())
  if (!outputPath) return null
  await mirrorWorkspaceFileBlobToHostFs({ absolutePath: outputPath, blob: args.blob })
  return outputPath
}

export const resolveKgcCompanionOutputPath = (args: {
  workspacePath: string | null | undefined
  extension: string
  variant?: string | null
}): string | null => {
  const basePath = String(args.workspacePath || '').trim()
  if (!basePath) return null
  return toKgcOutputWorkspacePath(basePath, args.extension, { variant: args.variant }) || null
}

export const writeKgcCompanionOutputText = async (args: {
  workspacePath: string | null | undefined
  extension: string
  text: string
  variant?: string | null
}): Promise<string | null> => {
  const outputPath = resolveKgcCompanionOutputPath(args)
  return await writeWorkspaceTextArtifactAtPath({
    absolutePath: outputPath,
    text: args.text,
  })
}

export const writeKgcCompanionOutputBlob = async (args: {
  workspacePath: string | null | undefined
  extension: string
  blob: Blob
  variant?: string | null
}): Promise<string | null> => {
  const outputPath = resolveKgcCompanionOutputPath(args)
  return await writeWorkspaceBlobArtifactAtPath({
    absolutePath: outputPath,
    blob: args.blob,
  })
}
