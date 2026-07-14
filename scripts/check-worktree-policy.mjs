import { checkWorktreePolicy } from './worktree-policy.mjs'

const result = await checkWorktreePolicy()
console.log(`[worktree] ${result.message}`)
