import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchContent, getDefaultBranch } from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = cookies.get('gh_token');
	if (!token) {
		throw error(401, 'Not authenticated');
	}

	const path = url.searchParams.get('path');
	if (!path) {
		throw error(400, 'Missing "path" query parameter');
	}

	const branch = url.searchParams.get('branch') || getDefaultBranch();

	try {
		const file = await fetchContent(token, path, branch);
		return json({
			exists: true,
			sha: file.sha,
			size: file.content.length,
			encoding: 'utf-8',
		});
	} catch (err) {
		const msg = (err as Error).message || '';
		if (msg.includes('404')) {
			return json({ exists: false, sha: null, size: 0, encoding: 'utf-8' });
		}
		throw error(500, msg);
	}
};
