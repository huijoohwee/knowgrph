import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const knowgrphRoot = path.resolve(__dirname, '..')
const githubRoot = path.resolve(knowgrphRoot, '..')

const KNOWN_ARGS = new Set([
  '--docs-root',
  '--base-url',
  '--workspace-id',
  '--device-id',
  '--dry-run',
  '--help',
])

const getArgValue = (flag) => {
  const index = process.argv.indexOf(flag)
  if (index < 0) return null
  return process.argv[index + 1] || null
}

const hasFlag = (flag) => process.argv.includes(flag)

const ensureNoUnknownArgs = () => {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] || ''
    if (!token.startsWith('--')) continue
    if (!KNOWN_ARGS.has(token)) {
      throw new Error(`Unknown argument: ${token}`)
    }
    if (token !== '--dry-run' && token !== '--help') i += 1
  }
}

const printHelp = () => {
  console.log(`
Seed huijoohwee/docs markdown into Cloudflare D1 through knowgrph storage Worker.

Usage:
  node ./scripts/seed-storage-docs-to-cloudflare.mjs [options]

Options:
  --docs-root <absolute-path>   Docs root to sync (default: ../huijoohwee/docs)
  --base-url <url>              Storage API origin (default: https://airvio.co)
  --workspace-id <id>           Target workspace id (default: kgws:canonical-docs)
  --device-id <id>              Device id label (default: seed:canonical-docs)
  --dry-run                     Print planned mutations without push
  --help                        Show this help
`.trim())
}

const normalizeString = (value) => String(value || '').trim()

const docsRoot = normalizeString(getArgValue('--docs-root'))
  || path.resolve(githubRoot, 'huijoohwee', 'docs')
const baseUrl = normalizeString(getArgValue('--base-url')) || 'https://airvio.co'
const workspaceId = normalizeString(getArgValue('--workspace-id')) || 'kgws:canonical-docs'
const deviceId = normalizeString(getArgValue('--device-id')) || 'seed:canonical-docs'
const dryRun = hasFlag('--dry-run')

const contentHash = (text) => createHash('sha256').update(text).digest('hex')

const walkMarkdownFiles = async (rootDir) => {
  const out = []
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.resolve(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (!entry.name.toLowerCase().endsWith('.md')) continue
      out.push(absolute)
    }
  }
  await walk(rootDir)
  out.sort((a, b) => a.localeCompare(b))
  return out
}

const toPosixRel = (rootDir, filePath) =>
  path.relative(rootDir, filePath).split(path.sep).filter(Boolean).join('/')

const buildMutation = async (args) => {
  const stats = await fs.stat(args.filePath)
  const text = await fs.readFile(args.filePath, 'utf8')
  const normalizedText = String(text || '')
  const relPath = toPosixRel(args.docsRoot, args.filePath)
  const canonicalPath = `huijoohwee/docs/${relPath}`
  const hash = contentHash(normalizedText)
  const revision = Math.max(1, Math.floor(stats.mtimeMs))
  const documentId = `docs:${contentHash(canonicalPath).slice(0, 24)}`
  const graphId = `docs-graph:${contentHash(canonicalPath).slice(0, 24)}`
  const mutationId = `seed:${Date.now()}:${contentHash(`${canonicalPath}:${hash}`).slice(0, 12)}`
  return {
    mutationId,
    workspaceId: args.workspaceId,
    entity: 'document',
    op: 'upsert',
    recordId: documentId,
    baseRevision: null,
    record: {
      id: documentId,
      workspaceId: args.workspaceId,
      canonicalPath,
      title: path.basename(relPath),
      docType: 'markdown',
      lang: null,
      graphId,
      sourceKind: 'markdown',
      contentMd: normalizedText,
      contentHash: hash,
      parserVersion: 'seed-storage-docs-to-cloudflare:v1',
      revision,
      updatedAtMs: Math.floor(stats.mtimeMs),
      deleted: false,
    },
  }
}

const pushMutations = async (args) => {
  const endpoint = new URL('/api/storage/push', args.baseUrl).toString()
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      apiVersion: '2026-05-04',
      workspaceId: args.workspaceId,
      deviceId: args.deviceId,
      mutations: args.mutations,
    }),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Storage push returned non-JSON response (${response.status}): ${text.slice(0, 300)}`)
  }
  if (!response.ok || !json || json.ok !== true) {
    throw new Error(`Storage push failed (${response.status}): ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

const exportWorkspace = async (args) => {
  const endpoint = new URL(`/api/storage/export/${encodeURIComponent(args.workspaceId)}`, args.baseUrl).toString()
  const response = await fetch(endpoint, { method: 'GET' })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Storage export returned non-JSON response (${response.status}): ${text.slice(0, 300)}`)
  }
  if (!response.ok || !json || json.ok !== true) {
    throw new Error(`Storage export failed (${response.status}): ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

const toSqlString = (value) => `'${String(value || '').replace(/'/g, "''")}'`
const toSqlNullableString = (value) => {
  if (value == null) return 'NULL'
  return toSqlString(value)
}

const executeD1SqlFile = async (sqlText) => {
  const tempDir = path.resolve(knowgrphRoot, '.tmp')
  const fileName = `seed-storage-docs-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`
  const tempFile = path.resolve(tempDir, fileName)
  await fs.mkdir(tempDir, { recursive: true })
  await fs.writeFile(tempFile, sqlText, 'utf8')
  try {
    const result = spawnSync(
      'npx',
      [
        '--yes',
        'wrangler',
        'd1',
        'execute',
        'knowgrph-storage',
        '--remote',
        '--config',
        'cloudflare/workers/knowgrph-storage/wrangler.toml',
        '--file',
        tempFile,
      ],
      {
        cwd: knowgrphRoot,
        env: process.env,
        encoding: 'utf8',
      },
    )
    if (result.status !== 0) {
      const message = (result.stderr || result.stdout || '').trim()
      throw new Error(message || 'npx wrangler d1 execute failed')
    }
  } finally {
    await fs.rm(tempFile, { force: true }).catch(() => void 0)
  }
}

const seedDocumentsDirectlyToD1 = async (args) => {
  if (!normalizeString(process.env.CLOUDFLARE_API_TOKEN)) {
    throw new Error(
      'CLOUDFLARE_API_TOKEN is required for direct D1 seeding fallback. ' +
      'Set token, then rerun: npm run storage:d1:seed:docs',
    )
  }
  const nowIso = new Date().toISOString()
  await executeD1SqlFile(
    [
      'PRAGMA foreign_keys = ON;',
      `INSERT INTO workspaces (id, slug, title, visibility, created_at, updated_at)`,
      `VALUES (${toSqlString(args.workspaceId)}, ${toSqlString(args.workspaceId)}, ${toSqlString(args.workspaceId)}, 'private', ${toSqlString(nowIso)}, ${toSqlString(nowIso)})`,
      `ON CONFLICT(id) DO UPDATE SET`,
      `slug = excluded.slug,`,
      `title = excluded.title,`,
      `updated_at = excluded.updated_at;`,
    ].join('\n'),
  )
  for (let i = 0; i < args.mutations.length; i += 1) {
    const mutation = args.mutations[i]
    if (!mutation || mutation.entity !== 'document' || mutation.op !== 'upsert') continue
    const record = mutation.record
    const updatedAtIso = new Date(Math.max(1, Number(record.updatedAtMs || Date.now()))).toISOString()
    const sql = [
      'PRAGMA foreign_keys = ON;',
      `INSERT INTO documents (`,
      `  id, workspace_id, canonical_path, title, doc_type, lang, graph_id, source_kind,`,
      `  content_md, content_hash, parser_version, revision, deleted, created_at, updated_at`,
      `) VALUES (`,
      `  ${toSqlString(record.id)},`,
      `  ${toSqlString(record.workspaceId)},`,
      `  ${toSqlString(record.canonicalPath)},`,
      `  ${toSqlNullableString(record.title)},`,
      `  ${toSqlNullableString(record.docType)},`,
      `  ${toSqlNullableString(record.lang)},`,
      `  ${toSqlNullableString(record.graphId)},`,
      `  ${toSqlString(record.sourceKind)},`,
      `  ${toSqlString(record.contentMd)},`,
      `  ${toSqlString(record.contentHash)},`,
      `  ${toSqlString(record.parserVersion)},`,
      `  ${Math.max(1, Number(record.revision || 1))},`,
      `  ${record.deleted ? 1 : 0},`,
      `  ${toSqlString(updatedAtIso)},`,
      `  ${toSqlString(updatedAtIso)}`,
      `)`,
      `ON CONFLICT(id) DO UPDATE SET`,
      `  workspace_id = excluded.workspace_id,`,
      `  canonical_path = excluded.canonical_path,`,
      `  title = excluded.title,`,
      `  doc_type = excluded.doc_type,`,
      `  lang = excluded.lang,`,
      `  graph_id = excluded.graph_id,`,
      `  source_kind = excluded.source_kind,`,
      `  content_md = excluded.content_md,`,
      `  content_hash = excluded.content_hash,`,
      `  parser_version = excluded.parser_version,`,
      `  revision = excluded.revision,`,
      `  deleted = excluded.deleted,`,
      `  updated_at = excluded.updated_at;`,
    ].join('\n')
    await executeD1SqlFile(sql)
  }
}

const run = async () => {
  ensureNoUnknownArgs()
  if (hasFlag('--help')) {
    printHelp()
    return
  }
  const rootStats = await fs.stat(docsRoot).catch(() => null)
  if (!rootStats || !rootStats.isDirectory()) {
    throw new Error(`Docs root does not exist or is not a directory: ${docsRoot}`)
  }
  const markdownFiles = await walkMarkdownFiles(docsRoot)
  if (markdownFiles.length === 0) {
    throw new Error(`No markdown files found under docs root: ${docsRoot}`)
  }
  const mutations = []
  for (let i = 0; i < markdownFiles.length; i += 1) {
    const mutation = await buildMutation({
      filePath: markdownFiles[i],
      docsRoot,
      workspaceId,
    })
    mutations.push(mutation)
  }
  console.log(`[knowgrph] docs-root=${docsRoot}`)
  console.log(`[knowgrph] workspace-id=${workspaceId}`)
  console.log(`[knowgrph] base-url=${baseUrl}`)
  console.log(`[knowgrph] markdown-files=${markdownFiles.length}`)
  if (dryRun) {
    console.log('[knowgrph] dry-run enabled; no remote push executed')
    console.log('[knowgrph] sample canonical paths:')
    for (const mutation of mutations.slice(0, 10)) {
      console.log(`  - ${mutation.record.canonicalPath}`)
    }
    return
  }
  try {
    const pushJson = await pushMutations({
      baseUrl,
      workspaceId,
      deviceId,
      mutations,
    })
    const acknowledgements = Array.isArray(pushJson.acknowledgements) ? pushJson.acknowledgements : []
    const applied = acknowledgements.filter(item => item && item.status === 'applied').length
    const conflict = acknowledgements.filter(item => item && item.status === 'conflict').length
    const rejected = acknowledgements.filter(item => item && item.status === 'rejected').length
    console.log(`[knowgrph] push complete: applied=${applied}, conflict=${conflict}, rejected=${rejected}`)
    const exported = await exportWorkspace({ baseUrl, workspaceId })
    const documentCount = Array.isArray(exported.documents) ? exported.documents.length : 0
    console.log(`[knowgrph] export verification: documents=${documentCount}`)
    return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[knowgrph] API push path unavailable: ${message}`)
    console.warn('[knowgrph] Falling back to direct D1 remote upsert via npx wrangler.')
  }
  await seedDocumentsDirectlyToD1({
    workspaceId,
    mutations,
  })
  console.log('[knowgrph] direct D1 seed complete')
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[knowgrph] seed-storage-docs-to-cloudflare failed: ${message}`)
  process.exitCode = 1
})
