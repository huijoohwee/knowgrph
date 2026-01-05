import { parseCsvToGraph } from '@/lib/graph/csv'

export function testParseKindCsv() {
  const header = 'kind,id,name,type,degree,source,target,edge_type,weight\n'
  const rows = [
    ['node','n1','Node 1','Company','3','','','',''],
    ['node','n2','Node 2','Investor','1','','','',''],
    ['edge','e1','','','', 'n1','n2','InvestedIn','2']
  ].map(cols => cols.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n')
  const csv = header + rows + '\n'
  const g = parseCsvToGraph(csv)
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new Error('graph not parsed')
  if (g.nodes.length !== 2) throw new Error('nodes length mismatch')
  if (g.edges.length !== 1) throw new Error('edges length mismatch')
  const e = g.edges[0]
  if (String(e.source) !== 'n1' || String(e.target) !== 'n2') throw new Error('edge endpoints mismatch')
  if (e.label !== 'InvestedIn') throw new Error('edge label mismatch')
}

