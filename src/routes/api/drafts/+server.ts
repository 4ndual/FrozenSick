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
import {
  CONTENT_BRANCH_PREFIX,
  buildUserContentBranch,
  parseContentBranch,
  slugifyLogin,
} from '$lib/server/content-branches';
import { assertCanManageContentBranch, resolveAuthzContext, type AuthzContext } from '$lib/server/authz';

const API = 'https://api.github.com';
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
  const context = await resolveAuthzContext(token);

  const branches = await listBranches(token);
  const drafts = branches
    .filter((name) => name.startsWith(CONTENT_BRANCH_PREFIX))
    .filter((name) => {
      if (context.isAdmin) return true;
      if (name === `${CONTENT_BRANCH_PREFIX}timeline-${context.loginSlug}`) return true;
      const parsed = parseContentBranch(name);
      return parsed?.owner === context.loginSlug;
    })
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
 *     -> creates content/{github-login-slug}/{entry-slug} branch from default HEAD.
 *        Falls back to existing legacy content/{entry-slug} branch when present.
 *        sourcePath is preferred and derives the entry slug server-side.
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
  const context = await resolveAuthzContext(token);

  const body = await request.json();
  const action = body.action as string;

  switch (action) {
    case 'create':
      return handleCreate(token, context, body);
    case 'create-timeline':
      return handleCreateTimeline(token, context);
    case 'ensure-pr':
      return handleEnsurePr(token, context, body);
    case 'pull':
      return handlePull(token, context, body);
    case 'discard':
      return handleDiscard(token, context, body);
    default:
      throw error(400, `Unknown action: ${action}`);
  }
};

async function handleCreate(
  token: string,
  context: AuthzContext,
  body: { slug?: string; sourcePath?: string },
) {
  const sourcePath = body.sourcePath?.trim();
  const resolvedPath = sourcePath ? resolveEntryPath(sourcePath).path : null;
  const slug = resolvedPath
    ? slugifyForBranch(resolvedPath)
    : body.slug?.trim();
  if (!slug) throw error(400, 'Missing slug');

  const login = context.login;
  const branchName = resolvedPath
    ? buildUserContentBranch(resolvedPath, login)
    : `${CONTENT_BRANCH_PREFIX}${slugifyLogin(login)}/${slug}`;
  const legacyBranchName = `${CONTENT_BRANCH_PREFIX}${slug}`;
  const defaultBranch = getDefaultBranch();

  if (resolvedPath) {
    const [markdownTree, chapterJsonTree] = await Promise.all([
      fetchTree(token, defaultBranch),
      fetchChapterJsonPaths(token, defaultBranch),
    ]);
    const allKnownPaths = [...markdownTree.map((e) => e.path), ...chapterJsonTree.map((e) => e.path)];
    const collision = allKnownPaths.find(
      (candidate) =>
        candidate !== resolvedPath && slugifyForBranch(candidate) === slug,
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

  const existingBranches = await listBranches(token);
  if (existingBranches.includes(branchName)) {
    return json({ branch: branchName, alreadyExists: true });
  }
  if (
    context.isAdmin &&
    legacyBranchName !== branchName &&
    existingBranches.includes(legacyBranchName)
  ) {
    // Keep using legacy per-page branches so users continue editing existing pending work.
    return json({ branch: legacyBranchName, alreadyExists: true, legacyBranch: true });
  }

  const branchResult = await createBranchFromDefault(token, branchName, defaultBranch);
  if (branchResult === 'exists') {
    return json({ branch: branchName, alreadyExists: true });
  }

  return json({ branch: branchName });
}

async function handleCreateTimeline(token: string, context: AuthzContext) {
  const timelineSlug = slugifyLogin(context.login);
  const branchName = `${CONTENT_BRANCH_PREFIX}timeline-${timelineSlug}`;
  const defaultBranch = getDefaultBranch();

  const branchResult = await createBranchFromDefault(token, branchName, defaultBranch);
  return json({
    branch: branchName,
    login: context.login,
    alreadyExists: branchResult === 'exists',
  });
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

async function handleEnsurePr(
  token: string,
  context: AuthzContext,
  body: { branch?: string },
) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only create PRs for content/ branches');
  }
  assertCanManageContentBranch(context, branch);

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

async function handlePull(
  token: string,
  context: AuthzContext,
  body: { branch?: string },
) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only pull into content/ branches');
  }
  assertCanManageContentBranch(context, branch);

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

async function handleDiscard(
  token: string,
  context: AuthzContext,
  body: { branch?: string },
) {
  const branch = body.branch;
  if (!branch) throw error(400, 'Missing branch');
  if (!branch.startsWith(CONTENT_BRANCH_PREFIX)) {
    throw error(403, 'Can only discard content/ branches');
  }
  assertCanManageContentBranch(context, branch);

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
