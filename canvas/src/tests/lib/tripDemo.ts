import { pickSandboxDemoMarkdownFile, readSandboxDemoText, toDocumentPath } from '@/tests/lib/sandboxRoot'

export const resolveTripDemoPath = (): string | null => {
  return pickSandboxDemoMarkdownFile({
    preferBasename: 'trip-demo.md',
    envVarPathKey: 'KG_TRIP_DEMO_PATH',
  })
}

export const resolveTripDemoDocumentPath = (): string | null => {
  const p = resolveTripDemoPath()
  if (!p) return null
  const docPath = toDocumentPath(p)
  return docPath || null
}

export const readTripDemo = (): string | null => {
  const res = readSandboxDemoText({
    preferBasename: 'trip-demo.md',
    envVarPathKey: 'KG_TRIP_DEMO_PATH',
  })
  return res?.text ?? null
}

