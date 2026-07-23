import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const serviceWorker = fs.readFileSync(path.resolve(repoRoot, 'canvas', 'dist', 'sw.js'), 'utf8')
const importedChatWorker = fs.readFileSync(
  path.resolve(repoRoot, 'canvas', 'public', 'knowgrph-chat-stream-sw.js'),
  'utf8',
)
const revisionAuthority = fs.readFileSync(
  path.resolve(repoRoot, 'canvas', 'dist', 'knowgrph-service-worker-revision.js'),
  'utf8',
)

assert.doesNotMatch(
  serviceWorker,
  /\{url:["']index\.html["']/,
  'generated service worker must not precache a mutable HTML shell',
)
assert.doesNotMatch(
  serviceWorker,
  /NavigationRoute\([^)]*createHandlerBoundToURL\(["']index\.html["']\)/,
  'generated service worker must not own production navigations through an HTML fallback',
)
assert.match(serviceWorker, /\.skipWaiting\(\)/, 'generated service worker must activate the canonical revision')
assert.match(serviceWorker, /\.clientsClaim\(\)/, 'generated service worker must claim clients from one lifecycle owner')
assert.doesNotMatch(
  importedChatWorker,
  /addEventListener\(["'](?:install|activate)["']/,
  'imported chat worker must not duplicate generated service-worker lifecycle ownership',
)
assert.doesNotMatch(
  revisionAuthority,
  /addEventListener\(["'](?:install|activate)["']/,
  'revision authority must not duplicate generated service-worker lifecycle ownership',
)
const attestedRevision = revisionAuthority.match(/const sourceRevision = ["']([0-9a-f]{40})["']/)?.[1] || ''
assert.match(attestedRevision, /^[0-9a-f]{40}$/, 'revision authority must attest one exact source revision')
assert.match(
  serviceWorker,
  new RegExp(`importScripts\\(["']knowgrph-service-worker-revision\\.js\\?revision=${attestedRevision}["'],["']knowgrph-chat-stream-sw\\.js\\?revision=${attestedRevision}["']\\)`),
  'generated service worker must revision-bind both imported worker scripts',
)
assert.match(
  serviceWorker,
  new RegExp(`assets/${attestedRevision}/`),
  'service-worker precache and attested active revision must share one source namespace',
)
assert.match(
  importedChatWorker,
  /RUNTIME_SCHEMA = ["']knowgrph-chat-stream-worker\/v2["']/,
  'imported chat worker must expose the lifecycle-clean runtime attestation',
)

process.stdout.write('[knowgrph] generated PWA keeps HTTP as the sole HTML owner\n')
