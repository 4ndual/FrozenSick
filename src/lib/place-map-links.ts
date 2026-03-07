export interface PlaceMapMatch {
  place: string;
  source?: string;
  id?: number;
  x?: number;
  y?: number;
}

export interface PlaceMapLinksDocument {
  rawMapUrl?: string;
  matches: PlaceMapMatch[];
}

interface LinkifyOptions {
  matches: PlaceMapMatch[];
  branch?: string | null;
  defaultBranch?: string;
  mapFile?: string | null;
}

interface PlaceLinkRuleSet {
  pattern: RegExp;
  hrefByPlaceKey: Map<string, string>;
}

const PROTECTED_TAGS = new Set(['a', 'code', 'pre', 'script', 'style']);

export function normalizePlaceKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMapFileNameFromRawUrl(rawMapUrl?: string): string | null {
  if (!rawMapUrl) return null;
  try {
    const url = new URL(rawMapUrl);
    const segment = url.pathname.split('/').pop();
    if (!segment) return null;
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function findPlaceMatch(matches: PlaceMapMatch[], place: string | null): PlaceMapMatch | null {
  if (!place) return null;
  const target = normalizePlaceKey(place);
  return matches.find((entry) => normalizePlaceKey(entry.place) === target) ?? null;
}

export function buildMapsTabUrl(
  place: string,
  options: { branch?: string | null; defaultBranch?: string; file?: string | null } = {},
): string {
  const params = new URLSearchParams();
  params.set('place', place);
  if (options.file) params.set('file', options.file);
  if (options.branch && options.defaultBranch && options.branch !== options.defaultBranch) {
    params.set('branch', options.branch);
  }
  const query = params.toString();
  return query ? `/maps?${query}` : '/maps';
}

export function linkifyPlacesInHtml(html: string, options: LinkifyOptions): string {
  if (!html || !options.matches?.length) return html;
  const rules = buildRules(options);
  if (!rules) return html;

  const chunks = html.split(/(<[^>]+>)/g);
  const depth = new Map<string, number>();
  const output: string[] = [];

  for (const chunk of chunks) {
    if (!chunk) continue;
    if (chunk.startsWith('<')) {
      updateProtectedDepth(depth, chunk);
      output.push(chunk);
      continue;
    }

    if (isInProtectedTag(depth)) {
      output.push(chunk);
      continue;
    }

    output.push(applyRules(chunk, rules));
  }

  return output.join('');
}

function buildRules(options: LinkifyOptions): PlaceLinkRuleSet | null {
  const placeByKey = new Map<string, string>();
  for (const entry of options.matches) {
    if (!entry.place) continue;
    const normalized = normalizePlaceKey(entry.place);
    if (!normalized) continue;
    const existing = placeByKey.get(normalized);
    if (!existing || entry.place.length > existing.length) {
      placeByKey.set(normalized, entry.place);
    }
  }

  const mapFile = options.mapFile ?? null;
  const places = [...placeByKey.values()].sort((a, b) => b.length - a.length);
  if (!places.length) return null;

  const hrefByPlaceKey = new Map<string, string>();
  for (const place of places) {
    hrefByPlaceKey.set(
      normalizePlaceKey(place),
      buildMapsTabUrl(place, {
      branch: options.branch ?? null,
      defaultBranch: options.defaultBranch ?? 'main',
      file: mapFile,
      }),
    );
  }

  const alternation = places.map((place) => escapeRegExp(place)).join('|');
  return {
    hrefByPlaceKey,
    pattern: new RegExp(`(^|[^\\p{L}\\p{N}])(${alternation})(?=[^\\p{L}\\p{N}]|$)`, 'giu'),
  };
}

function applyRules(text: string, rules: PlaceLinkRuleSet): string {
  return text.replace(rules.pattern, (full, prefix: string, matched: string) => {
    const href = rules.hrefByPlaceKey.get(normalizePlaceKey(matched));
    if (!href) return full;
    return `${prefix}<a href="${escapeHtmlAttr(href)}" class="map-inline-link">${matched}</a>`;
  });
}

function updateProtectedDepth(depth: Map<string, number>, chunk: string): void {
  const tagMatch = chunk.match(/^<\s*(\/)?\s*([a-zA-Z0-9-]+)/);
  if (!tagMatch) return;

  const closing = Boolean(tagMatch[1]);
  const tag = tagMatch[2].toLowerCase();
  if (!PROTECTED_TAGS.has(tag)) return;
  if (chunk.endsWith('/>')) return;

  const current = depth.get(tag) ?? 0;
  if (closing) {
    if (current <= 1) depth.delete(tag);
    else depth.set(tag, current - 1);
    return;
  }

  depth.set(tag, current + 1);
}

function isInProtectedTag(depth: Map<string, number>): boolean {
  for (const tag of PROTECTED_TAGS) {
    if ((depth.get(tag) ?? 0) > 0) return true;
  }
  return false;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
