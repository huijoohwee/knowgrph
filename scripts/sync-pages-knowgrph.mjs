import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const knowgrphRoot = path.resolve(__dirname, '..')
const githubRoot = path.resolve(knowgrphRoot, '..')
const distDir = path.resolve(knowgrphRoot, 'canvas', 'dist')
const targetDir = path.resolve(githubRoot, 'huijoohwee', 'content', 'knowgrph')
const publicRouteDir = path.resolve(githubRoot, 'huijoohwee', 'knowgrph')
const repoFileTargetDir = path.resolve(githubRoot, 'huijoohwee', '__repo_file')
const redirectsPath = path.resolve(githubRoot, 'huijoohwee', '_redirects')
const repoFileSeeds = [
  { source: path.resolve(knowgrphRoot, 'README.md'), target: path.resolve(repoFileTargetDir, 'README.md') },
  {
    source: path.resolve(githubRoot, 'sandbox', 'test-data', 'knowgrph-rich-media-generation-demo.md'),
    target: path.resolve(repoFileTargetDir, 'sandbox', 'test-data', 'knowgrph-rich-media-generation-demo.md'),
  },
]
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

const copyIfChanged = async (src, dest) => {
  let same = false
  try {
    const [srcHash, dstHash] = await Promise.all([fileHash(src), fileHash(dest)])
    same = srcHash === dstHash
  } catch {
    same = false
  }
  if (same) return false
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.copyFile(src, dest)
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

const updateKnowgrphRedirects = async (rootFiles) => {
  const existing = await fs.readFile(redirectsPath, 'utf8')
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
  if (next !== existing) {
    await fs.writeFile(redirectsPath, next, 'utf8')
  }
}

if (!(await existsDir(distDir))) {
  throw new Error(`Missing build output directory: ${distDir}`)
}

await fs.mkdir(targetDir, { recursive: true })
const sourceFiles = await listFiles(distDir)
const sourceSet = new Set(sourceFiles)
let copiedCount = 0
for (const rel of sourceFiles) {
  const src = path.resolve(distDir, rel)
  const dst = path.resolve(targetDir, rel)
  const copied = await copyIfChanged(src, dst)
  if (copied) copiedCount += 1
}

if (await existsDir(targetDir)) {
  const targetFiles = await listAllFiles(targetDir)
  for (const rel of targetFiles) {
    if (isPreservedRelativePath(rel)) continue
    if (sourceSet.has(rel)) continue
    await fs.rm(path.resolve(targetDir, rel), { force: true })
  }
  await removeEmptyDirs(targetDir)
}

await fs.mkdir(publicRouteDir, { recursive: true })
const publicIndex = path.resolve(publicRouteDir, 'index.html')
const copiedPublicIndex = await copyIfChanged(path.resolve(targetDir, 'index.html'), publicIndex)
const rootFiles = sourceFiles
  .filter(rel => !rel.includes('/') && rel !== 'index.html' && !rel.startsWith('_'))
  .sort((a, b) => a.localeCompare(b))
await updateKnowgrphRedirects(rootFiles)

let copiedRepoSeedCount = 0
for (const entry of repoFileSeeds) {
  const copied = await copyIfChanged(entry.source, entry.target)
  if (copied) copiedRepoSeedCount += 1
}

console.log(
  `[knowgrph] synced ${distDir} -> ${targetDir} (copied=${copiedCount}, publicIndexUpdated=${copiedPublicIndex ? 'yes' : 'no'}, repoFileSeedsUpdated=${copiedRepoSeedCount})`,
)
