import fs from 'node:fs'
import path from 'node:path'
import {
  LEGACY_CANONICAL_TEST_VALIDATION_WORKSPACE_SEED_PATH,
  TEST_VALIDATION_WORKSPACE_SEED_BASENAME,
} from '@/features/workspace-fs/workspaceFs'

const DEFAULT_DOCS_SSOT_ROOT_SEGMENTS = ['..', '..', 'huijoohwee', 'docs'] as const

export const KNOWGRPH_VIDEO_DEMO_BASENAME = TEST_VALIDATION_WORKSPACE_SEED_BASENAME
export const KNOWGRPH_VIDEO_DEMO_WORKSPACE_PATH = LEGACY_CANONICAL_TEST_VALIDATION_WORKSPACE_SEED_PATH

export function resolveKnowgrphVideoDemoFixturePath(): string {
  return resolveDocsSsotFixturePath(KNOWGRPH_VIDEO_DEMO_BASENAME)
}

export function resolveDocsSsotRootPath(): string {
  const envRoot = String(process.env.KG_TEST_DOCS_SSOT_ROOT || '').trim()
  if (envRoot) return envRoot
  return path.resolve(process.cwd(), ...DEFAULT_DOCS_SSOT_ROOT_SEGMENTS)
}

export function resolveDocsSsotFixturePath(basename: string): string {
  const name = String(basename || '').trim()
  if (!name) throw new Error('expected docs fixture basename')
  return path.resolve(resolveDocsSsotRootPath(), name)
}

export function readDocsSsotFixtureText(basename: string): string {
  const fixturePath = resolveDocsSsotFixturePath(basename)
  return fs.readFileSync(fixturePath, 'utf8')
}
