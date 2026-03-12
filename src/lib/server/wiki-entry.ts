import { error } from '@sveltejs/kit';
import { slugifyForBranch } from '$lib/utils/slugify';

export type WikiEntryFormat = 'md' | 'json';

const CONTENT_PREFIX = 'content/';
const CHAPTERS_JSON_PREFIX = 'content/Chapters/';

function normalizePath(rawPath: string): string {
  let decoded = rawPath.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep original input if it is not URI encoded.
  }

  const normalized = decoded.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/')) {
    throw error(400, 'Invalid path');
  }

  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw error(400, 'Invalid path segments');
  }

  return parts.join('/');
}

export function resolveEntryPath(path: string, format?: WikiEntryFormat): {
  path: string;
  format: WikiEntryFormat;
} {
  const normalizedPath = normalizePath(path);
  if (!normalizedPath.startsWith(CONTENT_PREFIX)) {
    throw error(403, `Write denied: path must start with ${CONTENT_PREFIX}`);
  }

  const inferredFormat: WikiEntryFormat | null = normalizedPath.endsWith('.md')
    ? 'md'
    : normalizedPath.endsWith('.json')
      ? 'json'
      : null;

  const resolvedFormat = format ?? inferredFormat;
  if (!resolvedFormat) {
    throw error(400, 'Path must end with .md or .json');
  }

  if (resolvedFormat === 'md' && !normalizedPath.endsWith('.md')) {
    throw error(400, 'Markdown entries must use a .md path');
  }
  if (resolvedFormat === 'json' && !normalizedPath.endsWith('.json')) {
    throw error(400, 'JSON entries must use a .json path');
  }
  if (resolvedFormat === 'json' && !normalizedPath.startsWith(CHAPTERS_JSON_PREFIX)) {
    throw error(403, `JSON entries must be under ${CHAPTERS_JSON_PREFIX}`);
  }

  return { path: normalizedPath, format: resolvedFormat };
}

export function branchForPath(path: string): string {
  return `content/${slugifyForBranch(path)}`;
}

export function assertBranchMatchesPath(branch: string, path: string): void {
  const expected = branchForPath(path);
  if (branch !== expected) {
    throw error(400, `Branch "${branch}" does not match path-derived branch "${expected}"`);
  }
}
