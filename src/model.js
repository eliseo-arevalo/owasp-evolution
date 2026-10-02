function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function flattenCatalog(input) {
  const output = [];
  for (const family of Object.values(input.families ?? {})) {
    for (const edition of family.editions ?? []) {
      for (const item of edition.items ?? []) {
        output.push({
          ...item,
          family: family.id,
          familyLabel: family.label,
          year: edition.year,
          editionLabel: edition.label,
          key: `${edition.year}:${item.id}`,
        });
      }
    }
  }
  return output;
}

export function searchRisks(input, query, familyId) {
  const needle = normalize(query);
  const items = flattenCatalog(input).filter((item) => !familyId || item.family === familyId);
  if (!needle) return items;

  return items.filter((item) => normalize([
    item.id,
    item.name,
    item.summary,
    item.change,
    ...(item.prevention ?? []),
    item.year,
  ].join(' ')).includes(needle));
}

export function getRisk(input, familyId, year, id) {
  const family = input.families?.[familyId];
  const edition = family?.editions.find((candidate) => candidate.year === Number(year));
  return edition?.items.find((candidate) => candidate.id === id) ?? null;
}

export function getEdition(input, familyId, year) {
  return input.families?.[familyId]?.editions.find((edition) => edition.year === Number(year)) ?? null;
}

export function getLineage(input, familyId, year, id) {
  const family = input.families?.[familyId];
  if (!family) return { nodes: [], edges: [] };

  const start = `${Number(year)}:${id}`;
  const allNodes = flattenCatalog({ families: { [familyId]: family } });
  const nodeByKey = new Map(allNodes.map((node) => [node.key, node]));
  if (!nodeByKey.has(start)) return { nodes: [], edges: [] };

  const selectedKeys = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of family.edges ?? []) {
      if (selectedKeys.has(edge.from) || selectedKeys.has(edge.to)) {
        if (!selectedKeys.has(edge.from)) {
          selectedKeys.add(edge.from);
          changed = true;
        }
        if (!selectedKeys.has(edge.to)) {
          selectedKeys.add(edge.to);
          changed = true;
        }
      }
    }
  }

  const edges = (family.edges ?? []).filter((edge) => selectedKeys.has(edge.from) && selectedKeys.has(edge.to));
  const nodes = [...selectedKeys]
    .map((key) => nodeByKey.get(key))
    .filter(Boolean)
    .sort((a, b) => a.year - b.year || a.rank - b.rank);

  return { nodes, edges };
}

function defaultRoute(input) {
  const family = input.families[input.defaultFamily];
  const edition = family.editions.find((candidate) => candidate.year === family.defaultYear) ?? family.editions.at(-1);
  return { family: family.id, year: edition.year, id: edition.items[0].id };
}

export function parseRoute(hash, input) {
  let segments;
  try {
    segments = String(hash ?? '')
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return defaultRoute(input);
  }

  const [familyId, yearValue, id] = segments;
  const year = Number(yearValue);
  if (getRisk(input, familyId, year, id)) return { family: familyId, year, id };
  return defaultRoute(input);
}

export function formatRoute({ family, year, id }) {
  return `#/${encodeURIComponent(family)}/${encodeURIComponent(year)}/${encodeURIComponent(id)}`;
}

export function resolveRouteState(hash, input) {
  const route = parseRoute(hash, input);
  const canonicalHash = formatRoute(route);
  return {
    route,
    canonicalHash,
    changed: String(hash ?? '') !== canonicalHash,
  };
}

export function relationshipLabel(type) {
  return ({
    continues: 'Continúa',
    moved: 'Cambia de posición',
    renamed: 'Renombrada',
    merged: 'Fusionada',
    expanded: 'Ampliada',
    consolidated: 'Consolidada',
    new: 'Nueva',
    removed: 'Sale del Top 10',
  })[type] ?? type;
}
