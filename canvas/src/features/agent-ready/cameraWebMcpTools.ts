import { controlLocalCamera, inspectLocalCamera } from '@/features/strybldr/cameraMcpRuntime'
import { KNOWGRPH_AGENT_READY_TOOL_IDS } from './knowgrphAgentReadyToolContract.mjs'

type CameraWebMcpContract = Readonly<{
  webName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  securitySchemes?: Array<Record<string, unknown>>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}>

type CameraWebMcpTool = CameraWebMcpContract & Readonly<{
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}>

const buildTool = (
  contract: CameraWebMcpContract,
  execute: CameraWebMcpTool['execute'],
): CameraWebMcpTool => ({
  ...contract,
  name: contract.webName,
  execute,
})

export function buildCameraWebMcpToolBuilders(
  findContract: (name: string) => CameraWebMcpContract,
): Record<string, () => CameraWebMcpTool> {
  const inspectContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCamera)
  const controlContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalCamera)
  return {
    [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalCamera]: () => buildTool(
      inspectContract,
      async () => inspectLocalCamera(),
    ),
    [KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalCamera]: () => buildTool(
      controlContract,
      async input => controlLocalCamera(input || {}),
    ),
  }
}
