import { error, redirect } from '@sveltejs/kit';
import {
  fetchTree,
  buildManifest,
  buildNav,
  fetchContent,
  listBranches,
  getDefaultBranch,
  slugifyPath,
  GitHubAuthError,
} from '$lib/server/github-content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) {
    throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
  }

  const defaultBranch = getDefaultBranch();
  const branch = url.searchParams.get('branch') || defaultBranch;

  try {
    const [tree, branches] = await Promise.all([
      fetchTree(token, branch),
      listBranches(token),
    ]);

    const manifest = buildManifest(tree);
    const nav = buildNav(tree);

    const rawSlug = Array.isArray(params.slug) ? params.slug.join('/') : (params.slug ?? '');
    const slug = '/' + slugifyPath(rawSlug);
    const sourcePath = manifest[slug];

    if (!sourcePath) {
      throw error(404, 'Page not found');
    }

    const file = await fetchContent(token, sourcePath, branch);

    return {
      content: file.content,
      slug,
      sourcePath,
      branch,
      defaultBranch,
      branches,
      nav,
    };
  } catch (err) {
    if (err instanceof GitHubAuthError) {
      cookies.delete('gh_token', { path: '/' });
      throw redirect(302, `/api/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
    }
    throw err;
  }
};
