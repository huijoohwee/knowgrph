import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { readContract, repoRoot, validateTaskBranch } from './collaboration-contract.mjs'
import { countRegisteredWorktrees, evaluateWorktreePolicy } from './worktree-policy.mjs'

const runGit = (args, cwd) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
  return String(result.stdout || '').trim()
}

const canonicalRef = source => `${source.canonical_remote}/${source.canonical_branch}`

const requireCanonicalSource = (state, source) => {
  if (source.clean_required && state.status) {
    throw new Error(`${source.id} source requires a clean worktree; commit, stash, or remove local changes first`)
  }
  if (state.headSha !== state.canonicalSha) {
    const recovery = !state.status && state.branch === source.canonical_branch
      ? ' Run npm run dev:latest to fast-forward clean canonical checkouts safely.'
      : ''
    throw new Error(
      `${source.id} canonical Dev source mismatch: HEAD ${state.headSha} != ${canonicalRef(source)} ${state.canonicalSha}. `
      + `Update the ${source.id} checkout to the fetched canonical revision.${recovery}`,
    )
  }
  return `${source.id}=${canonicalRef(source)}@${state.canonicalSha.slice(0, 12)}`
}

export const evaluateDevSourceConsistency = (sourceStates, contract, mode) => {
  const settings = contract.local_development
  if (mode !== settings.canonical_mode && mode !== settings.task_mode) {
    throw new Error(
      `${settings.mode_environment_variable} must be ${settings.canonical_mode} or ${settings.task_mode}; received ${mode}`,
    )
  }

  evaluateWorktreePolicy(sourceStates, contract)
  const statesById = new Map(sourceStates.map(state => [state.id, state]))
  const identities = settings.canonical_sources.map(source => {
    const state = statesById.get(source.id)
    if (!state) throw new Error(`missing local source identity for ${source.id}`)
    if (mode === settings.task_mode && source.task_divergence_allowed) {
      validateTaskBranch(state.branch, contract)
      return `${source.id}=task:${state.branch}@${state.headSha.slice(0, 12)} (canonical ${canonicalRef(source)}@${state.canonicalSha.slice(0, 12)})`
    }
    return requireCanonicalSource(state, source)
  })

  return {
    canonical: mode === settings.canonical_mode,
    message: `${mode} sources ${identities.join('; ')}`,
  }
}

const requirePath = async targetPath => fs.access(targetPath)

export const checkDevSourceConsistency = async ({
  cwd = repoRoot,
  environment = process.env,
  git = runGit,
  pathCheck = requirePath,
} = {}) => {
  const contract = await readContract()
  const settings = contract.local_development
  const sourceStates = []
  for (const source of settings.canonical_sources) {
    const sourceRoot = path.resolve(cwd, source.repository_path)
    try {
      await pathCheck(path.resolve(sourceRoot, source.required_path))
    } catch {
      throw new Error(`${source.id} required path is unavailable at ${path.resolve(sourceRoot, source.required_path)}`)
    }
    if (source.fetch_required) git(['fetch', '--quiet', source.canonical_remote, source.canonical_branch], sourceRoot)
    sourceStates.push({
      id: source.id,
      branch: git(['branch', '--show-current'], sourceRoot),
      headSha: git(['rev-parse', 'HEAD'], sourceRoot),
      canonicalSha: git(['rev-parse', `refs/remotes/${source.canonical_remote}/${source.canonical_branch}`], sourceRoot),
      status: git(['status', '--porcelain'], sourceRoot),
      worktreeCount: countRegisteredWorktrees(git(['worktree', 'list', '--porcelain'], sourceRoot)),
    })
  }
  const mode = String(environment[settings.mode_environment_variable] || settings.canonical_mode).trim()
  return evaluateDevSourceConsistency(sourceStates, contract, mode)
}
