import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testDesignRendererMountsEditorChromeAndTokensPanel() {
  const shell = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'DesignCanvasRenderShell.tsx'), 'utf8')
  const panel = readFileSync(resolve(process.cwd(), 'src', 'features', 'design', 'DesignFloatingPanelView.tsx'), 'utf8')
  if (!shell.includes('DesignCanvasEditorChrome')) throw new Error('expected Design renderer shell to mount shared editor chrome')
  if (!panel.includes('DesignTokensPanel') || !panel.includes("id: 'tokens'")) {
    throw new Error('expected Design floating panel to expose semantic token analysis tab')
  }
  if (!panel.includes('<ToolbarDropdownSelect') || !panel.includes('title={`Design section:') || panel.includes('aria-label="Design panel tabs"')) {
    throw new Error('expected Design floating panel section switching to use the shared click-expand-down chooser instead of a horizontal tabs row')
  }
}

export function testDesignEditorChromeUsesExistingStoreActions() {
  const chrome = readFileSync(resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'DesignCanvasEditorChrome.tsx'), 'utf8')
  for (const snippet of ['setCanvasPointerMode2d', 'undoDesignHistory', 'redoDesignHistory', 'dispatchRuntimeFitToViewSoon']) {
    if (!chrome.includes(snippet)) throw new Error(`expected Design editor chrome to reuse existing action: ${snippet}`)
  }
}

export function testDesignFloatingPanelUsesViewportAndToolShortcuts() {
  const panel = readFileSync(resolve(process.cwd(), 'src', 'features', 'design', 'DesignFloatingPanelView.tsx'), 'utf8')
  const hotkeys = readFileSync(resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasHotkeysRuntime.tsx'), 'utf8')
  const handlers = readFileSync(resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasHotkeyHandlers.ts'), 'utf8')
  if (!panel.includes('dispatchRuntimeFitToViewSoon') || !panel.includes('Fit to view')) {
    throw new Error('expected Design floating panel to expose the shared fit-to-view viewport action')
  }
  if (!hotkeys.includes('handleCanvasPointerModeHotkey(e)')) {
    throw new Error('expected Design hotkeys to remain wired through the shared canvas hotkey runtime shell')
  }
  for (const snippet of ["canvas2dRenderer === 'design'", 'setCanvasPointerMode2d', "lowerKey !== 'v' && lowerKey !== 'h'"]) {
    if (!handlers.includes(snippet)) throw new Error(`expected Design pointer hotkeys to be owned by the shared canvas hotkey handlers: ${snippet}`)
  }
}

export function testDesignTokenSummaryUsesSharedSemanticKeyHelper() {
  const summary = readFileSync(resolve(process.cwd(), 'src', 'features', 'design', 'designTokenSummary.ts'), 'utf8')
  if (!summary.includes("buildScopedGraphSemanticKey('design-token-summary'")) {
    throw new Error('expected Design token summary cache to reuse the shared graph semantic-key helper')
  }
}
