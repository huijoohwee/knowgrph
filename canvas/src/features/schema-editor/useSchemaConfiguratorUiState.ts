import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS } from '@/lib/config'

export function useSchemaConfiguratorUiState() {
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

  const collapseAll = () => {
    setSchemaUiStep31Collapsed(true)
    setSchemaUiStep32Collapsed(true)
    setSchemaUiStep33Collapsed(true)
    setSchemaUiStep332Collapsed(true)
  }

  const expandAll = () => {
    setSchemaUiStep31Collapsed(false)
    setSchemaUiStep32Collapsed(false)
    setSchemaUiStep33Collapsed(false)
    setSchemaUiStep332Collapsed(false)
  }

  return {
    schemaUiStep31Collapsed,
    schemaUiStep32Collapsed,
    schemaUiStep33Collapsed,
    schemaUiStep332Collapsed,
    setSchemaUiStep31Collapsed,
    setSchemaUiStep32Collapsed,
    setSchemaUiStep33Collapsed,
    setSchemaUiStep332Collapsed,
    collapseAll,
    expandAll,
  }
}

