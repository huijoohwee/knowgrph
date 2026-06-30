type LaunchDropdownFallbackModule = typeof import('./launchDropdownFallbacks')

let launchDropdownFallbackModulePromise: Promise<LaunchDropdownFallbackModule> | null = null

export const loadLaunchDropdownFallbackModule = (): Promise<LaunchDropdownFallbackModule> => {
  if (!launchDropdownFallbackModulePromise) {
    launchDropdownFallbackModulePromise = import('./launchDropdownFallbacks')
      .then(module => module)
      .catch(error => {
        launchDropdownFallbackModulePromise = null
        throw error
      })
  }
  return launchDropdownFallbackModulePromise
}
