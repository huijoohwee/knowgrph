import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const knowgrphRoot = path.resolve(__dirname, '..')
const githubRoot = path.resolve(knowgrphRoot, '..')
const syncMapPath = path.resolve(githubRoot, 'huijoohwee.github.io', 'schema', 'AgenticRAG', 'sync_map.py')

const ignoredDirNames = new Set([
  '.git',
  '.idea',
  '.next',
  '.turbo',
  '.vscode',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

const ignoredRelativeRoots = new Set([
  'canvas/dist',
])

const textExtensions = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.jsonld',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.sh',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
  '.py',
])

const textBasenames = new Set([
  '.env.example',
  '.eslintrc',
  '.eslintrc.json',
  '.gitignore',
  '.prettierignore',
  'README',
  'README.md',
])

const toPosixRel = absolutePath => path.relative(knowgrphRoot, absolutePath).split(path.sep).filter(Boolean).join('/')

const isIgnoredRelativePath = rel => {
  for (const root of ignoredRelativeRoots) {
    if (rel === root || rel.startsWith(`${root}/`)) return true
  }
  return false
}

const isTextFile = absolutePath => {
  const ext = path.extname(absolutePath).toLowerCase()
  const base = path.basename(absolutePath)
  return textExtensions.has(ext) || textBasenames.has(base)
}

const listTextFiles = async rootDir => {
  const out = []
  const walk = async dir => {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (ignoredDirNames.has(entry.name)) continue
      const abs = path.resolve(dir, entry.name)
      const rel = toPosixRel(abs)
      if (isIgnoredRelativePath(rel)) continue
      if (entry.isDirectory()) {
        await walk(abs)
        continue
      }
      if (!entry.isFile() || !isTextFile(abs)) continue
      out.push(abs)
    }
  }
  await walk(rootDir)
  out.sort((a, b) => a.localeCompare(b))
  return out
}

const findConflictMarkers = async () => {
  const files = await listTextFiles(knowgrphRoot)
  const out = []
  for (const filePath of files) {
    const text = await fs.readFile(filePath, 'utf8')
    const lines = text.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (
        line.startsWith('<<<<<<<') ||
        line.startsWith('=======') ||
        line.startsWith('>>>>>>>')
      ) {
        out.push(`${toPosixRel(filePath)}:${index + 1}`)
      }
    }
  }
  return out
}

const runCommand = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
  child.on('error', reject)
  child.on('close', code => resolve(code ?? 1))
})

const main = async () => {
  const conflictMarkers = await findConflictMarkers()
  if (conflictMarkers.length > 0) {
    console.error('[knowgrph] unresolved merge markers detected:')
    for (const entry of conflictMarkers.slice(0, 50)) console.error(`  - ${entry}`)
    if (conflictMarkers.length > 50) {
      console.error(`  - ... ${conflictMarkers.length - 50} more`)
    }
    process.exit(1)
  }

  const syncExitCode = await runCommand(
    process.execPath,
    [path.resolve(__dirname, 'sync-pages-knowgrph.mjs'), '--check'],
    knowgrphRoot,
  )
  if (syncExitCode !== 0) process.exit(syncExitCode)

  try {
    await fs.access(syncMapPath)
    const schemaExitCode = await runCommand(
      'python3',
      [syncMapPath, '--mode', 'check'],
      githubRoot,
    )
    if (schemaExitCode !== 0) process.exit(schemaExitCode)
  } catch {
    console.log('[knowgrph] schema sync check skipped (sibling AgenticRAG repo not available)')
  }

  console.log('[knowgrph] conflict-resolution compliance checks passed')
}

await main()
