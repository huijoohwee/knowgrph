export const createWebMcpLifecycleController = (args = {}) => {
  const root = args.root
  const lifecycleState = args.state
  const tools = Array.isArray(args.tools) ? args.tools : []
  const toolNames = Array.isArray(args.toolNames) ? args.toolNames : []
  const lateBindingRetryDelayMs = Number(args.lateBindingRetryDelayMs || 500)
  const lateBindingMaxAttempts = Number(args.lateBindingMaxAttempts || 20)
  const markRuntimeState = typeof args.markRuntimeState === 'function' ? args.markRuntimeState : () => {}

  if (!root || !lifecycleState || typeof lifecycleState !== 'object') {
    throw new Error('root and state are required')
  }

  const normalizeString = (value) => String(value || '').trim()

  const readGlobalNavigator = () => {
    const windowNavigator = root.window && root.window.navigator
    if (windowNavigator && root.navigator !== windowNavigator) {
      try {
        Object.defineProperty(root, 'navigator', {
          configurable: true,
          value: windowNavigator,
        })
      } catch {
        root.navigator = windowNavigator
      }
      return windowNavigator
    }
    if (root.navigator) return root.navigator
    const navigatorObject = {}
    try {
      Object.defineProperty(root, 'navigator', {
        configurable: true,
        value: navigatorObject,
      })
    } catch {
      root.navigator = navigatorObject
    }
    return navigatorObject
  }

  const getRegistrationState = (context) => {
    const existing = lifecycleState.registrations.get(context)
    if (existing) return existing
    const created = {
      registeredToolNames: new Set(),
      abortControllers: new Map(),
    }
    lifecycleState.registrations.set(context, created)
    return created
  }

  const createFallbackModelContext = () => {
    const context = { tools: [] }
    const upsertTool = (tool) => {
      if (!tool || !tool.name) return
      const existingIndex = context.tools.findIndex((entry) => entry && entry.name === tool.name)
      if (existingIndex >= 0) context.tools.splice(existingIndex, 1, tool)
      else context.tools.push(tool)
    }
    context.provideContext = (provided = {}) => {
      context.tools.splice(0, context.tools.length)
      const providedTools = Array.isArray(provided.tools) ? provided.tools : []
      for (const tool of providedTools) upsertTool(tool)
    }
    context.registerTool = (tool, options = {}) => {
      if (!tool || !tool.name) throw new Error('tool name is required')
      if (context.tools.some((entry) => entry && entry.name === tool.name)) {
        const error = new Error(`tool already registered: ${tool.name}`)
        error.name = 'InvalidStateError'
        throw error
      }
      if (options.signal?.aborted) return
      context.tools.push(tool)
      if (options.signal && typeof options.signal.addEventListener === 'function') {
        options.signal.addEventListener('abort', () => {
          const index = context.tools.findIndex((entry) => entry && entry.name === tool.name)
          if (index >= 0) context.tools.splice(index, 1)
        }, { once: true })
      }
    }
    context.provideContext({ tools })
    return context
  }

  const isDuplicateToolRegistrationError = (error) => {
    if (!error || typeof error !== 'object') return false
    return normalizeString(error.name) === 'InvalidStateError'
  }

  const releasePreviousRegisteredContext = (nextContext) => {
    const active = lifecycleState.activeRegisteredContext
    if (!active || active === nextContext) {
      lifecycleState.activeRegisteredContext = nextContext
      return
    }
    const registrationState = lifecycleState.registrations.get(active)
    if (registrationState) {
      registrationState.abortControllers.forEach((controller) => {
        if (controller && typeof controller.abort === 'function') controller.abort()
      })
    }
    lifecycleState.activeRegisteredContext = nextContext
  }

  const clearLateBindingRetry = () => {
    if (lifecycleState.lateBindingRetryId === null || !root.window || typeof root.window.clearTimeout !== 'function') return
    root.window.clearTimeout(lifecycleState.lateBindingRetryId)
    lifecycleState.lateBindingRetryId = null
  }

  const installToolsIntoModelContext = (context) => {
    const registrationState = getRegistrationState(context)
    let providedContext = false
    if (typeof context.provideContext === 'function') {
      try {
        context.provideContext({ tools })
        providedContext = true
      } catch {
        void 0
      }
    }
    if (providedContext) {
      releasePreviousRegisteredContext(context)
      return true
    }
    if (typeof context.registerTool === 'function') {
      for (const tool of tools) {
        if (registrationState.registeredToolNames.has(tool.name)) continue
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        try {
          context.registerTool(tool, controller ? { signal: controller.signal } : {})
          registrationState.registeredToolNames.add(tool.name)
          registrationState.abortControllers.set(tool.name, controller)
        } catch (error) {
          if (!isDuplicateToolRegistrationError(error)) continue
          registrationState.registeredToolNames.add(tool.name)
          registrationState.abortControllers.set(tool.name, null)
        }
      }
    }
    if (Array.isArray(context.tools)) {
      for (const tool of tools) {
        if (!context.tools.some((entry) => entry && entry.name === tool.name)) context.tools.push(tool)
      }
    }
    const allToolsRegistered = tools.every((tool) =>
      registrationState.registeredToolNames.has(tool.name)
      || (Array.isArray(context.tools) && context.tools.some((entry) => entry && entry.name === tool.name))
    )
    if (allToolsRegistered) {
      releasePreviousRegisteredContext(context)
      return true
    }
    return providedContext && typeof context.registerTool !== 'function' && !Array.isArray(context.tools)
  }

  const tryInstallLateBoundModelContext = (nav) => {
    const context = nav.modelContext
    if (!context || context === lifecycleState.fallbackContext) return false
    const installed = installToolsIntoModelContext(context)
    if (installed) {
      clearLateBindingRetry()
      markRuntimeState('installed')
      return true
    }
    return false
  }

  const scheduleLateBindingRetry = (nav) => {
    if (!root.window || typeof root.window.setTimeout !== 'function') return
    if (lifecycleState.lateBindingRetryId !== null) return
    if (lifecycleState.lateBindingAttemptCount >= lateBindingMaxAttempts) {
      markRuntimeState('retry-exhausted')
      return
    }
    lifecycleState.lateBindingRetryId = root.window.setTimeout(() => {
      lifecycleState.lateBindingRetryId = null
      lifecycleState.lateBindingAttemptCount += 1
      if (!tryInstallLateBoundModelContext(nav)) scheduleLateBindingRetry(nav)
    }, lateBindingRetryDelayMs)
  }

  const defineFallbackModelContext = (nav, context) => {
    lifecycleState.fallbackContext = context
    const doc = root.document
    let currentContext = (doc && doc.modelContext && doc.modelContext !== context)
      ? doc.modelContext
      : nav.modelContext && nav.modelContext !== context ? nav.modelContext : context
    const descriptor = {
      configurable: true,
      enumerable: false,
      get: () => currentContext,
      set: (value) => {
        currentContext = value || context
        if (currentContext !== context) void tryInstallLateBoundModelContext(nav)
      },
    }
    try {
      Object.defineProperty(nav, 'modelContext', descriptor)
    } catch {
      nav.modelContext = context
    }
    if (doc && !doc.modelContext) {
      try {
        Object.defineProperty(doc, 'modelContext', descriptor)
      } catch {
        void 0
      }
    }
  }

  const install = () => {
    const nav = readGlobalNavigator()
    markRuntimeState('installing')
    const docContext = root.document && root.document.modelContext
    if (docContext && !nav.modelContext) {
      try {
        Object.defineProperty(nav, 'modelContext', {
          configurable: true,
          enumerable: false,
          get: () => root.document && root.document.modelContext,
          set: (value) => {
            if (value && value !== docContext) void installToolsIntoModelContext(value)
          },
        })
      } catch {
        nav.modelContext = docContext
      }
    }
    if (docContext && installToolsIntoModelContext(docContext)) {
      markRuntimeState('installed')
      return
    }
    if (nav.modelContext && installToolsIntoModelContext(nav.modelContext)) {
      markRuntimeState('installed')
      return
    }
    if (!nav.modelContext) defineFallbackModelContext(nav, createFallbackModelContext())
    markRuntimeState(
      toolNames.every((toolName) => nav.modelContext && Array.isArray(nav.modelContext.tools) && nav.modelContext.tools.some((entry) => entry && entry.name === toolName))
        ? 'fallback-readable'
        : 'awaiting-model-context',
    )
    scheduleLateBindingRetry(nav)
  }

  return {
    install,
    clearLateBindingRetry,
    installToolsIntoModelContext,
    tryInstallLateBoundModelContext,
    scheduleLateBindingRetry,
    defineFallbackModelContext,
    readGlobalNavigator,
  }
}
