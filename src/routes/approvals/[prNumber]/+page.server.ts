import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	buildManifest,
	buildNav,
	fetchMenuCustomization,
	fetchTree,
	getDefaultBranch,
	listBranches,
} from '$lib/server/github-content';
import {
	CONTENT_BRANCH_PREFIX,
	formatContentBranchLabel,
} from '$lib/server/content-branches';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	const defaultBranch = getDefaultBranch();

	const [tree, allBranches, menuCustomization] = await Promise.all([
		fetchTree(token, defaultBranch),
		listBranches(token),
		fetchMenuCustomization(token, defaultBranch),
	]);
	const manifest = buildManifest(tree);
	const nav = buildNav(tree, menuCustomization);
	const filteredBranches = allBranches.filter(
		(b) => b === defaultBranch || b.startsWith(CONTENT_BRANCH_PREFIX),
	);
	const branchLabels: Record<string, string> = {};
	branchLabels[defaultBranch] = 'Published';
	const manifestPaths = Object.values(manifest);
	for (const branch of filteredBranches) {
		if (branch.startsWith(CONTENT_BRANCH_PREFIX)) {
			branchLabels[branch] = formatContentBranchLabel(branch, manifestPaths);
		}
	}

	const statusRes = await fetch('/api/status');
	if (!statusRes.ok) throw error(401, 'Not authenticated');
	const statusData = (await statusRes.json()) as { isAdmin?: boolean; authenticated?: boolean };
	if (!statusData.isAdmin) throw error(403, 'Only admins can review approvals.');
	const detailRes = await fetch(`/api/approvals/${encodeURIComponent(params.prNumber)}`);
	if (!detailRes.ok) {
		const body = (await detailRes.json().catch(() => ({}))) as { message?: string };
		throw error(detailRes.status, body.message || 'Failed to load approval details.');
	}

	return {
		branch: defaultBranch,
		defaultBranch,
		branches: filteredBranches,
		branchLabels,
		nav,
		authenticated: Boolean(statusData.authenticated),
		review: await detailRes.json(),
	};
};

