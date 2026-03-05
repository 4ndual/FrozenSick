import { redirect } from '@sveltejs/kit';
import {
  fetchTree,
  buildNav,
  listBranches,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) {
    throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname)}`);
  }

  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  try {
    const [tree, branches] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
    ]);

    const nav = buildNav(tree);

    return {
      branch,
      defaultBranch,
      branches,
      nav,
    };
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      cookies.delete('gh_token', { path: '/' });
      throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname)}`);
    }
    throw err;
  }
};
