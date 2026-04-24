import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSourceFilesIngestUsesParseJobGuardForStaleAsyncResults() {
  const p = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('parseJobBySourceFileId')) {
    throw new Error('expected source file ingest parse path to keep per-file parse job tokens')
  }
  if (!text.includes("parseJobBySourceFileId.get(fileId) !== parseJobToken")) {
    throw new Error('expected stale parse jobs to be dropped before state writeback')
  }
  if (!text.includes("hashStringToHexCached(`source-file:${fileId}`, String(latest.text || '')) !== textHash")) {
    throw new Error('expected parse writeback to verify latest text hash before applying results')
  }
}

export function testSourceFilesIngestDedupesPendingParsesForSameTextHash() {
  const p = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('pendingParseTextHashBySourceFileId')) {
    throw new Error('expected source file ingest parse path to track pending text hashes per file')
  }
  if (!text.includes("before.status === 'loading' && pendingParseTextHashBySourceFileId.get(fileId) === textHash")) {
    throw new Error('expected source file ingest parse path to skip duplicate parses for the same pending text')
  }
  if (!text.includes('pendingParseTextHashBySourceFileId.set(fileId, textHash)')) {
    throw new Error('expected source file ingest parse path to record the active pending text hash')
  }
  if (!text.includes('pendingParseTextHashBySourceFileId.delete(fileId)')) {
    throw new Error('expected source file ingest parse path to clear pending text hashes after completion')
  }
}

export function testSourceFilesIngestHydratesPendingUrlSourcesOnBootstrap() {
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const bootstrapPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'SourceFilesPersistenceBootstrap.tsx')
  const ingestText = readFileSync(ingestPath, 'utf8')
  const bootstrapText = readFileSync(bootstrapPath, 'utf8')

  if (!ingestText.includes('export async function hydratePendingUrlSourceFiles(): Promise<void>')) {
    throw new Error('expected source file ingest integration to expose bootstrap hydration for pending url sources')
  }
  if (!ingestText.includes("if (!source || source.kind !== 'url') return false")) {
    throw new Error('expected pending url hydration to gate on canonical url sources only')
  }
  if (!ingestText.includes("if (String(file.text || '').trim()) return false")) {
    throw new Error('expected pending url hydration to skip already-hydrated source file text')
  }
  if (!ingestText.includes("await importUrlIntoActive({ fileId: file.id, url, format: 'markdown' })")) {
    throw new Error('expected pending url hydration to reuse upstream url import flow')
  }
  if (!bootstrapText.includes('await hydratePendingUrlSourceFiles()')) {
    throw new Error('expected source files bootstrap to hydrate pending url sources before composing graph data')
  }
}

export function testSourceFilesIngestTreatsMarkdownLikeUrlsAsDirectTextImports() {
  const ingestPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'sourceFilesIngestIntegration.ts')
  const ingestText = readFileSync(ingestPath, 'utf8')

  if (!ingestText.includes('|md|markdown|mdx|svg')) {
    throw new Error('expected source file url ingest classification to keep markdown-like urls on the direct text import path')
  }
  if (!ingestText.includes('if (isSameOriginRepoFileUrl(normalizedUrl)) {')) {
    throw new Error('expected source file url ingest to branch same-origin __repo_file markdown imports onto the direct local fetch path')
  }
  if (!ingestText.includes('const direct = await fetchSameOriginRepoFileText(normalizedUrl)')) {
    throw new Error('expected source file url ingest to fetch same-origin __repo_file markdown urls without remote fetch proxy fallback')
  }
  if (!ingestText.includes('preferProxy: shouldPreferProxy')) {
    throw new Error('expected non-local url ingest to continue using proxy-preferred remote fetch fallback')
  }
}
