import React from 'react'

type State = { hasError: boolean; error?: unknown; componentStack?: string }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, State> {
  constructor(props: React.PropsWithChildren<object>) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error }
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    try {
      const stack = String(info?.componentStack || '')
      this.setState({ componentStack: stack })
    } catch {
      void 0
    }
    try {
      console.error(error)
    } catch {
      void 0
    }
  }
  render() {
    if (!this.state.hasError) return this.props.children
    const message = (() => {
      const e = this.state.error
      if (!e) return 'Unknown error'
      if (e instanceof Error) return `${e.name}: ${e.message}`
      return String(e)
    })()
    const stack = this.state.error instanceof Error ? String(this.state.error.stack || '') : ''
    const details = [message, stack, this.state.componentStack || ''].filter(Boolean).join('\n')
    return (
      <div className="p-3 text-sm text-red-600">
        <div>Something went wrong.</div>
        <div className="mt-2 whitespace-pre-wrap break-words text-xs text-red-700">{details}</div>
      </div>
    )
  }
}
