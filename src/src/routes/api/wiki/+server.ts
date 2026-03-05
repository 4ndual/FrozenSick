import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ROOT = process.cwd();

// Try to resolve content path - in dev, content is in ../content/
// on Vercel with includeFiles, content is bundled at content/ relative to function
function resolveContentPath(decodedPath: string): string | null {
  // Try direct path first (Vercel bundled)
  const directPath = join(ROOT, decodedPath);
  if (existsSync(directPath)) {
    return directPath;
  }

  // Try parent directory (local dev)
  const parentPath = join(ROOT, '..', decodedPath);
  if (existsSync(parentPath)) {
    return parentPath;
  }

  return null;
}

export const GET: RequestHandler = ({ url }) => {
  const pathParam = url.searchParams.get('path');

  if (!pathParam) {
    throw error(400, 'Missing path');
  }

  const decoded = decodeURIComponent(pathParam);

  // Security check: prevent directory traversal
  if (decoded.includes('..') || decoded.startsWith('/')) {
    throw error(400, 'Invalid path');
  }

  const fullPath = resolveContentPath(decoded);

  if (!fullPath) {
    throw error(404, 'Not found');
  }

  // Ensure we don't escape the repo root (check against both possible roots)
  const directRoot = resolve(ROOT);
  const parentRoot = resolve(ROOT, '..');
  if (!fullPath.startsWith(directRoot) && !fullPath.startsWith(parentRoot)) {
    throw error(400, 'Invalid path');
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return json({ content });
  } catch (err) {
    throw error(500, 'Failed to read file');
  }
};
