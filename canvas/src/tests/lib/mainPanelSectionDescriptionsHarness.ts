import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const key = '__KNOWGRPH_MAIN_PANEL_SECTION_DESCRIPTIONS_MARKDOWN__'

export const installMainPanelSectionDescriptionsHarness = (): (() => void) => {
  const target = globalThis as Record<string, unknown>
  const previous = target[key]
  target[key] = readFileSync(resolve(process.cwd(), '..', 'docs', 'documents', 'knowgrph-mainpanel-section-descriptions.md'), 'utf8')
  return () => { if (typeof previous === 'string') target[key] = previous; else delete target[key] }
}
