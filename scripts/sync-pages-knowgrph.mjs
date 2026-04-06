import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const knowgrphRoot = path.resolve(__dirname, '..')
const distDir = path.resolve(knowgrphRoot, 'canvas', 'dist')
const targetDir = path.resolve(knowgrphRoot, '..', 'huijoohwee', 'content', 'knowgrph')

const existsDir = async (dir) => {
  try {
    const stat = await fs.stat(dir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

if (!(await existsDir(distDir))) {
  throw new Error(`Missing build output directory: ${distDir}`)
}

await fs.rm(targetDir, { recursive: true, force: true })
await fs.mkdir(targetDir, { recursive: true })
await fs.cp(distDir, targetDir, { recursive: true })

console.log(`[knowgrph] synced ${distDir} -> ${targetDir}`)

