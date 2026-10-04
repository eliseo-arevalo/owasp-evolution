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
