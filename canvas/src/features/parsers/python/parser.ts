import type { GraphData } from '@/lib/graph/types'
import { toLines, isBlankOrComment, matchClass, matchDef, matchImport, matchFromImport, findCallsInLine } from './lexer'
import { ScopeStack } from './scope'
import { PyGraphBuilder } from './builder'

export const parsePython = (name: string, body: string): { graphData: GraphData; warnings: string[] } => {
  const lines = toLines(body);
  const scope = new ScopeStack();
  const builder = new PyGraphBuilder();
  const moduleName = (name || '').replace(/\.py$/i, '')
  builder.addModule(moduleName, name)

  const imports: Array<{ from: string; what: string; line: number }> = []
  const functions: string[] = []
  const classes: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i]
    if (isBlankOrComment(L.text)) continue
    scope.popUntilIndent(L.indent)
    const cm = matchClass(L.text)
    if (cm) {
      const clsName = cm[1]
      const bases = (cm[2] || '').split(',').map(s => s.trim()).filter(Boolean)
      builder.addClass(clsName, name, bases, L.num)
      scope.push({ kind: 'class', name: clsName, indent: L.indent })
      classes.push(clsName)
      continue
    }
    const fm = matchDef(L.text)
    if (fm) {
      const fnName = fm[1]
      const args = (fm[2] || '').trim()
      const within = scope.currentClass() || undefined
      builder.addFunction(fnName, name, args, L.num, within)
      const fnId = within ? `py:function:${within}.${fnName}` : `py:function:${fnName}`
      functions.push(fnId)
      scope.push({ kind: 'function', name: fnId, indent: L.indent })
      continue
    }
    const im = matchImport(L.text)
    if (im) {
      const list = im[1].split(',').map(s => s.trim()).filter(Boolean)
      for (const item of list) {
        const target = item.replace(/\sas\s+\w+$/i, '')
        imports.push({ from: moduleName, what: target, line: L.num })
        builder.addImports(moduleName, target, name, L.num)
      }
      continue
    }
    const fim = matchFromImport(L.text)
    if (fim) {
      const fromMod = fim[1]
      const whatList = fim[2].replace(/[()]/g, '').split(',').map(s => s.trim()).filter(Boolean)
      for (const w of whatList) {
        const target = `${fromMod}.${w}`
        imports.push({ from: moduleName, what: target, line: L.num })
        builder.addImports(moduleName, target, name, L.num)
      }
      continue
    }
    const curFn = scope.currentFunction()
    if (curFn) {
      const calls = findCallsInLine(L.text)
      for (const c of calls) {
        builder.addCalls(curFn, c, name, L.num)
      }
    }
  }

  const graphData: GraphData = {
    context: 'python-ast',
    type: 'Graph',
    nodes: Array.from(builder.nodes.values()),
    edges: builder.edges,
  }
  const warnings: string[] = []
  return { graphData, warnings }
}
