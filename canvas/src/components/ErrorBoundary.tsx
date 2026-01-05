import React from 'react'

type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, State> {
  constructor(props: React.PropsWithChildren<object>) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): State {
    return { hasError: true }
  }
  componentDidCatch(): void {}
  render() {
    if (this.state.hasError) {
      return <div className="p-3 text-sm text-red-600">Something went wrong.</div>
    }
    return this.props.children
  }
}
