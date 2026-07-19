import { Buffer } from 'node:buffer'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

export const KG_FS_ARTIFACT_PATH = '/__kg_fs_artifact' as const
export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const

export type KgFsPathPolicy = {
  isAllowed: (candidate: string) => boolean
  resolveHostPath: (candidate: string) => string
}

export const createKgFsPathPolicy = (repoRoot: string): KgFsPathPolicy => {
  const worktreeMarker = `${path.sep}.worktrees${path.sep}`
  const worktreeMarkerIndex = path.resolve(repoRoot).indexOf(worktreeMarker)
  const workspaceMirrorRoot = worktreeMarkerIndex > 0
    ? path.resolve(repoRoot).slice(0, worktreeMarkerIndex)
    : path.resolve(repoRoot, '..')
  const allowedRoots = [path.resolve(repoRoot), workspaceMirrorRoot]
  const isAllowed = (candidate: string): boolean => {
    const resolved = path.resolve(candidate)
    return allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep))
  }
  const resolveHostPath = (candidate: string): string => {
    const raw = String(candidate || '').trim()
    if (!raw) return ''
    const resolved = path.resolve(raw)
    if (isAllowed(resolved)) return resolved
    if (raw.startsWith('/')) return path.resolve(workspaceMirrorRoot, `.${raw}`)
    return path.resolve(workspaceMirrorRoot, raw)
  }
  return { isAllowed, resolveHostPath }
}

export const decodeStrictBase64 = (value: string): Buffer | null => {
  const normalized = String(value || '').replace(/\s+/g, '')
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null
  try {
    const decoded = Buffer.from(normalized, 'base64')
    return decoded.toString('base64').replace(/=+$/, '') === normalized.replace(/=+$/, '') ? decoded : null
  } catch {
    return null
  }
}

export const decodeXlsxArtifactBase64 = (args: {
  base64: string
  encoding: string
  mimeType: string
}): Buffer | null => {
  if (String(args.encoding || '').trim().toLowerCase() !== 'base64') return null
  if (String(args.mimeType || '').trim().toLowerCase() !== XLSX_MIME_TYPE) return null
  const decoded = decodeStrictBase64(args.base64)
  return decoded?.[0] === 0x50 && decoded?.[1] === 0x4b && decoded?.[2] === 0x03 && decoded?.[3] === 0x04
    ? decoded
    : null
}

const createArtifactHandler = (policy: KgFsPathPolicy): import('vite').Connect.NextHandleFunction =>
  async (request, response, next) => {
    if (request.method !== 'GET') {
      next()
      return
    }
    const requestUrl = new URL(String(request.url || ''), 'http://localhost')
    const requestedPath = policy.resolveHostPath(String(requestUrl.searchParams.get('path') || ''))
    if (!requestedPath || !policy.isAllowed(requestedPath) || path.extname(requestedPath).toLowerCase() !== '.xlsx') {
      response.statusCode = 400
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ ok: false, error: 'A permitted .xlsx artifact path is required' }))
      return
    }
    try {
      const stat = await fs.stat(requestedPath)
      if (!stat.isFile()) throw new Error('Artifact is not a file')
      response.statusCode = 200
      response.setHeader('Content-Type', XLSX_MIME_TYPE)
      response.setHeader('Content-Length', String(stat.size))
      response.setHeader('Content-Disposition', `attachment; filename="${path.basename(requestedPath).replace(/["\\]/g, '')}"`)
      response.setHeader('Cache-Control', 'no-store')
      createReadStream(requestedPath).pipe(response)
    } catch {
      response.statusCode = 404
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ ok: false, error: 'Artifact not found' }))
    }
  }

export const createWorkspaceArtifactBridgePlugin = (repoRoot: string): Plugin => {
  const policy = createKgFsPathPolicy(repoRoot)
  return {
    name: 'knowgrph-workspace-artifact-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(KG_FS_ARTIFACT_PATH, createArtifactHandler(policy))
    },
    configurePreviewServer(server) {
      server.middlewares.use(KG_FS_ARTIFACT_PATH, createArtifactHandler(policy))
    },
  }
}
