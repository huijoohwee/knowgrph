import { validateTransforms } from '@/features/parsers/schema'
import yaml from 'js-yaml'

export function testYamlTransformsValidation() {
  const okYaml = `
node:
  props:
    pick:
      - a
      - b
    map:
      id: "$.id"
edge:
  props:
    set:
      via: parser
`
  const badYaml = `
node:
  props:
    pick: "not-an-array"
`
  const okObj = yaml.load(okYaml) as unknown
  const badObj = yaml.load(badYaml) as unknown
  const ok = validateTransforms(okObj)
  if (!ok.ok) throw new Error('YAML transforms should be valid')
  const bad = validateTransforms(badObj)
  if (bad.ok) throw new Error('Invalid YAML transforms should fail')
}
