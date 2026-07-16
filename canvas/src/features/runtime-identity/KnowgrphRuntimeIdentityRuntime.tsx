import { useEffect } from 'react'
import {
  useAgenticOsRemoteGrammarCatalog,
  type AgenticOsRemoteGrammarSigil,
} from '@/features/agentic-os/agenticOsRemoteGrammarClient'
import { publishKnowgrphCatalogIdentity, useKnowgrphRuntimeIdentity } from './knowgrphRuntimeIdentity'
import { useKnowgrphRuntimeIdentityAttestationRuntime } from './useKnowgrphRuntimeIdentityAttestationRuntime'

const CATALOG_IDENTITY_SIGILS: readonly AgenticOsRemoteGrammarSigil[] = ['/', '#', '@']

/** Owns application identity globally; catalog hydration is one published identity facet. */
export function KnowgrphRuntimeIdentityRuntime() {
  const catalogSnapshot = useAgenticOsRemoteGrammarCatalog({ sigils: CATALOG_IDENTITY_SIGILS })
  const identity = useKnowgrphRuntimeIdentity()

  useEffect(() => {
    publishKnowgrphCatalogIdentity(catalogSnapshot)
  }, [catalogSnapshot])
  useKnowgrphRuntimeIdentityAttestationRuntime(identity)

  return null
}
