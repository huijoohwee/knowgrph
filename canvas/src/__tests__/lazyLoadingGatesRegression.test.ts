import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testHeavyFeatureSurfacesUseTargetedLazyLoadingGates() {
  const root = process.cwd()
  const mainText = readFileSync(resolve(root, 'src', 'main.tsx'), 'utf8')
  if (mainText.includes("import 'monaco-editor/dev/vs/style.css'")) {
    throw new Error('expected monaco styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }
  if (mainText.includes("import 'maplibre-gl/dist/maplibre-gl.css'")) {
    throw new Error('expected maplibre styles to be lazy-loaded instead of eagerly imported in main.tsx')
  }

  const monacoTextEditorText = readFileSync(resolve(root, 'src', 'lib', 'monaco', 'MonacoTextEditor.impl.tsx'), 'utf8')
  if (!monacoTextEditorText.includes('ensureMonacoStyles')) {
    throw new Error('expected MonacoTextEditor to gate style loading via ensureMonacoStyles')
  }
  if (monacoTextEditorText.includes("stickyScrollContribution")) {
    throw new Error('expected MonacoTextEditor to avoid eagerly importing sticky scroll contrib')
  }
  if (monacoTextEditorText.includes('stickyScroll: {')) {
    throw new Error('expected MonacoTextEditor to avoid enabling sticky scroll by default on the slim Monaco path')
  }
  if (!monacoTextEditorText.includes("await loadMonacoLanguageContribution(language)")) {
    throw new Error('expected MonacoTextEditor to lazy-load Monaco language contributions per active language')
  }
  if (!monacoTextEditorText.includes("await import('monaco-editor/esm/vs/language/json/monaco.contribution')")) {
    throw new Error('expected MonacoTextEditor to lazy-load JSON language support only when needed')
  }
  if (!monacoTextEditorText.includes("await import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution')")) {
    throw new Error('expected MonacoTextEditor to lazy-load SQL language support only when needed')
  }

  const monacoEnvironmentText = readFileSync(resolve(root, 'src', 'features', 'monaco', 'monacoEnvironment.ts'), 'utf8')
  if (monacoEnvironmentText.includes("html.worker?worker")) {
    throw new Error('expected Monaco environment to avoid bundling the unused HTML worker')
  }
  if (monacoEnvironmentText.includes("label === 'html'")) {
    throw new Error('expected Monaco environment to avoid routing unused HTML-family labels to a dedicated worker')
  }

  const markdownCodeBlockText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx'), 'utf8')
  if (!markdownCodeBlockText.includes('MermaidDiagramLazy') || !markdownCodeBlockText.includes('React.Suspense')) {
    throw new Error('expected MarkdownCodeBlock to lazy-load MermaidDiagram behind suspense')
  }

  const mdxComponentsText = readFileSync(resolve(root, 'src', 'features', 'markdown', 'ui', 'mdxComponents.tsx'), 'utf8')
  if (!mdxComponentsText.includes('MermaidDiagramLazy') || !mdxComponentsText.includes('React.Suspense')) {
    throw new Error('expected mdxComponents Mermaid renderer to lazy-load MermaidDiagram')
  }

  const mermaidRuntimeText = readFileSync(resolve(root, 'src', 'lib', 'mermaid', 'mermaidRuntime.ts'), 'utf8')
  if (!mermaidRuntimeText.includes("return header.startsWith('graph ') || header.startsWith('flowchart ')")) {
    throw new Error('expected mermaid runtime to constrain elk support to graph or flowchart families')
  }
  if (!mermaidRuntimeText.includes("const layout = String((config as Record<string, unknown>)?.layout || '').trim().toLowerCase()")) {
    throw new Error('expected mermaid runtime to branch standard vs elk by explicit layout config')
  }
  if (!mermaidRuntimeText.includes("await import('@/lib/mermaid/mermaidElkRuntime')")) {
    throw new Error('expected mermaid runtime to lazy-load elk registration only for explicit elk layouts')
  }

  const threeGraphText = readFileSync(resolve(root, 'src', 'lib', 'three', 'ThreeGraph.impl.tsx'), 'utf8')
  if (!threeGraphText.includes("await import('three/examples/jsm/exporters/GLTFExporter.js')")) {
    throw new Error('expected ThreeGraph GLTF export path to lazy-load GLTFExporter')
  }

  const activeGraphDataText = readFileSync(resolve(root, 'src', 'hooks', 'useActiveGraphData.ts'), 'utf8')
  if (activeGraphDataText.includes("from '@/lib/mermaid/mermaidFrontmatterGeometry'")) {
    throw new Error('expected useActiveGraphData to avoid static mermaidFrontmatterGeometry import on startup path')
  }
  if (!activeGraphDataText.includes("import('@/lib/mermaid/mermaidFrontmatterGeometry')")) {
    throw new Error('expected useActiveGraphData to lazy-load mermaidFrontmatterGeometry for frontmatter geometry application')
  }

  const inlineMarkdownGeoJsonText = readFileSync(resolve(root, 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx'), 'utf8')
  if (!inlineMarkdownGeoJsonText.includes("from 'gympgrph/map-preview'")) {
    throw new Error('expected inline markdown GeoJSON preview to import the narrow gympgrph map-preview entry')
  }
  if (inlineMarkdownGeoJsonText.includes("from 'gympgrph'")) {
    throw new Error('expected inline markdown GeoJSON preview to avoid the heavy gympgrph root entry')
  }

  const viteConfigText = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
  if (!viteConfigText.includes("nodeRequire.resolve('three/src/Three.js')")) {
    throw new Error('expected vite config to resolve three through its source barrel so coarse subchunks can split cleanly')
  }
  if (!viteConfigText.includes("nodeRequire.resolve('maplibre-gl/src/index.ts')")) {
    throw new Error('expected vite config to resolve maplibre through its source entry so coarse subchunks can split cleanly')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/examples/')) return 'three-examples'")) {
    throw new Error('expected vite config to split three examples into a separate coarse lazy chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@react-three/fiber/')) return 'three-fiber'")) {
    throw new Error('expected vite config to split react-three-fiber from three core')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/renderers/')) return 'three-renderers'")) {
    throw new Error('expected vite config to split three renderers into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/math/')) return 'three-math'")) {
    throw new Error('expected vite config to split three math internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/materials/')) return 'three-materials'")) {
    throw new Error('expected vite config to split three materials into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/geometries/')) return 'three-geometries'")) {
    throw new Error('expected vite config to split three geometries into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/src/core/')) return 'three-scene-core'")) {
    throw new Error('expected vite config to split three scene core internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/three/')) return 'three-core'")) {
    throw new Error('expected vite config to keep the remaining three internals isolated from feature chunks')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/render/')) return 'maplibre-render'")) {
    throw new Error('expected vite config to split maplibre render internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/source/')) return 'maplibre-source'")) {
    throw new Error('expected vite config to split maplibre source internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/shaders/')) return 'maplibre-shaders'")) {
    throw new Error('expected vite config to split maplibre shader internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/')) return 'maplibre-core'")) {
    throw new Error('expected vite config to keep maplibre core isolated from render/source subchunks')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/')) return 'monaco-editor-browser'")) {
    throw new Error('expected vite config to split monaco browser editor internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/widget/')) return 'monaco-editor-widget'")) {
    throw new Error('expected vite config to split monaco editor widget internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/viewParts/')) return 'monaco-editor-viewparts'")) {
    throw new Error('expected vite config to split monaco editor view parts into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/view/')) return 'monaco-editor-view'")) {
    throw new Error('expected vite config to split monaco editor view internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/controller/')) return 'monaco-editor-controller'")) {
    throw new Error('expected vite config to split monaco editor controller internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/browser/services/')) return 'monaco-editor-browser-services'")) {
    throw new Error('expected vite config to split monaco editor browser services into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/model/')) return 'monaco-editor-model'")) {
    throw new Error('expected vite config to split monaco editor model internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/languages/')) return 'monaco-editor-languages'")) {
    throw new Error('expected vite config to split monaco editor language internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/services/')) return 'monaco-editor-services'")) {
    throw new Error('expected vite config to split monaco editor services into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/common/')) return 'monaco-editor-common'")) {
    throw new Error('expected vite config to split monaco common editor internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/editor/contrib/')) return 'monaco-contrib'")) {
    throw new Error('expected vite config to split monaco editor contrib internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/platform/')) return 'monaco-platform'")) {
    throw new Error('expected vite config to split monaco platform internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/browser/')) return 'monaco-base-browser'")) {
    throw new Error('expected vite config to split monaco browser base internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/monaco-editor/esm/vs/base/common/')) return 'monaco-base-common'")) {
    throw new Error('expected vite config to split monaco common base internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/mermaid/dist/chunks/mermaid.core/flowDiagram')) return 'mermaid-flow'")) {
    throw new Error('expected vite config to split mermaid flowchart runtime into its own coarse chunk')
  }
  if (!viteConfigText.includes("name: 'knowgrph-strip-mermaid-architecture-detector'")) {
    throw new Error('expected vite config to strip the stock mermaid architecture detector from the standard runtime path')
  }
  if (!viteConfigText.includes("registerLazyLoadedDiagrams(detector_default, detector_default3);")) {
    throw new Error('expected vite config to patch mermaid core so architecture is not registered by default')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/mermaid/dist/chunks/mermaid.core/')) return 'mermaid-core-runtime'")) {
    throw new Error('expected vite config to isolate shared mermaid runtime chunks from diagram-specific chunks')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/dist/chunks/mermaid-layout-elk.esm.min/render-')) return 'mermaid-elk-render'")) {
    throw new Error('expected vite config to split mermaid elk render internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/@mermaid-js/layout-elk/')) return 'mermaid-elk-core'")) {
    throw new Error('expected vite config to keep mermaid elk core isolated from its render internals')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/ui/')) return 'maplibre-ui'")) {
    throw new Error('expected vite config to split maplibre ui internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/style/')) return 'maplibre-style'")) {
    throw new Error('expected vite config to split maplibre style internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/geo/')) return 'maplibre-geo'")) {
    throw new Error('expected vite config to split maplibre geo internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/util/')) return 'maplibre-util'")) {
    throw new Error('expected vite config to split maplibre util internals into a separate coarse chunk')
  }
  if (!viteConfigText.includes("if (moduleId.includes('/node_modules/maplibre-gl/src/data/')) return 'maplibre-data'")) {
    throw new Error('expected vite config to split maplibre data internals into a separate coarse chunk')
  }
}
