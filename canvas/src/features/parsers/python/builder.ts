import type { GraphNode, GraphEdge } from '@/lib/graph/types'

export class PyGraphBuilder {
  nodes = new Map<string, GraphNode>();
  edges: GraphEdge[] = [];
  private addNode(id: string, label: string, type: string, props: Record<string, import('@/lib/graph/types').JSONValue>) {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, label, type, properties: props });
  }
  addModule(mod: string, file: string) { this.addNode(`py:module:${mod}`, mod, 'module', { file }); }
  addClass(name: string, file: string, bases: string[], line: number) {
    const id = `py:class:${name}`;
    this.addNode(id, name, 'class', { file, bases, line });
  }
  addFunction(name: string, file: string, args: string, line: number, withinClass?: string) {
    const id = withinClass ? `py:function:${withinClass}.${name}` : `py:function:${name}`;
    this.addNode(id, name, 'function', { file, args, line });
    if (withinClass) this.edges.push({ id: `py:member:${id}->py:class:${withinClass}`, source: id, target: `py:class:${withinClass}`, label: 'memberOf', properties: {} });
  }
  addSymbol(qualified: string, file: string) { this.addNode(`py:symbol:${qualified}`, qualified, 'symbol', { file }); }
  addImports(fromMod: string, toTarget: string, file: string, line: number) {
    const src = `py:module:${fromMod}`;
    const tgt = toTarget.startsWith('py:') ? toTarget : `py:module:${toTarget}`;
    this.addNode(fromMod.startsWith('py:') ? fromMod : src, fromMod, 'module', { file });
    if (!tgt.startsWith('py:module:')) this.addSymbol(toTarget, file);
    this.edges.push({ id: `py:imports:${src}->${tgt}|${line}`, source: src, target: tgt, label: 'imports', properties: { file, line } });
  }
  addCalls(fromFn: string, toQualified: string, file: string, line: number) {
    const src = fromFn;
    const tgtId = toQualified.startsWith('py:function:') || toQualified.startsWith('py:class:') || toQualified.startsWith('py:module:') ? toQualified : `py:symbol:${toQualified}`;
    if (tgtId.startsWith('py:symbol:')) this.addSymbol(toQualified, file);
    this.edges.push({ id: `py:calls:${src}->${tgtId}|${line}`, source: src, target: tgtId, label: 'calls', properties: { file, line } });
  }
}
