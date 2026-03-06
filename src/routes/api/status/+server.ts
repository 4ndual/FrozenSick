import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listBranches, getDefaultBranch } from '$lib/server/github-content';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('gh_token');

	if (!token) {
		return json({
			authenticated: false,
			user: null,
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

	return json({
		authenticated: true,
		user,
		branch: getDefaultBranch(),
		defaultBranch: getDefaultBranch(),
		draftCount,
		cacheBackend: getCacheBackend(),
		branches,
	});
};

function getCacheBackend(): 'redis' | 'memory' {
	try {
		if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
			return 'redis';
		}
	} catch {
		// env not available
	}
	return 'memory';
}
