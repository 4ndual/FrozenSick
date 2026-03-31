import { env } from '$env/dynamic/public';

const API = 'https://api.github.com';
const WORKFLOW_SETTINGS_PATH = '.data/workflow-settings.json';

export interface WorkflowSettings {
	allowDirectDefaultBranchEdits: boolean;
}

const DEFAULT_WORKFLOW_SETTINGS: WorkflowSettings = {
	allowDirectDefaultBranchEdits: false,
};

function getOwner(): string {
	return env.PUBLIC_GITHUB_OWNER || '4ndual';
}

function getRepo(): string {
	return env.PUBLIC_GITHUB_REPO || 'FrozenSick';
}

function getDefaultBranch(): string {
	return env.PUBLIC_GITHUB_BRANCH || 'main';
}

function repoUrl(): string {
	return `${API}/repos/${getOwner()}/${getRepo()}`;
}

function ghHeaders(token: string): Record<string, string> {
	return {
		Authorization: `Bearer ${token}`,
		Accept: 'application/vnd.github+json',
		'Content-Type': 'application/json',
	};
}

function normalizeSettings(raw: unknown): WorkflowSettings {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORKFLOW_SETTINGS };
	const obj = raw as Record<string, unknown>;
	return {
		allowDirectDefaultBranchEdits: obj.allowDirectDefaultBranchEdits === true,
	};
}

function encodePath(path: string): string {
	return path.split('/').map(encodeURIComponent).join('/');
}

function decodeBase64Utf8(b64: string): string {
	const bin = atob(b64);
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string): string {
	return btoa(unescape(encodeURIComponent(value)));
}

export async function getWorkflowSettings(
	token: string | null | undefined,
): Promise<WorkflowSettings> {
	if (!token) return { ...DEFAULT_WORKFLOW_SETTINGS };
	const res = await fetch(
		`${repoUrl()}/contents/${encodePath(WORKFLOW_SETTINGS_PATH)}?ref=${encodeURIComponent(getDefaultBranch())}`,
		{ headers: ghHeaders(token) },
	);
	if (res.status === 404) return { ...DEFAULT_WORKFLOW_SETTINGS };
	if (!res.ok) return { ...DEFAULT_WORKFLOW_SETTINGS };
	const data = (await res.json()) as { content?: string };
	if (!data.content) return { ...DEFAULT_WORKFLOW_SETTINGS };
	try {
		const decoded = decodeBase64Utf8(data.content.replace(/\n/g, ''));
		return normalizeSettings(JSON.parse(decoded));
	} catch {
		return { ...DEFAULT_WORKFLOW_SETTINGS };
	}
}

export async function saveWorkflowSettings(
	token: string,
	settings: WorkflowSettings,
): Promise<WorkflowSettings> {
	const next = normalizeSettings(settings);
	const contentUrl = `${repoUrl()}/contents/${encodePath(WORKFLOW_SETTINGS_PATH)}`;
	const existing = await fetch(
		`${contentUrl}?ref=${encodeURIComponent(getDefaultBranch())}`,
		{ headers: ghHeaders(token) },
	);

	let sha: string | undefined;
	if (existing.ok) {
		const data = (await existing.json()) as { sha?: string };
		sha = data.sha;
	} else if (existing.status !== 404) {
		throw new Error('Failed to load workflow settings');
	}

	const body: Record<string, string> = {
		message: `Workflow settings: ${next.allowDirectDefaultBranchEdits ? 'enable' : 'disable'} direct publish`,
		content: encodeBase64Utf8(`${JSON.stringify(next, null, 2)}\n`),
		branch: getDefaultBranch(),
	};
	if (sha) body.sha = sha;

	const write = await fetch(contentUrl, {
		method: 'PUT',
		headers: ghHeaders(token),
		body: JSON.stringify(body),
	});
	if (!write.ok) {
		const err = (await write.json().catch(() => ({}))) as { message?: string };
		throw new Error(err.message || 'Failed to save workflow settings');
	}
	return next;
}

