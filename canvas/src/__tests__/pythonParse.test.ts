import { pythonSpec } from '@/features/parsers/python/index'

export const testPythonParseBasic = () => {
  const name = 'sample.py'
  const body = [
    'import os, sys',
    'from pkg.mod import util, helper',
    '',
    'class Foo(Base):',
    '  def bar(self, x):',
    '    util(x)',
    '    self.baz(x)',
    '  def baz(self, y):',
    '    print(y)',
  ].join('\n')
  const res = pythonSpec.parse(name, body)
  const nodes = res.graphData.nodes
  const edges = res.graphData.edges
  const hasModule = nodes.some(n => n.id === 'py:module:sample')
  const hasClass = nodes.some(n => n.id === 'py:class:Foo')
  const hasFnBar = nodes.some(n => n.id === 'py:function:Foo.bar')
  const hasFnBaz = nodes.some(n => n.id === 'py:function:Foo.baz')
  if (!hasModule || !hasClass || !hasFnBar || !hasFnBaz) throw new Error('missing nodes for python parse basic')
  const importsEdges = edges.filter(e => e.label === 'imports')
  if (importsEdges.length < 3) throw new Error('expected imports edges')
  const callsEdges = edges.filter(e => e.label === 'calls')
  const hasUtilCall = callsEdges.some(e => e.source === 'py:function:Foo.bar' && e.target.startsWith('py:symbol:util'))
  const hasBazCall = callsEdges.some(e => e.source === 'py:function:Foo.bar' && e.target.startsWith('py:symbol:self.baz'))
  if (!hasUtilCall || !hasBazCall) throw new Error('expected calls from Foo.bar')
}
