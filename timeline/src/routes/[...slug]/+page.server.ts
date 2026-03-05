import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';
import manifest from '$lib/wiki-manifest.json';

const ROOT = process.cwd();

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

  const fullPath = join(ROOT, '..', sourcePath);

  // Ensure we don't escape the repo root
  const repoRoot = join(ROOT, '..');
  if (!fullPath.startsWith(repoRoot)) {
    throw error(400, 'Invalid path');
  }

  if (!existsSync(fullPath)) {
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
