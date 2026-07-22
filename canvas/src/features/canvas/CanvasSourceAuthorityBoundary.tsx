import React from 'react'
import { useLocation } from 'react-router-dom'
import { resolveCanvasSourceAuthorityIntent } from '@/features/canvas/canvasDocDeepLink'
import {
  beginSourceFilesDocumentIntent,
  clearSourceFilesDocumentIntent,
  failSourceFilesDocumentIntent,
  SourceFilesDocumentIntentProvider,
} from '@/features/source-files/sourceFilesBootstrapReadiness'

export function CanvasSourceAuthorityBoundary(props: { children: React.ReactNode }) {
  const location = useLocation()
  const intent = React.useMemo(
    () => resolveCanvasSourceAuthorityIntent({
      pathname: String(location.pathname || ''),
      search: String(location.search || ''),
    }),
    [location.pathname, location.search],
  )
  const intentKey = intent.key
  const previousIntentKeyRef = React.useRef('')

  React.useLayoutEffect(() => {
    const previousKey = previousIntentKeyRef.current
    if (intentKey) {
      beginSourceFilesDocumentIntent(intentKey)
      if (intent.error) failSourceFilesDocumentIntent(intentKey, intent.error)
    }
    if (previousKey && previousKey !== intentKey) clearSourceFilesDocumentIntent(previousKey)
    previousIntentKeyRef.current = intentKey
  }, [intent.error, intentKey])

  return (
    <SourceFilesDocumentIntentProvider intentKey={intentKey}>
      {props.children}
    </SourceFilesDocumentIntentProvider>
  )
}
