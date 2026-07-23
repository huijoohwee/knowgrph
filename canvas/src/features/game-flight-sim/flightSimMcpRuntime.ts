import {
  exitFlightSim,
  openFlightSimSurface,
  persistFlightSimPendingDecisions,
  readFlightSimSnapshot,
  restartFlightSim,
  setFlightSimThrottle,
  startFlightSim,
  stopFlightSim,
} from './flightSimRuntime'
import {
  FLIGHT_SIM_SAVE_PATH,
  readFlightSimDecisionStore,
} from './flightSimDecisionStore'
import {
  FLIGHT_SIM_INVOCATION_BINDINGS,
  FLIGHT_SIM_INVOCATION_COMMANDS,
  FLIGHT_SIM_INVOCATION_SEMANTICS,
  FLIGHT_SIM_MCP_SCHEMA,
  FLIGHT_SIM_OPERATIONS,
  FLIGHT_SIM_WEB_MCP_TOOL_IDS,
} from './flightSimMcpContract.mjs'

export type FlightSimOperation =
  | 'inspect'
  | 'open'
  | 'start'
  | 'stop'
  | 'restart'
  | 'throttle'
  | 'save'
  | 'exit'

export type FlightSimControlInput = Readonly<{
  invocation?: string
  operation?: FlightSimOperation
  throttle?: number
}>

export type NormalizedFlightSimControl = Readonly<{
  invocation: string
  operation: FlightSimOperation
  throttle?: number
}>

const FLIGHT_SIM_OPERATION_SET = new Set<string>(FLIGHT_SIM_OPERATIONS)
const FLIGHT_SIM_INVOCATION_PREFIX = [
  FLIGHT_SIM_INVOCATION_COMMANDS.control,
  FLIGHT_SIM_INVOCATION_BINDINGS.canvas,
  FLIGHT_SIM_INVOCATION_SEMANTICS.flight,
].join(' ')
const NATIVE_THROTTLE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

const isFlightSimOperation = (value: unknown): value is FlightSimOperation => (
  typeof value === 'string' && FLIGHT_SIM_OPERATION_SET.has(value)
)

const isThrottle = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
)

export function buildFlightSimInvocation(
  operation: FlightSimOperation,
  throttle?: number,
): string {
  if (!isFlightSimOperation(operation)) {
    throw new TypeError(`Unsupported Flight Sim operation: ${String(operation)}`)
  }
  if (operation === 'throttle') {
    if (!isThrottle(throttle)) {
      throw new TypeError('Flight Sim throttle requires a finite value from 0 through 1.')
    }
    return `${FLIGHT_SIM_INVOCATION_PREFIX} operation=${operation} throttle=${throttle}`
  }
  if (throttle !== undefined) {
    throw new TypeError(`Flight Sim operation=${operation} forbids a throttle value.`)
  }
  return `${FLIGHT_SIM_INVOCATION_PREFIX} operation=${operation}`
}

const parseNativeThrottle = (value: string | undefined): number | null => {
  if (!value || !NATIVE_THROTTLE_PATTERN.test(value)) return null
  const parsed = Number(value)
  return isThrottle(parsed) ? parsed : null
}

export function parseFlightSimInvocation(value: unknown): NormalizedFlightSimControl | null {
  if (typeof value !== 'string') return null
  const invocation = value.trim()
  if (!invocation) return null
  const tokens = invocation.split(/\s+/).filter(Boolean)
  const commandTokens = tokens.filter(token => token.startsWith('/'))
  const bindingTokens = tokens.filter(token => token.startsWith('@'))
  const semanticTokens = tokens.filter(token => token.startsWith('#'))
  if (tokens[0] !== FLIGHT_SIM_INVOCATION_COMMANDS.control) return null
  if (commandTokens.length !== 1 || commandTokens[0] !== FLIGHT_SIM_INVOCATION_COMMANDS.control) return null
  if (bindingTokens.length !== 1 || bindingTokens[0] !== FLIGHT_SIM_INVOCATION_BINDINGS.canvas) return null
  if (semanticTokens.length !== 1 || semanticTokens[0] !== FLIGHT_SIM_INVOCATION_SEMANTICS.flight) return null

  const pairs: Record<string, string> = {}
  for (const token of tokens.slice(1)) {
    if (token === FLIGHT_SIM_INVOCATION_BINDINGS.canvas || token === FLIGHT_SIM_INVOCATION_SEMANTICS.flight) {
      continue
    }
    const separator = token.indexOf('=')
    if (separator <= 0 || separator === token.length - 1) return null
    const key = token.slice(0, separator)
    if ((key !== 'operation' && key !== 'throttle') || Object.hasOwn(pairs, key)) return null
    pairs[key] = token.slice(separator + 1)
  }

  const operation = pairs.operation
  if (!isFlightSimOperation(operation)) return null
  if (operation !== 'throttle') {
    return Object.hasOwn(pairs, 'throttle') ? null : { invocation, operation }
  }
  const throttle = parseNativeThrottle(pairs.throttle)
  return throttle === null ? null : { invocation, operation, throttle }
}

export function normalizeFlightSimControl(
  input: FlightSimControlInput,
): NormalizedFlightSimControl | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const keys = Object.keys(input)
  if (Object.hasOwn(input, 'invocation')) {
    if (keys.length !== 1) return null
    return parseFlightSimInvocation(input.invocation)
  }
  if (!Object.hasOwn(input, 'operation') || !isFlightSimOperation(input.operation)) return null
  if (input.operation === 'throttle') {
    if (keys.length !== 2 || !Object.hasOwn(input, 'throttle') || !isThrottle(input.throttle)) return null
    return { invocation: '', operation: input.operation, throttle: input.throttle }
  }
  return keys.length === 1
    ? { invocation: '', operation: input.operation }
    : null
}

const buildInvocationGrammar = (): Record<FlightSimOperation, string> => Object.fromEntries(
  FLIGHT_SIM_OPERATIONS.map(operation => [
    operation,
    buildFlightSimInvocation(operation as FlightSimOperation, operation === 'throttle' ? 0.5 : undefined),
  ]),
) as Record<FlightSimOperation, string>

export function inspectLocalFlightSim() {
  const flightSim = readFlightSimSnapshot()
  return {
    schema: FLIGHT_SIM_MCP_SCHEMA,
    webMcpTools: {
      inspect: `knowgrph.${FLIGHT_SIM_WEB_MCP_TOOL_IDS.inspect}`,
      control: `knowgrph.${FLIGHT_SIM_WEB_MCP_TOOL_IDS.control}`,
    },
    invocationGrammar: buildInvocationGrammar(),
    flightSim,
    decisions: {
      ...readFlightSimDecisionStore(),
      path: FLIGHT_SIM_SAVE_PATH,
    },
    runtime: {
      webglSupported: flightSim.webglSupported,
      rendererOwner: 'existing-r3f-canvas',
      sceneOwner: 'authored-xr-terrain',
      simulationOwner: 'native-agentic-ecs',
      persistenceOwner: 'browser-local-workspace-fs',
      assetOwner: 'in-repo-typescript-json-spec',
      collision: 'authored-terrain-aabb',
      controls: ['desktop', 'pointer', 'touch', 'gamepad', 'motion-control', 'mcp'],
      runtimeNetworkCalls: 0,
      runtimeModelCalls: 0,
    },
  }
}

const controlResult = (
  ok: boolean,
  message: string,
  operation?: FlightSimOperation,
) => ({
  ok,
  message,
  ...(operation ? { operation } : {}),
  flight: inspectLocalFlightSim(),
})

const runtimeFailureMessage = (
  snapshot: ReturnType<typeof readFlightSimSnapshot>,
  fallback: string,
): string => String(snapshot.runtimeError || fallback)

export async function controlLocalFlightSim(input: FlightSimControlInput) {
  const control = normalizeFlightSimControl(input)
  if (!control) {
    return controlResult(
      false,
      'Use a supported structured operation or native /flight.sim @canvas #flight invocation.',
    )
  }
  if (control.operation === 'inspect') {
    return controlResult(true, 'Local Flight Sim inspected without mutation.', control.operation)
  }

  const before = readFlightSimSnapshot()
  if (control.operation === 'open') {
    if (before.active) {
      return controlResult(false, 'Open requires an inactive Flight Sim surface.', control.operation)
    }
    const opened = await openFlightSimSurface()
    const ok = opened.active && opened.phase === 'stopped' && opened.webglSupported && !opened.runtimeError
    return controlResult(
      ok,
      ok ? 'Flight Sim opened on the authored XR surface.' : runtimeFailureMessage(opened, 'Flight Sim could not open.'),
      control.operation,
    )
  }
  if (control.operation === 'start') {
    if (!before.active || before.phase !== 'stopped') {
      return controlResult(false, 'Start requires an open, stopped Flight Sim.', control.operation)
    }
    const started = startFlightSim()
    const ok = (started.phase === 'ready' || started.phase === 'flying') && !started.runtimeError
    let message = 'Flight Sim resumed its retained in-memory flight.'
    if (!ok) message = runtimeFailureMessage(started, 'Flight Sim could not start.')
    else if (started.phase === 'ready') {
      message = 'Flight Sim is ready at its retained in-memory tick and waiting for input.'
    }
    return controlResult(
      ok,
      message,
      control.operation,
    )
  }
  if (control.operation === 'stop') {
    if (!before.active || (before.phase !== 'ready' && before.phase !== 'flying')) {
      return controlResult(false, 'Stop requires a ready or flying Flight Sim mission.', control.operation)
    }
    const stopped = stopFlightSim()
    const ok = stopped.active && stopped.phase === 'stopped' && !stopped.runtimeError
    return controlResult(
      ok,
      ok ? 'Flight Sim stopped with its in-memory state retained.' : runtimeFailureMessage(stopped, 'Flight Sim could not stop.'),
      control.operation,
    )
  }
  if (control.operation === 'restart') {
    if (!before.active) {
      return controlResult(false, 'Restart requires an open Flight Sim surface.', control.operation)
    }
    const restarted = restartFlightSim()
    const ok = restarted.phase === 'ready' && !restarted.runtimeError
    return controlResult(
      ok,
      ok ? 'Flight Sim restarted at a fresh tick-zero state.' : runtimeFailureMessage(restarted, 'Flight Sim could not restart.'),
      control.operation,
    )
  }
  if (control.operation === 'throttle') {
    if (!before.active || (before.phase !== 'ready' && before.phase !== 'flying') || control.throttle === undefined) {
      return controlResult(false, 'Throttle requires a ready or flying Flight Sim mission and a finite value from 0 through 1.', control.operation)
    }
    const throttled = setFlightSimThrottle(control.throttle)
    const ok = (throttled.phase === 'ready' || throttled.phase === 'flying') && !throttled.runtimeError
    return controlResult(
      ok,
      ok ? `Flight Sim throttle target set to ${control.throttle}.` : runtimeFailureMessage(throttled, 'Flight Sim throttle was rejected.'),
      control.operation,
    )
  }
  if (control.operation === 'save') {
    if (before.phase !== 'completed' && before.phase !== 'crashed') {
      return controlResult(false, 'Save requires a completed or crashed Flight Sim mission.', control.operation)
    }
    const saved = await persistFlightSimPendingDecisions()
    const ok = saved.status === 'saved'
    return controlResult(
      ok,
      ok ? 'Validated Flight Sim Decisions saved locally.' : saved.error || 'Flight Sim Decision save failed.',
      control.operation,
    )
  }
  if (!before.active) {
    return controlResult(false, 'Exit requires an open Flight Sim surface.', control.operation)
  }
  const exited = exitFlightSim()
  const ok = !exited.active && exited.phase === 'stopped'
  return controlResult(
    ok,
    ok ? 'Flight Sim exited and restored the previous Canvas surface.' : runtimeFailureMessage(exited, 'Flight Sim could not exit.'),
    control.operation,
  )
}
