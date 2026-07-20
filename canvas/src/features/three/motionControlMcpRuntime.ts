import {
  inspectMotionControlRuntime,
  readMotionControlSnapshot,
  setMotionControlBoundingBoxEnabled,
  startMotionControl,
  stopMotionControl,
  type MotionControlBackendPreference,
} from './motionControlRuntime'
import {
  MOTION_CONTROL_INVOCATION_BINDINGS,
  MOTION_CONTROL_INVOCATION_COMMANDS,
  MOTION_CONTROL_INVOCATION_SEMANTICS,
  MOTION_CONTROL_MCP_SCHEMA,
  MOTION_CONTROL_WEB_MCP_TOOL_IDS,
} from './motionControlMcpContract.mjs'
import {
  inspectMotionControlTargets,
} from './motionControlTargetRuntime'
import {
  MOTION_CONTROL_XR_UNAVAILABLE_MESSAGE,
  openMotionControlSurface,
} from './motionControlSurfaceRuntime'

export type MotionControlOperation = 'open' | 'start' | 'stop'
export type MotionControlInput = Readonly<{
  invocation?: string
  operation?: MotionControlOperation
  backend?: MotionControlBackendPreference
  boundingBox?: boolean
}>

type CanonicalTokens = Readonly<{ command: string; semantic: string; binding: string }>
type NormalizedControl = Readonly<{
  operation: MotionControlOperation
  backend: MotionControlBackendPreference
  boundingBox?: boolean
  invocation: string
}>

const canonicalTokens = (): CanonicalTokens => ({
  command: MOTION_CONTROL_INVOCATION_COMMANDS.control,
  semantic: MOTION_CONTROL_INVOCATION_SEMANTICS.pose,
  binding: MOTION_CONTROL_INVOCATION_BINDINGS.canvas,
})

export function buildMotionControlInvocation(operation: MotionControlOperation, backend: MotionControlBackendPreference = 'auto'): string {
  const tokens = canonicalTokens()
  return `${tokens.command} ${tokens.binding} ${tokens.semantic} operation=${operation}${operation === 'start' ? ` backend=${backend}` : ''}`
}

export function buildMotionControlBoundingBoxInvocation(enabled: boolean): string {
  const invocation = buildMotionControlInvocation('open')
  return invocation ? `${invocation} boundingBox=${enabled}` : ''
}

function parseInvocation(value: unknown): NormalizedControl | null {
  const invocation = String(value || '').trim()
  const canonical = canonicalTokens()
  if (!invocation) return null
  const tokens = invocation.split(/\s+/).filter(Boolean)
  if (tokens[0] !== canonical.command || tokens.filter(token => token.startsWith('/')).length !== 1) return null
  const semantics = tokens.filter(token => token.startsWith('#'))
  const bindings = tokens.filter(token => token.startsWith('@'))
  if (semantics.length !== 1 || semantics[0] !== canonical.semantic || bindings.length !== 1 || bindings[0] !== canonical.binding) return null
  const pairs: Record<string, string> = {}
  for (const token of tokens.slice(1).filter(token => !token.startsWith('#') && !token.startsWith('@'))) {
    const separator = token.indexOf('=')
    if (separator <= 0 || separator === token.length - 1) return null
    const key = token.slice(0, separator)
    if (!['operation', 'backend', 'boundingBox'].includes(key) || pairs[key]) return null
    pairs[key] = token.slice(separator + 1)
  }
  const operation = pairs.operation as MotionControlOperation
  const backend = (pairs.backend || 'auto') as MotionControlBackendPreference
  if (!['open', 'start', 'stop'].includes(operation) || !['auto', 'webgpu', 'wasm'].includes(backend)) return null
  if (operation !== 'start' && pairs.backend) return null
  if (pairs.boundingBox && !['true', 'false'].includes(pairs.boundingBox)) return null
  if (operation !== 'open' && pairs.boundingBox) return null
  return { invocation, operation, backend, ...(pairs.boundingBox ? { boundingBox: pairs.boundingBox === 'true' } : {}) }
}

function normalizeControl(input: MotionControlInput): NormalizedControl | null {
  if (input.invocation) {
    if (Object.keys(input).some(key => key !== 'invocation')) return null
    if (input.operation !== undefined || input.backend !== undefined || input.boundingBox !== undefined) return null
    return parseInvocation(input.invocation)
  }
  if (Object.keys(input).some(key => !['operation', 'backend', 'boundingBox'].includes(key))) return null
  const operation = input.operation
  const backend = input.backend || 'auto'
  if (!operation || !['open', 'start', 'stop'].includes(operation)) return null
  if (!['auto', 'webgpu', 'wasm'].includes(backend) || (operation !== 'start' && input.backend !== undefined)) return null
  if (input.boundingBox !== undefined && (operation !== 'open' || typeof input.boundingBox !== 'boolean')) return null
  return { invocation: '', operation, backend, ...(input.boundingBox === undefined ? {} : { boundingBox: input.boundingBox }) }
}

export function inspectLocalMotionControl() {
  const canonical = canonicalTokens()
  const runtime = inspectMotionControlRuntime()
  return {
    ...runtime,
    schema: MOTION_CONTROL_MCP_SCHEMA,
    runtimeSchema: runtime.schema,
    webMcpTools: {
      inspect: `knowgrph.${MOTION_CONTROL_WEB_MCP_TOOL_IDS.inspect}`,
      control: `knowgrph.${MOTION_CONTROL_WEB_MCP_TOOL_IDS.control}`,
    },
    invocationGrammar: {
      open: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=open`,
      boundingBox: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=open boundingBox=true|false`,
      start: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=start backend=auto|webgpu|wasm`,
      stop: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=stop`,
    },
    targets: inspectMotionControlTargets(),
  }
}

export async function controlLocalMotionControl(input: MotionControlInput) {
  const control = normalizeControl(input)
  if (!control) return { ok: false, message: 'Use a supported structured operation or native /motion.control @canvas #pose invocation.' }
  if (control.operation === 'stop') {
    const stopped = await stopMotionControl()
    return { ok: true, message: stopped.message, operation: control.operation, motionControl: inspectLocalMotionControl() }
  }
  if (!openMotionControlSurface('motion-control')) {
    return {
      ok: false,
      message: MOTION_CONTROL_XR_UNAVAILABLE_MESSAGE,
      operation: control.operation,
      motionControl: inspectLocalMotionControl(),
    }
  }
  if (control.operation === 'open') {
    if (control.boundingBox !== undefined) setMotionControlBoundingBoxEnabled(control.boundingBox)
    const preferenceMessage = control.boundingBox === undefined ? '' : ` Bounding box ${control.boundingBox ? 'enabled' : 'disabled'}.`
    const cameraMessage = readMotionControlSnapshot().cameraActive ? ' Camera capture remains active.' : ' Camera access still requires Start.'
    return { ok: true, message: `Motion Control opened in XR Mode.${preferenceMessage}${cameraMessage}`, operation: control.operation, motionControl: inspectLocalMotionControl() }
  }
  const started = await startMotionControl(control.backend)
  return {
    ok: started.phase === 'running',
    message: started.message,
    operation: control.operation,
    motionControl: inspectLocalMotionControl(),
  }
}

export function motionControlRuntimeActive(): boolean {
  return readMotionControlSnapshot().phase === 'running'
}
