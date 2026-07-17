import { controlLocalAnimation, inspectLocalAnimation } from '@/features/three/xrAnimationMcpRuntime'
import { KNOWGRPH_AGENT_READY_TOOL_IDS } from './knowgrphAgentReadyToolContract.mjs'

type XrAnimationWebMcpContract = Readonly<{
  webName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  securitySchemes?: Array<Record<string, unknown>>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}>

type XrAnimationWebMcpTool = XrAnimationWebMcpContract & Readonly<{
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}>

const buildTool = (
  contract: XrAnimationWebMcpContract,
  execute: XrAnimationWebMcpTool['execute'],
): XrAnimationWebMcpTool => ({ ...contract, name: contract.webName, execute })

export function buildXrAnimationWebMcpToolBuilders(
  findContract: (name: string) => XrAnimationWebMcpContract,
): Record<string, () => XrAnimationWebMcpTool> {
  const inspectContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalAnimation)
  const controlContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalAnimation)
  return {
    [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalAnimation]: () => buildTool(inspectContract, async () => inspectLocalAnimation()),
    [KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalAnimation]: () => buildTool(controlContract, async input => controlLocalAnimation(input || {})),
  }
}
