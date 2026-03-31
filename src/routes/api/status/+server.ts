import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { listBranches, getDefaultBranch } from '$lib/server/github-content';
import { resolveAppRole } from '$lib/server/roles';
import { getWorkflowSettings } from '$lib/server/workflow-settings';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('gh_token');
  const workflow = await getWorkflowSettings(token);

	if (!token) {
		const role = resolveAppRole(false, null);
		return json({
			authenticated: false,
			user: null,
			role,
			isAdmin: false,
			canApprove: false,
			canDirectPublish: false,
      allowDirectDefaultBranchEdits: workflow.allowDirectDefaultBranchEdits,
			branch: getDefaultBranch(),
			defaultBranch: getDefaultBranch(),
			draftCount: 0,
			cacheBackend: getCacheBackend(),
			branches: [],
		});
	}

	let user: string | null = null;
	try {
		const res = await fetch('https://api.github.com/user', {
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
		});
		if (res.ok) {
			const data = await res.json();
			user = data.login;
		}
	} catch {
		// user stays null
	}

	let branches: string[] = [];
	let draftCount = 0;
	try {
		branches = await listBranches(token);
		draftCount = branches.filter((b) => b.startsWith('content/')).length;
	} catch {
		// branches stays empty
	}

	const role = resolveAppRole(true, user);
	const isAdmin = role === 'admin';

	return json({
		authenticated: true,
		user,
		role,
		isAdmin,
		canApprove: isAdmin,
		canDirectPublish: isAdmin && workflow.allowDirectDefaultBranchEdits,
    allowDirectDefaultBranchEdits: workflow.allowDirectDefaultBranchEdits,
		branch: getDefaultBranch(),
		defaultBranch: getDefaultBranch(),
		draftCount,
		cacheBackend: getCacheBackend(),
		branches,
	});
};

function getCacheBackend(): 'redis' | 'memory' {
	try {
		if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
			return 'redis';
		}
	} catch {
		// env not available
	}
	return 'memory';
}
