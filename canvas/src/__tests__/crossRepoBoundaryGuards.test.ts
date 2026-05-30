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
const KNOWGRPH_ROOT = resolve(process.cwd(), '..')

export function testForbidSiblingRepoSourceImports() {
  const files = listFilesRecursively(SRC_DIR).filter(f => /\.(ts|tsx)$/.test(f))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"][^'"]*gympgrph\/src\//,
    /\bimport\(\s*['"][^'"]*gympgrph\/src\//,
    /\brequire\(\s*['"][^'"]*gympgrph\/src\//,
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

export function testHostGympgrphIntegrationUsesDeclaredPackageEntrypointsOnly() {
  const files = listFilesRecursively(SRC_DIR)
    .filter(f => /\.(ts|tsx)$/.test(f))
    .filter(f => !f.includes(join('src', '__tests__')))
    .filter(f => !f.includes(join('src', 'tests')))
    .filter(f => !f.includes(join('src', 'cli')))
  const violations: Array<{ file: string; pattern: string }> = []
  const patterns: RegExp[] = [
    /\bfrom\s+['"]gympgrph\/(?!map-preview['"]|testkit['"])[^'"]+['"]/,
    /\bimport\(\s*['"]gympgrph\/(?!map-preview['"]|testkit['"])[^'"]+['"]/,
    /\brequire\(\s*['"]gympgrph\/(?!map-preview['"]|testkit['"])[^'"]+['"]/,
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
    throw new Error(`Knowgrph must import gympgrph via declared package entrypoints only:\n${msg}`)
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

export function testForbidEditorJsDependencies() {
  const ignoreDirNames = new Set(['node_modules', 'dist', 'build', 'coverage', '.git'])
  const repoSrcDirs = [
    SRC_DIR,
    resolve(KNOWGRPH_ROOT, 'gympgrph', 'src'),
  ]
  const pkgJsonPaths = [
    resolve(KNOWGRPH_ROOT, 'gympgrph', 'package.json'),
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
  const repoSrcDirs = [
    SRC_DIR,
    resolve(KNOWGRPH_ROOT, 'gympgrph', 'src'),
  ]
  const pkgJsonPaths = [
    resolve(KNOWGRPH_ROOT, 'canvas', 'package.json'),
    resolve(KNOWGRPH_ROOT, 'gympgrph', 'package.json'),
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
    /react-flow__handle/i,
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
  const repoSrcDirs = [
    SRC_DIR,
    resolve(KNOWGRPH_ROOT, 'gympgrph', 'src'),
    resolve(KNOWGRPH_ROOT, 'grph-shared', 'src'),
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
    /\/Users\/[^\n]+\/Documents\/GitHub\/sandbox\/demo\/markdown-slide-demo\.md/,
    /\/Users\/[^\n]+\/GitHub\/sandbox\/demo\/markdown-slide-demo\.md/,
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

export function testForbidHardcodedRuntimeValidationInputInRepo() {
  const runtimeInputPath = String(process.env.KG_TEST_VALIDATION_FORBID_HARDCODE_IN_REPO || '').trim()
  if (!runtimeInputPath) return

  const normalizedInputPath = runtimeInputPath.replace(/\\/g, '/')
  const pathParts = normalizedInputPath.split('/').filter(Boolean)
  const basename = pathParts[pathParts.length - 1] || ''
  const pathTail = pathParts.slice(-3).join('/')
  const forbiddenNeedles = Array.from(new Set([normalizedInputPath, pathTail, basename].filter(v => v.length >= 4)))
  if (!forbiddenNeedles.length) return

  const ignoreDirNames = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    '.trae',
    'data',
  ])
  const files = listFilesRecursively(KNOWGRPH_ROOT, { ignoreDirNames })
    .filter(f => /\.(ts|tsx|js|jsx|json|md|mjs|cjs|py|yml|yaml|toml|gltf)$/.test(f))

  const violations: Array<{ file: string; needle: string }> = []
  for (const file of files) {
    const st = statSync(file)
    if (!st.isFile()) continue
    const text = readFileSync(file, 'utf8').replace(/\\/g, '/')
    for (const needle of forbiddenNeedles) {
      if (text.includes(needle)) {
        violations.push({ file, needle })
        break
      }
    }
  }

  if (violations.length) {
    const msg = violations.map(v => `${v.file} contains ${JSON.stringify(v.needle)}`).join('\n')
    throw new Error(`Runtime validation inputs must stay external and must not be hardcoded in the repo under test:\n${msg}`)
  }
}

export function testCanvasViewportMountsOnlyActiveRendererSurface() {
  const viewportPath = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const canvasPagePath = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readFileSync(viewportPath, 'utf8')
  const canvasPageText = readFileSync(canvasPagePath, 'utf8')
  const requiredSnippets = [
    "d3SurfaceActive ? <GraphCanvasLazy active /> : null",
    "active2dSurface === 'flow' ? <FlowCanvasLazy active /> : null",
    "active2dSurface === 'flowEditor' ? <FlowEditorCanvasLazy active /> : null",
    "canvasRenderMode === '2d' && (",
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`CanvasViewport must mount only the active renderer surface instead of retaining inactive renderer trees:\n${msg}`)
  }
  if (text.includes('mounted2dRenderers')) {
    throw new Error('CanvasViewport should not retain a mounted2dRenderers warm-state map after switching renderers')
  }
  if (text.includes('threeWarmed') || text.includes('geospatialWarmed')) {
    throw new Error('CanvasViewport should not keep warmed 3d/geospatial overlays mounted after mode switches')
  }
  if (canvasPageText.includes('mounted2dRenderers')) {
    throw new Error('Canvas page should not track mounted renderer history once viewport ownership is active-only')
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
