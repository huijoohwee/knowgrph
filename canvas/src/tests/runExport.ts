import path from 'node:path'

async function main() {
  const [moduleRelPath, exportName] = process.argv.slice(2)
  if (!moduleRelPath || !exportName) {
    throw new Error('Usage: runExport <modulePath> <exportName>')
  }

  const moduleAbsPath = path.resolve(process.cwd(), moduleRelPath)
  const mod = (await import(moduleAbsPath)) as Record<string, unknown>
  const fn = mod[exportName]
  if (typeof fn !== 'function') {
    throw new Error(`Expected ${exportName} to be a function export of ${moduleRelPath}`)
  }
  await (fn as () => Promise<void> | void)()
}

main()
  .then(() => {
    process.stdout.write('OK\n')
  })
  .catch(err => {
    process.stderr.write(String(err?.stack || err) + '\n')
    process.exit(1)
  })

