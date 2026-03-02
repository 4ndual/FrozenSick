/**
 * Transcript Pipeline Orchestrator
 *
 * Sequential 3-stage processing of D&D session transcripts:
 *   1. Spanish Text Corrector  — fix speech-to-text errors
 *   2. Meta Removal            — classify canon vs meta-talk
 *   3. Speaker Attribution     — assign lines to characters
 *
 * Each stage processes the transcript in chunks, writing intermediate
 * output that the next stage reads.
 *
 * Run with:
 *   bun run Assets/agents/pipeline.ts -- --input="28 de feb, 17-54.txt"
 */

import { mkdir } from "fs/promises";
import { join, basename } from "path";
import { existsSync } from "fs";

import {
  WORKSPACE_ROOT,
  AGENTS_DIR,
  MODELS,
  PROMPTS,
  CONTEXTS,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  PARALLEL_CHUNKS,
  DEBUG,
} from "./config";
import { runAgentWithRetry, extractTranscriptText } from "./runner";

function parseArgs(): { inputFile: string; chunkIndex?: number } {
  const inputArg = process.argv.find((a) => a.startsWith("--input="));
  if (!inputArg) {
    console.error("Usage: bun run pipeline.ts -- --input=\"<transcript file>\"");
    console.error("       Optional: --chunk=N  to process only chunk N (0-based)");
    process.exit(1);
  }

  const inputFile = inputArg.split("=").slice(1).join("=");

  const chunkArg = process.argv.find((a) => a.startsWith("--chunk="));
  const chunkIndex = chunkArg ? parseInt(chunkArg.split("=")[1], 10) : undefined;

  return { inputFile, chunkIndex };
}

function splitIntoChunks(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];

  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + CHUNK_SIZE, lines.length);
    chunks.push(lines.slice(start, end).join("\n"));
    start = end - CHUNK_OVERLAP;
    if (start >= lines.length) break;
    if (end === lines.length) break;
  }

  return chunks;
}

function buildCorrectorPrompt(chunkFile: string): string {
  return `You are processing a D&D session transcript chunk for text correction.

Read your system instructions from: ${PROMPTS.corrector}
Read your reference context from: ${CONTEXTS.corrector}
Read the raw transcript chunk to correct from: ${chunkFile}

Follow the instructions exactly. Output ONLY the corrected transcript text — no explanations, no headers, no markdown code blocks.`;
}

function buildMetaPrompt(correctedFile: string): string {
  return `You are processing a corrected D&D session transcript chunk for meta-talk classification.

Read your system instructions from: ${PROMPTS.metaRemoval}
Read your reference context from: ${CONTEXTS.metaRemoval}
Read the corrected transcript chunk to classify from: ${correctedFile}

Follow the instructions exactly. Output ONLY the classified transcript text with [CANON], [META], or [MIXED] tags — no explanations, no markdown code blocks.`;
}

function buildAttributionPrompt(classifiedFile: string): string {
  return `You are processing a classified D&D session transcript chunk for speaker attribution.

Read your system instructions from: ${PROMPTS.attribution}
Read your reference context from: ${CONTEXTS.attribution}
Read the classified transcript chunk to attribute from: ${classifiedFile}

Follow the instructions exactly. Output ONLY the attributed transcript text with speaker tags — no explanations, no markdown code blocks.`;
}

async function processChunk(
  chunkText: string,
  chunkIdx: number,
  totalChunks: number,
  outputDir: string
): Promise<{ corrected: string | null; classified: string | null; attributed: string | null }> {
  const tag = `[Chunk ${chunkIdx + 1}/${totalChunks}]`;
  const chunkDir = join(outputDir, `chunk-${String(chunkIdx).padStart(3, "0")}`);
  await mkdir(chunkDir, { recursive: true });

  const rawChunkPath = join(chunkDir, "0-raw.txt");
  const correctedPath = join(chunkDir, "1-corrected.txt");
  const classifiedPath = join(chunkDir, "2-classified.txt");
  const attributedPath = join(chunkDir, "3-attributed.txt");

  await Bun.write(rawChunkPath, chunkText);

  // Stage 1: Corrector
  console.log(`\n${tag} Stage 1: Spanish Text Corrector`);
  const corrected = await runAgentWithRetry(
    `${tag} Corrector`,
    buildCorrectorPrompt(rawChunkPath),
    extractTranscriptText,
    undefined,
    MODELS.corrector
  );

  if (!corrected) {
    console.log(`${tag} Corrector failed — skipping remaining stages for this chunk`);
    return { corrected: null, classified: null, attributed: null };
  }
  await Bun.write(correctedPath, corrected);

  // Stage 2: Meta Removal
  console.log(`${tag} Stage 2: Meta Removal`);
  const classified = await runAgentWithRetry(
    `${tag} MetaRemoval`,
    buildMetaPrompt(correctedPath),
    extractTranscriptText,
    undefined,
    MODELS.metaRemoval
  );

  if (!classified) {
    console.log(`${tag} Meta Removal failed — skipping attribution for this chunk`);
    return { corrected, classified: null, attributed: null };
  }
  await Bun.write(classifiedPath, classified);

  // Stage 3: Speaker Attribution
  console.log(`${tag} Stage 3: Speaker Attribution`);
  const attributed = await runAgentWithRetry(
    `${tag} Attribution`,
    buildAttributionPrompt(classifiedPath),
    extractTranscriptText,
    undefined,
    MODELS.attribution
  );

  if (!attributed) {
    console.log(`${tag} Attribution failed for this chunk`);
    return { corrected, classified, attributed: null };
  }
  await Bun.write(attributedPath, attributed);

  return { corrected, classified, attributed };
}

async function main() {
  const { inputFile, chunkIndex } = parseArgs();

  const inputPath = inputFile.startsWith("/")
    ? inputFile
    : join(WORKSPACE_ROOT, inputFile);

  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const sessionName = basename(inputFile, ".txt");
  const outputDir = join(WORKSPACE_ROOT, "Assets", "agents", "output", sessionName);
  await mkdir(outputDir, { recursive: true });

  console.log("================================================================");
  console.log("       FROZEN SICK — TRANSCRIPT PIPELINE");
  console.log("================================================================");
  console.log(`Input:   ${inputPath}`);
  console.log(`Output:  ${outputDir}`);
  console.log(`Models:  corrector=${MODELS.corrector}  meta=${MODELS.metaRemoval}  attribution=${MODELS.attribution}`);
  if (DEBUG) console.log("Debug:   ON");

  const rawText = await Bun.file(inputPath).text();
  const totalLines = rawText.split("\n").length;
  console.log(`Lines:   ${totalLines}`);

  const chunks = splitIntoChunks(rawText);
  console.log(`Chunks:  ${chunks.length} (${CHUNK_SIZE} lines each, ${CHUNK_OVERLAP} overlap)`);
  console.log(`Parallel: ${PARALLEL_CHUNKS} chunks at a time`);

  const startChunk = chunkIndex !== undefined ? chunkIndex : 0;
  const endChunk = chunkIndex !== undefined ? chunkIndex + 1 : chunks.length;

  if (chunkIndex !== undefined) {
    if (chunkIndex < 0 || chunkIndex >= chunks.length) {
      console.error(`Chunk index ${chunkIndex} out of range (0-${chunks.length - 1})`);
      process.exit(1);
    }
    console.log(`\nProcessing only chunk ${chunkIndex} of ${chunks.length}`);
  }

  console.log("\n================================================================\n");

  type ChunkResult = { corrected: string | null; classified: string | null; attributed: string | null };
  const results: ChunkResult[] = new Array(endChunk - startChunk);
  let failures = 0;

  for (let batchStart = startChunk; batchStart < endChunk; batchStart += PARALLEL_CHUNKS) {
    const batchEnd = Math.min(batchStart + PARALLEL_CHUNKS, endChunk);
    const batchIndices = Array.from({ length: batchEnd - batchStart }, (_, k) => batchStart + k);

    console.log(`--- Batch: chunks ${batchIndices.map(i => i + 1).join(", ")} of ${chunks.length} (parallel) ---`);

    const batchResults = await Promise.all(
      batchIndices.map((i) => processChunk(chunks[i], i, chunks.length, outputDir))
    );

    for (let k = 0; k < batchResults.length; k++) {
      results[batchIndices[k] - startChunk] = batchResults[k];
      if (!batchResults[k].attributed) failures++;
    }
  }

  const allCorrected = results.map(r => r.corrected).filter((t): t is string => t !== null);
  const allClassified = results.map(r => r.classified).filter((t): t is string => t !== null);
  const allAttributed = results.map(r => r.attributed).filter((t): t is string => t !== null);

  // Assemble final outputs
  console.log("\n================================================================");
  console.log("       ASSEMBLING FINAL OUTPUT");
  console.log("================================================================\n");

  if (allCorrected.length > 0) {
    const correctedFinal = join(outputDir, "final-corrected.txt");
    await Bun.write(correctedFinal, allCorrected.join("\n\n---\n\n"));
    console.log(`[OK] Corrected:  ${correctedFinal}`);
  }

  if (allClassified.length > 0) {
    const classifiedFinal = join(outputDir, "final-classified.txt");
    await Bun.write(classifiedFinal, allClassified.join("\n\n---\n\n"));
    console.log(`[OK] Classified: ${classifiedFinal}`);
  }

  if (allAttributed.length > 0) {
    const attributedFinal = join(outputDir, "final-attributed.txt");
    await Bun.write(attributedFinal, allAttributed.join("\n\n---\n\n"));
    console.log(`[OK] Attributed: ${attributedFinal}`);
  }

  console.log("\n================================================================");
  if (failures === 0) {
    console.log("       PIPELINE COMPLETE — ALL CHUNKS SUCCEEDED");
  } else {
    console.log(`       PIPELINE COMPLETE — ${failures}/${endChunk - startChunk} CHUNKS HAD FAILURES`);
  }
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
