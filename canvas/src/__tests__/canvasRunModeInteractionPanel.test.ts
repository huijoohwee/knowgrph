import fs from 'node:fs'
import path from 'node:path'

function readSource(relPath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), 'src', relPath), { encoding: 'utf8' })
}

function expectSource(text: string, needle: string, label: string) {
  if (!text.includes(needle)) {
    throw new Error(`expected ${label} to include ${needle}`)
  }
}

export function testToolbarInteractionPanelIncludesRunModeControl() {
  const panel = readSource('features/canvas/InfiniteCanvasInteractionPanel.tsx')
  const toolbarSelect = readSource('components/toolbar/InteractionModeSelect.tsx')

  expectSource(panel, 'canvasRunMode', 'Interaction panel run mode state')
  expectSource(panel, 'setCanvasRunMode', 'Interaction panel run mode setter')
  expectSource(panel, 'aria-label="Run Mode"', 'Interaction panel run mode group')
  expectSource(panel, 'Manual Run Mode', 'Interaction panel manual option')
  expectSource(panel, 'Auto Run Mode', 'Interaction panel auto option')
  expectSource(panel, "setCanvasRunMode('manual')", 'Interaction panel manual action')
  expectSource(panel, "setCanvasRunMode('auto')", 'Interaction panel auto action')
  expectSource(toolbarSelect, 'Run Mode: Manual', 'Toolbar Interaction run mode manual row')
  expectSource(toolbarSelect, 'Run Mode: Auto', 'Toolbar Interaction run mode auto row')
  expectSource(toolbarSelect, "setCanvasRunMode(canvasRunMode === 'auto' ? 'manual' : 'auto')", 'Toolbar Interaction run mode toggle')
  expectSource(toolbarSelect, "option.key === 'runMode'", 'Toolbar Interaction run mode option')
}

export function testCanvasRunModeUsesPersistedManualDefault() {
  const renderConfig = readSource('lib/config.render.ts')
  const lsKeys = readSource('lib/config.ls.keys.ts')
  const lsOwners = readSource('lib/config.ls.owners.ts')
  const storeTypes = readSource('hooks/store/store-types/graph-state-canvas-runtime.ts')
  const canvasSlice = readSource('hooks/store/canvasSlice.ts')

  expectSource(renderConfig, "CANVAS_RUN_MODES = ['manual', 'auto'] as const", 'run mode config')
  expectSource(renderConfig, "DEFAULT_CANVAS_RUN_MODE: CanvasRunMode = 'manual'", 'run mode default')
  expectSource(lsKeys, "canvasRunMode: 'kg:ui:canvas:runMode'", 'run mode storage key')
  expectSource(lsOwners, "canvasRunMode: 'ui.workspace'", 'run mode storage owner')
  expectSource(storeTypes, 'canvasRunMode: CanvasRunMode;', 'run mode store state type')
  expectSource(storeTypes, 'setCanvasRunMode: (mode: CanvasRunMode) => void;', 'run mode store setter type')
  expectSource(canvasSlice, 'const initialCanvasRunMode = lsJson(', 'run mode persisted initial state')
  expectSource(canvasSlice, 'DEFAULT_CANVAS_RUN_MODE', 'run mode default in slice')
  expectSource(canvasSlice, "mode === 'auto' ? 'auto' : 'manual'", 'run mode normalization')
  expectSource(canvasSlice, 'lsSetJsonCoalesced(LS_KEYS.canvasRunMode', 'run mode persisted setter')
}
