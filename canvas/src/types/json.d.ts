declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}

declare module '*.json?raw' {
  const value: string
  export default value
}
