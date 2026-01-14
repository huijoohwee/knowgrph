import type { GraphSchema, PropertySpec, CompactPropertyBadge } from './schemaTypes';

export function getNodePropSpec(schema: GraphSchema | null | undefined, nodeType: string, prop: string): PropertySpec | null {
  if (!schema || !schema.propertySchemas || !schema.propertySchemas.node) return null;
  const byOwner = schema.propertySchemas.node[nodeType];
  if (!byOwner) return null;
  const spec = byOwner[prop];
  return spec || null;
}

export function getEdgePropSpec(schema: GraphSchema | null | undefined, edgeLabel: string, prop: string): PropertySpec | null {
  if (!schema || !schema.propertySchemas || !schema.propertySchemas.edge) return null;
  const byOwner = schema.propertySchemas.edge[edgeLabel];
  if (!byOwner) return null;
  const spec = byOwner[prop];
  return spec || null;
}

export function summarizePropertySpec(spec: PropertySpec | null | undefined): string[] {
  const badges: string[] = [];
  if (!spec) return badges;
  if (spec.required) badges.push('required');
  if (spec.uniqueness) badges.push('unique');
  const range = spec.range;
  if (range && (typeof range.min === 'number' || typeof range.max === 'number')) {
    const min = typeof range.min === 'number' ? String(range.min) : '-∞';
    const max = typeof range.max === 'number' ? String(range.max) : '+∞';
    badges.push('range: ' + min + '..' + max);
  }
  if (spec.enum && spec.enum.length > 0) {
    const values = spec.enum.slice(0, 3).join(' | ');
    const suffix = spec.enum.length > 3 ? '…' : '';
    badges.push('enum: ' + values + suffix);
  }
  return badges;
}

export function toCompactPropertyBadgeLabel(badge: string): string {
  if (badge === 'required') return 'R';
  if (badge === 'unique') return 'U';
  if (badge.startsWith('range:')) return 'Rng';
  if (badge.startsWith('enum:')) return 'E';
  const trimmed = badge.trim();
  if (!trimmed) return '';
  return trimmed[0] ? trimmed[0].toUpperCase() : '';
}

export function sortPropertyBadgesByPriority(badges: string[]): string[] {
  const priority = (badge: string): number => {
    if (badge === 'required') return 0;
    if (badge === 'unique') return 1;
    if (badge.startsWith('range:')) return 2;
    if (badge.startsWith('enum:')) return 3;
    return 4;
  };
  return badges.slice().sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

export function buildNodeSchemaBadges(
  schema: GraphSchema | null | undefined,
  nodeType: string,
  properties: Record<string, unknown> | null | undefined,
): CompactPropertyBadge[] {
  if (!schema) return [];
  const props = properties || {};
  const keys = Object.keys(props);
  if (!keys.length) return [];
  const allBadges = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const spec = getNodePropSpec(schema, nodeType, key);
    if (!spec) continue;
    const badges = summarizePropertySpec(spec);
    for (let j = 0; j < badges.length; j += 1) {
      allBadges.add(badges[j]);
    }
  }
  if (allBadges.size === 0) return [];
  const sortedBadges = sortPropertyBadgesByPriority(Array.from(allBadges)).slice(0, 4);
  return sortedBadges
    .map((badge) => ({ badge, label: toCompactPropertyBadgeLabel(badge) }))
    .filter((b) => b.label);
}

export function buildEdgeSchemaBadges(
  schema: GraphSchema | null | undefined,
  edgeLabel: string,
  properties: Record<string, unknown> | null | undefined,
): CompactPropertyBadge[] {
  if (!schema) return [];
  const props = properties || {};
  const keys = Object.keys(props);
  if (!keys.length) return [];
  const allBadges = new Set<string>();
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const spec = getEdgePropSpec(schema, edgeLabel, key);
    if (!spec) continue;
    const badges = summarizePropertySpec(spec);
    for (let j = 0; j < badges.length; j += 1) {
      allBadges.add(badges[j]);
    }
  }
  if (allBadges.size === 0) return [];
  const sortedBadges = sortPropertyBadgesByPriority(Array.from(allBadges)).slice(0, 4);
  return sortedBadges
    .map((badge) => ({ badge, label: toCompactPropertyBadgeLabel(badge) }))
    .filter((b) => b.label);
}
