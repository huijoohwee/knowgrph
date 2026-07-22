import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export const PHYSICS_SEED_RELATIVE_PATH = 'docs/workspace-seeds/knowgrph-physics-playground-demo.md'

const isFile = async filePath => (await stat(filePath).catch(() => null))?.isFile() === true

const requireCanonicalIdentity = source => {
  const requiredMarkers = [
    'canonical_source_file: "/docs/workspace-seeds/knowgrph-physics-playground-demo.md"',
    'source_root: "knowgrph/docs"',
    'source_backed: true',
  ]
  const missing = requiredMarkers.filter(marker => !source.includes(marker))
  if (missing.length > 0) {
    throw new Error(`canonical workspace seed is missing identity markers: ${missing.join(', ')}`)
  }
}

export async function verifyWorkspaceSeedAuthority({
  knowgrphRoot,
  agenticDocsRoot,
  publishRoot,
}) {
  const canonicalPath = path.resolve(knowgrphRoot, PHYSICS_SEED_RELATIVE_PATH)
  if (!await isFile(canonicalPath)) throw new Error(`canonical workspace seed is missing: ${canonicalPath}`)
  const source = await readFile(canonicalPath, 'utf8')
  requireCanonicalIdentity(source)

  if (agenticDocsRoot) {
    const projectionPath = path.resolve(agenticDocsRoot, 'workspace-seeds/knowgrph-physics-playground-demo.md')
    if (!await isFile(projectionPath)) throw new Error(`default-storage projection is missing: ${projectionPath}`)
    const projection = await readFile(projectionPath, 'utf8')
    if (projection !== source) {
      throw new Error('Agentic Canvas OS default-storage projection must be byte-identical to the Knowgrph workspace-seed SSOT')
    }
  }

  if (publishRoot) {
    const duplicatePath = path.resolve(publishRoot, PHYSICS_SEED_RELATIVE_PATH)
    if (await isFile(duplicatePath)) {
      throw new Error(`publish repositories must not own an editable workspace-seed duplicate: ${duplicatePath}`)
    }
  }

  return { canonicalPath, sourceBytes: Buffer.byteLength(source) }
}
