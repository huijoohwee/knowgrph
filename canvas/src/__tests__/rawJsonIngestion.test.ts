import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export function testRawJsonNodesArrayIngestion() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const raw = {
    meta: { title: 'Workflow Graph', version: '1.0' },
    nodes: [
      {
        id: 'n-business',
        type: 'business_outcome',
        layer: 0,
        label: 'Business Outcome',
        narrative: 'problem_framing',
        score: 9,
      },
      {
        id: 'n-technical',
        type: 'technical_decision',
        layer: 1,
        label: 'Technical Decision',
        narrative: 'model_selection',
        score: 8,
      },
    ],
  };

  const text = JSON.stringify(raw);

  const res = applyParser(toParserId('json'), {
    name: 'workflow.json',
    text,
  });

  if (!res) throw new Error('raw json parse returned null');
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`raw json parse warnings: ${res.warnings.join('; ')}`);
  }

  const graph = res.graphData;
  const nodes = graph.nodes || [];
  if (nodes.length !== 2) {
    throw new Error(`expected 2 nodes, got ${nodes.length}`);
  }

  const first = nodes[0];
  if (first.id !== 'n-business') {
    throw new Error(`expected first node id n-business, got ${first.id}`);
  }
  if (!first.properties || (first.properties as Record<string, unknown>).narrative !== 'problem_framing') {
    throw new Error('expected first node narrative property to be preserved');
  }
  if ((first.properties as Record<string, unknown>).layer !== 0) {
    throw new Error('expected first node layer property to be preserved');
  }
}

export function testRawJsonExtendedNodesIngestion() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const raw = {
    meta: { title: 'Extended Workflow Graph', version: '2.0' },
    extended_nodes: [
      {
        id: 'extended-dialogue',
        type: 'dialogue',
        layer: 0.5,
        narrative: 'problem_framing',
        label: 'Stakeholder Dialogue',
        outcome: 'constraints_aligned',
        selected: true,
      },
      {
        id: 'extended-proof',
        type: 'mathematical_proof',
        layer: 3.5,
        narrative: 'model_selection',
        label: 'Gradient Descent Derivation',
        score: 10,
      },
    ],
  };

  const text = JSON.stringify(raw);

  const res = applyParser(toParserId('json'), {
    name: 'extended-workflow.json',
    text,
  });

  if (!res) throw new Error('extended raw json parse returned null');
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`extended raw json parse warnings: ${res.warnings.join('; ')}`);
  }

  const graph = res.graphData;
  const nodes = graph.nodes || [];
  if (nodes.length !== 2) {
    throw new Error(`expected 2 extended nodes, got ${nodes.length}`);
  }

  const dialogue = nodes.find(n => n.id === 'extended-dialogue');
  if (!dialogue) {
    throw new Error('expected extended-dialogue node to exist');
  }
  const props = (dialogue.properties || {}) as Record<string, unknown>;
  if (props.narrative !== 'problem_framing') {
    throw new Error('expected extended-dialogue narrative property to be preserved');
  }
  if (props.outcome !== 'constraints_aligned') {
    throw new Error('expected extended-dialogue outcome property to be preserved');
  }
  if (props.selected !== true) {
    throw new Error('expected extended-dialogue selected property to be preserved');
  }
}

