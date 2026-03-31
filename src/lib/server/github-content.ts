import { env } from '$env/dynamic/public';
import type { NavEntry, NavItem, NavSection } from '$lib/wiki-nav';
import { classifyWikiEntry, formatNavTitle, slugify, slugifyPath } from '$lib/wiki-entry';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const API = 'https://api.github.com';
const LOCAL_DEV_CONTENT = process.env.NODE_ENV !== 'production';
const LOCAL_REPO_ROOT = process.cwd();
const LOCAL_CONTENT_ROOT = path.join(LOCAL_REPO_ROOT, 'content');

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

async function walkLocalContent(dir: string): Promise<TreeEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: TreeEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkLocalContent(fullPath)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.match(/\.(md|txt)$/i)) continue;
    if (entry.name === 'README.md') continue;

    const relative = path.relative(LOCAL_REPO_ROOT, fullPath).split(path.sep).join('/');
    result.push({
      path: relative,
      mode: '100644',
      type: 'blob',
      sha: 'local',
    });
  }

  return result;
}

async function walkLocalFiles(dir: string, extension: string): Promise<TreeEntry[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result: TreeEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walkLocalFiles(fullPath, extension)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(extension)) continue;

    const relative = path.relative(LOCAL_REPO_ROOT, fullPath).split(path.sep).join('/');
    result.push({
      path: relative,
      mode: '100644',
      type: 'blob',
      sha: 'local',
    });
  }

  return result;
}

function canUseLocalContent(): boolean {
  return LOCAL_DEV_CONTENT && existsSync(LOCAL_CONTENT_ROOT);
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
export { slugify, slugifyPath } from '$lib/wiki-entry';

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
 * Fetch the full file tree for a branch. Uses ref -> commit -> tree chain.
 * Returns only blob entries under `content/` that end with `.md` or `.txt`.
 */
export async function fetchTree(token: string, branch?: string): Promise<TreeEntry[]> {
  if (canUseLocalContent()) {
    return walkLocalContent(LOCAL_CONTENT_ROOT);
  }

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
      /\.(md|txt)$/i.test(e.path) &&
      !e.path.endsWith('/README.md'),
  );

  await setCache(cacheKey, contentEntries, TREE_TTL);
  return contentEntries;
}

const WORLD_MAPS_TTL = 5 * 60 * 1000;
const CHAPTER_JSON_TTL = 5 * 60 * 1000;
const MENU_CONFIG_TTL = 60 * 1000;
export const MENU_CONFIG_PATH = 'content/Menu/navigation.json';
const LOCAL_MENU_CONFIG = path.join(LOCAL_REPO_ROOT, MENU_CONFIG_PATH);

export interface MenuCustomization {
  hidden: string[];
}

const EMPTY_MENU_CUSTOMIZATION: MenuCustomization = {
  hidden: [],
};

const TRACKER_SOURCE_PATH = 'content/Plot/Tracker';
const DM_PLANNING_SOURCE_PATH = 'content/Plot/DM Planning.md';

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
  if (canUseLocalContent()) {
    if (!existsSync(LOCAL_MENU_CONFIG)) {
      return { ...EMPTY_MENU_CUSTOMIZATION };
    }

    try {
      const decoded = await readFile(LOCAL_MENU_CONFIG, 'utf8');
      return normalizeMenuCustomization(JSON.parse(decoded));
    } catch {
      return { ...EMPTY_MENU_CUSTOMIZATION };
    }
  }

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
  if (canUseLocalContent()) {
    const worldRoot = path.join(LOCAL_CONTENT_ROOT, 'World');
    return existsSync(worldRoot) ? walkLocalFiles(worldRoot, '.map') : [];
  }

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
  if (canUseLocalContent()) {
    const chaptersRoot = path.join(LOCAL_CONTENT_ROOT, 'Chapters');
    return existsSync(chaptersRoot) ? walkLocalFiles(chaptersRoot, '.json') : [];
  }

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
 * Build slug -> repoPath manifest from tree entries.
 * Strips the `content/` prefix for slug generation but keeps it in the value.
 */
export function buildManifest(tree: TreeEntry[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  for (const entry of tree) {
    const relativePath = entry.path.replace(/^content\//, '');
    const slug = '/' + slugifyPath(relativePath);
    manifest[slug] = entry.path;

    const parts = relativePath.split('/');
    const isSectionLanding = classifyWikiEntry(entry.path).isSectionLanding;

    if (isSectionLanding && parts.length > 1) {
      const parentSlug = '/' + slugifyPath(parts.slice(0, -1).join('/'));
      manifest[parentSlug] = entry.path;
    }
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
          const fileName = f.split('/').pop()!.replace(/\.(md|txt)$/i, '');
          return {
            title: formatNavTitle(sourcePath, fileName),
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
      const fileName = file.split('/').pop()!.replace(/\.(md|txt)$/i, '');
      const sourcePath = `content/${file}`;
      if (sourcePath === DM_PLANNING_SOURCE_PATH) continue;
      children.push({
        title: formatNavTitle(sourcePath, fileName),
        href: '/' + slugifyPath(file),
        sourcePath,
        kind: 'file',
      });
    }

    if (sectionName === 'Plot') {
      const tracker = children.find((child) => child.sourcePath === TRACKER_SOURCE_PATH);
      if (tracker) {
        const trackerChildren: NavItem[] = [];
        if (tracker.href) {
          trackerChildren.push({
            title: 'Overview',
            href: tracker.href,
            sourcePath: `${TRACKER_SOURCE_PATH}/Summary.md`,
            kind: 'file',
          });
        }
        if (tracker.sub?.length) {
          trackerChildren.push(...tracker.sub);
        }
        nav.push({
          section: 'Tracker',
          sourcePath: TRACKER_SOURCE_PATH,
          children: trackerChildren,
        } as NavSection);
      }
      continue;
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
    const name = file.replace(/\.(md|txt)$/i, '');
    const sourcePath = `content/${file}`;
    nav.push({
      title: formatNavTitle(sourcePath, name),
      href: '/' + slugify(name),
      sourcePath,
      kind: 'file',
    });
  }

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
  if (canUseLocalContent()) {
    const fullPath = path.join(LOCAL_REPO_ROOT, repoPath);
    const content = await readFile(fullPath, 'utf8');
    return { content, sha: 'local' };
  }

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
  if (canUseLocalContent()) {
    const fullPath = path.join(LOCAL_REPO_ROOT, repoPath);
    return readFile(fullPath, 'utf8');
  }

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
  if (LOCAL_DEV_CONTENT) {
    try {
      const output = execSync('git branch --format=\"%(refname:short)\"', {
        cwd: LOCAL_REPO_ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const branches = output
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean);
      return branches.length > 0 ? branches : [getDefaultBranch()];
    } catch {
      return [getDefaultBranch()];
    }
  }

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
  if (LOCAL_DEV_CONTENT) {
    return { aheadBy: 0, behindBy: 0 };
  }

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
