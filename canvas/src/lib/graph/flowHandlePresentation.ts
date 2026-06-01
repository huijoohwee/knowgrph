export type FlowHandleDir = 'in' | 'out' | 'input' | 'output'

export function readFlowHandlePath(dir: FlowHandleDir): 'handles.target' | 'handles.source' {
  return dir === 'in' || dir === 'input' ? 'handles.target' : 'handles.source'
}

export function readFlowHandleTypeLabel(dir: FlowHandleDir): 'in' | 'out' {
  return dir === 'in' || dir === 'input' ? 'in' : 'out'
}

export function formatFlowHandleKeyValue(args: { dir: FlowHandleDir; portKey: string }): string {
  const portKey = String(args.portKey || '').trim()
  if (!portKey) return ''
  const path = readFlowHandlePath(args.dir)
  return `${path}: "${portKey}"`
}

export function formatFlowHandleAccessibleName(args: {
  dir: FlowHandleDir
  portKey: string
  schemaPath?: unknown
  occurrenceIndex?: number
  occurrenceCount?: number
}): string {
  const base = formatFlowHandleKeyValue({ dir: args.dir, portKey: args.portKey })
  if (!base) return ''
  const count = Number.isFinite(args.occurrenceCount) ? Math.max(0, Math.floor(Number(args.occurrenceCount))) : 0
  if (count <= 1) return base
  const schemaPath = String(args.schemaPath || '').trim()
  const index = Number.isFinite(args.occurrenceIndex) ? Math.max(0, Math.floor(Number(args.occurrenceIndex))) : 0
  if (schemaPath) return `${base} (${schemaPath} ${index + 1}/${count})`
  return `${base} (${index + 1}/${count})`
}

export function formatFlowHandleValueList(handles: ReadonlyArray<string>): string {
  const vals = handles
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .map(v => `"${v}"`)
  if (vals.length === 0) return ''
  if (vals.length === 1) return vals[0]
  return `[${vals.join(', ')}]`
}
