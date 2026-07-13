import { spawnSync } from 'node:child_process'
import { readContract, repoRoot, validateTaskBranch } from './collaboration-contract.mjs'

const runGit = (args, cwd) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
  return String(result.stdout || '').trim()
}

export const evaluateDevSourceConsistency = ({ branch, headSha, canonicalSha, status }, contract, mode) => {
  const settings = contract.local_development
  if (mode === settings.task_mode) {
    validateTaskBranch(branch, contract)
    return {
      canonical: false,
      message: `task source ${branch}@${headSha.slice(0, 12)} (canonical ${settings.canonical_remote}/${settings.canonical_branch}@${canonicalSha.slice(0, 12)})`,
    }
  }
  if (mode !== settings.canonical_mode) {
    throw new Error(
      `${settings.mode_environment_variable} must be ${settings.canonical_mode} or ${settings.task_mode}; received ${mode}`,
    )
  }
  if (settings.clean_required && status) {
    throw new Error('canonical Dev startup requires a clean worktree; commit, stash, or remove local changes first')
  }
  if (headSha !== canonicalSha) {
    throw new Error(
      `canonical Dev source mismatch: HEAD ${headSha} != ${settings.canonical_remote}/${settings.canonical_branch} ${canonicalSha}. `
      + `Update the canonical checkout with git pull --ff-only ${settings.canonical_remote} ${settings.canonical_branch}`,
    )
  }
  return {
    canonical: true,
    message: `canonical source ${settings.canonical_remote}/${settings.canonical_branch}@${canonicalSha.slice(0, 12)}`,
  }
}

export const checkDevSourceConsistency = async ({ cwd = repoRoot, environment = process.env, git = runGit } = {}) => {
  const contract = await readContract()
  const settings = contract.local_development
  if (settings.fetch_required) git(['fetch', '--quiet', settings.canonical_remote, settings.canonical_branch], cwd)
  const branch = git(['branch', '--show-current'], cwd)
  const headSha = git(['rev-parse', 'HEAD'], cwd)
  const canonicalSha = git(['rev-parse', `refs/remotes/${settings.canonical_remote}/${settings.canonical_branch}`], cwd)
  const status = git(['status', '--porcelain'], cwd)
  const mode = String(environment[settings.mode_environment_variable] || settings.canonical_mode).trim()
  return evaluateDevSourceConsistency({ branch, headSha, canonicalSha, status }, contract, mode)
}
