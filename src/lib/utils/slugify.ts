/**
 * Shared slugify utilities used by both client (Header, BranchSelector)
 * and server (github-content, page.server) code.
 */

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugifyPath(relPath: string): string {
  return relPath
    .replace(/\.md$/i, '')
    .split('/')
    .map(slugify)
    .join('/');
}

/**
 * Derive a branch-safe slug from a content file path.
 * e.g. "content/Chapters/Chapter 1 - The Tavern/Summary.md"
 *   -> "chapters-chapter-1---the-tavern-summary"
 */
export function slugifyForBranch(sourcePath: string): string {
  return sourcePath
    .replace(/^content\//, '')
    .replace(/\.(md|json)$/i, '')
    .split('/')
    .map(slugify)
    .join('-');
}

/**
 * Convert a content file path into a human-readable title.
 * e.g. "content/Chapters/Chapter 1 - The Tavern/Summary.md"
 *   -> "Chapter 1 - The Tavern / Summary"
 */
export function formatPathAsTitle(filePath: string): string {
  const withoutPrefix = filePath.replace(/^content\//, '');
  const withoutExt = withoutPrefix.replace(/\.md$/i, '');
  const parts = withoutExt.split('/');
  return parts.slice(1).join(' / ') || parts[0];
}
