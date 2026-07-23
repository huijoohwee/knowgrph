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

type FlightSimDeadline = Readonly<{
  expired: Promise<void>
  cancel: () => void
}>

export type FlightSimWebMcpDependencies = Readonly<{
  inspect?: () => unknown | Promise<unknown>
  control?: (input: Record<string, unknown>) => unknown | Promise<unknown>
  createDeadline?: (deadlineMs: number) => FlightSimDeadline
}>

export const FLIGHT_SIM_WEB_MCP_DEADLINE_MS = 2_000

const FLIGHT_SIM_WEB_MCP_TIMEOUT = Symbol('flight-sim-web-mcp-timeout')

const createFlightSimDeadline = (deadlineMs: number): FlightSimDeadline => {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    expired: new Promise(resolve => {
      timer = setTimeout(resolve, deadlineMs)
    }),
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}

const webMcpError = (
  errorCode: string,
  message: string,
  detail: Readonly<Record<string, unknown>> = {},
) => Object.freeze({ ok: false, errorCode, message, ...detail })

async function executeWithinFlightSimDeadline(
  operationName: 'inspect' | 'control',
  execute: () => unknown | Promise<unknown>,
  deadlineFactory: (deadlineMs: number) => FlightSimDeadline,
): Promise<unknown> {
  const deadline = deadlineFactory(FLIGHT_SIM_WEB_MCP_DEADLINE_MS)
  const timeout = deadline.expired.then(() => FLIGHT_SIM_WEB_MCP_TIMEOUT)
  try {
    const result = await Promise.race([
      Promise.resolve().then(execute),
      timeout,
    ])
    if (result === FLIGHT_SIM_WEB_MCP_TIMEOUT) {
      return webMcpError(
        'FLIGHT_SIM_WEB_MCP_TIMEOUT',
        `Flight Sim ${operationName} did not complete within ${FLIGHT_SIM_WEB_MCP_DEADLINE_MS} milliseconds.`,
        { operation: operationName, deadlineMs: FLIGHT_SIM_WEB_MCP_DEADLINE_MS },
      )
    }
    return result
  } catch (error) {
    return webMcpError(
      'FLIGHT_SIM_WEB_MCP_EXECUTION_FAILED',
      `Flight Sim ${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
      { operation: operationName },
    )
  } finally {
    deadline.cancel()
  }
}

const buildTool = (
  contract: FlightSimWebMcpContract,
  execute: FlightSimWebMcpTool['execute'],
): FlightSimWebMcpTool => ({ ...contract, name: contract.webName, execute })

export function buildFlightSimWebMcpToolBuilders(
  findContract: (name: string) => FlightSimWebMcpContract,
  dependencies: FlightSimWebMcpDependencies = {},
): Record<string, () => FlightSimWebMcpTool> {
  const inspectContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalFlightSim)
  const controlContract = findContract(KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalFlightSim)
  const inspect = dependencies.inspect || inspectLocalFlightSim
  const control = dependencies.control || controlLocalFlightSim
  const deadlineFactory = dependencies.createDeadline || createFlightSimDeadline
  return {
    [KNOWGRPH_AGENT_READY_TOOL_IDS.inspectLocalFlightSim]: () => (
      buildTool(inspectContract, async () => executeWithinFlightSimDeadline(
        'inspect',
        async () => {
          const inspection = await inspect()
          const active = (
            inspection
            && typeof inspection === 'object'
            && 'flightSim' in inspection
            && (inspection as { flightSim?: { active?: unknown } }).flightSim?.active === true
          )
          return active
            ? inspection
            : webMcpError(
              'FLIGHT_SIM_STATE_UNAVAILABLE',
              'Flight Sim state is unavailable while the surface is inactive.',
              { operation: 'inspect' },
            )
        },
        deadlineFactory,
      ))
    ),
    [KNOWGRPH_AGENT_READY_TOOL_IDS.controlLocalFlightSim]: () => (
      buildTool(controlContract, async input => executeWithinFlightSimDeadline(
        'control',
        () => control(input || {}),
        deadlineFactory,
      ))
    ),
  }
}
