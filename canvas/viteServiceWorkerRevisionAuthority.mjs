const SOURCE_REVISION_PATTERN = /^[0-9a-f]{40}$/
export const SERVICE_WORKER_REVISION_ARTIFACT = 'knowgrph-service-worker-revision.js'
export const SERVICE_WORKER_REVISION_REQUEST = 'KG_SERVICE_WORKER_SOURCE_REVISION_REQUEST'
export const SERVICE_WORKER_REVISION_RESPONSE = 'KG_SERVICE_WORKER_SOURCE_REVISION_RESPONSE'

export const buildServiceWorkerRevisionAuthoritySource = sourceRevision => {
  if (!SOURCE_REVISION_PATTERN.test(sourceRevision)) {
    throw new Error('service-worker revision authority requires an exact source revision')
  }
  return `;(() => {
  const sourceRevision = ${JSON.stringify(sourceRevision)}
  self.addEventListener('message', event => {
    if (event.data?.type !== ${JSON.stringify(SERVICE_WORKER_REVISION_REQUEST)}) return
    const port = event.ports?.[0]
    if (!port) return
    port.postMessage({
      type: ${JSON.stringify(SERVICE_WORKER_REVISION_RESPONSE)},
      sourceRevision,
    })
  })
})()
`
}

export const createServiceWorkerRevisionAuthorityPlugin = sourceRevision => ({
  name: 'knowgrph-service-worker-revision-authority',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: SERVICE_WORKER_REVISION_ARTIFACT,
      source: buildServiceWorkerRevisionAuthoritySource(sourceRevision),
    })
  },
})
