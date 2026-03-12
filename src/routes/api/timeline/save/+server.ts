import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  saveToGitHub,
  checkRemoteHead,
  type FileChange,
  type RepoConfig,
} from '$lib/utils/github';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';
import { assertCanWriteBranch, resolveAuthzContext } from '$lib/server/authz';
import { getWorkflowSettings } from '$lib/server/workflow-settings';

const ALLOWED_PREFIXES = ['.data/'];
function getDefaultBranch(): string {
  return env.PUBLIC_GITHUB_BRANCH || 'main';
}

function getRepoConfig(branch: string): RepoConfig {
  return {
    owner: env.PUBLIC_GITHUB_OWNER || '4ndual',
    repo: env.PUBLIC_GITHUB_REPO || 'FrozenSick',
    branch,
  };
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  const token = cookies.get('gh_token');
  if (!token) throw error(401, 'Not authenticated');
  const context = await resolveAuthzContext(token);
  const workflow = await getWorkflowSettings(token);

  const body = await request.json();
  const { changes, message, parentSha, baseTreeSha, branch } = body as {
    changes: FileChange[];
    message: string;
    parentSha: string;
    baseTreeSha: string;
    branch: string;
  };

  if (!changes || !message || !parentSha || !baseTreeSha || !branch) {
    throw error(400, 'Missing required fields');
  }

  assertCanWriteBranch(
    context,
    branch,
    getDefaultBranch(),
    workflow.allowDirectDefaultBranchEdits,
  );

  for (const change of changes) {
    if (!ALLOWED_PREFIXES.some((p) => change.path.startsWith(p))) {
      throw error(
        403,
        `Write denied: path "${change.path}" must start with ${ALLOWED_PREFIXES.join(' or ')}`,
      );
    }

    if (change.content !== null && change.path.endsWith('.json')) {
      try {
        JSON.parse(change.content);
      } catch {
        throw error(400, `Invalid JSON in ${change.path}`);
      }
    }
  }

  const cfg = getRepoConfig(branch);

  try {
    const remoteHead = await checkRemoteHead(cfg, token);
    if (remoteHead !== parentSha) {
      return json(
        {
          error:
            'Someone else saved changes. Refresh the page to get the latest data, then try saving again.',
          conflict: true,
        },
        { status: 409 },
      );
    }

    const result = await saveToGitHub(
      cfg,
      token,
      changes,
      message,
      parentSha,
      baseTreeSha,
    );

    await invalidateCache(branch);

    return json({
      commitSha: result.commitSha,
      treeSha: result.treeSha,
      newFileShas: result.newFileShas,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CONFLICT')) {
      return json({ error: msg, conflict: true }, { status: 409 });
    }
    return json({ error: msg }, { status: 500 });
  }
};
