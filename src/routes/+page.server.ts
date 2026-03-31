import {
  fetchTree,
  buildManifest,
  buildNav,
  fetchMenuCustomization,
  listBranches,
  getDefaultBranch,
  GitHubAuthError,
} from '$lib/server/github-content';
import {
  CONTENT_BRANCH_PREFIX,
  formatContentBranchLabel,
} from '$lib/server/content-branches';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const authToken = cookies.get('gh_token') ?? '';
  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  const loadData = async (token: string) => {
    const [tree, allBranches] = await Promise.all([fetchTree(token, branch), listBranches(token)]);
    const menuCustomization = await fetchMenuCustomization(token, branch);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree, menuCustomization);

    const filteredBranches = allBranches.filter(
      (b) => b === defaultBranch || b.startsWith(CONTENT_BRANCH_PREFIX),
    );

    const branchLabels: Record<string, string> = {};
    branchLabels[defaultBranch] = 'Published';
    const manifestPaths = Object.values(manifest);
    for (const b of filteredBranches) {
      if (b.startsWith(CONTENT_BRANCH_PREFIX)) {
        branchLabels[b] = formatContentBranchLabel(b, manifestPaths);
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
