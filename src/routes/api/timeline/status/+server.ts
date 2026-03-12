import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDefaultBranch, compareBranches } from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');

  const branch = url.searchParams.get('branch');
  if (!branch) throw error(400, 'Missing branch');

  const defaultBranch = getDefaultBranch();
  if (branch === defaultBranch) {
    return json({
      branch,
      defaultBranch,
      aheadPublished: false,
      behindPublished: false,
      diverged: false,
    });
  }

  const comparison = await compareBranches(token, branch, defaultBranch);
  const aheadPublished = comparison.aheadBy > 0;
  const behindPublished = comparison.behindBy > 0;

  return json({
    branch,
    defaultBranch,
    aheadPublished,
    behindPublished,
    diverged: aheadPublished && behindPublished,
  });
};
