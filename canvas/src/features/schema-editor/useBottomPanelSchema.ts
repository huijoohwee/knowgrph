import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSchemaTab } from '@/features/schema-editor/useSchemaTab'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { BottomTab } from '@/features/bottom-panel/open'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'

type TabKey = BottomTab

export type SchemaUiApplyRegistration = {
  apply: () => void
  schemaHash: string
}

let lastSchemaUiApplyRegistration: SchemaUiApplyRegistration | null = null
let lastSchemaUiEditorOpen = false

export function getSchemaUiApplyRegistrationSnapshot(): SchemaUiApplyRegistration | null {
  return lastSchemaUiApplyRegistration
}

export function isSchemaUiEditorOpenSnapshot(): boolean {
  return lastSchemaUiEditorOpen
}

export function canUseSchemaUiApplyRegistration(
  reg: SchemaUiApplyRegistration | null,
  currentSchemaHash: string,
): reg is SchemaUiApplyRegistration {
  if (!reg) return false
  const regHash = typeof reg.schemaHash === 'string' ? reg.schemaHash : ''
  const curHash = typeof currentSchemaHash === 'string' ? currentSchemaHash : ''
  if (!regHash || !curHash) return false
  return regHash === curHash
}

export function useBottomPanelSchema(tab: TabKey) {
  const {
    schema,
    setSchema,
    schemaText,
    setSchemaText,
    schemaError,
    onImportSchema,
    onApplySchema,
    onResetSchema,
    schemaActions,
    schemaLastExportHash,
    schemaHash,
    schemaUnsaved,
    uniqueNodeTypes,
    uniqueEdgeLabels,
    filteredNodeTypes,
    filteredEdgeLabels,
  } = useSchemaTab(tab)

  const [schemaUiEditorOpen, setSchemaUiEditorOpen] = useState(false)
  const schemaUiApplyRef = useRef<SchemaUiApplyRegistration | null>(null)
  const [schemaUiStep31Collapsed, setSchemaUiStep31Collapsed] = usePersistedBoolean(
    LS_KEYS.schemaUiStep31Collapsed,
    true,
  )
  const [schemaUiStep32Collapsed, setSchemaUiStep32Collapsed] = usePersistedBoolean(
    LS_KEYS.schemaUiStep32Collapsed,
    true,
  )
  const [schemaUiStep33Collapsed, setSchemaUiStep33Collapsed] = usePersistedBoolean(
    LS_KEYS.schemaUiStep33Collapsed,
    true,
  )
  const [schemaUiStep332Collapsed, setSchemaUiStep332Collapsed] = usePersistedBoolean(
    LS_KEYS.schemaUiStep332Collapsed,
    true,
  )

  useEffect(() => {
    lastSchemaUiEditorOpen = schemaUiEditorOpen
  }, [schemaUiEditorOpen])

  const registerSchemaUiApply = useCallback((reg: SchemaUiApplyRegistration) => {
    schemaUiApplyRef.current = reg
    lastSchemaUiApplyRegistration = reg
  }, [])

  const handleSchemaUiCollapseAll = useCallback(() => {
    setSchemaUiStep31Collapsed(true)
    setSchemaUiStep32Collapsed(true)
    setSchemaUiStep33Collapsed(true)
    setSchemaUiStep332Collapsed(true)
  }, [setSchemaUiStep31Collapsed, setSchemaUiStep32Collapsed, setSchemaUiStep33Collapsed, setSchemaUiStep332Collapsed])

  const handleSchemaUiExpandAll = useCallback(() => {
    setSchemaUiStep31Collapsed(false)
    setSchemaUiStep32Collapsed(false)
    setSchemaUiStep33Collapsed(false)
    setSchemaUiStep332Collapsed(false)
  }, [setSchemaUiStep31Collapsed, setSchemaUiStep32Collapsed, setSchemaUiStep33Collapsed, setSchemaUiStep332Collapsed])

  const handleApplySchema = useCallback(() => {
    if (tab !== 'schema') return
    if (!schemaUiEditorOpen) {
      onApplySchema()
      return
    }

    const computeStoreSchemaHash = () => {
      try {
        return JSON.stringify(useGraphStore.getState().schema)
      } catch {
        return ''
      }
    }

    const tryUiApply = (): boolean => {
      const reg = schemaUiApplyRef.current
      const currentHash = computeStoreSchemaHash()
      if (!canUseSchemaUiApplyRegistration(reg, currentHash)) return false
      reg.apply()
      return true
    }

    if (tryUiApply()) return

    try {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          if (tryUiApply()) return
          onApplySchema()
        }, 0)
        return
      }
    } catch {
      void 0
    }

    onApplySchema()
  }, [onApplySchema, tab, schemaUiEditorOpen])

  const enhancedSchemaActions = useMemo(
    () =>
      schemaActions.map(action => {
        if (!action.label.startsWith('Export')) return action
        return {
          ...action,
          onClick: async () => {
            const reg = schemaUiApplyRef.current
            if (schemaUiEditorOpen && canUseSchemaUiApplyRegistration(reg, schemaHash)) {
              reg.apply()
            }
            await action.onClick()
          },
        }
      }),
    [schemaActions, schemaUiEditorOpen, schemaHash],
  )

  return {
    schema,
    setSchema,
    schemaText,
    setSchemaText,
    schemaError,
    onImportSchema,
    onApplySchema: handleApplySchema,
    onResetSchema,
    schemaActions: enhancedSchemaActions,
    schemaLastExportHash,
    schemaHash,
    schemaUnsaved,
    uniqueNodeTypes,
    uniqueEdgeLabels,
    filteredNodeTypes,
    filteredEdgeLabels,
    schemaUiEditorOpen,
    setSchemaUiEditorOpen,
    schemaUiStep31Collapsed,
    schemaUiStep32Collapsed,
    setSchemaUiStep31Collapsed,
    setSchemaUiStep32Collapsed,
    schemaUiStep33Collapsed,
    setSchemaUiStep33Collapsed,
    schemaUiStep332Collapsed,
    setSchemaUiStep332Collapsed,
    handleSchemaUiCollapseAll,
    handleSchemaUiExpandAll,
    registerSchemaUiApply,
  }
}
