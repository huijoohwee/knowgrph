import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const canvasRoot = resolve(moduleDirectory, '../..')

export const RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA = 'rich-media-catalog-preview-timing/v1'
export const RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA_PATH = resolve(
  canvasRoot,
  'schemas/rich-media-catalog-preview-timing.v1.schema.json',
)
export const RICH_MEDIA_CATALOG_PREVIEW_TIMING_ARTIFACT_PATH = resolve(
  canvasRoot,
  '../data/outputs/rich-media-catalog-preview-timing.json',
)

let validatorPromise = null

async function loadValidator() {
  if (!validatorPromise) {
    validatorPromise = readFile(RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA_PATH, 'utf8')
      .then(JSON.parse)
      .then(schema => {
        const ajv = new Ajv2020({ allErrors: true, strict: true })
        return { ajv, schema, validate: ajv.compile(schema) }
      })
  }
  return validatorPromise
}

export async function validateRichMediaCatalogPreviewTiming(value) {
  const { ajv, schema, validate } = await loadValidator()
  if (!validate(value)) {
    const detail = ajv.errorsText(validate.errors, { dataVar: 'timing', separator: '; ' })
    throw new Error(`invalid ${RICH_MEDIA_CATALOG_PREVIEW_TIMING_SCHEMA} artifact: ${detail}`)
  }
  return { schemaId: schema.$id, schemaVersion: value.schema }
}

export async function validateRichMediaCatalogPreviewTimingArtifact(
  artifactPath = RICH_MEDIA_CATALOG_PREVIEW_TIMING_ARTIFACT_PATH,
) {
  const value = JSON.parse(await readFile(artifactPath, 'utf8'))
  const identity = await validateRichMediaCatalogPreviewTiming(value)
  return { artifactPath, ...identity }
}
