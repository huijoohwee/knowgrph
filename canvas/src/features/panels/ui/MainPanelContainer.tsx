import React from 'react'

export default function MainPanelContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const base = 'MainPanelContainer h-full flex flex-col p-0 rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60 overflow-hidden'
  return <div className={`${base} ${className || ''}`}>{children}</div>
}
