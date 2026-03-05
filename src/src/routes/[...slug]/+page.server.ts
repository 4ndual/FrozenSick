import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';
import manifest from '$lib/wiki-manifest.json';

const ROOT = process.cwd();

// Try to resolve content path - in dev, content is in ../content/
// on Vercel with includeFiles, content is bundled at content/ relative to function
function resolveContentPath(sourcePath: string): string | null {
  // Try direct path first (Vercel bundled)
  const directPath = join(ROOT, sourcePath);
  if (existsSync(directPath)) {
    return directPath;
  }

  // Try parent directory (local dev)
  const parentPath = join(ROOT, '..', sourcePath);
  if (existsSync(parentPath)) {
    return parentPath;
  }

  return null;
}

export async function load({ params }) {
  const slug = '/' + params.slug;
  const slugToPath = manifest as Record<string, string>;
  const sourcePath = slugToPath[slug];

  if (!sourcePath) {
    throw error(404, 'Page not found');
  }

  // Security check: prevent directory traversal
  if (sourcePath.includes('..') || sourcePath.startsWith('/')) {
    throw error(400, 'Invalid path');
  }

  const fullPath = resolveContentPath(sourcePath);

  if (!fullPath) {
    throw error(404, 'Page not found');
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return {
      content,
      slug,
      sourcePath
    };
  } catch (err) {
    throw error(500, 'Failed to read file');
  }
}
