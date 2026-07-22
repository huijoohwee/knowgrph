import { createBrowserSafeFunctionSource } from './browserFunctionSource.mjs'
import { createWebMcpLifecycleController } from './webMcpLifecycle.mjs'

export const WEB_MCP_LIFECYCLE_CONTROLLER_BROWSER_SOURCE =
  createBrowserSafeFunctionSource(createWebMcpLifecycleController)
