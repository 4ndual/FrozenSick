import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  saveToGitHub,
  checkRemoteHead,
  loadFromGitHub,
  type FileChange,
  type RepoConfig,
} from '$lib/utils/github';
import { env } from '$env/dynamic/public';
import { invalidateCache } from '$lib/server/github-content';
import { assertCanWriteBranch, resolveAuthzContext } from '$lib/server/authz';
import { getWorkflowSettings } from '$lib/server/workflow-settings';
import type {
  CalendarConfig,
  CampaignData,
  CampaignEvent,
  CampaignMeta,
  CampaignTimeline,
  CustomEventType,
} from '$lib/types/schema';
import {
  validateCampaignData,
  validateCampaignDataWithCalendar,
} from '$lib/types/validation';

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

function applyChangesToCampaignSnapshot(data: CampaignData, changes: FileChange[]): CampaignData {
  const next: CampaignData = {
    ...data,
    meta: structuredClone(data.meta),
    calendar: structuredClone(data.calendar),
    timelines: data.timelines.map((timeline) => structuredClone(timeline)),
    events: data.events.map((event) => structuredClone(event)),
    ...(data.eventTypes ? { eventTypes: data.eventTypes.map((type) => structuredClone(type)) } : {}),
    ...(data.suggestedTags ? { suggestedTags: [...data.suggestedTags] } : {}),
  };

  for (const change of changes) {
    if (change.content === null) {
      if (change.path.startsWith('.data/events/') && change.path.endsWith('.json')) {
        const eventId = change.path.split('/').pop()?.replace(/\.json$/i, '') ?? '';
        next.events = next.events.filter((event) => event.id !== eventId);
        continue;
      }
      if (change.path.startsWith('.data/timelines/') && change.path.endsWith('.json')) {
        const timelineId = change.path.split('/').pop()?.replace(/\.json$/i, '') ?? '';
        next.timelines = next.timelines.filter((timeline) => timeline.id !== timelineId);
        continue;
      }
      if (change.path === '.data/event-types.json') {
        delete next.eventTypes;
        continue;
      }
      if (change.path === '.data/suggested-tags.json') {
        delete next.suggestedTags;
      }
      continue;
    }

    if (change.path === '.data/meta.json') {
      next.meta = JSON.parse(change.content) as CampaignMeta;
      continue;
    }
    if (change.path === '.data/calendar.json') {
      next.calendar = JSON.parse(change.content) as CalendarConfig;
      continue;
    }
    if (change.path === '.data/event-types.json') {
      next.eventTypes = JSON.parse(change.content) as CustomEventType[];
      continue;
    }
    if (change.path === '.data/suggested-tags.json') {
      next.suggestedTags = JSON.parse(change.content) as string[];
      continue;
    }
    if (change.path.startsWith('.data/events/') && change.path.endsWith('.json')) {
      const event = JSON.parse(change.content) as CampaignEvent;
      const index = next.events.findIndex((existing) => existing.id === event.id);
      if (index >= 0) next.events[index] = event;
      else next.events.push(event);
      continue;
    }
    if (change.path.startsWith('.data/timelines/') && change.path.endsWith('.json')) {
      const timeline = JSON.parse(change.content) as CampaignTimeline;
      const index = next.timelines.findIndex((existing) => existing.id === timeline.id);
      if (index >= 0) next.timelines[index] = timeline;
      else next.timelines.push(timeline);
    }
  }

  next.timelines.sort((a, b) => a.order - b.order);
  return next;
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

    const snapshot = await loadFromGitHub(cfg, token);
    const nextData = applyChangesToCampaignSnapshot(snapshot.data, changes);
    validateCampaignData(nextData);
    const dateErrors = validateCampaignDataWithCalendar(nextData);
    if (dateErrors.length > 0) {
      throw error(400, `Invalid campaign data: ${dateErrors.slice(0, 5).join('; ')}`);
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
    if ('status' in (err as object) && typeof (err as { status?: unknown }).status === 'number') {
      throw err;
    }
    if (msg.includes('CONFLICT')) {
      return json({ error: msg, conflict: true }, { status: 409 });
    }
    return json({ error: msg }, { status: 500 });
  }
};
