import { WORKSPACE_ROOT, TIMEOUT_MS, MAX_RETRIES, DEBUG, MODELS } from "./config";

export interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runAgent(
  prompt: string,
  model: string = MODELS.corrector,
  timeoutMs: number = TIMEOUT_MS,
  mode?: "ask" | "plan"
): Promise<ProcessResult> {
  const args = [
    "-p",
    prompt,
    "--model",
    model,
    "--output-format",
    "text",
    "--force",
  ];

  if (mode) {
    args.push("--mode", mode);
  }

  if (DEBUG) {
    const preview = args
      .map((a) => (a.length > 80 ? a.slice(0, 80) + "..." : a))
      .join(" ");
    console.log(`      [CMD] agent ${preview}`);
  }

  const proc = Bun.spawn(["agent", ...args], {
    cwd: WORKSPACE_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });

  const exitPromise = (async () => {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    return { code, stdout, stderr };
  })();

  return Promise.race([exitPromise, timeoutPromise]);
}

export async function runAgentWithRetry(
  name: string,
  prompt: string,
  extractFn: (text: string) => string | null,
  maxRetries: number = MAX_RETRIES,
  model: string = MODELS.corrector,
  timeoutMs: number = TIMEOUT_MS,
  mode?: "ask" | "plan"
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const result = await runAgent(prompt, model, timeoutMs, mode);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.code !== 0) {
        console.log(
          `   [WARN] ${name} (attempt ${attempt}): Exit code ${result.code} (${elapsed}s)`
        );
        if (DEBUG && result.stderr)
          console.log(`      stderr: ${result.stderr.slice(0, 300)}`);
        continue;
      }

      const extracted = extractFn(result.stdout);
      if (!extracted) {
        console.log(
          `   [WARN] ${name} (attempt ${attempt}): Failed to extract output (${elapsed}s)`
        );
        if (DEBUG) console.log(`      stdout: ${result.stdout.slice(0, 300)}`);
        continue;
      }

      console.log(
        `   [OK] ${name}: Done (${elapsed}s)${attempt > 1 ? ` [attempt ${attempt}]` : ""}`
      );
      return extracted;
    } catch (error: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `   [WARN] ${name} (attempt ${attempt}): ${error.message} (${elapsed}s)`
      );
    }
  }

  console.log(`   [FAIL] ${name}: Failed after ${maxRetries} attempts`);
  return null;
}

/**
 * The transcript agents output plain corrected/annotated text, not structured
 * markdown with headers.  Accept any non-empty response as valid output.
 */
export function extractTranscriptText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 20) return null;
  return trimmed;
}
