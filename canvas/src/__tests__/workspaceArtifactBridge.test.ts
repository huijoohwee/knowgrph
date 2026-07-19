import path from 'node:path'
import {
  XLSX_MIME_TYPE,
  createKgFsPathPolicy,
  decodeXlsxArtifactBase64,
} from '../../viteWorkspaceArtifactBridge'

export function testWorkspaceArtifactBridgeAcceptsOnlyVerifiedXlsxPayloads() {
  const valid = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]).toString('base64')
  if (!decodeXlsxArtifactBase64({ base64: valid, encoding: 'base64', mimeType: XLSX_MIME_TYPE })) {
    throw new Error('expected exact-MIME base64 XLSX ZIP bytes to be accepted')
  }
  for (const candidate of [
    { base64: valid, encoding: 'text', mimeType: XLSX_MIME_TYPE },
    { base64: valid, encoding: 'base64', mimeType: 'application/octet-stream' },
    { base64: Buffer.from('not-a-zip').toString('base64'), encoding: 'base64', mimeType: XLSX_MIME_TYPE },
    { base64: 'not base64', encoding: 'base64', mimeType: XLSX_MIME_TYPE },
  ]) {
    if (decodeXlsxArtifactBase64(candidate)) {
      throw new Error(`expected invalid XLSX write payload to be rejected: ${JSON.stringify(candidate)}`)
    }
  }
}

export function testWorkspaceArtifactBridgeConfinesDownloadPathsToWorkspaceRoots() {
  const repoRoot = path.resolve('/workspace/knowgrph')
  const policy = createKgFsPathPolicy(repoRoot)
  if (!policy.isAllowed(path.resolve(repoRoot, 'artifact.xlsx'))) {
    throw new Error('expected task-repo artifacts to be allowed')
  }
  const remapped = policy.resolveHostPath('/outside/secrets.xlsx')
  if (remapped === '/outside/secrets.xlsx' || !policy.isAllowed(remapped)) {
    throw new Error(`expected outside absolute paths to be remapped inside the workspace mirror, got ${remapped}`)
  }
}
