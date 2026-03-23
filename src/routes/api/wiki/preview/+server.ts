import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchContent, getDefaultBranch } from '$lib/server/github-content';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = cookies.get('gh_token') ?? '';
	if (!token && process.env.NODE_ENV === 'production') {
		throw error(401, 'Not authenticated');
	}

	const path = url.searchParams.get('path');
	if (!path) {
		throw error(400, 'Missing "path" query parameter');
	}

	const branch = url.searchParams.get('branch') || getDefaultBranch();

	try {
		const file = await fetchContent(token, path, branch);
		const md = file.content;

		const headingRegex = /^(#{1,6})\s+(.+)$/gm;
		const headings: { level: number; text: string }[] = [];
		let match;
		while ((match = headingRegex.exec(md)) !== null) {
			headings.push({ level: match[1].length, text: match[2].trim() });
		}

		const title = headings.find((h) => h.level === 1)?.text ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path;

		const wordCount = md
			.replace(/^#+\s+.*$/gm, '')
			.replace(/[^a-zA-Z0-9\s\u00C0-\u024F]/g, ' ')
			.split(/\s+/)
			.filter((w) => w.length > 0).length;

		return json({
			title,
			headings: headings.map((h) => h.text),
			wordCount,
			sha: file.sha,
		});
	} catch (err) {
		const msg = (err as Error).message || '';
		if (msg.includes('404')) {
			throw error(404, 'File not found');
		}
		throw error(500, msg);
	}
};
