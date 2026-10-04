export function defaultVisibleYears(family) {
  return family.editions.filter((edition) => !edition.hiddenByDefault).map((edition) => edition.year);
}

export function visibleEditions(family, years) {
  return family.editions.filter((edition) => years.has(edition.year));
}

// Collapse paths through hidden editions so that lineage remains visible across gaps.
export function visibleConnections(family, years, highlightedEdges = []) {
  const visible = (key) => years.has(Number(key.split(':')[0]));
  const highlighted = new Set(highlightedEdges.map((edge) => `${edge.from}>${edge.to}`));
  const output = new Map();
  const walk = (start, edge, path, visited) => {
    if (visited.has(edge.to)) return;
    const nextPath = [...path, edge];
    if (visible(edge.to)) {
      const key = `${start}>${edge.to}`;
      const selected = nextPath.every((part) => highlighted.has(`${part.from}>${part.to}`));
      const existing = output.get(key);
      output.set(key, { ...edge, from: start, highlighted: selected || existing?.highlighted || false });
      return;
    }
    const nextVisited = new Set([...visited, edge.to]);
    for (const next of family.edges.filter((candidate) => candidate.from === edge.to)) walk(start, next, nextPath, nextVisited);
  };
  for (const edge of family.edges) if (visible(edge.from)) walk(edge.from, edge, [], new Set([edge.from]));
  return [...output.values()].sort((a, b) => Number(a.highlighted) - Number(b.highlighted));
}

const KIND_ORDER = { continues: 0, renamed: 1, merged: 2 };
const yearOf = (key) => Number(key.split(':')[0]);
const idOf = (key) => key.slice(key.indexOf(':') + 1);
const rankOf = (key) => Number(idOf(key).match(/(\d+)$/)?.[1] ?? 0);

// Collapse documented relationship types onto the three legend strokes.
export function relationKind(type) {
  if (type === 'renamed') return 'renamed';
  if (['merged', 'expanded', 'consolidated'].includes(type)) return 'merged';
  return 'continues';
}

// Walk outward from the focused row so each node takes the stroke that joins it to the path.
export function lineageKinds(connections, focusKey) {
  const lit = connections.filter((edge) => edge.highlighted);
  const kinds = new Map();
  const reached = new Set([focusKey]);
  let frontier = [focusKey];
  while (frontier.length) {
    const candidates = new Map();
    for (const key of frontier) {
      for (const edge of lit) {
        const next = edge.from === key ? edge.to : edge.to === key ? edge.from : null;
        if (!next || reached.has(next)) continue;
        const kind = relationKind(edge.type);
        const current = candidates.get(next);
        if (!current || KIND_ORDER[kind] < KIND_ORDER[current]) candidates.set(next, kind);
      }
    }
    for (const [key, kind] of candidates) {
      kinds.set(key, kind);
      reached.add(key);
    }
    frontier = [...candidates.keys()];
  }
  return kinds;
}

// The primary neighbor is the most direct relationship; merges yield to continuations.
export function primaryNeighbor(connections, key, direction) {
  const forward = direction === 'next';
  const options = connections
    .filter((edge) => (forward ? edge.from : edge.to) === key)
    .map((edge) => ({ key: forward ? edge.to : edge.from, kind: relationKind(edge.type) }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || rankOf(a.key) - rankOf(b.key));
  return options[0]?.key ?? null;
}

// Per-row cues for categories that enter, leave, or connect only through a hidden edition.
export function rowCues(family, years) {
  const editionYears = family.editions.map((edition) => edition.year);
  const connections = visibleConnections(family, years);
  const cues = new Map();
  for (const edition of visibleEditions(family, years)) {
    const index = editionYears.indexOf(edition.year);
    for (const item of edition.items) {
      const key = `${edition.year}:${item.id}`;
      const incoming = family.edges.some((edge) => edge.to === key);
      const outgoing = family.edges.some((edge) => edge.from === key);
      const previous = editionYears[index - 1];
      const next = editionYears[index + 1];
      cues.set(key, {
        isNew: index > 0 && !incoming,
        leaves: next !== undefined && !outgoing ? next : null,
        hiddenBefore: incoming && !connections.some((edge) => edge.to === key) ? previous : null,
        hiddenAfter: outgoing && !connections.some((edge) => edge.from === key) ? next : null,
      });
    }
  }
  return cues;
}

// Group lineage nodes by edition: visible years form the path, hidden years only count.
export function lineagePath(nodes, years) {
  const groups = new Map();
  for (const node of [...nodes].sort((a, b) => a.year - b.year || a.rank - b.rank)) {
    if (!groups.has(node.year)) groups.set(node.year, []);
    groups.get(node.year).push(node.id);
  }
  const entries = [...groups].map(([year, ids]) => ({ year, ids }));
  return {
    visible: entries.filter((entry) => years.has(entry.year)),
    hidden: entries.filter((entry) => !years.has(entry.year)).map(({ year, ids }) => ({ year, count: ids.length })),
  };
}

export function formatLineagePath(path, hiddenWord = 'en') {
  const route = path.visible.map(({ year, ids }) => `${year} ${ids.join(' + ')}`).join(' → ');
  const hidden = path.hidden.map(({ year, count }) => `+${count} ${hiddenWord} ${year}`);
  return { route, hidden };
}

export { yearOf, idOf };
