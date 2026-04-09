import type { SettingMeta } from './types'
import { threeSettingsRegistryPart1 } from './registry-three.part1'
import { threeSettingsRegistryPart2 } from './registry-three.part2'
import { threeSettingsRegistryPart3 } from './registry-three.part3'

export const threeSettingsRegistry: SettingMeta[] = [
  ...threeSettingsRegistryPart1,
  ...threeSettingsRegistryPart2,
  ...threeSettingsRegistryPart3,
]
