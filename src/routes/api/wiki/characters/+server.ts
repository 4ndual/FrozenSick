import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTree, getDefaultBranch } from '$lib/server/github-content';

function toDisplayName(raw: string): string {
  return raw
    .replace(/\.(md|txt)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCharacterDirectory(paths: string[]): string[] {
  const normalized = new Map<string, string>();

  for (const path of paths) {
    const withoutPrefix = path.replace(/^content\/Characters\//, '');
    if (withoutPrefix === path) continue;

    const parts = withoutPrefix.split('/');
    let candidate = '';

    if (parts.length > 1) {
      candidate = parts[0];
    } else {
      candidate = parts[0]?.replace(/\.(md|txt)$/i, '') ?? '';
    }

    const name = toDisplayName(candidate);
    if (!name || name.toLowerCase() === 'npcs') continue;

    const key = name.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, name);
    }
  }

  return [...normalized.values()].sort((a, b) => a.localeCompare(b));
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token') ?? '';
  if (!token && process.env.NODE_ENV === 'production') throw error(401, 'Not authenticated');

  const branch = url.searchParams.get('branch') || getDefaultBranch();
  const markdownTree = await fetchTree(token, branch);
  const characters = normalizeCharacterDirectory(markdownTree.map((entry) => entry.path));

  return json({ branch, characters });
};
