import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAP_MODULES = import.meta.glob('/content/World/*.map', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:\s*/gi, '');
}

function extractSvg(mapContent: string): string | null {
  const start = mapContent.indexOf('<svg');
  if (start === -1) return null;

  const end = mapContent.lastIndexOf('</svg>');
  if (end === -1 || end <= start) return null;

  return mapContent.slice(start, end + '</svg>'.length);
}

function validateFileName(file: string): boolean {
  if (!file.toLowerCase().endsWith('.map')) return false;
  if (file.includes('/') || file.includes('\\')) return false;
  if (file.includes('..')) return false;
  return true;
}

function fileNameFromModulePath(modulePath: string): string {
  return modulePath.split('/').pop() ?? modulePath;
}

function resolveModulePath(fileName: string): string | undefined {
  return Object.keys(MAP_MODULES).find((modulePath) => fileNameFromModulePath(modulePath) === fileName);
}

export const GET: RequestHandler = async ({ url }) => {
  const requestedFile = url.searchParams.get('file');
  let fileName = requestedFile ?? '';

  if (!fileName) {
    const first = Object.keys(MAP_MODULES)
      .map((modulePath) => fileNameFromModulePath(modulePath))
      .sort((a, b) => a.localeCompare(b))[0];

    if (!first) {
      throw error(404, 'No .map files found in content/World');
    }

    fileName = first;
  }

  if (!validateFileName(fileName)) {
    throw error(400, 'Invalid map file name');
  }

  const modulePath = resolveModulePath(fileName);
  if (!modulePath) {
    throw error(404, 'Map file not found');
  }

  const content = MAP_MODULES[modulePath];
  const rawSvg = extractSvg(content);
  if (!rawSvg) {
    throw error(422, 'No SVG found in .map file');
  }

  return json({
    file: fileName,
    name: fileName.replace(/\.map$/i, ''),
    svg: sanitizeSvg(rawSvg),
    source: 'content/World',
  });
};
