import { env } from '$env/dynamic/public';
import type { NavEntry, NavItem, NavSection } from '$lib/wiki-nav';
import { slugify, slugifyPath } from '$lib/utils/slugify';

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
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// ── Cache ────────────────────────────────────────────────────────────────────

import {
  getCached,
  setCache,
  invalidateCache as _invalidateCache,
} from './cache';

const TREE_TTL = 5 * 60 * 1000;
const CONTENT_TTL = 5 * 60 * 1000;
const BRANCHES_TTL = 30 * 1000;

export async function invalidateCache(branch?: string): Promise<void> {
  return _invalidateCache(branch);
}

// Re-export slug utilities for consumers that import from this module
export { slugify, slugifyPath } from '$lib/utils/slugify';

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
  const cached = await getCached<TreeEntry[]>(cacheKey);
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

  await setCache(cacheKey, contentEntries, TREE_TTL);
  return contentEntries;
}

const WORLD_MAPS_TTL = 5 * 60 * 1000;
const CHAPTER_JSON_TTL = 5 * 60 * 1000;
const MENU_CONFIG_TTL = 60 * 1000;
export const MENU_CONFIG_PATH = 'content/Menu/navigation.json';

export interface MenuCustomization {
  hidden: string[];
}

const EMPTY_MENU_CUSTOMIZATION: MenuCustomization = {
  hidden: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeMenuCustomization(raw: unknown): MenuCustomization {
  if (!isObject(raw)) {
    return { ...EMPTY_MENU_CUSTOMIZATION };
  }
  return {
    hidden: normalizeStringList(raw.hidden),
  };
}

export function navTargetKey(kind: 'file' | 'folder', sourcePath: string): string {
  return `${kind}:${sourcePath}`;
}

export async function fetchMenuCustomization(
  token: string,
  branch?: string,
): Promise<MenuCustomization> {
  const b = branch || getDefaultBranch();
  const cacheKey = `menuCustomization@${b}`;
  const cached = await getCached<MenuCustomization>(cacheKey);
  if (cached) return cached;

  const encodedPath = MENU_CONFIG_PATH.split('/').map(encodeURIComponent).join('/');
  const url = `${repoUrl()}/contents/${encodedPath}?ref=${encodeURIComponent(b)}`;
  const res = await fetch(url, { headers: ghHeaders(token) });

  if (res.status === 404) {
    const fallback = { ...EMPTY_MENU_CUSTOMIZATION };
    await setCache(cacheKey, fallback, MENU_CONFIG_TTL);
    return fallback;
  }
  if (res.status === 401) {
    throw new GitHubAuthError('GitHub token expired or invalid');
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${url}`);
  }

  const data = (await res.json()) as { content?: string };
  let parsed: unknown = {};
  if (data.content) {
    const decoded = decodeBase64Utf8(data.content.replace(/\n/g, ''));
    try {
      parsed = JSON.parse(decoded);
    } catch {
      parsed = {};
    }
  }

  const normalized = normalizeMenuCustomization(parsed);
  await setCache(cacheKey, normalized, MENU_CONFIG_TTL);
  return normalized;
}

/**
 * Fetch blob entries under content/World/ that end with .map (Azgaar FMG files).
 */
export async function fetchWorldMapPaths(token: string, branch?: string): Promise<TreeEntry[]> {
  const b = branch || getDefaultBranch();
  const cacheKey = `worldMaps@${b}`;
  const cached = await getCached<TreeEntry[]>(cacheKey);
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

  const mapEntries = treeData.tree.filter(
    (e) =>
      e.type === 'blob' &&
      e.path.startsWith('content/World/') &&
      e.path.endsWith('.map'),
  );

  await setCache(cacheKey, mapEntries, WORLD_MAPS_TTL);
  return mapEntries;
}

/**
 * Fetch blob entries under content/Chapters/ that end with .json.
 */
export async function fetchChapterJsonPaths(token: string, branch?: string): Promise<TreeEntry[]> {
  const b = branch || getDefaultBranch();
  const cacheKey = `chapterJson@${b}`;
  const cached = await getCached<TreeEntry[]>(cacheKey);
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

  const chapterEntries = treeData.tree.filter(
    (e) =>
      e.type === 'blob' &&
      e.path.startsWith('content/Chapters/') &&
      e.path.endsWith('.json'),
  );

  await setCache(cacheKey, chapterEntries, CHAPTER_JSON_TTL);
  return chapterEntries;
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
export function buildNav(tree: TreeEntry[], customization?: MenuCustomization): NavEntry[] {
  const hidden = new Set((customization?.hidden ?? []).map((entry) => entry.trim()).filter(Boolean));
  const isHiddenFile = (path: string) => hidden.has(navTargetKey('file', path));
  const isHiddenFolder = (path: string) =>
    hidden.has(navTargetKey('folder', path)) ||
    hidden.has(navTargetKey('folder', path.replace(/\/+$/, '')));
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

  const nav: NavEntry[] = [{ title: 'Home', href: '/', kind: 'special' }];

  const sortedSections = [...sections.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  for (const [sectionName, groups] of sortedSections) {
    const children: (NavItem & { sub?: NavItem[] })[] = [];

    const subGroups = [...groups.entries()]
      .filter(([k]) => k !== '__root__')
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [groupName, files] of subGroups) {
      const groupSourcePath = `content/${sectionName}/${groupName}`;
      if (isHiddenFolder(groupSourcePath)) continue;
      const sortedFiles = [...files]
        .map((path) => `content/${path}`)
        .filter((path) => !isHiddenFile(path))
        .map((path) => path.replace(/^content\//, ''))
        .sort();
      if (sortedFiles.length === 0) continue;
      const summaryFile = sortedFiles.find((f) =>
        f.split('/').pop()!.toLowerCase().replace(/\.md$/, '') === 'summary',
      );
      const mainFile = summaryFile || sortedFiles[0];
      const otherFiles = sortedFiles.filter((f) => f !== mainFile);

      const child: NavItem = {
        title: groupName,
        href: '/' + slugifyPath(mainFile),
        sourcePath: groupSourcePath,
        kind: 'folder',
      };

      if (otherFiles.length > 0) {
        child.sub = otherFiles.map((f) => {
          const sourcePath = `content/${f}`;
          const fileName = f.split('/').pop()!.replace(/\.md$/i, '');
          return {
            title: fileName,
            href: '/' + slugifyPath(f),
            sourcePath,
            kind: 'file',
          };
        });
      }

      children.push(child);
    }

    const rootFiles = groups.get('__root__') || [];
    for (const file of [...rootFiles]
      .map((path) => `content/${path}`)
      .filter((path) => !isHiddenFile(path))
      .map((path) => path.replace(/^content\//, ''))
      .sort()) {
      const fileName = file.split('/').pop()!.replace(/\.md$/i, '');
      children.push({
        title: fileName,
        href: '/' + slugifyPath(file),
        sourcePath: `content/${file}`,
        kind: 'file',
      });
    }

    if (sectionName === 'World') {
      children.push({ title: 'Map', href: '/maps', kind: 'special' });
    }

    if (children.length > 0) {
      nav.push({
        section: sectionName,
        sourcePath: `content/${sectionName}`,
        children,
      } as NavSection);
    }
  }

  for (const file of [...topLevel]
    .map((path) => `content/${path}`)
    .filter((path) => !isHiddenFile(path))
    .map((path) => path.replace(/^content\//, ''))
    .sort()) {
    const name = file.replace(/\.md$/i, '');
    nav.push({
      title: name,
      href: '/' + slugify(name),
      sourcePath: `content/${file}`,
      kind: 'file',
    });
  }

  nav.push({ title: 'Timeline', href: '/timeline/', kind: 'special' });

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
  const cached = await getCached<{ content: string; sha: string }>(cacheKey);
  if (cached) return cached;

  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  const data = await fetchJson<{ content?: string; sha: string; encoding?: string }>(
    `${repoUrl()}/contents/${encodedPath}?ref=${encodeURIComponent(b)}`,
    token,
  );

  const decoded = data.content ? decodeBase64Utf8(data.content.replace(/\n/g, '')) : '';
  const result = { content: decoded, sha: data.sha };

  await setCache(cacheKey, result, CONTENT_TTL);
  return result;
}

/**
 * Fetch raw file content (for large files >1MB where Contents API returns empty content).
 * Uses Accept: application/vnd.github.v3.raw to get the file body directly.
 */
export async function fetchContentRaw(
  token: string,
  repoPath: string,
  branch?: string,
): Promise<string> {
  const b = branch || getDefaultBranch();
  const cacheKey = `contentRaw:${repoPath}@${b}`;
  const cached = await getCached<string>(cacheKey);
  if (cached) return cached;

  const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
  const url = `${repoUrl()}/contents/${encodedPath}?ref=${encodeURIComponent(b)}`;
  const res = await fetch(url, {
    headers: {
      ...ghHeaders(token),
      Accept: 'application/vnd.github.v3.raw',
    },
  });
  if (res.status === 401) {
    throw new GitHubAuthError('GitHub token expired or invalid');
  }
  if (!res.ok) {
    throw new Error(`GitHub ${res.status}: ${url}`);
  }
  const content = await res.text();
  await setCache(cacheKey, content, CONTENT_TTL);
  return content;
}

/**
 * List all branches for the repo.
 */
export async function listBranches(token: string): Promise<string[]> {
  const cacheKey = 'branches';
  const cached = await getCached<string[]>(cacheKey);
  if (cached) return cached;

  const names: string[] = [];
  let page = 1;

  while (true) {
    const data = await fetchJson<{ name: string }[]>(
      `${repoUrl()}/branches?per_page=100&page=${page}`,
      token,
    );
    names.push(...data.map((b) => b.name));
    if (data.length < 100) break;
    page += 1;
  }

  await setCache(cacheKey, names, BRANCHES_TTL);
  return names;
}

export interface BranchComparison {
  aheadBy: number;
  behindBy: number;
}

/**
 * Compare a content branch against the default branch.
 * Returns how many commits the content branch is ahead/behind.
 */
export async function compareBranches(
  token: string,
  contentBranch: string,
  baseBranch?: string,
): Promise<BranchComparison> {
  const base = baseBranch || getDefaultBranch();
  const cacheKey = `compare:${base}...${contentBranch}`;
  const cached = await getCached<BranchComparison>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{ ahead_by: number; behind_by: number }>(
    `${repoUrl()}/compare/${encodeURIComponent(base)}...${encodeURIComponent(contentBranch)}`,
    token,
  );

  const result: BranchComparison = {
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
  };
  await setCache(cacheKey, result, BRANCHES_TTL);
  return result;
}
