import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const sharedStripePaymentSourcePath = resolve(process.cwd(), 'grph-shared/src/payments/stripePaymentSsot.ts')
export const sharedStripePaymentDistPath = resolve(process.cwd(), 'grph-shared/dist/payments/stripePaymentSsot.js')
export const sharedAgenticCommerceSourcePath = resolve(process.cwd(), 'grph-shared/src/payments/agenticCommerceSsot.ts')
export const sharedAgenticCommerceDistPath = resolve(process.cwd(), 'grph-shared/dist/payments/agenticCommerceSsot.js')

export const ensureSharedStripePaymentDist = () => {
  const sourceMtime = Math.max(
    existsSync(sharedStripePaymentSourcePath) ? statSync(sharedStripePaymentSourcePath).mtimeMs : 0,
    existsSync(sharedAgenticCommerceSourcePath) ? statSync(sharedAgenticCommerceSourcePath).mtimeMs : 0,
  )
  const distMtime = Math.min(
    existsSync(sharedStripePaymentDistPath) ? statSync(sharedStripePaymentDistPath).mtimeMs : 0,
    existsSync(sharedAgenticCommerceDistPath) ? statSync(sharedAgenticCommerceDistPath).mtimeMs : 0,
  )
  if (distMtime >= sourceMtime && distMtime > 0) return
  const output = spawnSync('npm', ['--prefix', 'canvas', 'run', 'build:grph-shared'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  if (output.error || output.status !== 0) {
    const reason = output.error?.message || output.stderr || output.stdout || `tsc exited ${output.status}`
    throw new Error(`Could not build grph-shared payment SSOT: ${String(reason).trim()}`)
  }
}

export const loadStripePaymentSsot = async () => {
  ensureSharedStripePaymentDist()
  return import(pathToFileURL(sharedStripePaymentDistPath).href)
}

export const loadAgenticCommerceSsot = async () => {
  ensureSharedStripePaymentDist()
  return import(pathToFileURL(sharedAgenticCommerceDistPath).href)
}

export const readArgValue = (args, name, fallback) => {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

export const hasFlag = (args, name) => args.includes(name)

export const parseTomlScalar = (value) => {
  const trimmed = String(value || '').trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export const readWranglerVarsFromToml = (configText) => {
  const vars = new Map()
  let inVars = false
  for (const line of String(configText || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      inVars = sectionMatch[1] === 'vars'
      continue
    }
    if (!inVars || trimmed.startsWith('#')) continue
    const assignment = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/)
    if (assignment) vars.set(assignment[1], parseTomlScalar(assignment[2]))
  }
  return vars
}

export const readWorkerSecretNames = ({ configPath, cwd = process.cwd() }) => {
  const output = spawnSync('npx', [
    '--yes',
    'wrangler',
    'secret',
    'list',
    '--config',
    configPath,
    '--format',
    'json',
  ], {
    cwd,
    encoding: 'utf8',
  })
  if (output.error || output.status !== 0) {
    const reason = output.error?.message || output.stderr || output.stdout || `wrangler exited ${output.status}`
    return { ok: false, error: String(reason).trim(), names: new Set() }
  }
  try {
    const parsed = JSON.parse(output.stdout || '[]')
    return {
      ok: true,
      names: new Set(parsed.map((entry) => String(entry?.name || '').trim()).filter(Boolean)),
    }
  } catch (error) {
    return { ok: false, error: `Could not parse wrangler secret list JSON: ${error.message}`, names: new Set() }
  }
}

const formatTomlString = (value) => JSON.stringify(String(value || ''))

export const updateWranglerVarsInToml = (configText, updates, removals = []) => {
  const updateMap = updates instanceof Map ? updates : new Map(Object.entries(updates || {}))
  const removalSet = new Set(removals)
  const updateKeys = Array.from(updateMap.keys())
  if (updateKeys.length === 0 && removalSet.size === 0) return String(configText || '')

  const original = String(configText || '')
  const hadTrailingNewline = original.endsWith('\n')
  const lines = original.split(/\r?\n/)
  if (hadTrailingNewline) lines.pop()

  let varsStart = -1
  let varsEnd = lines.length
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*\[vars\]\s*$/.test(lines[index])) {
      varsStart = index
      continue
    }
    if (varsStart >= 0 && index > varsStart && /^\s*\[[^\]]+\]\s*$/.test(lines[index])) {
      varsEnd = index
      break
    }
  }

  const renderUpdate = (key) => `${key} = ${formatTomlString(updateMap.get(key))}`

  if (varsStart < 0) {
    const nextLines = [...lines]
    if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim()) nextLines.push('')
    nextLines.push('[vars]')
    for (const key of updateKeys) nextLines.push(renderUpdate(key))
    return `${nextLines.join('\n')}\n`
  }

  const before = lines.slice(0, varsStart + 1)
  const section = lines.slice(varsStart + 1, varsEnd)
  const after = lines.slice(varsEnd)
  const written = new Set()
  const nextSection = []

  for (const line of section) {
    const assignment = line.match(/^(\s*)([A-Z0-9_]+)\s*=/)
    if (!assignment) {
      nextSection.push(line)
      continue
    }
    const [, indent, key] = assignment
    if (updateMap.has(key)) {
      nextSection.push(`${indent}${renderUpdate(key)}`)
      written.add(key)
      continue
    }
    if (removalSet.has(key)) continue
    nextSection.push(line)
  }

  for (const key of updateKeys) {
    if (!written.has(key)) nextSection.push(renderUpdate(key))
  }

  return `${[...before, ...nextSection, ...after].join('\n')}\n`
}
