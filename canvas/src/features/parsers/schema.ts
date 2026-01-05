export type ValidateResult = { ok: boolean; errors: string[] }

const isString = (v: unknown): v is string => typeof v === 'string'
const isArrayOfStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)
const isRecordOfStrings = (v: unknown): v is Record<string, string> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every(isString)
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export const validateTransforms = (obj: unknown): ValidateResult => {
  const errors: string[] = []
  if (obj == null || typeof obj !== 'object') return { ok: true, errors }

  const rec = obj as Record<string, unknown>
  if (rec.nodeTypeDefault != null && !isString(rec.nodeTypeDefault)) errors.push('nodeTypeDefault must be string')
  if (rec.edgeLabelDefault != null && !isString(rec.edgeLabelDefault)) errors.push('edgeLabelDefault must be string')

  const checkProps = (props?: unknown, which?: 'node' | 'edge') => {
    if (!props) return
    const propsRec = isRecord(props) ? props as Record<string, unknown> : {}
    const pRec = isRecord(propsRec.props) ? (propsRec.props as Record<string, unknown>) : {}
    if (pRec.pick && !isArrayOfStrings(pRec.pick)) errors.push(`${which}.props.pick must be array of strings`)
    if (pRec.drop && !isArrayOfStrings(pRec.drop)) errors.push(`${which}.props.drop must be array of strings`)
    if (pRec.map && !isRecordOfStrings(pRec.map)) errors.push(`${which}.props.map must be record of strings`)
    const agg = isRecord(pRec.mapAgg) ? (pRec.mapAgg as Record<string, unknown>) : {}
    Object.entries(agg).forEach(([k, v]) => {
      const vRec = isRecord(v) ? (v as Record<string, unknown>) : null
      if (!vRec) { errors.push(`${which}.props.mapAgg.${k} must be object`); return }
      const allowedOps = ['join','sum','count','first','last','min','max','avg','median','percentile']
      const op = vRec.op
      if (typeof op !== 'string' || !allowedOps.includes(op)) errors.push(`${which}.props.mapAgg.${k}.op invalid`)
      if (!isString(vRec.path)) errors.push(`${which}.props.mapAgg.${k}.path must be string`)
      if (vRec.sep != null && !isString(vRec.sep)) errors.push(`${which}.props.mapAgg.${k}.sep must be string`)
      if (vRec.p != null && typeof vRec.p !== 'number') errors.push(`${which}.props.mapAgg.${k}.p must be number`)
      if (vRec.method != null && !isString(vRec.method)) errors.push(`${which}.props.mapAgg.${k}.method must be string`)
      if (vRec.type != null && typeof vRec.type !== 'number') errors.push(`${which}.props.mapAgg.${k}.type must be number`)
    })
    if (pRec.set && !isRecord(pRec.set)) errors.push(`${which}.props.set must be object`)
    if (which === 'edge' && propsRec.labelMap && !isRecordOfStrings(propsRec.labelMap)) errors.push('edge.labelMap must be record of strings')
    if (which === 'node' && propsRec.typeMap && !isRecordOfStrings(propsRec.typeMap)) errors.push('node.typeMap must be record of strings')
  }

  checkProps(rec.node, 'node')
  checkProps(rec.edge, 'edge')

  return { ok: errors.length === 0, errors }
}
