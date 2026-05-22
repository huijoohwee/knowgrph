import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {
  agentReadyHomepageLinkHeaderValue,
  buildAgentReadyStaticFiles,
} from '../cloudflare/pages/knowgrph-agent-ready.mjs'

const checkMode = process.argv.includes('--check')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const knowgrphRoot = path.resolve(__dirname, '..')
const githubRoot = path.resolve(knowgrphRoot, '..')
const distDir = path.resolve(knowgrphRoot, 'canvas', 'dist')
const targetDir = path.resolve(githubRoot, 'huijoohwee', 'content', 'knowgrph')
const publicRouteDir = path.resolve(githubRoot, 'huijoohwee', 'knowgrph')
const redirectsPath = path.resolve(githubRoot, 'huijoohwee', '_redirects')
const headersPath = path.resolve(githubRoot, 'huijoohwee', '_headers')
const agentReadyFunctionSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'knowgrph-agent-ready.mjs')
const agentReadyFunctionTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', '[[path]].js')
const agentReadyDocRouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'doc', '[[path]].js')
const agentReadyDefaultDocRouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'doc-default', '[[path]].js')
const agentReadySharedSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'knowgrph-agent-ready-shared.mjs')
const agentReadySharedTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'functions',
  'knowgrph',
  'knowgrph-agent-ready-shared.mjs',
)
const rootAgentReadySharedTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'functions',
  'knowgrph-agent-ready-shared.mjs',
)
const rootAgentReadyFunctionSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'root-agent-ready-index.mjs')
const rootAgentReadyFunctionTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'index.js')
const agentReadyToolContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyToolContract.mjs',
)
const agentReadyToolContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyToolContract.mjs',
)
const publishedDocShareTokenSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'canvas',
  'canvasDocShareToken.mjs',
)
const publishedDocShareTokenTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'canvas',
  'canvasDocShareToken.mjs',
)
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
  '_headers',
  '_redirects',
  'unicorn-investors-test.json',
])
const preservedRelativeRoots = new Set([
  'imports',
])
const GENERATED_REDIRECTS_START = '# BEGIN knowgrph generated top-level file routes'
const GENERATED_REDIRECTS_END = '# END knowgrph generated top-level file routes'
const GENERATED_AGENT_HEADERS_START = '# BEGIN knowgrph generated agent-ready headers'
const GENERATED_AGENT_HEADERS_END = '# END knowgrph generated agent-ready headers'
const GENERATED_AGENT_HOMEPAGE_HEADERS_START = '# BEGIN knowgrph generated homepage discovery headers'
const GENERATED_AGENT_HOMEPAGE_HEADERS_END = '# END knowgrph generated homepage discovery headers'
const agentReadyDocRouteBody = `import { onRequest as onKnowgrphAgentReadyRequest } from "../[[path]].js";

export async function onRequest(context) {
  return onKnowgrphAgentReadyRequest(context);
}
`

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

const textHash = (value) => createHash('sha256').update(value).digest('hex')

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

const plainFileNeedsUpdate = async (src, dest) => {
  try {
    const [srcHash, dstHash] = await Promise.all([fileHash(src), fileHash(dest)])
    return srcHash !== dstHash
  } catch {
    return true
  }
}

const textFileNeedsUpdate = async (body, dest) => {
  try {
    return textHash(body) !== await fileHash(dest)
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
    '/knowgrph /knowgrph 200',
    '/knowgrph/ /knowgrph/ 200',
    '/knowgrph/doc/* /knowgrph/doc/:splat 200',
    '/knowgrph/doc-default/* /knowgrph/doc-default/:splat 200',
    '/knowgrph/mcp /knowgrph/mcp 200',
    '/knowgrph/robots.txt /knowgrph/robots.txt 200',
    '/knowgrph/sitemap.xml /knowgrph/sitemap.xml 200',
    '/knowgrph/.well-known/* /knowgrph/.well-known/:splat 200',
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

const buildAgentReadyHeaders = (existing, artifacts) => {
  const staticArtifactHeaderLines = [
    GENERATED_AGENT_HEADERS_START,
    ...Object.entries(artifacts).flatMap(([rel, artifact]) => [
      `/${rel}`,
      `  Content-Type: ${artifact.contentType}`,
      '  Cache-Control: public, max-age=3600',
    ]),
    GENERATED_AGENT_HEADERS_END,
  ]
  const staticArtifactBlock = staticArtifactHeaderLines.join('\n')
  const staticArtifactBlockRegex = new RegExp(
    `${GENERATED_AGENT_HEADERS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${GENERATED_AGENT_HEADERS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  )
  const homepageHeaderLines = [
    GENERATED_AGENT_HOMEPAGE_HEADERS_START,
    '/',
    `  Link: ${agentReadyHomepageLinkHeaderValue}`,
    '/index.html',
    `  Link: ${agentReadyHomepageLinkHeaderValue}`,
    GENERATED_AGENT_HOMEPAGE_HEADERS_END,
  ]
  const homepageHeaderBlock = homepageHeaderLines.join('\n')
  const homepageHeaderBlockRegex = new RegExp(
    `${GENERATED_AGENT_HOMEPAGE_HEADERS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${GENERATED_AGENT_HOMEPAGE_HEADERS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  )
  let next = existing
  if (staticArtifactBlockRegex.test(next)) {
    next = next.replace(staticArtifactBlockRegex, staticArtifactBlock)
  } else {
    const trimmed = next.endsWith('\n') ? next.trimEnd() : next
    next = `${trimmed}\n\n${staticArtifactBlock}\n`
  }
  if (homepageHeaderBlockRegex.test(next)) {
    return next.replace(homepageHeaderBlockRegex, homepageHeaderBlock)
  }
  const trimmed = next.endsWith('\n') ? next.trimEnd() : next
  return `${trimmed}\n\n${homepageHeaderBlock}\n`
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
const agentReadyFunctionNeedsUpdate = await plainFileNeedsUpdate(agentReadyFunctionSource, agentReadyFunctionTarget)
const agentReadyDocRouteNeedsUpdate = await textFileNeedsUpdate(agentReadyDocRouteBody, agentReadyDocRouteTarget)
const agentReadyDefaultDocRouteNeedsUpdate = await textFileNeedsUpdate(agentReadyDocRouteBody, agentReadyDefaultDocRouteTarget)
const agentReadySharedNeedsUpdate = await plainFileNeedsUpdate(agentReadySharedSource, agentReadySharedTarget)
const rootAgentReadySharedNeedsUpdate = await plainFileNeedsUpdate(
  agentReadySharedSource,
  rootAgentReadySharedTarget,
)
const rootAgentReadyFunctionNeedsUpdate = await plainFileNeedsUpdate(
  rootAgentReadyFunctionSource,
  rootAgentReadyFunctionTarget,
)
const agentReadyToolContractNeedsUpdate = await plainFileNeedsUpdate(
  agentReadyToolContractSource,
  agentReadyToolContractTarget,
)
const publishedDocShareTokenNeedsUpdate = await plainFileNeedsUpdate(
  publishedDocShareTokenSource,
  publishedDocShareTokenTarget,
)
const agentReadyArtifacts = await buildAgentReadyStaticFiles()
const agentReadyStaticFilesToWrite = []
for (const [rel, artifact] of Object.entries(agentReadyArtifacts)) {
  const dst = path.resolve(githubRoot, 'huijoohwee', rel)
  if (await textFileNeedsUpdate(artifact.body, dst)) agentReadyStaticFilesToWrite.push(rel)
}
const existingHeaders = await fs.readFile(headersPath, 'utf8')
const nextHeaders = buildAgentReadyHeaders(existingHeaders, agentReadyArtifacts)
const headersNeedUpdate = nextHeaders !== existingHeaders

if (checkMode) {
  const hasDrift = (
    filesToCopy.length > 0 ||
    filesToRemove.length > 0 ||
    publicFilesToCopy.length > 0 ||
    publicFilesToRemove.length > 0 ||
    redirectsNeedUpdate ||
    agentReadyFunctionNeedsUpdate ||
    agentReadyDocRouteNeedsUpdate ||
    agentReadyDefaultDocRouteNeedsUpdate ||
    agentReadySharedNeedsUpdate ||
    rootAgentReadySharedNeedsUpdate ||
    rootAgentReadyFunctionNeedsUpdate ||
    agentReadyToolContractNeedsUpdate ||
    publishedDocShareTokenNeedsUpdate ||
    agentReadyStaticFilesToWrite.length > 0 ||
    headersNeedUpdate ||
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
    if (agentReadyFunctionNeedsUpdate) console.error('  - Knowgrph agent-ready Pages Function is out of sync')
    if (agentReadyDocRouteNeedsUpdate) console.error('  - Knowgrph shared-doc Pages Function is out of sync')
    if (agentReadyDefaultDocRouteNeedsUpdate) console.error('  - Knowgrph default shared-doc Pages Function is out of sync')
    if (agentReadySharedNeedsUpdate) console.error('  - Knowgrph agent-ready shared markdown helper is out of sync')
    if (rootAgentReadySharedNeedsUpdate) console.error('  - Root agent-ready shared markdown helper is out of sync')
    if (rootAgentReadyFunctionNeedsUpdate) console.error('  - Root markdown negotiation Pages Function is out of sync')
    if (agentReadyToolContractNeedsUpdate) console.error('  - Knowgrph agent-ready shared tool contract is out of sync')
    if (publishedDocShareTokenNeedsUpdate) console.error('  - Knowgrph published doc share token helper is out of sync')
    if (agentReadyStaticFilesToWrite.length > 0) {
      console.error(`  - root agent-ready static files needing sync (${agentReadyStaticFilesToWrite.length}):`)
      for (const rel of agentReadyStaticFilesToWrite.slice(0, 20)) console.error(`  - ${rel}`)
    }
    if (headersNeedUpdate) console.error('  - `huijoohwee/_headers` generated agent-ready block is out of sync')
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
  if (agentReadyFunctionNeedsUpdate) {
    await fs.mkdir(path.dirname(agentReadyFunctionTarget), { recursive: true })
    await fs.copyFile(agentReadyFunctionSource, agentReadyFunctionTarget)
  }
  if (agentReadyDocRouteNeedsUpdate) {
    await fs.mkdir(path.dirname(agentReadyDocRouteTarget), { recursive: true })
    await fs.writeFile(agentReadyDocRouteTarget, agentReadyDocRouteBody, 'utf8')
  }
  if (agentReadyDefaultDocRouteNeedsUpdate) {
    await fs.mkdir(path.dirname(agentReadyDefaultDocRouteTarget), { recursive: true })
    await fs.writeFile(agentReadyDefaultDocRouteTarget, agentReadyDocRouteBody, 'utf8')
  }
  if (agentReadySharedNeedsUpdate) {
    await fs.mkdir(path.dirname(agentReadySharedTarget), { recursive: true })
    await fs.copyFile(agentReadySharedSource, agentReadySharedTarget)
  }
  if (rootAgentReadySharedNeedsUpdate) {
    await fs.mkdir(path.dirname(rootAgentReadySharedTarget), { recursive: true })
    await fs.copyFile(agentReadySharedSource, rootAgentReadySharedTarget)
  }
  if (rootAgentReadyFunctionNeedsUpdate) {
    await fs.mkdir(path.dirname(rootAgentReadyFunctionTarget), { recursive: true })
    await fs.copyFile(rootAgentReadyFunctionSource, rootAgentReadyFunctionTarget)
  }
  if (agentReadyToolContractNeedsUpdate) {
    await fs.mkdir(path.dirname(agentReadyToolContractTarget), { recursive: true })
    await fs.copyFile(agentReadyToolContractSource, agentReadyToolContractTarget)
  }
  if (publishedDocShareTokenNeedsUpdate) {
    await fs.mkdir(path.dirname(publishedDocShareTokenTarget), { recursive: true })
    await fs.copyFile(publishedDocShareTokenSource, publishedDocShareTokenTarget)
  }
  let agentReadyStaticUpdated = 0
  for (const rel of agentReadyStaticFilesToWrite) {
    const artifact = agentReadyArtifacts[rel]
    const dst = path.resolve(githubRoot, 'huijoohwee', rel)
    await fs.mkdir(path.dirname(dst), { recursive: true })
    await fs.writeFile(dst, artifact.body, 'utf8')
    agentReadyStaticUpdated += 1
  }
  if (headersNeedUpdate) {
    await fs.writeFile(headersPath, nextHeaders, 'utf8')
  }

  console.log(
    `[knowgrph] synced ${distDir} -> ${targetDir} (copied=${copiedCount}, removed=${filesToRemove.length}, publicCopied=${copiedPublicCount}, publicRemoved=${publicFilesToRemove.length}, redirectsUpdated=${redirectsNeedUpdate ? 'yes' : 'no'}, headersUpdated=${headersNeedUpdate ? 'yes' : 'no'}, agentReadyFunctionUpdated=${agentReadyFunctionNeedsUpdate ? 'yes' : 'no'}, agentReadyDocRouteUpdated=${agentReadyDocRouteNeedsUpdate ? 'yes' : 'no'}, agentReadyDefaultDocRouteUpdated=${agentReadyDefaultDocRouteNeedsUpdate ? 'yes' : 'no'}, agentReadySharedUpdated=${agentReadySharedNeedsUpdate ? 'yes' : 'no'}, rootAgentReadySharedUpdated=${rootAgentReadySharedNeedsUpdate ? 'yes' : 'no'}, rootAgentReadyFunctionUpdated=${rootAgentReadyFunctionNeedsUpdate ? 'yes' : 'no'}, agentReadyToolContractUpdated=${agentReadyToolContractNeedsUpdate ? 'yes' : 'no'}, publishedDocShareTokenUpdated=${publishedDocShareTokenNeedsUpdate ? 'yes' : 'no'}, agentReadyStaticUpdated=${agentReadyStaticUpdated})`,
  )
}
