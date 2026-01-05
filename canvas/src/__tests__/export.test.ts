import { parseCsvToGraph } from '@/lib/graph/csv'

export function testParseCombinedCsv() {
  const header = 'row_type,id,label,node_type,properties,source_id,source_label,source_type,predicate,target_id,target_label,target_type,weight\n'
  const rows = [
    ['node','n1','Node 1','TypeA','{"foo":1}','','','','','','','',''],
    ['node','n2','Node 2','TypeB','{}','','','','','','','',''],
    ['edge','','','','','n1','Node 1','TypeA','relatedTo','n2','Node 2','TypeB','2']
  ].map(cols => cols.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n')
  const csv = header + rows + '\n'
  const g = parseCsvToGraph(csv)
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new Error('graph not parsed')
  if (g.nodes.length !== 2) throw new Error('nodes length mismatch')
  if (g.edges.length !== 1) throw new Error('edges length mismatch')
  const n1 = g.nodes.find(n => n.id === 'n1')
  const n2 = g.nodes.find(n => n.id === 'n2')
  if (!n1 || !n2) throw new Error('missing nodes')
  if (n1.label !== 'Node 1' || n1.type !== 'TypeA') throw new Error('node1 fields mismatch')
  const e = g.edges[0]
  if (String(e.source) !== 'n1' || String(e.target) !== 'n2') throw new Error('edge endpoints mismatch')
  if (e.label !== 'relatedTo') throw new Error('edge predicate mismatch')
}

