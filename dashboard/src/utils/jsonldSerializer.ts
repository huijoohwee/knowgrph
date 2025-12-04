import { FlowDiagramData } from '../types/flow';

const CONTEXT = {
  "@vocab": "https://huijoohwee.github.io/schema/vocab.jsonld",
  "id": "@id",
  "type": "@type",
  "subject": "subject",
  "predicate": "predicate",
  "object": "object",
  "domain": "domain",
  "category": "category",
  "stage": "stage",
  "source_location": "source_location",
  "source_type": "source_type",
  "metadata_json": "metadata_json"
};

function typeFromNode(nodeType: string): string {
  switch (nodeType) {
    case 'input': return 'Artifact';
    case 'output': return 'Artifact';
    case 'decision': return 'Process';
    default: return 'Process';
  }
}

export function flowToJsonLd(flow: FlowDiagramData): any {
  const items: any[] = [];
  const nodeLabelById = new Map<string, string>();
  const nodeTypeById = new Map<string, string>();

  flow.nodes.forEach(n => {
    nodeLabelById.set(n.id, n.label);
    nodeTypeById.set(n.id, typeFromNode(n.node_type));
  });

  let seq = 1;
  flow.edges.forEach(e => {
    const subject = nodeLabelById.get(e.source) || e.source;
    const object = nodeLabelById.get(e.target) || e.target;
    const entityType = nodeTypeById.get(e.source) || 'Process';
    items.push({
      id: `ui:flow_${String(seq).padStart(3,'0')}`,
      type: entityType,
      subject,
      predicate: e.label || 'relates_to',
      object,
      domain: 'Technology',
      category: 'Flow',
      stage: 'Planning',
      source_location: 'README.md#Example Flow',
      source_type: 'Documentation',
      metadata_json: '{}'
    });
    seq += 1;
  });

  return { '@context': CONTEXT, '@graph': items };
}

export async function saveJsonLdToFile(jsonld: any, fileName = 'a0.jsonld') {
  const content = JSON.stringify(jsonld, null, 2);
  try {
    // Try File System Access API
    // @ts-ignore
    if (window.showDirectoryPicker) {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      let outputsHandle = dirHandle;
      // Attempt to navigate into data/outputs when present
      try {
        // @ts-ignore
        const dataHandle = await outputsHandle.getDirectoryHandle('data', { create: true });
        // @ts-ignore
        outputsHandle = await dataHandle.getDirectoryHandle('outputs', { create: true });
      } catch {}
      // @ts-ignore
      const fileHandle = await outputsHandle.getFileHandle(fileName, { create: true });
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }
  } catch (e) {
    console.warn('File System Access API failed, falling back to download.', e);
  }
  // Fallback: trigger download
  const blob = new Blob([content], { type: 'application/ld+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return false;
}
