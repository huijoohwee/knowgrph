import React from 'react'
import CollapsibleSubsection from '@/features/panels/ui/CollapsibleSubsection'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { getSchemaSubsectionStorageKey } from '@/lib/config'

export default function Subsection({
  title,
  children,
  defaultCollapsed = true,
}: {
  title: string
  children: React.ReactNode
  defaultCollapsed?: boolean
}) {
  const slug = String(title).toLowerCase().replace(/\s+/g, '-')
  const [collapsed, setCollapsed] = usePersistedBoolean(
    getSchemaSubsectionStorageKey(slug),
    defaultCollapsed,
  )
  return (
    <CollapsibleSubsection title={title} collapsed={collapsed} onToggle={setCollapsed}>{children}</CollapsibleSubsection>
  )
}
