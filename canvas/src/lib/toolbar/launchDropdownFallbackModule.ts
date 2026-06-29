type LaunchDropdownFallbackModule = typeof import('@/features/toolbar/launchDropdownFallbacks')

let launchDropdownFallbackModulePromise: Promise<LaunchDropdownFallbackModule> | null = null

export const loadLaunchDropdownFallbackModule = (): Promise<LaunchDropdownFallbackModule> => {
  if (!launchDropdownFallbackModulePromise) {
    launchDropdownFallbackModulePromise = import('@/features/toolbar/launchDropdownFallbacks')
      .then(mod => mod)
      .catch(err => {
        launchDropdownFallbackModulePromise = null
        throw err
      })
  }
  return launchDropdownFallbackModulePromise
}
