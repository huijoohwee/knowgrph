import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const checkMode = process.argv.includes('--check')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const knowgrphRoot = path.resolve(__dirname, '..')
const githubRoot = path.resolve(knowgrphRoot, '..')
const distDir = path.resolve(knowgrphRoot, 'canvas', 'dist')
const targetDir = path.resolve(githubRoot, 'huijoohwee', 'content', 'knowgrph')
const publicRouteDir = path.resolve(githubRoot, 'huijoohwee', 'knowgrph')
const redirectsPath = path.resolve(githubRoot, 'huijoohwee', '_redirects')
const publicManagedRootFiles = new Set([
  'favicon.svg',
  'index.html',
  'llms.txt',
  'manifest.webmanifest',
  'settings-flow.json',
  'sw.js',
])
const obsoleteLegacyMirrorDir = path.resolve(githubRoot, 'huijoohwee', '__' + 'repo_file')
const blockedRelativeRoots = new Set([
  'cesium',
  'demo',
  'examples',
  'vendor/mermaid',
])
const blockedRelativeFiles = new Set([
  'unicorn-investors-test.json',
])
const preservedRelativeRoots = new Set([
  'imports',
])
const GENERATED_REDIRECTS_START = '# BEGIN knowgrph generated top-level file routes'
const GENERATED_REDIRECTS_END = '# END knowgrph generated top-level file routes'

const existsDir = async (dir) => {
  try {
    const stat = await fs.stat(dir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

const toPosixRel = (rootDir, absolutePath) => path.relative(rootDir, absolutePath).split(path.sep).filter(Boolean).join('/')

const isAllowedRelativePath = (rel) => {
  if (!rel) return true
  if (blockedRelativeFiles.has(rel)) return false
  for (const blocked of blockedRelativeRoots) {
    if (rel === blocked || rel.startsWith(`${blocked}/`)) return false
  }
  return true
}

const isPreservedRelativePath = (rel) => {
  if (!rel) return false
  for (const preserved of preservedRelativeRoots) {
    if (rel === preserved || rel.startsWith(`${preserved}/`)) return true
  }
  return false
}

const isPublicManagedRelativePath = (rel) => {
  if (!rel) return false
  return rel.startsWith('assets/') || publicManagedRootFiles.has(rel)
}

const listFiles = async (rootDir) => {
  const out = []
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const abs = path.resolve(dir, entry.name)
      const rel = toPosixRel(rootDir, abs)
      if (!isAllowedRelativePath(rel)) continue
      if (entry.isDirectory()) {
        await walk(abs)
        continue
      }
      if (entry.isFile()) out.push(rel)
    }
  }
  await walk(rootDir)
  out.sort((a, b) => a.localeCompare(b))
  return out
}

const listAllFiles = async (rootDir) => {
  const out = []
  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const abs = path.resolve(dir, entry.name)
      const rel = toPosixRel(rootDir, abs)
      if (entry.isDirectory()) {
        await walk(abs)
        continue
      }
      if (entry.isFile()) out.push(rel)
    }
  }
  await walk(rootDir)
  return out
}

const fileHash = async (filePath) => {
  const buf = await fs.readFile(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

const addEntryScriptCacheKey = (html) =>
  html.replace(
    /(<script\b[^>]*\bsrc=")(\/knowgrph\/assets\/([^"?/]+\.js))(")/,
    (_match, prefix, assetPath, assetFile, suffix) => `${prefix}${assetPath}?v=${encodeURIComponent(assetFile)}${suffix}`,
  )

const readPublishContent = async (src, rel) => {
  const buf = await fs.readFile(src)
  if (rel !== 'index.html') return buf
  return Buffer.from(addEntryScriptCacheKey(buf.toString('utf8')), 'utf8')
}

const publishContentHash = async (src, rel) => {
  const buf = await readPublishContent(src, rel)
  return createHash('sha256').update(buf).digest('hex')
}

const fileNeedsUpdate = async (src, dest, rel) => {
  try {
    const [srcHash, dstHash] = await Promise.all([publishContentHash(src, rel), fileHash(dest)])
    return srcHash !== dstHash
  } catch {
    return true
  }
}

const copyIfChanged = async (src, dest, rel) => {
  const needsUpdate = await fileNeedsUpdate(src, dest, rel)
  if (!needsUpdate) return false
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, await readPublishContent(src, rel))
  return true
}

const removeEmptyDirs = async (rootDir) => {
  const walk = async (dir) => {
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      await walk(path.resolve(dir, entry.name))
    }
    if (dir === rootDir) return
    const after = await fs.readdir(dir).catch(() => [])
    if (after.length === 0) {
      await fs.rm(dir, { recursive: true, force: true })
    }
  }
  await walk(rootDir)
}

const buildKnowgrphRedirects = (existing, rootFiles) => {
  const generatedLines = [
    GENERATED_REDIRECTS_START,
    ...rootFiles.map(rel => `/knowgrph/${rel} /content/knowgrph/${rel} 200`),
    GENERATED_REDIRECTS_END,
  ]
  const nextBlock = generatedLines.join('\n')
  const managedBlockRegex = new RegExp(
    `${GENERATED_REDIRECTS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${GENERATED_REDIRECTS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  )
  let next = existing.replace(
    /^\/knowgrph\/\*\.js .*?\n^\/knowgrph\/\*\.mjs .*?\n^\/knowgrph\/\*\.css .*?\n^\/knowgrph\/\*\.svg .*?\n^\/knowgrph\/\*\.ico .*?\n^\/knowgrph\/\*\.json .*?\n^\/knowgrph\/\*\.wasm .*?\n^\/knowgrph\/\*\.txt .*?\n^\/knowgrph\/\*\.webmanifest .*?\n^\/knowgrph\/\*\.map .*?\n/gm,
    '',
  )
  if (managedBlockRegex.test(next)) {
    next = next.replace(managedBlockRegex, nextBlock)
  } else {
    const anchor = '/knowgrph/imports/* /content/knowgrph/imports/:splat 200'
    if (!next.includes(anchor)) {
      throw new Error(`Missing expected knowgrph redirects anchor in ${redirectsPath}`)
    }
    next = next.replace(anchor, `${anchor}\n${nextBlock}`)
  }
  return next
}

if (!(await existsDir(distDir))) {
  throw new Error(`Missing build output directory: ${distDir}`)
}

const sourceFiles = await listFiles(distDir)
const sourceSet = new Set(sourceFiles)
const filesToCopy = []
for (const rel of sourceFiles) {
  const src = path.resolve(distDir, rel)
  const dst = path.resolve(targetDir, rel)
  if (await fileNeedsUpdate(src, dst, rel)) filesToCopy.push(rel)
}

const filesToRemove = []
if (await existsDir(targetDir)) {
  const targetFiles = await listAllFiles(targetDir)
  for (const rel of targetFiles) {
    if (isPreservedRelativePath(rel)) continue
    if (sourceSet.has(rel)) continue
    filesToRemove.push(rel)
  }
}

const publicFilesToCopy = []
for (const rel of sourceFiles) {
  if (!isPublicManagedRelativePath(rel)) continue
  const src = path.resolve(distDir, rel)
  const dst = path.resolve(publicRouteDir, rel)
  if (await fileNeedsUpdate(src, dst, rel)) publicFilesToCopy.push(rel)
}
const publicFilesToRemove = []
if (await existsDir(publicRouteDir)) {
  const publicFiles = await listAllFiles(publicRouteDir)
  for (const rel of publicFiles) {
    if (!isPublicManagedRelativePath(rel)) continue
    if (sourceSet.has(rel)) continue
    publicFilesToRemove.push(rel)
  }
}
const rootFiles = sourceFiles
  .filter(rel => !rel.includes('/') && rel !== 'index.html' && !rel.startsWith('_'))
  .sort((a, b) => a.localeCompare(b))
const existingRedirects = await fs.readFile(redirectsPath, 'utf8')
const nextRedirects = buildKnowgrphRedirects(existingRedirects, rootFiles)
const redirectsNeedUpdate = nextRedirects !== existingRedirects

if (checkMode) {
  const hasDrift = (
    filesToCopy.length > 0 ||
    filesToRemove.length > 0 ||
    publicFilesToCopy.length > 0 ||
    publicFilesToRemove.length > 0 ||
    redirectsNeedUpdate ||
    await existsDir(obsoleteLegacyMirrorDir)
  )
  if (hasDrift) {
    console.error('[knowgrph] publish sync drift detected')
    if (filesToCopy.length > 0) {
      console.error(`  content files needing sync (${filesToCopy.length}):`)
      for (const rel of filesToCopy.slice(0, 20)) console.error(`  - ${rel}`)
      if (filesToCopy.length > 20) console.error(`  - ... ${filesToCopy.length - 20} more`)
    }
    if (filesToRemove.length > 0) {
      console.error(`  stale content files needing removal (${filesToRemove.length}):`)
      for (const rel of filesToRemove.slice(0, 20)) console.error(`  - ${rel}`)
      if (filesToRemove.length > 20) console.error(`  - ... ${filesToRemove.length - 20} more`)
    }
    if (publicFilesToCopy.length > 0) {
      console.error(`  public route files needing sync (${publicFilesToCopy.length}):`)
      for (const rel of publicFilesToCopy.slice(0, 20)) console.error(`  - ${rel}`)
      if (publicFilesToCopy.length > 20) console.error(`  - ... ${publicFilesToCopy.length - 20} more`)
    }
    if (publicFilesToRemove.length > 0) {
      console.error(`  stale public route files needing removal (${publicFilesToRemove.length}):`)
      for (const rel of publicFilesToRemove.slice(0, 20)) console.error(`  - ${rel}`)
      if (publicFilesToRemove.length > 20) console.error(`  - ... ${publicFilesToRemove.length - 20} more`)
    }
    if (redirectsNeedUpdate) console.error('  - `huijoohwee/_redirects` generated knowgrph block is out of sync')
    if (await existsDir(obsoleteLegacyMirrorDir)) {
      console.error('  - obsolete legacy publish directory still exists')
    }
    console.error('  fix: run `npm run pages:build-sync`')
    process.exitCode = 1
  } else {
    console.log('[knowgrph] publish sync is up to date')
  }
} else {
  await fs.mkdir(targetDir, { recursive: true })
  let copiedCount = 0
  for (const rel of sourceFiles) {
    const src = path.resolve(distDir, rel)
    const dst = path.resolve(targetDir, rel)
    const copied = await copyIfChanged(src, dst, rel)
    if (copied) copiedCount += 1
  }

  if (await existsDir(targetDir)) {
    for (const rel of filesToRemove) {
      await fs.rm(path.resolve(targetDir, rel), { force: true })
    }
    await removeEmptyDirs(targetDir)
  }

  await fs.mkdir(publicRouteDir, { recursive: true })
  let copiedPublicCount = 0
  for (const rel of sourceFiles) {
    if (!isPublicManagedRelativePath(rel)) continue
    const src = path.resolve(distDir, rel)
    const dst = path.resolve(publicRouteDir, rel)
    const copied = await copyIfChanged(src, dst, rel)
    if (copied) copiedPublicCount += 1
  }
  if (await existsDir(publicRouteDir)) {
    for (const rel of publicFilesToRemove) {
      await fs.rm(path.resolve(publicRouteDir, rel), { force: true })
    }
    await removeEmptyDirs(publicRouteDir)
  }
  if (redirectsNeedUpdate) {
    await fs.writeFile(redirectsPath, nextRedirects, 'utf8')
  }

  console.log(
    `[knowgrph] synced ${distDir} -> ${targetDir} (copied=${copiedCount}, removed=${filesToRemove.length}, publicCopied=${copiedPublicCount}, publicRemoved=${publicFilesToRemove.length}, redirectsUpdated=${redirectsNeedUpdate ? 'yes' : 'no'})`,
  )
}
