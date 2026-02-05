import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function listFilesRecursively(dir: string, opts?: { ignoreDirNames?: Set<string> }): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (opts?.ignoreDirNames?.has(e.name)) continue
      out.push(...listFilesRecursively(p, opts))
    }
    else out.push(p)
  }
  return out
}

const SRC_DIR = resolve(process.cwd(), 'src')

export function testForbidSiblingRepoSourceImports() {
  const files = listFilesRecursively(SRC_DIR).filter(f => /\.(ts|tsx)$/.test(f))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\bimport\(\s*['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\brequire\(\s*['"][^'"]*(?:curagrph|gympgrph)\/src\//,
    /\bfrom\s+['"][^'"]*grph-shared\/src\//,
    /\bimport\(\s*['"][^'"]*grph-shared\/src\//,
    /\brequire\(\s*['"][^'"]*grph-shared\/src\//,
  ]
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      if (re.test(text)) {
        violations.push({ file, pattern: String(re) })
      }
    }
  }
  if (violations.length) {
    const msg = violations.map(v => `${v.file} matches ${v.pattern}`).join('\n')
    throw new Error(`Forbidden sibling-repo source imports detected:\n${msg}`)
  }
}

export function testHostGympgrphIntegrationUsesPackageRootOnly() {
  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"]gympgrph\/[^'"]+['"]/,
    /\bimport\(\s*['"]gympgrph\/[^'"]+['"]/,
    /\brequire\(\s*['"]gympgrph\/[^'"]+['"]/,
  ]
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      if (re.test(text)) violations.push({ file, pattern: String(re) })
    }
  }
  if (violations.length) {
    const msg = violations.map(v => `${v.file} matches ${v.pattern}`).join('\n')
    throw new Error(`Knowgrph must import gympgrph via package root only:\n${msg}`)
  }
}

export function testForbidGympgrphHookUsageInHost() {
  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: string[] = []
  const re = /\buseGympgrphStore\s*\(/g
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    if (re.test(text)) violations.push(file)
  }
  if (violations.length) {
    throw new Error(`Host code must not call gympgrph React hooks directly (avoid duplicate React instances). Use the host external-store adapter instead:\n${violations.join('\n')}`)
  }
}

export function testForbidMagicLocalStorageKeysOutsideCentralConstants() {
  const lsConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.ls.ts')
  const lsConfigText = readFileSync(lsConfigPath, 'utf8')
  const knownKeys = (() => {
    const out = new Set<string>()
    const re = /:\s*(['"])(kg:[^'"]+)\1/g
    let m: RegExpExecArray | null = null
    while ((m = re.exec(lsConfigText))) {
      const key = m[2]
      if (typeof key !== 'string') continue
      const trimmed = key.trim()
      if (!trimmed) continue
      if (trimmed.split(':').length < 3) continue
      out.add(trimmed)
    }
    return out
  })()

  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
    .filter(f => !f.endsWith(join('src', 'lib', 'config.ls.ts')))
  const violations: Array<{ file: string }> = []
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const key of knownKeys) {
      if (text.includes(`'${key}'`) || text.includes(`"${key}"`)) {
        violations.push({ file })
        break
      }
    }
  }
  if (violations.length) {
    const msg = violations.map(v => v.file).join('\n')
    throw new Error(`Hardcoded LocalStorage keys found outside config.ls.ts:\n${msg}`)
  }
}

export function testCuragrphAliasContractInViteConfig() {
  const viteConfigPath = resolve(process.cwd(), 'vite.config.ts')
  const text = readFileSync(viteConfigPath, 'utf8')
  const requiredSnippets = [
    "./node_modules/curagrph/src/components/BottomPanel/$1",
    "./node_modules/curagrph/src/features/graph-data-table/$1",
    "./node_modules/curagrph/src/features/json/$1",
    "./node_modules/curagrph/src/features/markdown/$1",
    "./node_modules/curagrph/src/features/panels/views/preview-panel/ui/$1",
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`Curagrph alias contract missing in vite.config.ts:\n${msg}`)
  }
}

export function testForbidEditorJsDependencies() {
  const ignoreDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.git'])
  const repoRoot = resolve(process.cwd(), '..', '..', '..')
  const repoSrcDirs = [
    SRC_DIR,
    resolve(repoRoot, 'curagrph', 'src'),
    resolve(repoRoot, 'gympgrph', 'src'),
  ]
  const pkgJsonPaths = [
    resolve(repoRoot, 'curagrph', 'package.json'),
    resolve(repoRoot, 'gympgrph', 'package.json'),
  ]

  const files = repoSrcDirs
    .flatMap(dir => {
      try {
        return listFilesRecursively(dir, { ignoreDirNames })
      } catch {
        return []
      }
    })
    .filter(f => /\.(ts|tsx|js|jsx|json)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: Array<{ file: string; snippet: string }> = []

  const patterns: RegExp[] = [
    /@editorjs\//,
    /\b@editorjs\/editorjs\b/,
    /\beditorjs\b/i,
    /codex-team\/editor\.js/i,
    /editorjs\.io/i,
  ]

  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      const m = text.match(re)
      if (m && m[0]) {
        violations.push({ file, snippet: m[0] })
        break
      }
    }
  }

  for (const file of pkgJsonPaths) {
    try {
      const text = readFileSync(file, 'utf8')
      for (const re of patterns) {
        const m = text.match(re)
        if (m && m[0]) {
          violations.push({ file, snippet: m[0] })
          break
        }
      }
    } catch {
      void 0
    }
  }

  if (violations.length) {
    const msg = violations.map(v => `${v.file} contains ${JSON.stringify(v.snippet)}`).join('\n')
    throw new Error(
      `Forbidden Editor.js dependency/reference detected (Markdown must remain native; do not import/copy Editor.js):\n${msg}`,
    )
  }
}

export function testForbidReactFlowAndLiteGraphDependencies() {
  const ignoreDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.git'])
  const repoRoot = resolve(process.cwd(), '..', '..', '..')
  const repoSrcDirs = [
    SRC_DIR,
    resolve(repoRoot, 'curagrph', 'src'),
    resolve(repoRoot, 'gympgrph', 'src'),
  ]
  const pkgJsonPaths = [
    resolve(repoRoot, 'knowgrph', 'canvas', 'package.json'),
    resolve(repoRoot, 'curagrph', 'package.json'),
    resolve(repoRoot, 'gympgrph', 'package.json'),
  ]

  const files = repoSrcDirs
    .flatMap(dir => {
      try {
        return listFilesRecursively(dir, { ignoreDirNames })
      } catch {
        return []
      }
    })
    .filter(f => /\.(ts|tsx|js|jsx|json)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))

  const patterns: RegExp[] = [
    /\breactflow\b/i,
    /@xyflow\/react/i,
    /\blitegraph\.js\b/i,
    /jagenjo\/litegraph/i,
  ]
  const violations: Array<{ file: string; snippet: string }> = []

  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      const m = text.match(re)
      if (m && m[0]) {
        violations.push({ file, snippet: m[0] })
        break
      }
    }
  }

  for (const file of pkgJsonPaths) {
    try {
      const text = readFileSync(file, 'utf8')
      for (const re of patterns) {
        const m = text.match(re)
        if (m && m[0]) {
          violations.push({ file, snippet: m[0] })
          break
        }
      }
    } catch {
      void 0
    }
  }

  if (violations.length) {
    const msg = violations.map(v => `${v.file} contains ${JSON.stringify(v.snippet)}`).join('\n')
    throw new Error(
      `Forbidden Flow dependency/reference detected (Flow must remain native Canvas2D; do not import/copy React Flow or LiteGraph):\n${msg}`,
    )
  }
}

export function testForbidHardcodedSandboxAbsolutePaths() {
  const ignoreDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.trae'])
  const repoRoot = resolve(process.cwd(), '..', '..', '..')
  const repoSrcDirs = [
    SRC_DIR,
    resolve(repoRoot, 'curagrph', 'src'),
    resolve(repoRoot, 'gympgrph', 'src'),
    resolve(repoRoot, 'grph-shared', 'src'),
  ]
  const files = repoSrcDirs
    .flatMap(dir => {
      try {
        return listFilesRecursively(dir, { ignoreDirNames })
      } catch {
        return []
      }
    })
    .filter(f => /\.(ts|tsx|js|jsx|json)$/.test(f))

  const violations: Array<{ file: string; snippet: string }> = []
  const patterns: RegExp[] = [
    /\/Users\/[^\n]+\/Documents\/GitHub\/sandbox\//,
    /\/Users\/[^\n]+\/GitHub\/sandbox\//,
    /\/Users\/[^\n]+\/Documents\/GitHub\/sandbox\/demo\/abc123\.md/,
    /\/Users\/[^\n]+\/Documents\/GitHub\/sandbox\/demo\/trip-demo-mmd\.md/,
  ]
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8')
    for (const re of patterns) {
      const m = text.match(re)
      if (m && m[0]) {
        violations.push({ file, snippet: m[0] })
        break
      }
    }
  }
  if (violations.length) {
    const msg = violations.map(v => `${v.file} contains ${JSON.stringify(v.snippet)}`).join('\n')
    throw new Error(`Forbidden hardcoded absolute sandbox paths detected. Use sandboxRoot helpers + basenames or local test fixtures:\n${msg}`)
  }
}

export function testCanvas2dRendererSwitchWarmsInactiveRenderer() {
  const canvasPath = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readFileSync(canvasPath, 'utf8')
  const requiredSnippets = [
    "mounted2dRenderers.d3 ? <GraphCanvasLazy active={canvas2dRenderer === 'd3'} />",
    "mounted2dRenderers.flow ? <FlowCanvasLazy active={canvas2dRenderer === 'flow'} />",
    "canvasRenderMode === '2d' && (",
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`Canvas.tsx must warm-mount the inactive 2D renderer after prefetch, while toggling via active/visibility:\n${msg}`)
  }
}

export function testForbidTopLevelElkImportInFlowLayout() {
  const elkPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'elkLayout.ts')
  const text = readFileSync(elkPath, 'utf8')
  if (/\bimport\s+ELK\s+from\s+['"]elkjs\//.test(text)) {
    throw new Error('Flow ELK must be lazy-loaded via dynamic import to avoid switch-time main-thread stalls')
  }
}

export function testForbidLegacyToolbarToolMenuAreasSystem() {
  const toolbarDir = resolve(SRC_DIR, 'features', 'toolbar')
  let files: string[] = []
  try {
    files = listFilesRecursively(toolbarDir).filter(f => /\.(ts|tsx)$/.test(f))
  } catch {
    files = []
  }

  const forbiddenFileNameParts = [
    'ToolbarToolMenuAreas',
    'ToolbarToolMenuAreasInspector',
    'ToolbarToolMenuAreas.registry',
    'useToolbarMenuAction',
  ]
  const forbiddenContentPatterns: RegExp[] = [
    /\bTOOLBAR_AREA_RENDERERS\b/,
    /\bToolbarToolMenuAreasProps\b/,
  ]

  const violations: string[] = []
  for (const file of files) {
    const base = file.split(/[/\\]/).pop() || file
    if (forbiddenFileNameParts.some(part => base.includes(part))) {
      violations.push(file)
      continue
    }
    const text = readFileSync(file, 'utf8')
    if (forbiddenContentPatterns.some(re => re.test(text))) {
      violations.push(file)
    }
  }

  if (violations.length) {
    throw new Error(`Legacy toolbar tool-menu-areas system must not be reintroduced:\n${violations.join('\n')}`)
  }
}
