import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import {
  MENU_CONFIG_PATH,
  invalidateCache,
  navTargetKey,
  type MenuCustomization,
} from '$lib/server/github-content';
import { resolveEntryPath } from '$lib/server/wiki-entry';
import { buildUserContentBranch } from '$lib/server/content-branches';
import { assertCanWriteBranch, resolveAuthzContext } from '$lib/server/authz';
import { getWorkflowSettings } from '$lib/server/workflow-settings';

const API = 'https://api.github.com';
const CONTENT_PREFIX = 'content/';

type NavMutationAction = 'hide' | 'unhide' | 'delete';
type NavTargetKind = 'file' | 'folder';

interface NavMutationBody {
  action?: NavMutationAction;
  targetKind?: NavTargetKind;
  targetPath?: string;
  branch?: string;
  ensurePr?: boolean;
}

interface GitTreeEntry {
  path: string;
  type: 'blob' | 'tree' | string;
}

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}

function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

function getDefaultBranch() {
  return env.PUBLIC_GITHUB_BRANCH || 'main';
}

function repoUrl() {
  return `${API}/repos/${getOwner()}/${getRepo()}`;
}

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

function encodePath(repoPath: string): string {
  return repoPath.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function normalizePath(rawPath: string): string {
  let decoded = rawPath.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep raw path if decode fails
  }

  const normalized = decoded.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/')) {
    throw error(400, 'Invalid path');
  }
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw error(400, 'Invalid path segments');
  }
  return parts.join('/');
}

function normalizeTargetPath(kind: NavTargetKind, rawPath: string): string {
  if (kind === 'file') {
    return resolveEntryPath(rawPath).path;
  }
  const normalized = normalizePath(rawPath).replace(/\/+$/, '');
  if (!normalized.startsWith(CONTENT_PREFIX)) {
    throw error(403, `Write denied: path must start with ${CONTENT_PREFIX}`);
  }
  if (normalized.endsWith('.md') || normalized.endsWith('.json')) {
    throw error(400, 'Folder target must not be a file path');
  }
  return normalized;
}

async function createBranchFromDefault(
  token: string,
  branchName: string,
  defaultBranch: string,
): Promise<'created' | 'exists'> {
  const refRes = await fetch(
    `${repoUrl()}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    { headers: ghHeaders(token) },
  );
  if (!refRes.ok) throw error(502, 'Failed to read default branch');
  const ref = (await refRes.json()) as { object: { sha: string } };

  const createRes = await fetch(`${repoUrl()}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    }),
  });

  if (createRes.status === 422) return 'exists';
  if (!createRes.ok) {
    const err = (await createRes.json().catch(() => ({}))) as { message?: string };
    throw error(502, err.message || 'Failed to create branch');
  }
  return 'created';
}

async function ensurePullRequest(token: string, branch: string): Promise<{ prUrl: string | null }> {
  const defaultBranch = getDefaultBranch();
  const label = branch.slice('content/'.length).replace(/-/g, ' ');

  const listRes = await fetch(
    `${repoUrl()}/pulls?head=${getOwner()}:${branch}&base=${defaultBranch}&state=open`,
    { headers: ghHeaders(token) },
  );
  if (listRes.ok) {
    const prs = (await listRes.json()) as { html_url: string }[];
    if (prs.length > 0) {
      return { prUrl: prs[0].html_url };
    }
  }

  const prRes = await fetch(`${repoUrl()}/pulls`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      title: `Edit: ${label}`,
      head: branch,
      base: defaultBranch,
      body: `Content changes for "${label}".`,
    }),
  });

  if (prRes.status === 422) {
    const prBody = (await prRes.json().catch(() => ({}))) as {
      errors?: { message?: string }[];
      message?: string;
    };
    if (
      prBody.errors?.some((e) => e.message?.includes('No commits between')) ||
      (prBody.message === 'Validation Failed' && (!prBody.errors || prBody.errors.length === 0))
    ) {
      return { prUrl: null };
    }
    throw error(502, prBody.message || 'Failed to create PR');
  }
  if (!prRes.ok) {
    const err = (await prRes.json().catch(() => ({}))) as { message?: string };
    throw error(502, err.message || 'Failed to create PR');
  }

  const created = (await prRes.json()) as { html_url: string };
  return { prUrl: created.html_url };
}

async function fetchMenuCustomizationWithSha(
  token: string,
  branch: string,
): Promise<{ config: MenuCustomization; sha: string | null }> {
  const res = await fetch(
    `${repoUrl()}/contents/${encodePath(MENU_CONFIG_PATH)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token) },
  );
  if (res.status === 404) {
    return { config: { hidden: [] }, sha: null };
  }
  if (!res.ok) {
    throw error(502, 'Failed to read menu customization');
  }

  const data = (await res.json()) as { content?: string; sha: string };
  if (!data.content) {
    return { config: { hidden: [] }, sha: data.sha };
  }

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(decodeBase64Utf8(data.content.replace(/\n/g, '')));
  } catch {
    parsed = {};
  }
  const hiddenRaw = Array.isArray((parsed as { hidden?: unknown }).hidden)
    ? (parsed as { hidden: unknown[] }).hidden
    : [];
  const hidden = hiddenRaw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return { config: { hidden }, sha: data.sha };
}

async function saveMenuCustomization(
  token: string,
  branch: string,
  config: MenuCustomization,
  sha: string | null,
  message: string,
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: encodeBase64Utf8(`${JSON.stringify(config, null, 2)}\n`),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${repoUrl()}/contents/${encodePath(MENU_CONFIG_PATH)}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw error(502, err.message || 'Failed to save menu customization');
  }
}

async function deleteFileFromBranch(
  token: string,
  branch: string,
  filePath: string,
  message: string,
): Promise<boolean> {
  const getRes = await fetch(
    `${repoUrl()}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    { headers: ghHeaders(token) },
  );
  if (getRes.status === 404) return false;
  if (!getRes.ok) {
    throw error(502, `Failed to read file before delete: ${filePath}`);
  }
  const file = (await getRes.json()) as { sha: string };

  const delRes = await fetch(`${repoUrl()}/contents/${encodePath(filePath)}`, {
    method: 'DELETE',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message,
      sha: file.sha,
      branch,
    }),
  });
  if (delRes.status === 404) return false;
  if (!delRes.ok) {
    const err = (await delRes.json().catch(() => ({}))) as { message?: string };
    throw error(502, err.message || `Failed to delete ${filePath}`);
  }
  return true;
}

async function fetchBranchTree(token: string, branch: string): Promise<GitTreeEntry[]> {
  const refRes = await fetch(`${repoUrl()}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: ghHeaders(token),
  });
  if (!refRes.ok) throw error(502, 'Failed to resolve branch ref');
  const ref = (await refRes.json()) as { object: { sha: string } };

  const commitRes = await fetch(`${repoUrl()}/git/commits/${ref.object.sha}`, {
    headers: ghHeaders(token),
  });
  if (!commitRes.ok) throw error(502, 'Failed to resolve branch commit');
  const commit = (await commitRes.json()) as { tree: { sha: string } };

  const treeRes = await fetch(`${repoUrl()}/git/trees/${commit.tree.sha}?recursive=1`, {
    headers: ghHeaders(token),
  });
  if (!treeRes.ok) throw error(502, 'Failed to read branch tree');
  const tree = (await treeRes.json()) as { tree: GitTreeEntry[] };
  return tree.tree;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');
  const context = await resolveAuthzContext(token);
  const workflow = await getWorkflowSettings(token);

  const body = (await request.json()) as NavMutationBody;
  const action = body.action;
  const targetKind = body.targetKind;
  const targetPathRaw = body.targetPath;
  if (!action || !targetKind || !targetPathRaw) {
    throw error(400, 'Missing required fields: action, targetKind, targetPath');
  }
  if (!['hide', 'unhide', 'delete'].includes(action)) {
    throw error(400, `Unknown action: ${action}`);
  }
  if (!['file', 'folder'].includes(targetKind)) {
    throw error(400, `Unknown targetKind: ${targetKind}`);
  }

  const targetPath = normalizeTargetPath(targetKind, targetPathRaw);
  const branch = body.branch?.trim() || buildUserContentBranch(targetPath, context.login);
  const defaultBranch = getDefaultBranch();
  assertCanWriteBranch(context, branch, defaultBranch, workflow.allowDirectDefaultBranchEdits);

  if (branch !== defaultBranch) {
    await createBranchFromDefault(token, branch, defaultBranch);
  }

  const targetKey = navTargetKey(targetKind, targetPath);
  let deletedCount = 0;

  if (action === 'hide' || action === 'unhide') {
    const current = await fetchMenuCustomizationWithSha(token, branch);
    const hidden = new Set(current.config.hidden);
    if (action === 'hide') hidden.add(targetKey);
    if (action === 'unhide') hidden.delete(targetKey);
    await saveMenuCustomization(
      token,
      branch,
      { hidden: [...hidden].sort((a, b) => a.localeCompare(b)) },
      current.sha,
      `${action === 'hide' ? 'Hide' : 'Unhide'} navigation ${targetKind}: ${targetPath}`,
    );
  } else {
    if (targetKind === 'file') {
      const deleted = await deleteFileFromBranch(
        token,
        branch,
        targetPath,
        `Delete entry: ${targetPath.split('/').pop()}`,
      );
      deletedCount = deleted ? 1 : 0;
    } else {
      const tree = await fetchBranchTree(token, branch);
      const prefix = `${targetPath}/`;
      const candidates = tree
        .filter((entry) => entry.type === 'blob')
        .map((entry) => entry.path)
        .filter(
          (path) =>
            path.startsWith(prefix) &&
            (path.endsWith('.md') || path.endsWith('.json')) &&
            path.startsWith(CONTENT_PREFIX),
        )
        .sort((a, b) => b.localeCompare(a));

      for (const filePath of candidates) {
        const deleted = await deleteFileFromBranch(
          token,
          branch,
          filePath,
          `Delete folder entry: ${filePath.split('/').pop()}`,
        );
        if (deleted) deletedCount += 1;
      }
    }

    if (deletedCount === 0) {
      return json(
        {
          ok: false,
          action,
          targetKind,
          targetPath,
          branch,
          message: 'No deletable files were found for this target.',
        },
        { status: 409 },
      );
    }
  }

  await invalidateCache(branch);

  const shouldEnsurePr = body.ensurePr ?? true;
  const shouldCreatePr = shouldEnsurePr && branch.startsWith(CONTENT_PREFIX);
  const pr = shouldCreatePr ? await ensurePullRequest(token, branch) : { prUrl: null };

  return json({
    ok: true,
    action,
    targetKind,
    targetPath,
    branch,
    deletedCount,
    prUrl: pr.prUrl,
    message:
      action === 'delete'
        ? `Deleted ${deletedCount} file${deletedCount === 1 ? '' : 's'} on ${branch}.`
        : `${action === 'hide' ? 'Hidden' : 'Unhidden'} ${targetKind} in navigation.`,
  });
};
