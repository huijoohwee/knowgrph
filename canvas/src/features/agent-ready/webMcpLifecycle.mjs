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
    let currentContext = nav.modelContext && nav.modelContext !== context ? nav.modelContext : context
    try {
      Object.defineProperty(nav, 'modelContext', {
        configurable: true,
        enumerable: false,
        get: () => currentContext,
        set: (value) => {
          currentContext = value || context
          if (currentContext !== context) void tryInstallLateBoundModelContext(nav)
        },
      })
    } catch {
      nav.modelContext = context
    }
  }

  const install = () => {
    const nav = readGlobalNavigator()
    markRuntimeState('installing')
    if (nav.modelContext && installToolsIntoModelContext(nav.modelContext)) {
      markRuntimeState('installed')
      return
    }
    if (!nav.modelContext) defineFallbackModelContext(nav, { tools: [...tools] })
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
