import { env } from '$env/dynamic/public';
import type { NavEntry, NavItem, NavSection } from '$lib/wiki-nav';

const API = 'https://api.github.com';

function getOwner(): string {
  return (env.PUBLIC_GITHUB_OWNER as string) || '4ndual';
}

function getRepo(): string {
  return (env.PUBLIC_GITHUB_REPO as string) || 'FrozenSick';
}

export function getDefaultBranch(): string {
  return (env.PUBLIC_GITHUB_BRANCH as string) || 'main';
}

function repoUrl(): string {
  return `${API}/repos/${getOwner()}/${getRepo()}`;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const TREE_TTL = 5 * 60 * 1000;
const CONTENT_TTL = 5 * 60 * 1000;
const BRANCHES_TTL = 10 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(branch?: string): void {
  if (!branch) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(`@${branch}`) || key === 'branches') {
      cache.delete(key);
    }
  }
}

// ── Slugify (ported from generate-wiki-manifest.cjs) ─────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function slugifyPath(relPath: string): string {
  return relPath
    .replace(/\.md$/i, '')
    .split('/')
    .map(slugify)
    .join('/');
}

// ── GitHub API ───────────────────────────────────────────────────────────────

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (res.status === 401) {
    throw new GitHubAuthError('GitHub token expired or invalid');
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

/**
 * Fetch the full file tree for a branch. Uses ref→commit→tree chain.
 * Returns only blob entries under `content/` that end with `.md`.
 */
export async function fetchTree(token: string, branch?: string): Promise<TreeEntry[]> {
  const b = branch || getDefaultBranch();
  const cacheKey = `tree@${b}`;
  const cached = getCached<TreeEntry[]>(cacheKey);
  if (cached) return cached;

  const ref = await fetchJson<{ object: { sha: string } }>(
    `${repoUrl()}/git/ref/heads/${encodeURIComponent(b)}`,
    token,
  );
  const commit = await fetchJson<{ tree: { sha: string } }>(
    `${repoUrl()}/git/commits/${ref.object.sha}`,
    token,
  );
  const treeData = await fetchJson<{ tree: TreeEntry[] }>(
    `${repoUrl()}/git/trees/${commit.tree.sha}?recursive=1`,
    token,
  );

  const contentEntries = treeData.tree.filter(
    (e) =>
      e.type === 'blob' &&
      e.path.startsWith('content/') &&
      e.path.endsWith('.md') &&
      !e.path.endsWith('/README.md'),
  );

  setCache(cacheKey, contentEntries, TREE_TTL);
  return contentEntries;
}

/**
 * Build slug→repoPath manifest from tree entries.
 * Strips the `content/` prefix for slug generation but keeps it in the value.
 */
export function buildManifest(tree: TreeEntry[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const entry of tree) {
    const relativePath = entry.path.replace(/^content\//, '');
    const slug = '/' + slugifyPath(relativePath);
    manifest[slug] = entry.path;
  }
  return manifest;
}

/**
 * Build the wiki navigation from tree entries.
 * Folder structure under `content/` defines sections and groups.
 */
export function buildNav(tree: TreeEntry[]): NavEntry[] {
  const relativePaths = tree.map((e) => e.path.replace(/^content\//, ''));

  const sections = new Map<string, Map<string, string[]>>();
  const topLevel: string[] = [];

  for (const relPath of relativePaths) {
    const parts = relPath.split('/');

    if (parts.length === 1) {
      topLevel.push(relPath);
    } else if (parts.length === 2) {
      const sectionName = parts[0];
      if (!sections.has(sectionName)) sections.set(sectionName, new Map());
      const section = sections.get(sectionName)!;
      if (!section.has('__root__')) section.set('__root__', []);
      section.get('__root__')!.push(relPath);
    } else {
      const sectionName = parts[0];
      const groupName = parts[1];
      if (!sections.has(sectionName)) sections.set(sectionName, new Map());
      const section = sections.get(sectionName)!;
      if (!section.has(groupName)) section.set(groupName, []);
      section.get(groupName)!.push(relPath);
    }
  }

  const nav: NavEntry[] = [{ title: 'Home', href: '/' }];

  const sortedSections = [...sections.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  for (const [sectionName, groups] of sortedSections) {
    const children: (NavItem & { sub?: NavItem[] })[] = [];

    const subGroups = [...groups.entries()]
      .filter(([k]) => k !== '__root__')
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [groupName, files] of subGroups) {
      const sortedFiles = [...files].sort();
      const summaryFile = sortedFiles.find((f) =>
        f.split('/').pop()!.toLowerCase().replace(/\.md$/, '') === 'summary',
      );
      const mainFile = summaryFile || sortedFiles[0];
      const otherFiles = sortedFiles.filter((f) => f !== mainFile);

      const child: NavItem & { sub?: NavItem[] } = {
        title: groupName,
        href: '/' + slugifyPath(mainFile),
      };

      if (otherFiles.length > 0) {
        child.sub = otherFiles.map((f) => {
          const fileName = f.split('/').pop()!.replace(/\.md$/i, '');
          return { title: fileName, href: '/' + slugifyPath(f) };
        });
      }

      children.push(child);
    }

    const rootFiles = groups.get('__root__') || [];
    for (const file of [...rootFiles].sort()) {
      const fileName = file.split('/').pop()!.replace(/\.md$/i, '');
      children.push({ title: fileName, href: '/' + slugifyPath(file) });
    }

    nav.push({ section: sectionName, children } as NavSection);
  }

  for (const file of [...topLevel].sort()) {
    const name = file.replace(/\.md$/i, '');
    nav.push({ title: name, href: '/' + slugify(name) });
  }

  nav.push({ title: 'Timeline', href: '/timeline/' });

  return nav;
}

/**
 * Fetch a single file's content from GitHub.
 * Uses the Contents API which accepts branch names directly.
 */
export async function fetchContent(
  token: string,
  repoPath: string,
  branch?: string,
): Promise<{ content: string; sha: string }> {
  const b = branch || getDefaultBranch();
  const cacheKey = `content:${repoPath}@${b}`;
  const cached = getCached<{ content: string; sha: string }>(cacheKey);
  if (cached) return cached;

  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  const data = await fetchJson<{ content?: string; sha: string; encoding?: string }>(
    `${repoUrl()}/contents/${encodedPath}?ref=${encodeURIComponent(b)}`,
    token,
  );

  const decoded = data.content ? atob(data.content.replace(/\n/g, '')) : '';
  const result = { content: decoded, sha: data.sha };

  setCache(cacheKey, result, CONTENT_TTL);
  return result;
}

/**
 * List all branches for the repo.
 */
export async function listBranches(token: string): Promise<string[]> {
  const cacheKey = 'branches';
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{ name: string }[]>(
    `${repoUrl()}/branches?per_page=100`,
    token,
  );

  const names = data.map((b) => b.name);
  setCache(cacheKey, names, BRANCHES_TTL);
  return names;
}
