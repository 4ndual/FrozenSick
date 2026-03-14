import { error } from '@sveltejs/kit';
import {
  fetchTree,
  buildManifest,
  buildNav,
  fetchMenuCustomization,
  fetchContent,
  listBranches,
  getDefaultBranch,
  compareBranches,
  GitHubAuthError,
} from '$lib/server/github-content';
import { fetchPlaceMapLinks } from '$lib/server/place-map-links';
import { extractMapFileNameFromRawUrl } from '$lib/place-map-links';
import {
  slugifyPath,
} from '$lib/utils/slugify';
import {
  CONTENT_BRANCH_PREFIX,
  formatContentBranchLabel,
} from '$lib/server/content-branches';
import type { PageServerLoad } from './$types';

type SyncStatus = 'viewing' | 'saved' | 'synced' | 'behind';

export const load: PageServerLoad = async ({ params, url, cookies }) => {
  const authToken = cookies.get('gh_token') ?? '';
  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  const loadData = async (token: string) => {
    const [tree, allBranches, placeMapLinks] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
      fetchPlaceMapLinks(token, branch, defaultBranch),
    ]);
    const menuCustomization = await fetchMenuCustomization(token, branch);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree, menuCustomization);

    const rawSlug = (Array.isArray(params.slug) ? params.slug.join('/') : (params.slug ?? '')).replace(/\/+$/, '');
    const slug = '/' + slugifyPath(rawSlug);
    if (slug === '/') {
      throw redirect(302, '/');
    }
    const sourcePath = manifest[slug];

    if (!sourcePath) {
      throw error(404, 'Page not found');
    }

    const file = await fetchContent(token, sourcePath, branch);

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

    let initialSyncStatus: SyncStatus = 'viewing';

    if (
      branch !== defaultBranch &&
      branch.startsWith(CONTENT_BRANCH_PREFIX) &&
      filteredBranches.includes(branch)
    ) {
      try {
        const comparison = await compareBranches(token, branch, defaultBranch);
        if (comparison.aheadBy === 0 && comparison.behindBy === 0) {
          initialSyncStatus = 'synced';
        } else if (comparison.aheadBy > 0 && comparison.behindBy > 0) {
          initialSyncStatus = 'behind';
        } else if (comparison.aheadBy > 0) {
          initialSyncStatus = 'saved';
        } else {
          initialSyncStatus = 'behind';
        }
      } catch {
        initialSyncStatus = 'viewing';
      }
    }

    return {
      content: file.content,
      slug,
      sourcePath,
      branch,
      defaultBranch,
      branches: filteredBranches,
      branchLabels,
      initialSyncStatus,
      nav,
      placeMapMatches: placeMapLinks?.matches ?? [],
      placeMapFile: extractMapFileNameFromRawUrl(placeMapLinks?.rawMapUrl) ?? '',
    };
  };

  try {
    return await loadData(authToken);
  } catch (err) {
    if (err instanceof GitHubAuthError && authToken) {
      cookies.delete('gh_token', { path: '/' });
      return loadData('');
    }
    // Log so Vercel/serverless logs show the real cause (e.g. GitHub API timeout, rate limit, missing content)
    console.error('[slug] load error', url.pathname, err);
    throw err;
  }
};
