import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const API = 'https://api.github.com';
const DRAFT_BRANCH_PREFIX = 'content/';
const STALE_DAYS = 30;

function getOwner() {
  return env.PUBLIC_GITHUB_OWNER || '4ndual';
}
function getRepo() {
  return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
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
 * POST /api/drafts/cleanup
 * Deletes content/ branches with no commits in the last STALE_DAYS days.
 * Can be called by a cron job or manually. Requires a valid gh_token cookie
 * or the GITHUB_WEBHOOK_SECRET as a Bearer token for server-to-server calls.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  let token = cookies.get('gh_token');

  if (!token) {
    const authHeader = request.headers.get('authorization');
    const webhookSecret = privateEnv.GITHUB_WEBHOOK_SECRET;
    if (authHeader && webhookSecret && authHeader === `Bearer ${webhookSecret}`) {
      token = cookies.get('gh_token');
      if (!token) throw error(401, 'No GitHub token available for cleanup');
    } else {
      throw error(401, 'Not authenticated');
    }
  }

  const branchesRes = await fetch(`${repoUrl()}/branches?per_page=100`, {
    headers: ghHeaders(token),
  });
  if (!branchesRes.ok) throw error(502, 'Failed to list branches');

  const branches: { name: string; commit: { sha: string } }[] = await branchesRes.json();
  const contentBranches = branches.filter((b) => b.name.startsWith(DRAFT_BRANCH_PREFIX));

  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const cleaned: string[] = [];

  for (const branch of contentBranches) {
    const commitRes = await fetch(
      `${repoUrl()}/commits/${branch.commit.sha}`,
      { headers: ghHeaders(token) },
    );
    if (!commitRes.ok) continue;
    const commit: { commit: { committer: { date: string } } } = await commitRes.json();
    const commitDate = new Date(commit.commit.committer.date).getTime();

    if (commitDate < cutoff) {
      const prsRes = await fetch(
        `${repoUrl()}/pulls?head=${getOwner()}:${branch.name}&state=open`,
        { headers: ghHeaders(token) },
      );
      if (prsRes.ok) {
        const prs: { number: number }[] = await prsRes.json();
        for (const pr of prs) {
          await fetch(`${repoUrl()}/pulls/${pr.number}`, {
            method: 'PATCH',
            headers: ghHeaders(token),
            body: JSON.stringify({ state: 'closed' }),
          });
        }
      }

      const delRes = await fetch(
        `${repoUrl()}/git/refs/heads/${encodeURIComponent(branch.name)}`,
        { method: 'DELETE', headers: ghHeaders(token) },
      );
      if (delRes.ok || delRes.status === 422) {
        cleaned.push(branch.name);
      }
    }
  }

  return json({ cleaned, total: contentBranches.length });
};
