<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	interface ApprovalItem {
		prNumber: number;
		title: string;
		author: string;
		updatedAt: string;
		prUrl: string;
		headBranch: string;
	}

	interface Props {
		visible: boolean;
	}

	let { visible }: Props = $props();

	let open = $state(false);
	let loading = $state(false);
	let savingToggle = $state(false);
	let processingPr = $state<number | null>(null);
	let approvals = $state<ApprovalItem[]>([]);
	let allowDirectDefaultBranchEdits = $state(false);
	let statusMessage = $state('');
	let statusKind = $state<'idle' | 'success' | 'error'>('idle');
	const dropdownId = 'approvals-dropdown-menu';

	function announceOpenState(nextOpen: boolean) {
		if (!nextOpen || typeof window === 'undefined') return;
		window.dispatchEvent(
			new CustomEvent('header-overlay-open', {
				detail: { source: 'approvals-panel' },
			}),
		);
	}

	function formatDate(value: string): string {
		const when = new Date(value);
		if (Number.isNaN(when.getTime())) return value;
		return when.toLocaleString();
	}

	async function loadData() {
		loading = true;
		statusMessage = '';
		statusKind = 'idle';
		try {
			const [approvalsRes, settingsRes] = await Promise.all([
				fetch('/api/approvals'),
				fetch('/api/settings/workflow'),
			]);
			if (!approvalsRes.ok) throw new Error('Failed to load approvals.');
			if (!settingsRes.ok) throw new Error('Failed to load workflow settings.');
			const approvalsData = (await approvalsRes.json()) as { approvals?: ApprovalItem[] };
			const settingsData = (await settingsRes.json()) as {
				allowDirectDefaultBranchEdits?: boolean;
			};
			approvals = (approvalsData.approvals ?? []).filter((item) =>
				item.headBranch.startsWith('content/'),
			);
			allowDirectDefaultBranchEdits = settingsData.allowDirectDefaultBranchEdits === true;
		} catch (err) {
			statusKind = 'error';
			statusMessage = (err as Error).message || 'Failed to load approvals panel.';
		} finally {
			loading = false;
		}
	}

	function togglePanel() {
		open = !open;
		announceOpenState(open);
		if (open) {
			void loadData();
		}
	}

	async function updateWorkflowToggle(checked: boolean) {
		savingToggle = true;
		statusKind = 'idle';
		statusMessage = '';
		try {
			const res = await fetch('/api/settings/workflow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ allowDirectDefaultBranchEdits: checked }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || data.error || 'Failed to update workflow.');
			allowDirectDefaultBranchEdits = data.allowDirectDefaultBranchEdits === true;
			if (typeof window !== 'undefined') {
				window.dispatchEvent(
					new CustomEvent('workflow-settings-updated', {
						detail: { allowDirectDefaultBranchEdits },
					}),
				);
			}
			statusKind = 'success';
			statusMessage = allowDirectDefaultBranchEdits
				? 'Direct publish enabled for admins.'
				: 'Direct publish disabled.';
			await invalidateAll();
		} catch (err) {
			statusKind = 'error';
			statusMessage = (err as Error).message || 'Failed to update workflow.';
		} finally {
			savingToggle = false;
		}
	}

	async function processApproval(prNumber: number, action: 'approve' | 'reject') {
		processingPr = prNumber;
		statusKind = 'idle';
		statusMessage = '';
		try {
			const res = await fetch('/api/approvals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, prNumber }),
			});
			const data = await res.json();
			if (!res.ok || !data.ok) {
				throw new Error(data.message || data.error || `Failed to ${action} change.`);
			}
			approvals = approvals.filter((item) => item.prNumber !== prNumber);
			statusKind = 'success';
			statusMessage = data.message || 'Action completed.';
			await invalidateAll();
		} catch (err) {
			statusKind = 'error';
			statusMessage = (err as Error).message || `Failed to ${action} change.`;
		} finally {
			processingPr = null;
		}
	}

	onMount(() => {
		const onOverlayOpen = (event: Event) => {
			const source = (event as CustomEvent<{ source?: string }>).detail?.source;
			if (source && source !== 'approvals-panel') {
				open = false;
			}
		};
		window.addEventListener('header-overlay-open', onOverlayOpen as EventListener);
		return () => window.removeEventListener('header-overlay-open', onOverlayOpen as EventListener);
	});
</script>

{#if visible}
	<div class="approvals-wrapper">
		<button
			class="approvals-toggle"
			onclick={togglePanel}
			title="Approvals"
			data-testid="approvals-toggle"
			aria-expanded={open}
			aria-haspopup="dialog"
			aria-controls={dropdownId}
			aria-label="Approvals panel"
		>
			<span class="btn-label">Approvals</span>
			{#if approvals.length > 0}
				<span class="approvals-badge">{approvals.length}</span>
			{/if}
		</button>

		{#if open}
			<div
				id={dropdownId}
				class="approvals-dropdown"
				data-testid="approvals-dropdown"
				role="dialog"
				aria-modal="false"
				aria-label="Approvals and workflow settings"
			>
				<header class="approvals-header">Review Changes</header>
				<div class="workflow-row">
					<label class="workflow-label" for="workflow-direct-publish-toggle">
						Allow direct publish to Published branch
					</label>
					<input
						id="workflow-direct-publish-toggle"
						type="checkbox"
						checked={allowDirectDefaultBranchEdits}
						disabled={savingToggle}
						onchange={(event) =>
							updateWorkflowToggle((event.currentTarget as HTMLInputElement).checked)}
						data-testid="workflow-direct-publish-toggle"
						aria-label="Allow direct publish to published branch"
					/>
				</div>
				<p class="workflow-help">
					When off, edits require content branches and approval.
				</p>

				{#if loading}
					<div class="approvals-empty">Loading…</div>
				{:else if approvals.length === 0}
					<div class="approvals-empty" data-testid="approvals-empty">
						No pending content changes.
					</div>
				{:else}
					<div class="approvals-list" role="listbox" aria-label="Pending approvals">
						{#each approvals as item (item.prNumber)}
							<div
								class="approval-item"
								role="option"
								aria-selected={false}
								data-testid="approval-item-{item.prNumber}"
							>
								<div class="approval-title">{item.title}</div>
								<div class="approval-meta">
									<span>Author: {item.author}</span>
									<span>Updated: {formatDate(item.updatedAt)}</span>
									<span title={item.headBranch}>Branch: {item.headBranch}</span>
								</div>
								<div class="approval-actions">
									<a
										class="approval-link"
										href={"/approvals/" + item.prNumber}
										data-testid="approval-review-{item.prNumber}"
										aria-label="Review change request {item.prNumber}"
									>
										Review
									</a>
									<button
										class="approval-btn approve"
										onclick={() => processApproval(item.prNumber, 'approve')}
										disabled={processingPr === item.prNumber}
										data-testid="approval-accept-{item.prNumber}"
										aria-label="Accept change request {item.prNumber}"
									>
										Accept
									</button>
									<button
										class="approval-btn reject"
										onclick={() => processApproval(item.prNumber, 'reject')}
										disabled={processingPr === item.prNumber}
										data-testid="approval-reject-{item.prNumber}"
										aria-label="Reject change request {item.prNumber}"
									>
										Reject
									</button>
									<a
										class="approval-link"
										href={item.prUrl}
										target="_blank"
										rel="noopener noreferrer"
										data-testid="approval-open-github-pr-{item.prNumber}"
										aria-label="Open pull request {item.prNumber} on GitHub"
									>
										GitHub
									</a>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if statusMessage}
					<div
						class="status-message {statusKind}"
						data-testid="approvals-status-message"
						data-status={statusKind}
						role="status"
						aria-live="polite"
					>
						{statusMessage}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="approvals-backdrop" onclick={() => (open = false)} data-testid="approvals-backdrop"></div>
	{/if}
{/if}

<style>
	.approvals-wrapper {
		position: relative;
	}
	.approvals-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--surface);
		color: var(--text-muted);
		font-size: 0.8rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}
	.approvals-toggle:hover {
		border-color: var(--gold, #d4af37);
		color: var(--text);
	}
	.approvals-badge {
		background: var(--gold-dim, #8b7d2a);
		color: var(--gold, #d4af37);
		border-radius: 9px;
		padding: 0 5px;
		font-size: 0.7rem;
		min-width: 16px;
		text-align: center;
	}
	.approvals-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 6px;
		background: var(--surface);
		border: 1px solid var(--border-bright);
		border-radius: 6px;
		min-width: 420px;
		max-height: 70vh;
		overflow-y: auto;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		z-index: 220;
		padding: 12px;
	}
	.approvals-backdrop {
		position: fixed;
		inset: 56px 0 0 0;
		z-index: 150;
	}
	.approvals-header {
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 8px;
	}
	.workflow-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.workflow-label {
		font-size: 0.8rem;
		color: var(--text);
	}
	.workflow-help {
		margin: 6px 0 10px;
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.approvals-empty {
		padding: 10px 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.approvals-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.approval-item {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px;
	}
	.approval-title {
		font-size: 0.82rem;
		font-weight: 600;
		margin-bottom: 4px;
	}
	.approval-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.74rem;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	.approval-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.approval-btn {
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-muted);
		font-size: 0.74rem;
		cursor: pointer;
	}
	.approval-btn.approve:hover:not(:disabled) {
		border-color: #4a9a4a;
		color: #4a9a4a;
	}
	.approval-btn.reject:hover:not(:disabled) {
		border-color: #cc4444;
		color: #cc4444;
	}
	.approval-link {
		font-size: 0.74rem;
		color: var(--text-muted);
		text-decoration: underline;
	}
	.approval-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.status-message {
		margin-top: 10px;
		font-size: 0.78rem;
	}
	.status-message.success {
		color: #4a9a4a;
	}
	.status-message.error {
		color: #cc4444;
	}
</style>

