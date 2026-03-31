import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchContent, getDefaultBranch } from '$lib/server/github-content';

interface PlaceLinksPayload {
  matches?: Array<{ place?: unknown }>;
  unresolved?: unknown;
}

function normalizePlace(value: string): string {
  return value.trim();
}

function dedupePlaces(values: string[]): string[] {
  const normalized = new Map<string, string>();
  for (const value of values) {
    const trimmed = normalizePlace(value);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, trimmed);
    }
  }
  return [...normalized.values()].sort((a, b) => a.localeCompare(b));
}

async function loadPlaceNames(token: string, branch: string, fallbackBranch: string): Promise<string[]> {
  const branches = [...new Set([branch, fallbackBranch])];
  for (const targetBranch of branches) {
    try {
      const file = await fetchContent(token, 'content/World/places-map-links.json', targetBranch);
      const parsed = JSON.parse(file.content) as PlaceLinksPayload;

      const fromMatches = Array.isArray(parsed.matches)
        ? parsed.matches
          .map((entry) => (typeof entry?.place === 'string' ? entry.place : ''))
          .filter(Boolean)
        : [];

      const fromUnresolved = Array.isArray(parsed.unresolved)
        ? parsed.unresolved.filter((entry): entry is string => typeof entry === 'string')
        : [];

      const places = dedupePlaces([...fromMatches, ...fromUnresolved]);
      if (places.length > 0) {
        return places;
      }
    } catch {
      // Try next branch fallback.
    }
  }

  return [];
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token') ?? '';
  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;
  const places = await loadPlaceNames(token, branch, defaultBranch);
  return json({ branch, places });
};
