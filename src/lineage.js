import { primaryNeighbor, rowCues } from './editions.js';

// Preserve every branch, but put a single aligned year and rail node per edition.
export function lineageEditions(family, lineage, selectedKey) {
  const byKey = new Map(lineage.nodes.map(item => [item.key, item]));
  const cues = rowCues(family, new Set(family.editions.map(edition => edition.year)));
  const groups = new Map();
  const groupFor = year => {
    if (!groups.has(year)) groups.set(year, { year, nodes: [], departures: [] });
    return groups.get(year);
  };
  for (const item of lineage.nodes) {
    const incoming = lineage.edges.filter(edge => edge.to === item.key);
    const previous = byKey.get(primaryNeighbor(lineage.edges, item.key, 'previous'));
    const merges = incoming.filter(edge => ['merged', 'consolidated'].includes(edge.type)).map(edge => ({ ...byKey.get(edge.from), relationship: edge.type }));
    const relations = [...new Set(incoming.map(edge => edge.type === 'moved' ? 'continues' : edge.type))];
    groupFor(item.year).nodes.push({
      ...item, selected: item.key === selectedKey, previous,
      delta: previous ? previous.rank - item.rank : null,
      relations, merges, isNew: cues.get(item.key)?.isNew ?? false,
      firstEdition: item.year === Math.min(...family.editions.map(edition => edition.year)),
    });
    const leaves = cues.get(item.key)?.leaves;
    if (leaves) groupFor(leaves).departures.push(item);
  }
  return [...groups.values()].sort((a, b) => a.year - b.year);
}
