import type { WorkspaceImportWebsiteOpts } from '@/features/markdown-explorer/workspaceActionBridge'

const SINGLE_RESOURCE_EXTENSIONS = new Set([
  'md',
  'markdown',
  'mdx',
  'json',
  'jsonld',
  'geojson',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'txt',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'avif',
  'glb',
  'gltf',
  'zip',
  'gz',
  'tgz',
])

export function shouldAutoImportUrlAsWebsite(rawUrl: string): boolean {
  try {
    const u = new URL(String(rawUrl || '').trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (
      host === 'github.com' ||
      host.endsWith('.github.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be' ||
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      host === 'twitter.com' ||
      host.endsWith('.twitter.com')
    ) {
      return false
    }
    const leaf = (u.pathname.split('/').filter(Boolean).pop() || '').toLowerCase()
    const ext = leaf.includes('.') ? leaf.split('.').pop() || '' : ''
    return !ext || !SINGLE_RESOURCE_EXTENSIONS.has(ext)
  } catch {
    return false
  }
}

export function buildAutoWebsiteImportOptions(): WorkspaceImportWebsiteOpts {
  return {
    generateArtifactDocs: true,
    browserEnhance: true,
    minPages: 100,
    source: 'import-url',
  }
}
