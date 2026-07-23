import {
  controlLocalFlightSim,
  inspectLocalFlightSim,
} from '@/features/game-flight-sim/flightSimMcpRuntime'
import { KNOWGRPH_AGENT_READY_TOOL_IDS } from './knowgrphAgentReadyToolContract.mjs'

type FlightSimWebMcpContract = Readonly<{
  webName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  securitySchemes?: Array<Record<string, unknown>>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}>

type FlightSimWebMcpTool = FlightSimWebMcpContract & Readonly<{
  name: string
  execute: (input?: Record<string, unknown>) => Promise<unknown>
}>

const buildTool = (
  contract: FlightSimWebMcpContract,
  execute: FlightSimWebMcpTool['execute'],
): FlightSimWebMcpTool => ({ ...contract, name: contract.webName, execute })

export function buildFlightSimWebMcpToolBuilders(
  findContract: (name: string) => FlightSimWebMcpContract,
): Record<string, () => FlightSimWebMcpTool> {
  const inspectContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalFlightSim)
  const controlContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalFlightSim)
  return {
    [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalFlightSim]: () => (
      buildTool(inspectContract, async () => inspectLocalFlightSim())
    ),
    [KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalFlightSim]: () => (
      buildTool(controlContract, async input => controlLocalFlightSim(input || {}))
    ),
  }
}
