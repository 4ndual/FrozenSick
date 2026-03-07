import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';

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

  const res = await fetch(`${repoUrl()}/branches?per_page=100`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) throw error(502, 'Failed to list branches');

  const branches: { name: string }[] = await res.json();
  const drafts = branches
    .filter((b) => b.name.startsWith(CONTENT_BRANCH_PREFIX))
    .map((b) => ({
      branch: b.name,
      label: b.name.slice(CONTENT_BRANCH_PREFIX.length),
    }));

  return json({ drafts });
};

/**
 * POST /api/drafts - manage content branches
 *
 * Actions:
 *   { action: "create", slug: string }
 *     -> creates content/{slug} branch from default branch HEAD
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
  body: { slug?: string },
) {
  const slug = body.slug?.trim();
  if (!slug) throw error(400, 'Missing slug');

  const branchName = `${CONTENT_BRANCH_PREFIX}${slug}`;
  const defaultBranch = getDefaultBranch();

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
    return json({ branch: branchName, alreadyExists: true });
  }
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to create branch');
  }

  return json({ branch: branchName });
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
