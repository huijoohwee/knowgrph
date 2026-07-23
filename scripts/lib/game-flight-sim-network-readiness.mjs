const NETWORK_GUARD_PATH =
  'canvas/src/features/game-flight-sim/flightSimExternalCallGuard.ts'

const NETWORK_CAPABILITIES = Object.freeze([
  Object.freeze({ pattern: /\bfetch\s*\(/, name: 'fetch' }),
  Object.freeze({ pattern: /\bWebSocket\s*\(/, name: 'WebSocket' }),
  Object.freeze({ pattern: /\bEventSource\s*\(/, name: 'EventSource' }),
  Object.freeze({ pattern: /\bXMLHttpRequest\b/, name: 'XMLHttpRequest' }),
  Object.freeze({ pattern: /\bsendBeacon\s*\(/, name: 'sendBeacon' }),
])

const ORIGINAL_TRANSPORT_INVOCATIONS = Object.freeze([
  /\boriginalFetch(?:\.call|\.apply)?\s*\(/,
  /\boriginalXmlHttpRequestOpen(?:\.call|\.apply)?\s*\(/,
  /\boriginalWebSocket(?:\.call|\.apply)?\s*\(/,
  /\boriginalEventSource(?:\.call|\.apply)?\s*\(/,
  /\boriginalSendBeacon(?:\.call|\.apply)?\s*\(/,
  /\bReflect\.construct\s*\(\s*original(?:WebSocket|EventSource)\b/,
])

const REQUIRED_GUARD_MARKERS = Object.freeze([
  'type FlightSimNetworkHost = {',
  'EventSource?: typeof EventSource',
  'WebSocket?: typeof WebSocket',
  'XMLHttpRequest?: typeof XMLHttpRequest',
  'sendBeacon?: FlightSimSendBeacon',
  'const guardedFetch:',
  'const guardedXmlHttpRequestOpen',
  "guardedConstructor(originalWebSocket, 'websocket'",
  "guardedConstructor(originalEventSource, 'eventsource'",
  'const guardedSendBeacon:',
  'restoreInstalledNetworkFence',
])

export function assertFlightSimFeatureNetworkBoundary({
  relativePath,
  source,
}) {
  const detected = NETWORK_CAPABILITIES.filter(({ pattern }) => (
    pattern.test(source)
  ))
  if (relativePath !== NETWORK_GUARD_PATH) {
    if (detected.length === 0) return
    throw new Error(
      `${relativePath} introduces forbidden Flight Sim capability: ${
        detected[0].name
      }`,
    )
  }
  const missing = REQUIRED_GUARD_MARKERS.filter(marker => !source.includes(marker))
  if (missing.length > 0) {
    throw new Error(
      `Flight Sim network guard is missing required interception markers: ${
        missing.join(', ')
      }`,
    )
  }
  const invokedOriginal = ORIGINAL_TRANSPORT_INVOCATIONS.find(pattern => (
    pattern.test(source)
  ))
  if (invokedOriginal) {
    throw new Error(
      'Flight Sim network guard must never invoke a captured original transport',
    )
  }
}
