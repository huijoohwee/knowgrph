export function yamlQuote(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function yamlBlockScalar(key: string, value: string): string[] {
  const v = String(value || '').replace(/\r/g, '').trim()
  if (!v) return []
  const lines = v.split('\n')
  return [`${key}: |`, ...lines.map(line => `  ${line}`)]
}

