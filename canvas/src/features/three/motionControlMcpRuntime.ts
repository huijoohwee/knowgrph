import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import {
  inspectMotionControlRuntime,
  readMotionControlSnapshot,
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
}>

type CanonicalTokens = Readonly<{ command: string; semantic: string; binding: string }>
type NormalizedControl = Readonly<{
  operation: MotionControlOperation
  backend: MotionControlBackendPreference
  invocation: string
}>

function canonicalTokens(): CanonicalTokens | null {
  const command = findAgenticOsInvocationByToken(MOTION_CONTROL_INVOCATION_COMMANDS.control)
  const semantic = findAgenticOsInvocationByToken(MOTION_CONTROL_INVOCATION_SEMANTICS.pose)
  const binding = findAgenticOsInvocationByToken(MOTION_CONTROL_INVOCATION_BINDINGS.canvas)
  if (command?.kind !== 'command' || semantic?.kind !== 'semantic' || binding?.kind !== 'binding') return null
  return { command: command.token, semantic: semantic.token, binding: binding.token }
}

export function buildMotionControlInvocation(operation: MotionControlOperation, backend: MotionControlBackendPreference = 'auto'): string {
  const tokens = canonicalTokens()
  if (!tokens) return ''
  return `${tokens.command} ${tokens.binding} ${tokens.semantic} operation=${operation}${operation === 'start' ? ` backend=${backend}` : ''}`
}

function parseInvocation(value: unknown): NormalizedControl | null {
  const invocation = String(value || '').trim()
  const canonical = canonicalTokens()
  if (!invocation || !canonical) return null
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
    if (!['operation', 'backend'].includes(key) || pairs[key]) return null
    pairs[key] = token.slice(separator + 1)
  }
  const operation = pairs.operation as MotionControlOperation
  const backend = (pairs.backend || 'auto') as MotionControlBackendPreference
  if (!['open', 'start', 'stop'].includes(operation) || !['auto', 'webgpu', 'wasm'].includes(backend)) return null
  if (operation !== 'start' && pairs.backend) return null
  return { invocation, operation, backend }
}

function normalizeControl(input: MotionControlInput): NormalizedControl | null {
  if (input.invocation) {
    if (Object.keys(input).some(key => key !== 'invocation')) return null
    if (input.operation !== undefined || input.backend !== undefined) return null
    return parseInvocation(input.invocation)
  }
  if (Object.keys(input).some(key => key !== 'operation' && key !== 'backend')) return null
  const operation = input.operation
  const backend = input.backend || 'auto'
  if (!operation || !['open', 'start', 'stop'].includes(operation)) return null
  if (!['auto', 'webgpu', 'wasm'].includes(backend) || (operation !== 'start' && input.backend !== undefined)) return null
  return { invocation: '', operation, backend }
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
    invocationGrammar: canonical ? {
      open: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=open`,
      start: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=start backend=auto|webgpu|wasm`,
      stop: `${canonical.command} ${canonical.binding} ${canonical.semantic} operation=stop`,
    } : null,
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
    return { ok: true, message: 'Motion Control opened in XR Mode. Camera access still requires Start.', operation: control.operation, motionControl: inspectLocalMotionControl() }
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
