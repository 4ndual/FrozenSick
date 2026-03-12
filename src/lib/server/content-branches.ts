import { formatPathAsTitle, slugifyForBranch } from '$lib/utils/slugify';

export const CONTENT_BRANCH_PREFIX = 'content/';
const SEPARATOR = '/';

export interface ParsedContentBranch {
  owner: string | null;
  slug: string;
}

export function slugifyLogin(login: string): string {
  const normalized = login
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'user';
}

export function parseContentBranch(branch: string): ParsedContentBranch | null {
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) return null;
  const raw = branch.slice(CONTENT_BRANCH_PREFIX.length).trim();
  if (!raw) return null;

  const segments = raw.split(SEPARATOR).filter(Boolean);
  if (segments.length >= 2) {
    return {
      owner: segments[0],
      slug: segments.slice(1).join(SEPARATOR),
    };
  }

  return { owner: null, slug: segments[0] };
}

export function buildUserContentBranch(sourcePath: string, login: string): string {
  const owner = slugifyLogin(login);
  const slug = slugifyForBranch(sourcePath);
  return `${CONTENT_BRANCH_PREFIX}${owner}/${slug}`;
}

export function formatContentBranchLabel(
  branch: string,
  sourcePaths: string[],
): string {
  const parsed = parseContentBranch(branch);
  if (!parsed) return branch;

  const matchingSource = sourcePaths.find(
    (sourcePath) => slugifyForBranch(sourcePath) === parsed.slug,
  );
  const baseLabel = matchingSource
    ? formatPathAsTitle(matchingSource)
    : parsed.slug.replace(/-/g, ' ');

  if (!parsed.owner) return baseLabel;
  return `${baseLabel} (${parsed.owner})`;
}
