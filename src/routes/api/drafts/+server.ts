import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';

const API = 'https://api.github.com';
const CONTENT_PREFIX = 'content/';
const DRAFT_BRANCH_PREFIX = 'content/';

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
 * GET /api/drafts - list content branches (the user's drafts)
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
    .filter((b) => b.name.startsWith(DRAFT_BRANCH_PREFIX))
    .map((b) => ({
      branch: b.name,
      label: b.name.slice(DRAFT_BRANCH_PREFIX.length),
    }));

  return json({ drafts });
};

/**
 * POST /api/drafts - create a draft branch, save a draft, publish, or discard
 *
 * Actions:
 *   { action: "create", slug: string }
 *     -> creates content/{slug} branch from default branch
 *
 *   { action: "save", branch: string, path: string, content: string, sha: string }
 *     -> commits a file change to the draft branch
 *
 *   { action: "publish", branch: string }
 *     -> creates a PR from draft branch to default branch, then merges it
 *
 *   { action: "discard", branch: string }
 *     -> deletes the draft branch (and closes any open PR)
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const body = await request.json();
  const action = body.action as string;

  switch (action) {
    case 'create':
      return handleCreate(token, body);
    case 'save':
      return handleSave(token, body);
    case 'publish':
      return handlePublish(token, body);
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

  const branchName = `${DRAFT_BRANCH_PREFIX}${slug}`;
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

async function handleSave(
  token: string,
  body: { branch?: string; path?: string; content?: string; sha?: string; message?: string },
) {
  const { branch, path, content, sha, message } = body;
  if (!branch || !path || content === undefined || !sha) {
    throw error(400, 'Missing required fields: branch, path, content, sha');
  }

  if (!branch.startsWith(DRAFT_BRANCH_PREFIX)) {
    throw error(403, 'Can only save to content/ branches');
  }
  if (!path.startsWith(CONTENT_PREFIX) && !path.startsWith('.data/')) {
    throw error(403, 'Path must be under content/ or .data/');
  }

  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const ghRes = await fetch(`${repoUrl()}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message: message || `Edit: ${path.split('/').pop()}`,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
      branch,
    }),
  });

  if (ghRes.status === 409) {
    return json(
      { error: 'File was changed. Please reload and try again.' },
      { status: 409 },
    );
  }
  if (!ghRes.ok) {
    const err = await ghRes.json().catch(() => ({}));
    return json(
      { error: (err as { message?: string }).message || 'Save failed' },
      { status: ghRes.status },
    );
  }

  const data = await ghRes.json();
  await invalidateCache(branch);
  return json({ sha: data.content?.sha, commit: data.commit?.sha });
}

async function handlePublish(token: string, body: { branch?: string }) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(DRAFT_BRANCH_PREFIX)) {
    throw error(403, 'Can only publish content/ branches');
  }

  const defaultBranch = getDefaultBranch();
  const label = branch.slice(DRAFT_BRANCH_PREFIX.length);

  const prRes = await fetch(`${repoUrl()}/pulls`, {
    method: 'POST',
    headers: ghHeaders(token),
    body: JSON.stringify({
      title: `Publish: ${label}`,
      head: branch,
      base: defaultBranch,
      body: `Content update from draft "${label}".`,
    }),
  });

  let prNumber: number;
  let prHtmlUrl: string;

  if (prRes.status === 422) {
    const prBody: { errors?: { message?: string }[]; message?: string } = await prRes.json();
    if (prBody.errors?.some((e) => e.message?.includes('pull request already exists'))) {
      const listRes = await fetch(
        `${repoUrl()}/pulls?head=${getOwner()}:${branch}&base=${defaultBranch}&state=open`,
        { headers: ghHeaders(token) },
      );
      if (!listRes.ok) throw error(502, 'Failed to find existing PR');
      const prs: { number: number; html_url: string }[] = await listRes.json();
      if (prs.length === 0) throw error(502, 'PR exists but could not be found');
      prNumber = prs[0].number;
      prHtmlUrl = prs[0].html_url;
    } else if (
      prBody.errors?.some((e) => e.message?.includes('No commits between')) ||
      (prBody.message === 'Validation Failed' && (!prBody.errors || prBody.errors.length === 0))
    ) {
      return json({
        published: false,
        reason: 'No changes to publish. Save some changes to your draft first.',
      });
    } else {
      throw error(502, prBody.message || 'Failed to create PR');
    }
  } else if (!prRes.ok) {
    const err = await prRes.json().catch(() => ({}));
    throw error(502, (err as { message?: string }).message || 'Failed to create PR');
  } else {
    const pr: { number: number; html_url: string } = await prRes.json();
    prNumber = pr.number;
    prHtmlUrl = pr.html_url;
  }

  const mergeRes = await fetch(`${repoUrl()}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      merge_method: 'squash',
      commit_title: `Publish: ${label}`,
    }),
  });

  if (mergeRes.status === 405) {
    return json({
      published: false,
      prUrl: prHtmlUrl,
      reason: 'This draft has conflicts with the published content. Please resolve them first.',
    });
  }
  if (mergeRes.status === 409) {
    return json({
      published: false,
      prUrl: prHtmlUrl,
      reason: 'The HEAD has changed since the PR was created. Try again.',
    });
  }
  if (!mergeRes.ok) {
    return json({
      published: false,
      prUrl: prHtmlUrl,
      reason: 'Could not auto-publish. The pull request has been created for manual review.',
    });
  }

  const delRef = await fetch(
    `${repoUrl()}/git/refs/heads/${encodeURIComponent(branch)}`,
    { method: 'DELETE', headers: ghHeaders(token) },
  );
  void delRef;

  await invalidateCache(defaultBranch);
  await invalidateCache(branch);
  return json({ published: true, prUrl: prHtmlUrl });
}

async function handleDiscard(token: string, body: { branch?: string }) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(DRAFT_BRANCH_PREFIX)) {
    throw error(403, 'Can only discard content/ branches');
  }

  const listRes = await fetch(
    `${repoUrl()}/pulls?head=${getOwner()}:${branch}&state=open`,
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

  return json({ discarded: true });
}
