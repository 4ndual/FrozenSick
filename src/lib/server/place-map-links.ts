import { fetchContent } from '$lib/server/github-content';
import type { PlaceMapLinksDocument, PlaceMapMatch } from '$lib/place-map-links';

const PLACE_MAP_LINKS_PATH = 'content/World/places-map-links.json';

export async function fetchPlaceMapLinks(
  token: string,
  branch: string,
  defaultBranch: string,
): Promise<PlaceMapLinksDocument | null> {
  const branches = dedupe([branch, defaultBranch]);

  for (const targetBranch of branches) {
    try {
      const file = await fetchContent(token, PLACE_MAP_LINKS_PATH, targetBranch);
      const parsed = JSON.parse(file.content) as { rawMapUrl?: unknown; matches?: unknown };
      const matches = Array.isArray(parsed.matches)
        ? parsed.matches.map(toPlaceMatch).filter((entry): entry is PlaceMapMatch => Boolean(entry))
        : [];

      if (!matches.length) continue;

      return {
        rawMapUrl: typeof parsed.rawMapUrl === 'string' ? parsed.rawMapUrl : undefined,
        matches,
      };
    } catch {
      // Missing file or parse issues on this branch; try fallback branch.
    }
  }

  return null;
}

function toPlaceMatch(value: unknown): PlaceMapMatch | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.place !== 'string' || !candidate.place.trim()) return null;

  return {
    place: candidate.place,
    source: typeof candidate.source === 'string' ? candidate.source : undefined,
    id: typeof candidate.id === 'number' ? candidate.id : undefined,
    x: typeof candidate.x === 'number' ? candidate.x : undefined,
    y: typeof candidate.y === 'number' ? candidate.y : undefined,
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
