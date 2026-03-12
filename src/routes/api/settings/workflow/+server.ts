import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveAuthzContext } from '$lib/server/authz';
import { getWorkflowSettings, saveWorkflowSettings } from '$lib/server/workflow-settings';

export const GET: RequestHandler = async ({ cookies }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	const context = await resolveAuthzContext(token);
	if (!context.isAdmin) throw error(403, 'Only admins can view workflow settings.');

	const settings = await getWorkflowSettings(token);
	return json(settings);
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	const token = cookies.get('gh_token');
	if (!token) throw error(401, 'Not authenticated');
	const context = await resolveAuthzContext(token);
	if (!context.isAdmin) throw error(403, 'Only admins can update workflow settings.');

	const body = (await request.json()) as { allowDirectDefaultBranchEdits?: unknown };
	if (typeof body.allowDirectDefaultBranchEdits !== 'boolean') {
		throw error(400, 'allowDirectDefaultBranchEdits must be a boolean.');
	}

	const settings = await saveWorkflowSettings(token, {
		allowDirectDefaultBranchEdits: body.allowDirectDefaultBranchEdits,
	});
	return json({
		ok: true,
		...settings,
	});
};

