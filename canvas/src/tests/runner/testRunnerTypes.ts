export type TestResult = { name: string; ok: boolean; error?: string }

export type TestCaseTuple = readonly [name: string, importPath: string, exportName: string]

