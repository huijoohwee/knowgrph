import {
  resolveBytePlusVideoDurationForModel,
  supportsBytePlusVideoDraft,
} from '@/features/integrations/byteplusVideoGenerationDefaults'

export function testBytePlusSeedanceOneDurationUsesProviderRange() {
  const model = 'seedance-1-0-pro-fast-251015'
  if (resolveBytePlusVideoDurationForModel(model, 15) !== 12) {
    throw new Error('expected Seedance 1.0 duration to clamp to its 12-second provider maximum')
  }
  if (resolveBytePlusVideoDurationForModel(model, 1) !== 2) {
    throw new Error('expected Seedance 1.0 duration to clamp to its 2-second provider minimum')
  }
}

export function testBytePlusDraftSupportIsSeedanceOnePointFiveOnly() {
  if (supportsBytePlusVideoDraft('seedance-1-0-pro-fast-251015')) {
    throw new Error('expected Seedance 1.0 to omit the unsupported draft field')
  }
  if (!supportsBytePlusVideoDraft('seedance-1-5-pro-251215')) {
    throw new Error('expected Seedance 1.5 Pro to preserve draft support')
  }
  if (supportsBytePlusVideoDraft('dreamina-seedance-2-0-260128')) {
    throw new Error('expected Seedance 2.0 to omit the Seedance 1.5-only draft field')
  }
}

export function testBytePlusLaterSeedanceDurationUsesProviderRange() {
  for (const model of ['seedance-1-5-pro-251215', 'dreamina-seedance-2-0-260128']) {
    if (resolveBytePlusVideoDurationForModel(model, 15) !== 15) {
      throw new Error(`expected ${model} to preserve the supported 15-second duration`)
    }
    if (resolveBytePlusVideoDurationForModel(model, 2) !== 4) {
      throw new Error(`expected ${model} to clamp to its 4-second provider minimum`)
    }
  }
}
