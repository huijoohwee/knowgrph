declare module '*.json' {
  const value: Record<string, unknown>
  export default value
}

declare module '*.json?raw' {
  const value: string
  export default value
}

declare module '*.md?raw' {
  const value: string
  export default value
}

declare module '*.js?raw' {
  const value: string
  export default value
}

declare module '*.module.js?raw' {
  const value: string
  export default value
}
