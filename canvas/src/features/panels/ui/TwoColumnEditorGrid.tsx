import React from 'react'

export interface TwoColumnEditorGridProps {
  children: React.ReactNode
  className?: string
}

export function TwoColumnEditorGrid({ children, className }: TwoColumnEditorGridProps) {
  const rootClassName = ['grid grid-cols-2 gap-2', className || ''].filter(Boolean).join(' ')
  return (
    <div className={rootClassName}>
      {children}
    </div>
  )
}

