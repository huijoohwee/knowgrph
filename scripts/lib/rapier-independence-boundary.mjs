import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const DEPENDENCY_FILE_NAMES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock',
])
const SKIPPED_DIRECTORY_NAMES = new Set([
  '.git', '.worktrees', 'build', 'coverage', 'dist', 'node_modules',
])

const RAPIER_PACKAGE_REFERENCE = /@dimforge\/rapier(?:2d|3d)(?:-[a-z0-9._-]+)?/gi
const RAPIER_IMPLEMENTATION_MARKER = /rapier/i

export function findForbiddenRapierPackageReferences(source) {
  return Object.freeze([...new Set(
    String(source || '').match(RAPIER_PACKAGE_REFERENCE)?.map(value => value.toLowerCase()) || [],
  )].sort())
}

export async function discoverDependencyBoundaryPaths(repositoryRoot) {
  const paths = []
  async function visit(absDirectory, relDirectory = '') {
    const entries = await readdir(absDirectory, { withFileTypes: true })
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      const relPath = relDirectory ? `${relDirectory}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORY_NAMES.has(entry.name)) await visit(path.join(absDirectory, entry.name), relPath)
      } else if (entry.isFile() && DEPENDENCY_FILE_NAMES.has(entry.name)) {
        paths.push(relPath)
      }
    }
  }
  await visit(repositoryRoot)
  return Object.freeze(paths)
}

export async function assertRapierIndependentDependencyBoundary(repositoryRoot) {
  for (const relPath of await discoverDependencyBoundaryPaths(repositoryRoot)) {
    const source = await readFile(path.join(repositoryRoot, relPath), 'utf8')
    const references = findForbiddenRapierPackageReferences(source)
    if (references.length > 0) {
      throw new Error(
        `native physics must remain independent; forbidden Rapier package reference in ${relPath}: ${references.join(', ')}`,
      )
    }
  }
}

export function hasForbiddenRapierImplementationMarker(source) {
  return RAPIER_IMPLEMENTATION_MARKER.test(String(source || ''))
}

export async function assertRapierIndependentPhysicsSourceBoundary(repositoryRoot) {
  const sourceRoot = path.join(repositoryRoot, 'canvas/src/features/physics')
  const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:jsx?|mjs|tsx?)$/.test(entry.name)) continue
    const parentPath = entry.parentPath || entry.path || sourceRoot
    const absPath = path.join(parentPath, entry.name)
    const relPath = path.relative(repositoryRoot, absPath).split(path.sep).join('/')
    if (hasForbiddenRapierImplementationMarker(relPath)
      || hasForbiddenRapierImplementationMarker(await readFile(absPath, 'utf8'))) {
      throw new Error(`native physics source must remain independently named and authored: ${relPath}`)
    }
  }
}
