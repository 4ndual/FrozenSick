import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  fetchContentRaw,
  fetchWorldMapPaths,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';

/** Strip scripts and event handlers from SVG for safe in-browser render. */
function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript:\s*/gi, '');
}

/** Extract the first <svg>...</svg> from .map file content. */
function extractSvg(mapContent: string): string | null {
  const start = mapContent.indexOf('<svg');
  if (start === -1) return null;
  const end = mapContent.indexOf('</svg>', start);
  if (end === -1) return null;
  return mapContent.slice(start, end + '</svg>'.length);
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) {
    throw error(401, 'Not authenticated');
  }

  const fileParam = url.searchParams.get('file');
  const branch = url.searchParams.get('branch') || getDefaultBranch();

  let path: string;
  if (fileParam) {
    path = decodeURIComponent(fileParam);
    if (!path.startsWith('content/World/') || !path.endsWith('.map')) {
      throw error(400, 'Invalid map file path');
    }
  } else {
    try {
      const entries = await fetchWorldMapPaths(token, branch);
      const first = entries.sort((a, b) => b.path.localeCompare(a.path))[0];
      if (!first) throw error(404, 'No map files found');
      path = first.path;
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err) throw err;
      throw error(404, 'No map files found');
    }
  }

  try {
    const content = await fetchContentRaw(token, path, branch);
    const rawSvg = extractSvg(content);
    if (!rawSvg) throw error(422, 'No SVG found in map file');
    const svg = sanitizeSvg(rawSvg);
    const name = path.split('/').pop()?.replace(/\.map$/i, '') ?? path;
    return json({ svg, name, path, branch });
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      throw error(401, 'Token expired');
    }
    if (err && typeof err === 'object' && 'status' in err) throw err;
    throw error(500, 'Failed to load map');
  }
};
