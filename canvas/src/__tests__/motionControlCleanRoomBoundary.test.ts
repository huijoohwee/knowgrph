import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const FORBIDDEN_REFERENCE_TOKENS = Object.freeze([
  'andrisgauracs',
  'litert.js-mocap',
  'github.com/andrisgauracs',
] as const)

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : []
  })
}

export function testMotionControlProductionRemainsCleanRoomAndDependencyFree(): void {
  const canvasRoot = process.cwd()
  const repositoryRoot = resolve(canvasRoot, '..')
  const productionFiles = [
    ...sourceFiles(resolve(canvasRoot, 'src', 'features', 'three')),
    resolve(canvasRoot, 'src', 'features', 'agent-ready', 'motionControlAgentReadyContract.mjs'),
  ]
  const production = productionFiles
    .map(path => readFileSync(path, 'utf8'))
    .join('\n')
    .toLowerCase()
  const dependencies = [
    resolve(repositoryRoot, 'package.json'),
    resolve(repositoryRoot, 'package-lock.json'),
    resolve(canvasRoot, 'package.json'),
  ].map(path => readFileSync(path, 'utf8')).join('\n').toLowerCase()

  for (const token of FORBIDDEN_REFERENCE_TOKENS) {
    if (production.includes(token) || dependencies.includes(token)) {
      throw new Error(`expected clean-room Motion Control production and dependencies to exclude ${token}`)
    }
  }
}
