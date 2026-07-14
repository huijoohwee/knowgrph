import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { readContract, repoRoot } from './collaboration-contract.mjs'

const runGit = (args, cwd) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    const detail = String(result.error?.message || result.stderr || result.stdout || '').trim()
    throw new Error(`git ${args.join(' ')} failed in ${cwd}${detail ? `: ${detail}` : ''}`)
  }
  return String(result.stdout || '').trim()
}

export const countRegisteredWorktrees = porcelain => String(porcelain || '')
  .split(/\r?\n/)
  .filter(line => line.startsWith('worktree '))
  .length

export const evaluateWorktreePolicy = (sourceStates, contract) => {
  const settings = contract.local_development
  const maximum = settings.worktree_policy.maximum_registered_per_repository
  const statesById = new Map(sourceStates.map(state => [state.id, state]))
  const sources = settings.canonical_sources.map(source => {
    const state = statesById.get(source.id)
    if (!state) throw new Error(`missing local worktree identity for ${source.id}`)
    if (state.worktreeCount !== maximum) {
      throw new Error(
        `${source.id} source requires exactly ${maximum} registered worktree per repository on this device; `
        + `found ${state.worktreeCount}. Remove redundant linked worktrees before continuing`,
      )
    }
    return { id: source.id, worktreeCount: state.worktreeCount }
  })

  return {
    message: `${settings.worktree_policy.mode} sources ${sources.map(source => (
      `${source.id}=${source.worktreeCount}`
    )).join('; ')}`,
    sources,
  }
}

export const checkWorktreePolicy = async ({
  cwd = repoRoot,
  git = runGit,
} = {}) => {
  const contract = await readContract()
  const sourceStates = contract.local_development.canonical_sources.map(source => {
    const sourceRoot = path.resolve(cwd, source.repository_path)
    return {
      id: source.id,
      worktreeCount: countRegisteredWorktrees(git(['worktree', 'list', '--porcelain'], sourceRoot)),
    }
  })
  return evaluateWorktreePolicy(sourceStates, contract)
}
