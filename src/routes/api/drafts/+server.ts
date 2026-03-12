import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import {
  invalidateCache,
  fetchTree,
  fetchChapterJsonPaths,
  listBranches,
} from '$lib/server/github-content';
import { slugifyForBranch } from '$lib/utils/slugify';
import { resolveEntryPath } from '$lib/server/wiki-entry';

const API = 'https://api.github.com';
const CONTENT_BRANCH_PREFIX = 'content/';

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

/**
 * GET /api/drafts - list content branches
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const branches = await listBranches(token);
  const drafts = branches
    .filter((name) => name.startsWith(CONTENT_BRANCH_PREFIX))
    .map((b) => ({
      branch: b,
      label: b.slice(CONTENT_BRANCH_PREFIX.length),
    }));

  return json({ drafts });
};

/**
 * POST /api/drafts - manage content branches
 *
 * Actions:
 *   { action: "create", sourcePath?: string, slug?: string }
 *     -> creates content/{slug} branch from default branch HEAD.
 *        sourcePath is preferred and derives the slug server-side.
 *
 *   { action: "create-timeline" }
 *     -> creates/ensures content/timeline-<github-login> branch from default HEAD.
 *
 *   { action: "ensure-pr", branch: string }
 *     -> ensures an open PR exists from content branch to default (creates if needed)
 *
 *   { action: "pull", branch: string }
 *     -> merges default branch INTO the content branch (update from published)
 *
 *   { action: "discard", branch: string }
 *     -> closes any open PR and deletes the content branch
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const body = await request.json();
  const action = body.action as string;

  switch (action) {
    case 'create':
      return handleCreate(token, body);
    case 'create-timeline':
      return handleCreateTimeline(token);
    case 'ensure-pr':
      return handleEnsurePr(token, body);
    case 'pull':
      return handlePull(token, body);
    case 'discard':
      return handleDiscard(token, body);
    default:
      throw error(400, `Unknown action: ${action}`);
  }
};

async function handleCreate(
  token: string,
  body: { slug?: string; sourcePath?: string },
) {
  const sourcePath = body.sourcePath?.trim();
  const slug = sourcePath
    ? slugifyForBranch(resolveEntryPath(sourcePath).path)
    : body.slug?.trim();
  if (!slug) throw error(400, 'Missing slug');

  const branchName = `${CONTENT_BRANCH_PREFIX}${slug}`;
  const defaultBranch = getDefaultBranch();

  if (sourcePath) {
    const normalizedSourcePath = resolveEntryPath(sourcePath).path;
    const [markdownTree, chapterJsonTree] = await Promise.all([
      fetchTree(token, defaultBranch),
      fetchChapterJsonPaths(token, defaultBranch),
    ]);
    const allKnownPaths = [...markdownTree.map((e) => e.path), ...chapterJsonTree.map((e) => e.path)];
    const collision = allKnownPaths.find(
      (candidate) =>
        candidate !== normalizedSourcePath && slugifyForBranch(candidate) === slug,
    );
    if (collision) {
      return json(
        {
          error:
            'The requested path collides with another existing entry slug. Choose a different file name.',
          collisionPath: collision,
        },
        { status: 409 },
      );
    }
  }

  const branchResult = await createBranchFromDefault(token, branchName, defaultBranch);
  if (branchResult === 'exists') {
    return json({ branch: branchName, alreadyExists: true });
  }

  return json({ branch: branchName });
}

async function handleCreateTimeline(token: string) {
  const login = await fetchViewerLogin(token);
  const timelineSlug = slugifyLogin(login);
  const branchName = `${CONTENT_BRANCH_PREFIX}timeline-${timelineSlug}`;
  const defaultBranch = getDefaultBranch();

  const branchResult = await createBranchFromDefault(token, branchName, defaultBranch);
  return json({
    branch: branchName,
    login,
    alreadyExists: branchResult === 'exists',
  });
}

function slugifyLogin(login: string): string {
  const normalized = login.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'user';
}

async function fetchViewerLogin(token: string): Promise<string> {
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!userRes.ok) {
    throw error(502, 'Failed to resolve authenticated GitHub user');
  }
  const userData = (await userRes.json()) as { login?: string };
  const login = userData.login?.trim();
  if (!login) {
    throw error(502, 'Authenticated GitHub user has no login');
  }
  return login;
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
  const ref: { object: { sha: string } } = await refRes.json();

  const createRes = await fetch(`${repoUrl()}/git/refs`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    }),
  });

  if (createRes.status === 422) {
    return 'exists';
  }
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to create branch');
  }
  return 'created';
}

async function handleEnsurePr(token: string, body: { branch?: string }) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only create PRs for content/ branches');
  }

  const defaultBranch = getDefaultBranch();
  const label = branch.slice(CONTENT_BRANCH_PREFIX.length).replace(/-/g, ' ');

  const listRes = await fetch(
    `${repoUrl()}/pulls?head=${getOwner()}:${branch}&base=${defaultBranch}&state=open`,
    { headers: ghHeaders(token) },
  );
  if (listRes.ok) {
    const prs: { html_url: string }[] = await listRes.json();
    if (prs.length > 0) {
      return json({ prUrl: prs[0].html_url, existing: true });
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
    const prBody: { errors?: { message?: string }[]; message?: string } = await prRes.json();
    if (
      prBody.errors?.some((e) => e.message?.includes('No commits between')) ||
      (prBody.message === 'Validation Failed' && (!prBody.errors || prBody.errors.length === 0))
    ) {
      return json({ prUrl: null, reason: 'No changes to review yet.' });
    }
    throw error(502, prBody.message || 'Failed to create PR');
  }
  if (!prRes.ok) {
    const err = await prRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to create PR');
  }

  const pr: { html_url: string } = await prRes.json();
  return json({ prUrl: pr.html_url });
}

async function handlePull(token: string, body: { branch?: string }) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only pull into content/ branches');
  }

  const defaultBranch = getDefaultBranch();

  const mergeRes = await fetch(`${repoUrl()}/merges`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      base: branch,
      head: defaultBranch,
      commit_message: 'Update from published',
    }),
  });

  if (mergeRes.status === 204) {
    return json({ updated: true, reason: 'Already up to date.' });
  }
  if (mergeRes.status === 409) {
    return json({
      updated: false,
      reason: 'Conflicts detected. Your changes conflict with the published version.',
    });
  }
  if (!mergeRes.ok) {
    const err = await mergeRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to merge');
  }

  await invalidateCache(branch);
  return json({ updated: true });
}

async function handleDiscard(token: string, body: { branch?: string }) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only discard content/ branches');
  }

  const defaultBranch = getDefaultBranch();
  const listRes = await fetch(
    `${repoUrl()}/pulls?head=${getOwner()}:${branch}&base=${defaultBranch}&state=open`,
    { headers: ghHeaders(token) },
  );
  if (listRes.ok) {
    const prs: { number: number }[] = await listRes.json();
    for (const pr of prs) {
      await fetch(`${repoUrl()}/pulls/${pr.number}`, {
        method: 'PATCH',
        headers: ghHeaders(token),
        body: JSON.stringify({ state: 'closed' }),
      });
    }
  }

  const delRes = await fetch(
    `${repoUrl()}/git/refs/heads/${encodeURIComponent(branch)}`,
    { method: 'DELETE', headers: ghHeaders(token) },
  );

  if (!delRes.ok && delRes.status !== 422) {
    throw error(502, 'Failed to delete branch');
  }

  await invalidateCache(branch);
  return json({ discarded: true });
}
