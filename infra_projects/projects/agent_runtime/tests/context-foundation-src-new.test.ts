import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ContextAssembler,
  DefaultContextBudgetPolicy,
  FileStorage,
  LocalFileRetrievalProvider,
  StorageBackedRuntimeMemory,
  StorageBackedSessionTranscript,
} from "../src_new/index.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runContextFoundationSrcNewTests(): Promise<void> {
  await testSessionTranscriptBoundary();
  await testRuntimeMemoryBoundary();
  await testContextAssemblerBuildsOriginalAndBoundedContext();
}

async function testSessionTranscriptBoundary(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-transcript-");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const transcript = new StorageBackedSessionTranscript(storage);

  await transcript.update("session-1", [
    { role: "system", content: "system prompt" },
    { role: "user", content: "{\"task\":\"demo\"}" },
  ]);

  const loaded = await transcript.load("session-1");
  assert.equal(loaded.turns.length, 2);

  const persisted = JSON.parse(
    await readFile(path.join(workdir, ".agent_runtime", "transcripts", "session-1.json"), "utf8"),
  ) as { turns: Array<{ role: string }> };
  assert.equal(persisted.turns[1]?.role, "user");
}

async function testRuntimeMemoryBoundary(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-memory-");
  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const memory = new StorageBackedRuntimeMemory(storage);

  await memory.update("session-1", [
    { summary: "priority p0" },
  ]);

  const loaded = await memory.load("session-1");
  assert.equal(loaded.summaryItems[0]?.summary, "priority p0");
}

async function testContextAssemblerBuildsOriginalAndBoundedContext(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-src-new-context-");
  const docsDir = path.join(workdir, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(path.join(docsDir, "design.md"), "agent runtime design context assembly", "utf8");

  const storage = new FileStorage(path.join(workdir, ".agent_runtime"));
  const transcript = new StorageBackedSessionTranscript(storage);
  const memory = new StorageBackedRuntimeMemory(storage);
  const retrieval = new LocalFileRetrievalProvider(workdir);
  const assembler = new ContextAssembler(
    transcript,
    memory,
    retrieval,
    new DefaultContextBudgetPolicy(),
  );

  await transcript.update("session-1", [
    { role: "system", content: "system prompt" },
    { role: "user", content: "first task" },
    { role: "assistant", content: "first result" },
  ]);
  await memory.update("session-1", [
    { summary: "memory-1" },
    { summary: "memory-2" },
  ]);

  const context = await assembler.assemble({
    sessionId: "session-1",
    userInput: {
      content: {
        task: "agent runtime design",
      },
    },
    runtimeLimits: {
      maxTranscriptTurns: 2,
      maxMemoryItems: 1,
      maxRetrievalFragments: 1,
    },
  });

  assert.equal(context.originalContext.transcriptContext.turns.length, 3);
  assert.equal(context.originalContext.runtimeMemoryContext.summaryItems.length, 2);
  assert.equal(context.originalContext.retrievalContext?.fragments.length, 1);
  assert.equal(context.boundedContext?.transcriptContext.turns.length, 2);
  assert.equal(context.boundedContext?.runtimeMemoryContext.summaryItems.length, 1);
  assert.equal(context.boundedContext?.retrievalContext?.fragments.length, 1);
}

