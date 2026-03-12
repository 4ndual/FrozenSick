import {
  fetchTree,
  buildManifest,
  buildNav,
  listBranches,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';
import { formatPathAsTitle, slugifyForBranch } from '$lib/utils/slugify';
import type { PageServerLoad } from './$types';

const CONTENT_BRANCH_PREFIX = 'content/';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const authToken = cookies.get('gh_token') ?? '';
  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  const loadData = async (token: string) => {
    const [tree, allBranches] = await Promise.all([fetchTree(token, branch), listBranches(token)]);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree);

    const filteredBranches = allBranches.filter(
      (b) => b === defaultBranch || b.startsWith(CONTENT_BRANCH_PREFIX),
    );

    const branchLabels: Record<string, string> = {};
    branchLabels[defaultBranch] = 'Published';
    for (const b of filteredBranches) {
      if (b.startsWith(CONTENT_BRANCH_PREFIX)) {
        const branchSlug = b.slice(CONTENT_BRANCH_PREFIX.length);
        const matchingSource = Object.values(manifest).find(
          (src) => slugifyForBranch(src) === branchSlug,
        );
        branchLabels[b] = matchingSource
          ? formatPathAsTitle(matchingSource)
          : branchSlug.replace(/-/g, ' ');
      }
    }

    return { branch, defaultBranch, branches: filteredBranches, branchLabels, nav };
  };

  try {
    return await loadData(authToken);
  } catch (err) {
    if (err instanceof GitHubAuthError && authToken) {
      cookies.delete('gh_token', { path: '/' });
      return loadData('');
    }
    throw err;
  }
};
