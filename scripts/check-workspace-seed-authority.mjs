import path from 'node:path'
import process from 'node:process'
import { stat } from 'node:fs/promises'

import { verifyWorkspaceSeedAuthority } from './workspace-seed-authority.mjs'

const root = process.cwd()
const explicitAgenticDocsRoot = String(process.env.KNOWGRPH_AGENTIC_CANVAS_OS_DOCS_ROOT || '').trim()
const checkedOutAgenticDocsRoot = path.resolve(root, 'agentic-canvas-os/docs')
const explicitPublishRoot = String(process.env.KNOWGRPH_PRODUCTION_MIRROR_ROOT || '').trim()
const checkedOutPublishRoot = path.resolve(root, 'huijoohwee')

const exists = async candidate => {
  try {
    return (await stat(candidate)).isDirectory()
  } catch {
    return false
  }
}

const agenticDocsRoot = explicitAgenticDocsRoot
  || (await exists(checkedOutAgenticDocsRoot) ? checkedOutAgenticDocsRoot : null)
const publishRoot = explicitPublishRoot
  || (await exists(checkedOutPublishRoot) ? checkedOutPublishRoot : null)

const result = await verifyWorkspaceSeedAuthority({
  knowgrphRoot: root,
  agenticDocsRoot,
  publishRoot,
})

console.log(`[knowgrph] workspace-seed SSOT passed (${result.sourceBytes} bytes; agenticProjection=${Boolean(agenticDocsRoot)}; publishMirror=${Boolean(publishRoot)})`)
