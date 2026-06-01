import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRootPackageDeclaresDrizzleForKnowgrphStorageWorker() {
  const packagePath = resolve(process.cwd(), '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  if (!packageJson.dependencies?.['drizzle-orm']) {
    throw new Error('expected knowgrph root package to declare drizzle-orm for the D1 storage worker')
  }
  if (!packageJson.devDependencies?.['drizzle-kit']) {
    throw new Error('expected knowgrph root package to declare drizzle-kit for D1 schema ownership')
  }
}

export function testCloudflareDeployScriptsSeedDocsMirrorIntoD1() {
  const packagePath = resolve(process.cwd(), '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>
  }
  const scripts = packageJson.scripts || {}
  if (!scripts['storage:d1:seed:docs']?.includes('seed-storage-docs-to-cloudflare.mjs')) {
    throw new Error('expected storage:d1:seed:docs to own docs mirror seeding into D1')
  }
  if (!scripts['pages:deploy-cloudflare']?.includes('npm run storage:d1:seed:docs')) {
    throw new Error('expected pages:deploy-cloudflare to seed D1 after the static Pages upload')
  }
  if (!scripts['storage:deploy']?.includes('npm run storage:d1:seed:docs')) {
    throw new Error('expected storage:deploy to seed D1 after migrations and storage Worker deploy')
  }
  if (scripts['workers:deploy'] !== 'npm run storage:deploy && npm run payment:worker:deploy') {
    throw new Error('expected workers:deploy to reuse storage:deploy so D1 migrations, Worker deploy, and docs seeding stay together')
  }
}

export function testStorageSyncDocumentDeclaresPocketBaseYjsGitHubSsotContract() {
  const storageDocPath = resolve(process.cwd(), '..', 'docs', 'documents', 'knowgrph-storage-sync-document.md')
  const companionPath = resolve(process.cwd(), '..', 'docs', 'documents', 'knowgrph-storage-sync-document.companion.md')
  const storageDocText = readFileSync(storageDocPath, 'utf8')
  const companionText = readFileSync(companionPath, 'utf8')
  const requiredStorageDocFragments = [
    'Keep GitHub `docs/**` canonical for Storage Sync',
    'PocketBase + Yjs as the concurrent-editing layer',
    'collaborators never touch Git',
    'Never let two users edit raw JSON simultaneously without CRDT wrapping',
    '**Solo/local path**: Editor Workspace `/docs/**` ⇄ Source Files ⇄ configured local docs mirror.',
    '**Concurrent path**: Editor Workspace `/docs/**` ⇄ Yjs document room ⇄ PocketBase realtime relay ⇄ GitHub save bridge.',
    '| `*.md` | `Y.Text` | Character-level CRDT, zero conflicts |',
    '| `*.json` | `Y.Map` / nested `Y.Map` + `Y.Array` | Field-level merge, prevents destructive overwrites on minified JSON |',
    'User save / autosave boundary',
    'GitHub Contents API (or GitHub App): PUT /repos/{owner}/{repo}/contents/docs/{path}',
    'GitHub docs branch/main stays SSOT',
    'D1 remains the runtime export/read cache; it does not serve as the concurrent edit store.',
  ]
  for (const fragment of requiredStorageDocFragments) {
    if (!storageDocText.includes(fragment)) {
      throw new Error(`expected storage sync document to declare PocketBase/Yjs/GitHub SSOT fragment: ${fragment}`)
    }
  }
  if (storageDocText.includes('D1 becomes SSOT') || storageDocText.includes('flip SSOT to D1') || storageDocText.includes('Yjs doc update event (debounced 5s)')) {
    throw new Error('expected storage sync document to avoid D1-as-SSOT and update-event commit wording for concurrent editing')
  }
  const requiredCompanionFragments = [
    '`Storage Sync` is on and two users edit the same `*.md`',
    '`Storage Sync` is on and two users edit the same `*.json`',
    'raw JSON editing is blocked; Yjs shared JSON types own the edit',
    'collaborators never touch Git credentials or Git commands',
    '### ADR-010: Use PocketBase + Yjs For Same-File Collaboration, Not Git Merge',
    'D1 remains a runtime read/export cache and must not be promoted to collaboration SSOT.',
  ]
  for (const fragment of requiredCompanionFragments) {
    if (!companionText.includes(fragment)) {
      throw new Error(`expected storage sync companion to declare concurrent editing acceptance/ADR fragment: ${fragment}`)
    }
  }
}

export function testBrowserCacheLegacyShimFilesAreRemoved() {
  const storagePath = resolve(process.cwd(), 'src', 'lib', 'storage', 'rxdbStorage.ts')
  const recoveryPath = resolve(process.cwd(), 'src', 'lib', 'storage', 'rxdbRecovery.ts')
  if (existsSync(storagePath)) {
    throw new Error('expected the dead legacy browser-cache shim rxdbStorage.ts to be removed')
  }
  if (existsSync(recoveryPath)) {
    throw new Error('expected the dead legacy browser-cache shim rxdbRecovery.ts to be removed')
  }
}

export function testKnowgrphCanonicalStorageOwnerUsesPersistedCollectionStore() {
  const storagePath = resolve(process.cwd(), 'src', 'lib', 'storage', 'knowgrphStorageDb.ts')
  const storageText = readFileSync(storagePath, 'utf8')
  if (storageText.includes('createRxDatabase') || storageText.includes("from 'rxdb/")) {
    throw new Error('expected knowgrphStorageDb owner to avoid legacy runtime seams once D1 owns canonical persistence')
  }
  if (!storageText.includes('createPersistedCollectionDb')) {
    throw new Error('expected knowgrphStorageDb owner to use the minimal persisted collection store')
  }
}

export function testSourceFilesDbUsesPersistedCollectionStore() {
  const storagePath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesDb.ts')
  const storageText = readFileSync(storagePath, 'utf8')
  if (storageText.includes('createRxDatabase') || storageText.includes("from 'rxdb/")) {
    throw new Error('expected sourceFilesDb owner to avoid legacy runtime seams once the cache layer is minimal')
  }
  if (!storageText.includes('createPersistedCollectionDb')) {
    throw new Error('expected sourceFilesDb owner to use the minimal persisted collection store')
  }
}

export function testMarkdownFsCacheUsesPersistedCollectionStore() {
  const storagePath = resolve(process.cwd(), 'src', 'features', 'source-files', 'markdownFsCache.ts')
  const storageText = readFileSync(storagePath, 'utf8')
  if (storageText.includes('createRxDatabase') || storageText.includes("from 'rxdb/")) {
    throw new Error('expected markdownFsCache owner to avoid legacy runtime seams once the cache layer is minimal')
  }
  if (!storageText.includes('createPersistedCollectionDb')) {
    throw new Error('expected markdownFsCache owner to use the minimal persisted collection store')
  }
}

export function testWorkspaceFsCacheOwnerUsesPersistedCollectionStore() {
  const storagePath = resolve(process.cwd(), 'src', 'features', 'workspace-fs', 'workspaceFsPersisted.ts')
  const storageText = readFileSync(storagePath, 'utf8')
  if (storageText.includes('createRxDatabase') || storageText.includes("from 'rxdb/")) {
    throw new Error('expected workspaceFs cache owner to avoid legacy runtime seams once the cache layer is minimal')
  }
  if (!storageText.includes('createPersistedCollectionDb')) {
    throw new Error('expected workspaceFs cache owner to use the minimal persisted collection store')
  }
}

export function testGraphTableCacheOwnerUsesPersistedCollectionStore() {
  const storagePath = resolve(process.cwd(), 'src', 'lib', 'graph-table-db', 'graphTableDb.impl.ts')
  const storageText = readFileSync(storagePath, 'utf8')
  if (storageText.includes('createRxDatabase') || storageText.includes("from 'rxdb/")) {
    throw new Error('expected graphTableDb cache owner to avoid legacy runtime seams once the cache layer is minimal')
  }
  if (!storageText.includes('createPersistedCollectionDb')) {
    throw new Error('expected graphTableDb cache owner to use the minimal persisted collection store')
  }
}

export function testWorkflowPreviewArtifactsAvoidRxdbTerminologyForActiveStorageDocs() {
  const workflowPreviewDir = resolve(process.cwd(), '..', 'data', 'knowgrph-workflow-preview')
  const previewFiles = [
    'knowgrph-local-storage-document-graph-data.jsonld',
    'knowgrph-codebase-index-document-graph-data.jsonld',
    'knowgrph-ui-ux-design-document-graph-data.jsonld',
    'knowgrph-pipeline-deep-dive-document-graph-data.jsonld',
    'knowgrph-pipeline-document-graph-data.jsonld',
  ]
  const stalePattern = /\bRxDB\b|\brxdb\b/
  for (const previewFile of previewFiles) {
    const previewPath = resolve(workflowPreviewDir, previewFile)
    const previewText = readFileSync(previewPath, 'utf8')
    if (stalePattern.test(previewText)) {
      throw new Error(`expected workflow preview artifact ${previewFile} to avoid stale RxDB terminology`)
    }
  }
}

export function testDocsUpdateScriptUsesCentralizedWorkflowPreviewOwner() {
  const packagePath = resolve(process.cwd(), '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>
  }
  if (packageJson.scripts?.['docs:update'] !== 'node ./scripts/update-docs.mjs') {
    throw new Error('expected docs:update to be owned by scripts/update-docs.mjs')
  }
  if (packageJson.scripts?.['docs:preview:update'] !== 'node ./scripts/update-docs.mjs --preview-only') {
    throw new Error('expected docs:preview:update to expose the bounded workflow-preview owner')
  }

  const ownerPath = resolve(process.cwd(), '..', 'scripts', 'update-docs.mjs')
  const ownerText = readFileSync(ownerPath, 'utf8')
  const requiredDocuments = [
    'docs/documents/knowgrph-pipeline-document.md',
    'docs/documents/knowgrph-pipeline-deep-dive-document.md',
    'docs/documents/knowgrph-ui-ux-design-document.md',
    'docs/documents/knowgrph-codebase-index-document.md',
    'docs/documents/knowgrph-local-storage-document.md',
  ]
  for (const requiredDocument of requiredDocuments) {
    if (!ownerText.includes(requiredDocument)) {
      throw new Error(`expected docs update owner to include ${requiredDocument}`)
    }
  }
}

export function testCanvasBuildUsesWorkflowPreviewDocsOwner() {
  const packagePath = resolve(process.cwd(), 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>
  }
  const prebuild = packageJson.scripts?.prebuild
  if (!prebuild) {
    throw new Error('expected canvas package to declare a prebuild owner')
  }
  if (!prebuild.includes('npm --prefix .. run docs:preview:update')) {
    throw new Error('expected canvas prebuild to use the bounded workflow-preview docs owner')
  }
  if (prebuild.includes('npm --prefix .. run docs:update')) {
    throw new Error('expected canvas prebuild to avoid the wider docs:update owner')
  }
  if (!prebuild.includes('tsx src/cli/lint-doc.ts')) {
    throw new Error('expected canvas prebuild to keep document linting after preview generation')
  }
}
