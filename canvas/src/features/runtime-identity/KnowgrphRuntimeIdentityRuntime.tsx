import { useEffect } from 'react'
import {
  useAgenticOsRemoteGrammarCatalog,
  type AgenticOsRemoteGrammarSigil,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { publishKnowgrphCatalogIdentity } from './knowgrphRuntimeIdentity'

const CATALOG_IDENTITY_SIGILS: readonly AgenticOsRemoteGrammarSigil[] = ['/', '#', '@']

/** Owns application identity globally; catalog hydration is one published identity facet. */
export function KnowgrphRuntimeIdentityRuntime() {
  const catalogSnapshot = useAgenticOsRemoteGrammarCatalog({ sigils: CATALOG_IDENTITY_SIGILS })

  useEffect(() => {
    publishKnowgrphCatalogIdentity(catalogSnapshot)
  }, [catalogSnapshot])

  return null
}
