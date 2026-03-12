<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Header from '$lib/components/Header/Header.svelte';
	import WikiNav from '$lib/components/Header/WikiNav.svelte';
	import type { NavEntry } from '$lib/wiki-nav';

	interface DiffLine {
		type: 'add' | 'remove' | 'context';
		text: string;
	}

	interface DiffHunk {
		header: string;
		lines: DiffLine[];
	}

	interface ReviewFile {
		filename: string;
		previousFilename: string | null;
		status: string;
		summary: string;
		additions: number;
		deletions: number;
		changes: number;
		highlights: {
			added: string[];
			removed: string[];
		};
		hunks: DiffHunk[];
		hasPatch: boolean;
	}

	interface ReviewData {
		prNumber: number;
		title: string;
		description: string;
		author: string;
		updatedAt: string;
		headBranch: string;
		baseBranch: string;
		prUrl: string;
		summary: {
			filesChanged: number;
			additions: number;
			deletions: number;
		};
		files: ReviewFile[];
	}

interface PageData {
	branch: string;
	defaultBranch: string;
	branches: string[];
	branchLabels: Record<string, string>;
	nav: NavEntry[];
	authenticated?: boolean;
	review: ReviewData;
}

let { data }: { data: PageData } = $props();
let review = $derived(data.review);

	let processing = $state(false);
	let statusMessage = $state('');
	let statusKind = $state<'idle' | 'success' | 'error'>('idle');

	function formatDate(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString();
	}

	function fileStatusLabel(status: string): string {
		if (status === 'added') return 'Added';
		if (status === 'removed') return 'Removed';
		if (status === 'renamed') return 'Renamed';
		return 'Updated';
	}

	async function handleDecision(action: 'approve' | 'reject') {
		processing = true;
		statusKind = 'idle';
		statusMessage = '';
		try {
			const res = await fetch('/api/approvals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, prNumber: review.prNumber }),
			});
			const payload = await res.json();
			if (!res.ok || !payload.ok) {
				throw new Error(payload.message || payload.error || 'Failed to process decision.');
			}
			statusKind = 'success';
			statusMessage = payload.message || 'Decision applied.';
			await invalidateAll();
			await goto('/');
		} catch (err) {
			statusKind = 'error';
			statusMessage = (err as Error).message || 'Failed to process decision.';
		} finally {
			processing = false;
		}
	}
</script>

<div class="wiki-layout">
	<Header
		mode="wiki"
		branch={data.branch}
		defaultBranch={data.defaultBranch}
		branches={data.branches}
		branchLabels={data.branchLabels}
	/>
	<WikiNav
		nav={data.nav}
		branch={data.branch}
		defaultBranch={data.defaultBranch}
		authenticated={Boolean(data.authenticated)}
	/>

	<main class="wiki-main review-page" data-testid="approval-review-page">
	<header class="review-header">
		<div>
			<h1 data-testid="approval-review-title">Review Change Request #{review.prNumber}</h1>
			<p class="subtitle">{review.title}</p>
		</div>
		<div class="actions">
			<button
				class="decision approve"
				onclick={() => handleDecision('approve')}
				disabled={processing}
				data-testid="approval-review-accept"
				aria-label="Accept this change request"
			>
				Accept
			</button>
			<button
				class="decision reject"
				onclick={() => handleDecision('reject')}
				disabled={processing}
				data-testid="approval-review-reject"
				aria-label="Reject this change request"
			>
				Reject
			</button>
			<a
				class="gh-link"
				href={review.prUrl}
				target="_blank"
				rel="noopener noreferrer"
				data-testid="approval-review-open-github"
			>
				Open on GitHub
			</a>
		</div>
	</header>

	<section class="meta" data-testid="approval-review-meta">
		<div><strong>Author:</strong> {review.author}</div>
		<div><strong>From branch:</strong> {review.headBranch}</div>
		<div><strong>Into:</strong> {review.baseBranch}</div>
		<div><strong>Updated:</strong> {formatDate(review.updatedAt)}</div>
	</section>

	<section class="summary-grid" data-testid="approval-review-summary">
		<div class="summary-card">
			<div class="label">Files changed</div>
			<div class="value">{review.summary.filesChanged}</div>
		</div>
		<div class="summary-card add">
			<div class="label">Lines added</div>
			<div class="value">+{review.summary.additions}</div>
		</div>
		<div class="summary-card remove">
			<div class="label">Lines removed</div>
			<div class="value">-{review.summary.deletions}</div>
		</div>
	</section>

	{#if review.description}
		<section class="description" data-testid="approval-review-description">
			<h2>Description</h2>
			<p>{review.description}</p>
		</section>
	{/if}

	<section class="files" data-testid="approval-review-files">
		<h2>What will change</h2>
		{#each review.files as file, i (file.filename)}
			<details class="file-card" open={i === 0}>
				<summary>
					<div class="file-head">
						<div>
							<div class="file-name">{file.filename}</div>
							<div class="file-subtitle">
								<span class="badge {file.status}">{fileStatusLabel(file.status)}</span>
								<span>{file.summary}</span>
							</div>
						</div>
						<div class="counts">
							<span class="plus">+{file.additions}</span>
							<span class="minus">-{file.deletions}</span>
						</div>
					</div>
				</summary>

				<div class="highlights">
					{#if file.highlights.added.length > 0}
						<div class="highlight add">
							<h3>New content</h3>
							<ul>
								{#each file.highlights.added as line}
									<li>{line}</li>
								{/each}
							</ul>
						</div>
					{/if}
					{#if file.highlights.removed.length > 0}
						<div class="highlight remove">
							<h3>Removed content</h3>
							<ul>
								{#each file.highlights.removed as line}
									<li>{line}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				{#if file.hasPatch}
					<div class="diff-block" data-testid="approval-review-diff-{i}">
						{#each file.hunks as hunk}
							<div class="hunk">
								<div class="hunk-header">{hunk.header}</div>
								{#each hunk.lines as line}
									<div class="line {line.type}">
										<code>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}{line.text}</code>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{:else}
					<p class="binary-note">This file has no line-by-line preview available.</p>
				{/if}
			</details>
		{/each}
	</section>

	{#if statusMessage}
		<div
			class="status {statusKind}"
			data-testid="approval-review-status"
			data-status={statusKind}
			role="status"
			aria-live="polite"
		>
			{statusMessage}
		</div>
	{/if}
	</main>
</div>

<style>
	.wiki-layout {
		min-height: 100vh;
		background: var(--bg);
		color: var(--text);
	}
	.wiki-main {
		margin-left: 270px;
		padding: 2.5rem 3rem 4rem;
		padding-top: calc(56px + 2.5rem);
	}
	.review-page {
		max-width: 1100px;
	}
	.review-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
		margin-bottom: 1rem;
	}
	h1 {
		margin: 0 0 0.35rem;
		font-size: 1.4rem;
	}
	.subtitle {
		margin: 0;
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.decision {
		padding: 0.45rem 0.85rem;
		border-radius: 6px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}
	.decision.approve:hover:not(:disabled) {
		border-color: #4a9a4a;
		color: #4a9a4a;
	}
	.decision.reject:hover:not(:disabled) {
		border-color: #cc4444;
		color: #cc4444;
	}
	.gh-link {
		color: var(--text-muted);
		text-decoration: underline;
		font-size: 0.9rem;
	}
	.meta {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 1rem;
		color: var(--text-muted);
	}
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.summary-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.65rem;
		background: var(--surface);
	}
	.summary-card .label {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.summary-card .value {
		font-size: 1.1rem;
		font-weight: 600;
		margin-top: 0.15rem;
	}
	.summary-card.add {
		border-color: rgba(74, 154, 74, 0.5);
	}
	.summary-card.remove {
		border-color: rgba(204, 68, 68, 0.5);
	}
	.files h2 {
		margin: 0.35rem 0 0.8rem;
	}
	.file-card {
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.6rem;
		margin-bottom: 0.65rem;
		background: var(--surface);
	}
	.file-card summary {
		cursor: pointer;
		list-style: none;
	}
	.file-card summary::-webkit-details-marker {
		display: none;
	}
	.file-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}
	.file-name {
		font-weight: 600;
	}
	.file-subtitle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--text-muted);
		font-size: 0.82rem;
		margin-top: 0.2rem;
	}
	.badge {
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		font-size: 0.72rem;
	}
	.badge.added {
		border-color: rgba(74, 154, 74, 0.7);
		color: #4a9a4a;
	}
	.badge.removed {
		border-color: rgba(204, 68, 68, 0.7);
		color: #cc4444;
	}
	.badge.modified, .badge.renamed {
		border-color: rgba(212, 175, 55, 0.7);
		color: #d4af37;
	}
	.counts {
		display: flex;
		gap: 0.5rem;
		font-weight: 600;
	}
	.counts .plus {
		color: #4a9a4a;
	}
	.counts .minus {
		color: #cc4444;
	}
	.highlights {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
		margin: 0.75rem 0;
	}
	.highlight {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem;
	}
	.highlight h3 {
		font-size: 0.78rem;
		margin: 0 0 0.35rem;
	}
	.highlight ul {
		margin: 0;
		padding-left: 1rem;
	}
	.highlight li {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 0.15rem 0;
	}
	.highlight.add {
		border-color: rgba(74, 154, 74, 0.45);
	}
	.highlight.remove {
		border-color: rgba(204, 68, 68, 0.45);
	}
	.diff-block {
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.hunk {
		border-top: 1px solid var(--border);
	}
	.hunk:first-child {
		border-top: none;
	}
	.hunk-header {
		background: var(--surface-2);
		color: var(--text-muted);
		font-size: 0.75rem;
		padding: 0.35rem 0.5rem;
	}
	.line {
		padding: 0.15rem 0.5rem;
		white-space: pre-wrap;
		font-size: 0.8rem;
	}
	.line.add {
		background: rgba(74, 154, 74, 0.12);
	}
	.line.remove {
		background: rgba(204, 68, 68, 0.12);
	}
	.line.context {
		background: transparent;
	}
	.binary-note {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.status {
		margin-top: 0.8rem;
		font-size: 0.9rem;
	}
	.status.success {
		color: #4a9a4a;
	}
	.status.error {
		color: #cc4444;
	}
	@media (max-width: 900px) {
		.summary-grid {
			grid-template-columns: 1fr;
		}
		.highlights {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 768px) {
		.wiki-main {
			margin-left: 0;
			padding: 2rem 1.25rem;
			padding-top: calc(56px + 4rem);
		}
	}
</style>

