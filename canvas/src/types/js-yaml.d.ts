declare module 'js-yaml' {
  export function load(str: string): unknown
  export function dump(value: unknown, options?: Record<string, unknown>): string
  const _default: {
    load: (str: string) => unknown
    dump: (value: unknown, options?: Record<string, unknown>) => string
  }
  export default _default
}
