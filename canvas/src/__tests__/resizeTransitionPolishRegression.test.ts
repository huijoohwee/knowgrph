import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readUtf8 = (filePath: string): string => readFileSync(filePath, 'utf8')

export function testResizeTransitionPolishKeepsSharedShapeAndLabelTransitions() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const cssText = readUtf8(resolve(process.cwd(), 'src/index.css'))
  if (!cssText.includes('--kg-motion-fast: 140ms;')) {
    throw new Error('expected root CSS to define a shared fast motion token')
  }
  if (!cssText.includes('--kg-motion-ease: ease;')) {
    throw new Error('expected root CSS to define a shared motion easing token')
  }
  if (!cssText.includes('--kg-transition-action: transform var(--kg-motion-fast) var(--kg-motion-ease), box-shadow var(--kg-motion-fast) var(--kg-motion-ease), background var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared action-button transition token')
  }
  if (!cssText.includes('--kg-transition-group-shape: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), fill-opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-shape transition token')
  }
  if (!cssText.includes('--kg-transition-group-label: opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-label transition token')
  }
  if (!cssText.includes('@media (prefers-reduced-motion: reduce)')) {
    throw new Error('expected root CSS to override motion tokens for reduced-motion users')
  }
  if (!cssText.includes('--kg-motion-fast: 0ms;')) {
    throw new Error('expected reduced-motion CSS to zero fast motion durations')
  }
  if (!groupsText.includes("const groupShapeTransition = 'var(--kg-transition-group-shape)'")) {
    throw new Error('expected group resize polish to source shape transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes("const groupLabelTransition = 'var(--kg-transition-group-label)'")) {
    throw new Error('expected group resize polish to source label transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes(".style('transition', groupShapeTransition)")) {
    throw new Error('expected rect and geo groups to reuse the shared shape transition')
  }
  if (!groupsText.includes(".style('transition', groupLabelTransition)")) {
    throw new Error('expected group labels to reuse the shared label transition')
  }
  if (!cssText.includes('transition: var(--kg-transition-action);')) {
    throw new Error('expected app CSS action buttons to reuse the shared transition token SSOT')
  }
}

export function testResizeTransitionPolishKeepsChevronAndHandleDotTransitions() {
  const groupsText = readUtf8(resolve(process.cwd(), 'src/components/GraphCanvas/layers/groups.ts'))
  const cssText = readUtf8(resolve(process.cwd(), 'src/index.css'))
  const htmlViewerText = readUtf8(resolve(process.cwd(), 'src/lib/graph/htmlViewer/buildGraphHtmlViewerMarkup.ts'))
  if (!cssText.includes('--kg-transition-group-chevron: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group-chevron transition token')
  }
  if (!cssText.includes('--kg-transition-group-resize-dot: stroke-width var(--kg-motion-fast) var(--kg-motion-ease), fill-opacity var(--kg-motion-fast) var(--kg-motion-ease);')) {
    throw new Error('expected root CSS to define a shared group resize-dot transition token')
  }
  if (!groupsText.includes("const groupChevronTransition = 'var(--kg-transition-group-chevron)'")) {
    throw new Error('expected group resize polish to source chevron transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes("const groupResizeDotTransition = 'var(--kg-transition-group-resize-dot)'")) {
    throw new Error('expected group resize polish to source resize-dot transitions from the shared transition token SSOT')
  }
  if (!groupsText.includes(".style('transition', groupChevronTransition)")) {
    throw new Error('expected group chevrons to reuse the shared transition definition')
  }
  if (!groupsText.includes(".style('transition', groupResizeDotTransition)")) {
    throw new Error('expected group resize dots to reuse the shared transition definition')
  }
  if (!htmlViewerText.includes("transition:var(--kg-transition-action, transform var(--kg-motion-fast, 140ms) var(--kg-motion-ease, ease), box-shadow var(--kg-motion-fast, 140ms) var(--kg-motion-ease, ease), background var(--kg-motion-fast, 140ms) var(--kg-motion-ease, ease));")) {
    throw new Error('expected html viewer action buttons to reuse the shared transition token SSOT with safe fallbacks')
  }
}
