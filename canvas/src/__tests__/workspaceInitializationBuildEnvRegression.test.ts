import fs from 'node:fs'
import path from 'node:path'

export function testWorkspaceInitializationDocsAbsRootDefaultStaysOutOfProductionBuilds() {
  const viteConfigPath = path.resolve(process.cwd(), 'vite.config.ts')
  const text = fs.readFileSync(viteConfigPath, 'utf8')
  if (!text.includes("if (command === 'build') return")) {
    throw new Error('expected sibling docs absolute-root defaults to stay out of production builds')
  }
  if (text.includes("if (!String(process.env.VITE_WORKSPACE_INITIALIZATION_DOCS_ABS_ROOT || '').trim() && existsSync(siblingDocsRoot))")) {
    throw new Error('expected vite config to avoid top-level sibling docs absolute-root defaults')
  }
  if (!text.includes('applyWorkspaceInitializationDocsAbsRootDefault(command)')) {
    throw new Error('expected vite config to apply workspace docs defaults through the command-aware owner')
  }
}
