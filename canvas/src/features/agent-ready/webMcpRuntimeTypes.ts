export type WebMcpToolInput = Record<string, unknown> | undefined

export type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  securitySchemes?: Array<Record<string, unknown>>
  execute: (input?: WebMcpToolInput) => Promise<unknown>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

export type ModelContextLike = {
  tools?: WebMcpTool[]
  provideContext?: (context: { tools: WebMcpTool[] }) => void
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void
}

export type WebMcpNavigator = Navigator & { modelContext?: ModelContextLike }

export type AgentReadyToolContract = {
  name: string
  webName: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  securitySchemes?: Array<Record<string, unknown>>
  annotations?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

export type ModelContextRegistrationState = {
  registeredToolNames: Set<string>
  abortControllers: Map<string, AbortController | null>
}

export type WebMcpRuntimeState = {
  fallbackContext: ModelContextLike | null
  activeRegisteredContext: ModelContextLike | null
  registrations: WeakMap<ModelContextLike, ModelContextRegistrationState>
  lateBindingRetryId: number | null
  lateBindingAttemptCount: number
}
