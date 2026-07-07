import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const CHAT_PROXY_SERVER_ENV_KEYS = new Set([
  'KNOWGRPH_CHAT_PROXY_OPENAI_API_KEY',
  'OPENAI_API_KEY',
  'KNOWGRPH_CHAT_PROXY_MIROMIND_API_KEY',
  'MIROMIND_API_KEY',
  'KNOWGRPH_CHAT_PROXY_AGNES_API_KEY',
  'AGNES_API_KEY',
  'KNOWGRPH_CHAT_PROXY_SEALION_API_KEY',
  'KNOWGRPH_CHAT_PROXY_QWEN_API_KEY',
  'DASHSCOPE_API_KEY',
  'QWEN_API_KEY',
  'KNOWGRPH_CHAT_PROXY_GOOGLE_CLOUD_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN',
  'VERTEX_AI_ACCESS_TOKEN',
  'GOOGLE_OAUTH_ACCESS_TOKEN',
  'KNOWGRPH_CHAT_PROXY_BYTEPLUS_API_KEY',
])

const stripEnvQuotes = (value: string): string => {
  const raw = String(value || '').trim()
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1)
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1)
  return raw
}

const readServerManagedEnvFile = (filePath: string): Record<string, string> => {
  if (!existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const assignment = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed
    const eqIndex = assignment.indexOf('=')
    if (eqIndex <= 0) continue
    const key = assignment.slice(0, eqIndex).trim()
    if (!CHAT_PROXY_SERVER_ENV_KEYS.has(key)) continue
    const value = stripEnvQuotes(assignment.slice(eqIndex + 1))
    if (value) out[key] = value
  }
  return out
}

export const loadChatProxyServerManagedEnv = (args: {
  repoRoot: string
  canvasRoot: string
}): void => {
  const merged: Record<string, string> = {}
  for (const filePath of [
    path.resolve(args.repoRoot, '.env'),
    path.resolve(args.repoRoot, '.env.local'),
    path.resolve(args.canvasRoot, '.env'),
    path.resolve(args.canvasRoot, '.env.local'),
  ]) {
    Object.assign(merged, readServerManagedEnvFile(filePath))
  }
  for (const [key, value] of Object.entries(merged)) {
    if (String(process.env[key] || '').trim()) continue
    process.env[key] = value
  }
}
