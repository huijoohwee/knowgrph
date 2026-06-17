import React from 'react'
import { SimpleKeyValueRow as SharedSimpleKeyValueRow } from 'grph-shared/react/keyTypeValueRow'
import {
  resolveCanvasKeyTypeValueDensityClassName,
  useCanvasKeyTypeValueRuntime,
} from '@/features/panels/ui/canvasKeyTypeValueRuntime'

export interface SimpleKeyValueRowProps {
  label: React.ReactNode
  children: React.ReactNode
  align?: 'center' | 'start'
  density?: 'default' | 'compact'
  className?: string
}

export function SimpleKeyValueRow({
  label,
  children,
  align,
  density = 'default',
  className,
}: SimpleKeyValueRowProps) {
  const runtime = useCanvasKeyTypeValueRuntime()
  const densityClassName = resolveCanvasKeyTypeValueDensityClassName(runtime, density)

  return (
    <SharedSimpleKeyValueRow
      label={label}
      textSizeClassName={runtime.uiPanelKeyValueTextSizeClass}
      fontClassName={runtime.uiPanelTextFontClass}
      densityClassName={densityClassName}
      align={align}
      className={className}
    >
      {children}
    </SharedSimpleKeyValueRow>
  )
}
