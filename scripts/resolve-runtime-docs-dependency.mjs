import {
  formatGitHubOutput,
  readRuntimeReadinessContract,
  resolveRuntimeDocsDependency,
} from './runtime-readiness-contract.mjs'

const args = process.argv.slice(2)
const supportedArgs = new Set(['--github-output'])
const unknownArg = args.find(arg => !supportedArgs.has(arg))
if (unknownArg) throw new Error(`unsupported argument: ${unknownArg}`)

const dependency = resolveRuntimeDocsDependency(await readRuntimeReadinessContract())
const output = args.includes('--github-output')
  ? formatGitHubOutput(dependency)
  : `${JSON.stringify(dependency, null, 2)}\n`
process.stdout.write(output)
