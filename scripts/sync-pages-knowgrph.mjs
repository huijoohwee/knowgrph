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
const youtubeTranscriptFunctionSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'youtube-transcript.mjs')
const youtubeTranscriptFunctionTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', '__youtube_transcript.js')
const videoFrameFunctionSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'video-frame.mjs')
const videoFrameFunctionTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', '__video_frame.js')
const agentReadyDocRouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'doc', '[[path]].js')
const agentReadyDefaultDocRouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'doc-default', '[[path]].js')
const agentReadyShareRouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'share', '[[path]].js')
const agentReadySharedSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'knowgrph-agent-ready-shared.mjs')
const agentReadyDiscoverySource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'knowgrph-agent-ready-discovery.mjs')
const agentReadyCommerceSource = path.resolve(knowgrphRoot, 'cloudflare', 'pages', 'knowgrph-agent-ready-commerce.mjs')
const agentReadySharedTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'knowgrph-agent-ready-shared.mjs')
const agentReadyDiscoveryTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'functions',
  'knowgrph',
  'knowgrph-agent-ready-discovery.mjs',
)
const agentReadyCommerceTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph', 'knowgrph-agent-ready-commerce.mjs')
const agentReadyCommerceX402RouteTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'api', 'payments', 'commerce', 'x402.js')
const agentReadyCommerceX402RouteBody = `import { buildKnowgrphX402PaymentRequiredResponse } from "../../../knowgrph/knowgrph-agent-ready-commerce.mjs";\n\nexport async function onRequest(context) {\n  return buildKnowgrphX402PaymentRequiredResponse(context.request, context.env || {});\n}\n`
const agentReadyRuntimeCopies = [[agentReadyCommerceSource, agentReadyCommerceTarget], ...['dist/payments/agenticCommerceSsot.js', 'dist/payments/stripePaymentSsot.js', 'dist/hash/signature.js', 'dist/hash/stringHash.js'].map(rel => [path.resolve(knowgrphRoot, 'grph-shared', rel), path.resolve(githubRoot, 'huijoohwee', 'grph-shared', rel)])]
const videoFrameSharedProviderSource = path.resolve(knowgrphRoot, 'grph-shared', 'dist', 'rich-media', 'providers.js')
const videoFrameSharedProviderTarget = path.resolve(githubRoot, 'huijoohwee', 'grph-shared', 'dist', 'rich-media', 'providers.js')
const rootAgentReadySharedTarget = path.resolve(githubRoot, 'huijoohwee', 'functions', 'knowgrph-agent-ready-shared.mjs')
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
const agentReadyPromptContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyPromptContract.mjs',
)
const agentReadyPromptContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyPromptContract.mjs',
)
const agentReadyResourceContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyResourceContract.mjs',
)
const agentReadyResourceContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphAgentReadyResourceContract.mjs',
)
const mcpAppsReadyContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'mcpAppsReadyContract.mjs',
)
const mcpAppsReadyContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'mcpAppsReadyContract.mjs',
)
const vdeoxplnContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphVdeoxplnContract.mjs',
)
const vdeoxplnContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'knowgrphVdeoxplnContract.mjs',
)
const sharedDocumentStructureInspectionSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'sharedDocumentStructureInspection.mjs',
)
const sharedDocumentStructureInspectionTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'sharedDocumentStructureInspection.mjs',
)
const agentSurfaceInspectionSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'agentSurfaceInspection.mjs',
)
const agentSurfaceInspectionTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'agentSurfaceInspection.mjs',
)
const webMcpLifecycleSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'webMcpLifecycle.mjs',
)
const webMcpLifecycleTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'webMcpLifecycle.mjs',
)
const publishedToolExecutorsSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'features',
  'agent-ready',
  'publishedToolExecutors.mjs',
)
const publishedToolExecutorsTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'features',
  'agent-ready',
  'publishedToolExecutors.mjs',
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
const knowgrphStorageSyncContractSource = path.resolve(
  knowgrphRoot,
  'canvas',
  'src',
  'lib',
  'storage',
  'knowgrphStorageSyncContract.ts',
)
const knowgrphStorageSyncContractTarget = path.resolve(
  githubRoot,
  'huijoohwee',
  'canvas',
  'src',
  'lib',
  'storage',
  'knowgrphStorageSyncContract.ts',
)
const sharedD1Source = path.resolve(knowgrphRoot, 'cloudflare', 'workers', 'shared', 'd1.ts')
const sharedD1Target = path.resolve(githubRoot, 'huijoohwee', 'cloudflare', 'workers', 'shared', 'd1.ts')
const sharedPublishedDocSource = path.resolve(knowgrphRoot, 'cloudflare', 'workers', 'shared', 'publishedDoc.ts')
const sharedPublishedDocTarget = path.resolve(githubRoot, 'huijoohwee', 'cloudflare', 'workers', 'shared', 'publishedDoc.ts')
const publicManagedRootFiles = new Set([
  'favicon.svg',
  'index.html',
  'llms.txt',
  'manifest.webmanifest',
  'settings-flow.json',
  'sw.js',
])
const obsoleteLegacyMirrorDir = path.resolve(githubRoot, 'huijoohwee', '__' + 'repo_file')
const joinRel = (...parts) => parts.join('/')
const joinToken = (...parts) => parts.join('')
const joinKebab = (...parts) => parts.join('-')
const obsoleteGeneratedMirrorFiles = new Set([
  joinRel('canvas', 'src', 'features', 'agent-ready', joinToken('knowgrph', 'Skill', 'Pack', 'Contract.mjs')),
  joinRel('canvas', 'src', 'features', 'chat', joinToken('knowgrph', 'Skill', 'Pack', 'ChatArtifacts.ts')),
  joinRel('canvas', 'src', 'features', 'panels', 'views', joinToken('skill', 'Pack', 'McpApiDocs.ts')),
  joinRel('docs', 'documents', joinKebab('knowgrph', 'skill', 'packs', 'prd', 'tad.md')),
  joinRel('scripts', joinKebab('check', 'skill', 'packs.mjs')),
])
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
const GENERATED_APP_SHELL_HEADERS_START = '# BEGIN knowgrph generated app-shell cache headers'
const GENERATED_APP_SHELL_HEADERS_END = '# END knowgrph generated app-shell cache headers'
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

const readPublishContent = async (src, rel) => {
  const buf = await fs.readFile(src)
  return buf
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

const copyPlainFile = async (src, dest) => fs.mkdir(path.dirname(dest), { recursive: true }).then(() => fs.copyFile(src, dest))
const writeTextFile = async (dest, body) => fs.mkdir(path.dirname(dest), { recursive: true }).then(() => fs.writeFile(dest, body, 'utf8'))
const fileExists = async (filePath) => {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
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
    '/knowgrph/share/* /knowgrph/share/:splat 200',
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
  const appShellHeaderLines = [
    GENERATED_APP_SHELL_HEADERS_START,
    '/content/knowgrph/index.html',
    '  Cache-Control: no-store, no-cache, no-transform, must-revalidate, max-age=0',
    '/content/knowgrph/manifest.webmanifest',
    '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
    '/content/knowgrph/sw.js',
    '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
    '/knowgrph',
    '  Cache-Control: no-store, no-cache, no-transform, must-revalidate, max-age=0',
    '/knowgrph/',
    '  Cache-Control: no-store, no-cache, no-transform, must-revalidate, max-age=0',
    '/knowgrph/index.html',
    '  Cache-Control: no-store, no-cache, no-transform, must-revalidate, max-age=0',
    '/knowgrph/manifest.webmanifest',
    '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
    '/knowgrph/sw.js',
    '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
    GENERATED_APP_SHELL_HEADERS_END,
  ]
  const appShellHeaderBlock = appShellHeaderLines.join('\n')
  const appShellHeaderBlockRegex = new RegExp(
    `${GENERATED_APP_SHELL_HEADERS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${GENERATED_APP_SHELL_HEADERS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
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
  let next = existing.replace(
    /^\/content\/knowgrph\/index\.html\n  Cache-Control: .*?\n(?:\n)?^\/knowgrph\n  Cache-Control: .*?\n(?:\n)?^\/knowgrph\/\n  Cache-Control: .*?\n(?:\n)?^\/knowgrph\/index\.html\n  Cache-Control: .*?\n(?:\n)?/gm,
    '',
  ).replace(
    /^\/content\/knowgrph\/manifest\.webmanifest\n  Cache-Control: .*?\n(?:\n)?^\/content\/knowgrph\/sw\.js\n  Cache-Control: .*?\n(?:\n)?^\/knowgrph\/manifest\.webmanifest\n  Cache-Control: .*?\n(?:\n)?^\/knowgrph\/sw\.js\n  Cache-Control: .*?\n(?:\n)?/gm,
    '',
  )
  if (staticArtifactBlockRegex.test(next)) {
    next = next.replace(staticArtifactBlockRegex, staticArtifactBlock)
  } else {
    const trimmed = next.endsWith('\n') ? next.trimEnd() : next
    next = `${trimmed}\n\n${staticArtifactBlock}\n`
  }
  if (appShellHeaderBlockRegex.test(next)) {
    next = next.replace(appShellHeaderBlockRegex, appShellHeaderBlock)
  } else {
    const trimmed = next.endsWith('\n') ? next.trimEnd() : next
    next = `${trimmed}\n\n${appShellHeaderBlock}\n`
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
const youtubeTranscriptFunctionNeedsUpdate = await plainFileNeedsUpdate(youtubeTranscriptFunctionSource, youtubeTranscriptFunctionTarget)
const videoFrameFunctionNeedsUpdate = await plainFileNeedsUpdate(videoFrameFunctionSource, videoFrameFunctionTarget)
const videoFrameSharedProviderNeedsUpdate = await plainFileNeedsUpdate(videoFrameSharedProviderSource, videoFrameSharedProviderTarget)
const agentReadyDocRouteNeedsUpdate = await textFileNeedsUpdate(agentReadyDocRouteBody, agentReadyDocRouteTarget)
const agentReadyDefaultDocRouteNeedsUpdate = await textFileNeedsUpdate(agentReadyDocRouteBody, agentReadyDefaultDocRouteTarget)
const agentReadyShareRouteNeedsUpdate = await textFileNeedsUpdate(agentReadyDocRouteBody, agentReadyShareRouteTarget)
const agentReadySharedNeedsUpdate = await plainFileNeedsUpdate(agentReadySharedSource, agentReadySharedTarget)
const agentReadyDiscoveryNeedsUpdate = await plainFileNeedsUpdate(agentReadyDiscoverySource, agentReadyDiscoveryTarget)
const rootAgentReadySharedNeedsUpdate = await plainFileNeedsUpdate(agentReadySharedSource, rootAgentReadySharedTarget)
const rootAgentReadyFunctionNeedsUpdate = await plainFileNeedsUpdate(rootAgentReadyFunctionSource, rootAgentReadyFunctionTarget)
const agentReadyToolContractNeedsUpdate = await plainFileNeedsUpdate(agentReadyToolContractSource, agentReadyToolContractTarget)
const agentReadyPromptContractNeedsUpdate = await plainFileNeedsUpdate(agentReadyPromptContractSource, agentReadyPromptContractTarget)
const agentReadyResourceContractNeedsUpdate = await plainFileNeedsUpdate(agentReadyResourceContractSource, agentReadyResourceContractTarget)
const mcpAppsReadyContractNeedsUpdate = await plainFileNeedsUpdate(mcpAppsReadyContractSource, mcpAppsReadyContractTarget)
const vdeoxplnContractNeedsUpdate = await plainFileNeedsUpdate(vdeoxplnContractSource, vdeoxplnContractTarget)
const sharedDocumentStructureInspectionNeedsUpdate = await plainFileNeedsUpdate(sharedDocumentStructureInspectionSource, sharedDocumentStructureInspectionTarget)
const agentSurfaceInspectionNeedsUpdate = await plainFileNeedsUpdate(agentSurfaceInspectionSource, agentSurfaceInspectionTarget)
const webMcpLifecycleNeedsUpdate = await plainFileNeedsUpdate(webMcpLifecycleSource, webMcpLifecycleTarget)
const publishedToolExecutorsNeedsUpdate = await plainFileNeedsUpdate(publishedToolExecutorsSource, publishedToolExecutorsTarget)
const publishedDocShareTokenNeedsUpdate = await plainFileNeedsUpdate(publishedDocShareTokenSource, publishedDocShareTokenTarget)
const knowgrphStorageSyncContractNeedsUpdate = await plainFileNeedsUpdate(knowgrphStorageSyncContractSource, knowgrphStorageSyncContractTarget)
const sharedD1NeedsUpdate = await plainFileNeedsUpdate(sharedD1Source, sharedD1Target)
const sharedPublishedDocNeedsUpdate = await plainFileNeedsUpdate(sharedPublishedDocSource, sharedPublishedDocTarget)
const agentReadyArtifacts = await buildAgentReadyStaticFiles()
const agentReadyStaticFilesToWrite = []
for (const [rel, artifact] of Object.entries(agentReadyArtifacts)) {
  const dst = path.resolve(githubRoot, 'huijoohwee', rel)
  if (await textFileNeedsUpdate(artifact.body, dst)) agentReadyStaticFilesToWrite.push(rel)
}
const obsoleteGeneratedMirrorFilesToRemove = []
for (const rel of obsoleteGeneratedMirrorFiles) {
  const dst = path.resolve(githubRoot, 'huijoohwee', rel)
  if (await fileExists(dst)) obsoleteGeneratedMirrorFilesToRemove.push(rel)
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
    youtubeTranscriptFunctionNeedsUpdate ||
    videoFrameFunctionNeedsUpdate ||
    videoFrameSharedProviderNeedsUpdate ||
    agentReadyDocRouteNeedsUpdate ||
    agentReadyDefaultDocRouteNeedsUpdate ||
    agentReadyShareRouteNeedsUpdate ||
    agentReadySharedNeedsUpdate ||
    agentReadyDiscoveryNeedsUpdate ||
    rootAgentReadySharedNeedsUpdate ||
    rootAgentReadyFunctionNeedsUpdate ||
    agentReadyToolContractNeedsUpdate ||
    agentReadyPromptContractNeedsUpdate ||
    agentReadyResourceContractNeedsUpdate ||
    mcpAppsReadyContractNeedsUpdate ||
    vdeoxplnContractNeedsUpdate ||
    sharedDocumentStructureInspectionNeedsUpdate ||
    agentSurfaceInspectionNeedsUpdate ||
    webMcpLifecycleNeedsUpdate ||
    publishedToolExecutorsNeedsUpdate ||
    publishedDocShareTokenNeedsUpdate ||
    knowgrphStorageSyncContractNeedsUpdate ||
    sharedD1NeedsUpdate ||
    sharedPublishedDocNeedsUpdate ||
    agentReadyStaticFilesToWrite.length > 0 ||
    obsoleteGeneratedMirrorFilesToRemove.length > 0 ||
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
    if (youtubeTranscriptFunctionNeedsUpdate) console.error('  - YouTube transcript Pages Function is out of sync')
    if (videoFrameFunctionNeedsUpdate) console.error('  - Video frame Pages Function is out of sync')
    if (videoFrameSharedProviderNeedsUpdate) console.error('  - Video frame shared provider helper is out of sync')
    if (agentReadyDocRouteNeedsUpdate) console.error('  - Knowgrph shared-doc Pages Function is out of sync')
    if (agentReadyDefaultDocRouteNeedsUpdate) console.error('  - Knowgrph default shared-doc Pages Function is out of sync')
    if (agentReadyShareRouteNeedsUpdate) console.error('  - Knowgrph opaque share Pages Function is out of sync')
    if (agentReadySharedNeedsUpdate) console.error('  - Knowgrph agent-ready shared markdown helper is out of sync')
    if (agentReadyDiscoveryNeedsUpdate) console.error('  - Knowgrph agent-ready discovery helper is out of sync')
    if (rootAgentReadySharedNeedsUpdate) console.error('  - Root agent-ready shared markdown helper is out of sync')
    if (rootAgentReadyFunctionNeedsUpdate) console.error('  - Root markdown negotiation Pages Function is out of sync')
    if (agentReadyToolContractNeedsUpdate) console.error('  - Knowgrph agent-ready shared tool contract is out of sync')
    if (agentReadyPromptContractNeedsUpdate) console.error('  - Knowgrph agent-ready shared prompt contract is out of sync')
    if (agentReadyResourceContractNeedsUpdate) console.error('  - Knowgrph agent-ready shared resource contract is out of sync')
    if (mcpAppsReadyContractNeedsUpdate) console.error('  - Knowgrph MCP Apps-ready shared contract is out of sync')
    if (vdeoxplnContractNeedsUpdate) console.error('  - Knowgrph vdeoxpln contract helper is out of sync')
    if (sharedDocumentStructureInspectionNeedsUpdate) console.error('  - Knowgrph shared document structure inspection helper is out of sync')
    if (agentSurfaceInspectionNeedsUpdate) console.error('  - Knowgrph agent surface inspection helper is out of sync')
    if (webMcpLifecycleNeedsUpdate) console.error('  - Knowgrph WebMCP lifecycle helper is out of sync')
    if (publishedToolExecutorsNeedsUpdate) console.error('  - Knowgrph published tool executor helper is out of sync')
    if (publishedDocShareTokenNeedsUpdate) console.error('  - Knowgrph published doc share token helper is out of sync')
    if (knowgrphStorageSyncContractNeedsUpdate) console.error('  - Knowgrph storage sync contract helper is out of sync')
    if (sharedD1NeedsUpdate) console.error('  - Shared D1 helper is out of sync')
    if (sharedPublishedDocNeedsUpdate) console.error('  - Shared published doc helper is out of sync')
    if (agentReadyStaticFilesToWrite.length > 0) {
      console.error(`  - root agent-ready static files needing sync (${agentReadyStaticFilesToWrite.length}):`)
      for (const rel of agentReadyStaticFilesToWrite.slice(0, 20)) console.error(`  - ${rel}`)
    }
    if (obsoleteGeneratedMirrorFilesToRemove.length > 0) {
      console.error(`  - obsolete generated mirror files needing removal (${obsoleteGeneratedMirrorFilesToRemove.length}):`)
      for (const rel of obsoleteGeneratedMirrorFilesToRemove.slice(0, 20)) console.error(`  - ${rel}`)
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
    await copyPlainFile(agentReadyFunctionSource, agentReadyFunctionTarget)
  }
  if (youtubeTranscriptFunctionNeedsUpdate) {
    await copyPlainFile(youtubeTranscriptFunctionSource, youtubeTranscriptFunctionTarget)
  }
  if (videoFrameFunctionNeedsUpdate) {
    await copyPlainFile(videoFrameFunctionSource, videoFrameFunctionTarget)
  }
  if (agentReadyDocRouteNeedsUpdate) {
    await writeTextFile(agentReadyDocRouteTarget, agentReadyDocRouteBody)
  }
  if (agentReadyDefaultDocRouteNeedsUpdate) {
    await writeTextFile(agentReadyDefaultDocRouteTarget, agentReadyDocRouteBody)
  }
  if (agentReadyShareRouteNeedsUpdate) {
    await writeTextFile(agentReadyShareRouteTarget, agentReadyDocRouteBody)
  }
  if (agentReadySharedNeedsUpdate) {
    await copyPlainFile(agentReadySharedSource, agentReadySharedTarget)
  }
  if (agentReadyDiscoveryNeedsUpdate) {
    await copyPlainFile(agentReadyDiscoverySource, agentReadyDiscoveryTarget)
  }
  for (const [src, dst] of agentReadyRuntimeCopies) {
    await copyPlainFile(src, dst)
  }
  if (videoFrameSharedProviderNeedsUpdate) {
    await copyPlainFile(videoFrameSharedProviderSource, videoFrameSharedProviderTarget)
  }
  await writeTextFile(agentReadyCommerceX402RouteTarget, agentReadyCommerceX402RouteBody)
  if (rootAgentReadySharedNeedsUpdate) {
    await copyPlainFile(agentReadySharedSource, rootAgentReadySharedTarget)
  }
  if (rootAgentReadyFunctionNeedsUpdate) {
    await copyPlainFile(rootAgentReadyFunctionSource, rootAgentReadyFunctionTarget)
  }
  if (agentReadyToolContractNeedsUpdate) {
    await copyPlainFile(agentReadyToolContractSource, agentReadyToolContractTarget)
  }
  if (agentReadyPromptContractNeedsUpdate) {
    await copyPlainFile(agentReadyPromptContractSource, agentReadyPromptContractTarget)
  }
  if (agentReadyResourceContractNeedsUpdate) {
    await copyPlainFile(agentReadyResourceContractSource, agentReadyResourceContractTarget)
  }
  if (mcpAppsReadyContractNeedsUpdate) {
    await copyPlainFile(mcpAppsReadyContractSource, mcpAppsReadyContractTarget)
  }
  if (vdeoxplnContractNeedsUpdate) {
    await copyPlainFile(vdeoxplnContractSource, vdeoxplnContractTarget)
  }
  if (sharedDocumentStructureInspectionNeedsUpdate) {
    await copyPlainFile(sharedDocumentStructureInspectionSource, sharedDocumentStructureInspectionTarget)
  }
  if (agentSurfaceInspectionNeedsUpdate) {
    await copyPlainFile(agentSurfaceInspectionSource, agentSurfaceInspectionTarget)
  }
  if (webMcpLifecycleNeedsUpdate) {
    await copyPlainFile(webMcpLifecycleSource, webMcpLifecycleTarget)
  }
  if (publishedToolExecutorsNeedsUpdate) {
    await copyPlainFile(publishedToolExecutorsSource, publishedToolExecutorsTarget)
  }
  if (publishedDocShareTokenNeedsUpdate) {
    await copyPlainFile(publishedDocShareTokenSource, publishedDocShareTokenTarget)
  }
  if (knowgrphStorageSyncContractNeedsUpdate) {
    await copyPlainFile(knowgrphStorageSyncContractSource, knowgrphStorageSyncContractTarget)
  }
  if (sharedD1NeedsUpdate) {
    await copyPlainFile(sharedD1Source, sharedD1Target)
  }
  if (sharedPublishedDocNeedsUpdate) {
    await copyPlainFile(sharedPublishedDocSource, sharedPublishedDocTarget)
  }
  let agentReadyStaticUpdated = 0
  for (const rel of agentReadyStaticFilesToWrite) {
    const artifact = agentReadyArtifacts[rel]
    const dst = path.resolve(githubRoot, 'huijoohwee', rel)
    await writeTextFile(dst, artifact.body)
    agentReadyStaticUpdated += 1
  }
  let obsoleteGeneratedMirrorFilesRemoved = 0
  for (const rel of obsoleteGeneratedMirrorFilesToRemove) {
    await fs.rm(path.resolve(githubRoot, 'huijoohwee', rel), { force: true })
    obsoleteGeneratedMirrorFilesRemoved += 1
  }
  if (headersNeedUpdate) {
    await fs.writeFile(headersPath, nextHeaders, 'utf8')
  }

  console.log(
    `[knowgrph] synced ${distDir} -> ${targetDir} (copied=${copiedCount}, removed=${filesToRemove.length}, publicCopied=${copiedPublicCount}, publicRemoved=${publicFilesToRemove.length}, redirectsUpdated=${redirectsNeedUpdate ? 'yes' : 'no'}, headersUpdated=${headersNeedUpdate ? 'yes' : 'no'}, agentReadyFunctionUpdated=${agentReadyFunctionNeedsUpdate ? 'yes' : 'no'}, youtubeTranscriptFunctionUpdated=${youtubeTranscriptFunctionNeedsUpdate ? 'yes' : 'no'}, videoFrameFunctionUpdated=${videoFrameFunctionNeedsUpdate ? 'yes' : 'no'}, videoFrameSharedProviderUpdated=${videoFrameSharedProviderNeedsUpdate ? 'yes' : 'no'}, agentReadyDocRouteUpdated=${agentReadyDocRouteNeedsUpdate ? 'yes' : 'no'}, agentReadyDefaultDocRouteUpdated=${agentReadyDefaultDocRouteNeedsUpdate ? 'yes' : 'no'}, agentReadyShareRouteUpdated=${agentReadyShareRouteNeedsUpdate ? 'yes' : 'no'}, agentReadySharedUpdated=${agentReadySharedNeedsUpdate ? 'yes' : 'no'}, agentReadyDiscoveryUpdated=${agentReadyDiscoveryNeedsUpdate ? 'yes' : 'no'}, rootAgentReadySharedUpdated=${rootAgentReadySharedNeedsUpdate ? 'yes' : 'no'}, rootAgentReadyFunctionUpdated=${rootAgentReadyFunctionNeedsUpdate ? 'yes' : 'no'}, agentReadyToolContractUpdated=${agentReadyToolContractNeedsUpdate ? 'yes' : 'no'}, agentReadyPromptContractUpdated=${agentReadyPromptContractNeedsUpdate ? 'yes' : 'no'}, agentReadyResourceContractUpdated=${agentReadyResourceContractNeedsUpdate ? 'yes' : 'no'}, mcpAppsReadyContractUpdated=${mcpAppsReadyContractNeedsUpdate ? 'yes' : 'no'}, vdeoxplnContractUpdated=${vdeoxplnContractNeedsUpdate ? 'yes' : 'no'}, sharedDocumentStructureInspectionUpdated=${sharedDocumentStructureInspectionNeedsUpdate ? 'yes' : 'no'}, agentSurfaceInspectionUpdated=${agentSurfaceInspectionNeedsUpdate ? 'yes' : 'no'}, webMcpLifecycleUpdated=${webMcpLifecycleNeedsUpdate ? 'yes' : 'no'}, publishedToolExecutorsUpdated=${publishedToolExecutorsNeedsUpdate ? 'yes' : 'no'}, publishedDocShareTokenUpdated=${publishedDocShareTokenNeedsUpdate ? 'yes' : 'no'}, knowgrphStorageSyncContractUpdated=${knowgrphStorageSyncContractNeedsUpdate ? 'yes' : 'no'}, sharedD1Updated=${sharedD1NeedsUpdate ? 'yes' : 'no'}, sharedPublishedDocUpdated=${sharedPublishedDocNeedsUpdate ? 'yes' : 'no'}, agentReadyStaticUpdated=${agentReadyStaticUpdated}, obsoleteGeneratedMirrorFilesRemoved=${obsoleteGeneratedMirrorFilesRemoved})`,
  )
}
