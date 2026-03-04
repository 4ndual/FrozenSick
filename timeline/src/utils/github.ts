import type {
  CampaignData,
  CampaignEvent,
  CampaignTimeline,
  CampaignMeta,
  CalendarConfig,
  CustomEventType,
} from '../types/schema.ts';

const API = 'https://api.github.com';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export interface FileSha {
  path: string;
  sha: string;
}

export interface GitHubSnapshot {
  data: CampaignData;
  headSha: string;
  treeSha: string;
  fileShas: Record<string, string>;
}

export interface FileChange {
  path: string;
  content: string | null;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function repoUrl(cfg: RepoConfig) {
  return `${API}/repos/${cfg.owner}/${cfg.repo}`;
}

export function getRepoConfig(): RepoConfig {
  return {
    owner: import.meta.env.VITE_GITHUB_OWNER || '4ndual',
    repo: import.meta.env.VITE_GITHUB_REPO || 'FrozenSick',
    branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  };
}

// ── Read ────────────────────────────────────────────────────────────────────

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json();
}

async function getRef(cfg: RepoConfig, token: string): Promise<{ sha: string }> {
  const data = await fetchJson(
    `${repoUrl(cfg)}/git/ref/heads/${cfg.branch}`,
    token,
  );
  return { sha: data.object.sha };
}

async function getCommit(cfg: RepoConfig, token: string, sha: string) {
  return fetchJson(`${repoUrl(cfg)}/git/commits/${sha}`, token);
}

interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

async function getTree(cfg: RepoConfig, token: string, sha: string): Promise<TreeEntry[]> {
  const data = await fetchJson(
    `${repoUrl(cfg)}/git/trees/${sha}?recursive=1`,
    token,
  );
  return data.tree as TreeEntry[];
}

async function getBlob(cfg: RepoConfig, token: string, sha: string): Promise<string> {
  const data = await fetchJson(`${repoUrl(cfg)}/git/blobs/${sha}`, token);
  return atob(data.content);
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

/**
 * Load the entire `.data/` tree from GitHub and reassemble into CampaignData.
 */
export async function loadFromGitHub(
  cfg: RepoConfig,
  token: string,
): Promise<GitHubSnapshot> {
  const ref = await getRef(cfg, token);
  const commit = await getCommit(cfg, token, ref.sha);
  const tree = await getTree(cfg, token, commit.tree.sha);

  const dataFiles = tree.filter(
    (e) => e.path.startsWith('.data/') && e.type === 'blob',
  );

  const fileShas: Record<string, string> = {};
  const fileContents: Record<string, string> = {};

  const fetches = dataFiles.map(async (entry) => {
    const content = await getBlob(cfg, token, entry.sha);
    fileShas[entry.path] = entry.sha;
    fileContents[entry.path] = content;
  });

  await Promise.all(fetches);

  const meta = fileContents['.data/meta.json']
    ? parseJson<CampaignMeta>(fileContents['.data/meta.json'])
    : { campaignId: 'frozen-sick', campaignName: 'Frozen Sick', version: 1 };

  const calendar = fileContents['.data/calendar.json']
    ? parseJson<CalendarConfig>(fileContents['.data/calendar.json'])
    : undefined;

  const eventTypes = fileContents['.data/event-types.json']
    ? parseJson<CustomEventType[]>(fileContents['.data/event-types.json'])
    : undefined;

  const suggestedTags = fileContents['.data/suggested-tags.json']
    ? parseJson<string[]>(fileContents['.data/suggested-tags.json'])
    : undefined;

  const timelines: CampaignTimeline[] = [];
  const events: CampaignEvent[] = [];

  for (const [path, content] of Object.entries(fileContents)) {
    if (path.startsWith('.data/timelines/') && path.endsWith('.json')) {
      timelines.push(parseJson<CampaignTimeline>(content));
    } else if (path.startsWith('.data/events/') && path.endsWith('.json')) {
      events.push(parseJson<CampaignEvent>(content));
    }
  }

  timelines.sort((a, b) => a.order - b.order);

  const data: CampaignData = {
    meta,
    calendar: calendar!,
    timelines,
    events,
    ...(eventTypes ? { eventTypes } : {}),
    ...(suggestedTags ? { suggestedTags } : {}),
  };

  return {
    data,
    headSha: ref.sha,
    treeSha: commit.tree.sha,
    fileShas,
  };
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * Convert CampaignData into the set of `.data/` file paths and their content.
 */
export function shardCampaignData(data: CampaignData): Record<string, string> {
  const files: Record<string, string> = {};

  files['.data/meta.json'] = JSON.stringify(data.meta, null, 2);
  files['.data/calendar.json'] = JSON.stringify(data.calendar, null, 2);

  if (data.eventTypes?.length) {
    files['.data/event-types.json'] = JSON.stringify(data.eventTypes, null, 2);
  }
  if (data.suggestedTags?.length) {
    files['.data/suggested-tags.json'] = JSON.stringify(data.suggestedTags, null, 2);
  }

  for (const tl of data.timelines) {
    files[`.data/timelines/${tl.id}.json`] = JSON.stringify(tl, null, 2);
  }

  for (const ev of data.events) {
    files[`.data/events/${ev.id}.json`] = JSON.stringify(ev, null, 2);
  }

  return files;
}

/**
 * Diff current files against the last-known GitHub state to find changes.
 */
export function diffFiles(
  currentFiles: Record<string, string>,
  previousFiles: Record<string, string>,
): FileChange[] {
  const changes: FileChange[] = [];

  for (const [path, content] of Object.entries(currentFiles)) {
    if (previousFiles[path] !== content) {
      changes.push({ path, content });
    }
  }

  for (const path of Object.keys(previousFiles)) {
    if (!(path in currentFiles)) {
      changes.push({ path, content: null });
    }
  }

  return changes;
}

/**
 * Build a human-readable commit message from a set of file changes.
 */
export function buildCommitMessage(changes: FileChange[]): string {
  if (changes.length === 0) return 'No changes';
  if (changes.length === 1) {
    const c = changes[0];
    const name = c.path.split('/').pop()?.replace('.json', '') ?? c.path;
    if (c.content === null) return `Delete ${name}`;
    if (c.path.includes('/events/')) return `Update event: ${name}`;
    if (c.path.includes('/timelines/')) return `Update timeline: ${name}`;
    return `Update ${name}`;
  }

  const events = changes.filter((c) => c.path.includes('/events/'));
  const timelines = changes.filter((c) => c.path.includes('/timelines/'));
  const other = changes.filter(
    (c) => !c.path.includes('/events/') && !c.path.includes('/timelines/'),
  );

  const parts: string[] = [];
  if (events.length) parts.push(`${events.length} event${events.length > 1 ? 's' : ''}`);
  if (timelines.length) parts.push(`${timelines.length} timeline${timelines.length > 1 ? 's' : ''}`);
  if (other.length) parts.push(`${other.length} config file${other.length > 1 ? 's' : ''}`);

  return `Update ${parts.join(', ')}`;
}

/**
 * Commit a set of file changes as a single atomic commit via the Git Trees API.
 */
export async function saveToGitHub(
  cfg: RepoConfig,
  token: string,
  changes: FileChange[],
  message: string,
  parentSha: string,
  baseTreeSha: string,
): Promise<{ commitSha: string; treeSha: string; newFileShas: Record<string, string> }> {
  if (changes.length === 0) {
    return { commitSha: parentSha, treeSha: baseTreeSha, newFileShas: {} };
  }

  const hdrs = {
    ...headers(token),
    'Content-Type': 'application/json',
  };

  const newFileShas: Record<string, string> = {};

  const treeEntries: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string | null;
  }> = [];

  for (const change of changes) {
    if (change.content === null) {
      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    } else {
      const blobRes = await fetch(`${repoUrl(cfg)}/git/blobs`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          content: change.content,
          encoding: 'utf-8',
        }),
      });
      if (!blobRes.ok) throw new Error(`Failed to create blob: ${blobRes.status}`);
      const blob = await blobRes.json();
      newFileShas[change.path] = blob.sha;
      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }
  }

  const treeRes = await fetch(`${repoUrl(cfg)}/git/trees`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries,
    }),
  });
  if (!treeRes.ok) throw new Error(`Failed to create tree: ${treeRes.status}`);
  const newTree = await treeRes.json();

  const commitRes = await fetch(`${repoUrl(cfg)}/git/commits`, {
    method: 'POST',
    headers: hdrs,
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [parentSha],
    }),
  });
  if (!commitRes.ok) throw new Error(`Failed to create commit: ${commitRes.status}`);
  const newCommit = await commitRes.json();

  const refRes = await fetch(`${repoUrl(cfg)}/git/refs/heads/${cfg.branch}`, {
    method: 'PATCH',
    headers: hdrs,
    body: JSON.stringify({ sha: newCommit.sha }),
  });
  if (!refRes.ok) {
    const body = await refRes.json().catch(() => ({}));
    if (refRes.status === 422) {
      throw new Error(
        'CONFLICT: Someone else pushed changes. Pull the latest data before saving.',
      );
    }
    throw new Error(`Failed to update ref: ${refRes.status} ${JSON.stringify(body)}`);
  }

  return {
    commitSha: newCommit.sha,
    treeSha: newTree.sha,
    newFileShas,
  };
}

/**
 * Check if the remote HEAD still matches our known head.
 * Returns the current remote HEAD sha.
 */
export async function checkRemoteHead(
  cfg: RepoConfig,
  token: string,
): Promise<string> {
  const ref = await getRef(cfg, token);
  return ref.sha;
}
