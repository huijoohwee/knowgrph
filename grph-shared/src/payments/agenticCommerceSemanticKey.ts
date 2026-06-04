import { hashSignatureParts } from '../hash/signature.js'

type SignaturePrimitive = string | number | boolean | null | undefined

export const buildAgenticCommerceSemanticKey = (
  scope: string,
  parts: SignaturePrimitive[],
): string => hashSignatureParts(['agentic-commerce', scope, ...parts])
