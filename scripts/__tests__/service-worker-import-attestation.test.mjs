import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

import { buildServiceWorkerRevisionAuthoritySource } from '../../canvas/viteServiceWorkerRevisionAuthority.mjs'

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567'

const evaluateImportedWorker = source => {
  const listeners = new Map()
  const context = {
    AbortController,
    Map,
    Request,
    Response,
    Set,
    TextDecoder,
    URL,
    caches: {},
    fetch,
    self: {
      location: { origin: 'https://airvio.co' },
      addEventListener(type, listener) {
        listeners.set(type, listener)
      },
    },
  }
  vm.runInNewContext(source, context)
  return listeners
}

const requestAttestation = (listener, type) => {
  let response = null
  listener({
    data: { type },
    ports: [{
      postMessage(message) {
        response = message
      },
    }],
  })
  return response
}

test('generated active-worker authority reports its exact build revision', () => {
  const listeners = evaluateImportedWorker(
    buildServiceWorkerRevisionAuthoritySource(SOURCE_REVISION),
  )
  const response = requestAttestation(
    listeners.get('message'),
    'KG_SERVICE_WORKER_SOURCE_REVISION_REQUEST',
  )
  assert.equal(response?.type, 'KG_SERVICE_WORKER_SOURCE_REVISION_RESPONSE')
  assert.equal(response?.sourceRevision, SOURCE_REVISION)
  assert.deepEqual([...listeners.keys()], ['message'])
})

test('chat worker reports the lifecycle-clean runtime schema without another lifecycle owner', () => {
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, '../../canvas/public/knowgrph-chat-stream-sw.js'),
    'utf8',
  )
  const listeners = evaluateImportedWorker(source)
  const response = requestAttestation(
    listeners.get('message'),
    'KG_CHAT_STREAM_RUNTIME_ATTEST_REQUEST',
  )
  assert.equal(response?.type, 'KG_CHAT_STREAM_RUNTIME_ATTEST_RESPONSE')
  assert.equal(response?.schema, 'knowgrph-chat-stream-worker/v2')
  assert.deepEqual([...listeners.keys()], ['message'])
})
