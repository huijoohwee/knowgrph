import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

const ERROR_BOUNDARY_TOAST_ID = 'react:error-boundary'

export function formatErrorBoundaryToastMessage(error: unknown): string {
  if (!error) return 'Application error'
  if (error instanceof Error) {
    const message = String(error.message || '').trim()
    return message ? `${error.name}: ${message}` : error.name
  }
  const message = String(error).trim()
  return message || 'Application error'
}

function upsertErrorBoundaryToast(error: unknown): void {
  try {
    useGraphStore.getState().upsertUiToast({
      id: ERROR_BOUNDARY_TOAST_ID,
      kind: 'error',
      message: formatErrorBoundaryToastMessage(error),
      ttlMs: null,
      dismissible: true,
    })
  } catch {
    void 0
  }
}

type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, State> {
  constructor(props: React.PropsWithChildren<object>) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: unknown): State {
    void error
    return { hasError: true }
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    try {
      void info
      upsertErrorBoundaryToast(error)
    } catch {
      void 0
    }
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <section className="sr-only" role="status" aria-live="polite">
        Application error surfaced in notifications.
      </section>
    )
  }
}
