import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { SessionTranscriptStore } from "../src/context/session-transcript-store.js";
import { resolveSessionTranscriptPath } from "../src/runtime/runtime-storage-paths.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runSessionTranscriptStoreTests(): Promise<void> {
  await testSessionTranscriptStoreLoadsAndAppendsTranscript();
  await testSessionTranscriptStoreFlushesBufferedTranscript();
}

async function testSessionTranscriptStoreLoadsAndAppendsTranscript(): Promise<void> {
  const workdir = await createTestWorkdir();
  const store = new SessionTranscriptStore(workdir);

  await store.initialize("session-1", [
    {
      role: "system",
      content: "system prompt",
    },
  ]);
  await store.append("session-1", [
    {
      role: "user",
      content: "{\"task\":\"demo\"}",
    },
  ]);

  const transcript = await store.load("session-1");

  assert.equal(transcript.length, 2);
  assert.equal(transcript[0]?.role, "system");
  assert.equal(transcript[1]?.role, "user");
  await assert.rejects(readFile(resolveSessionTranscriptPath(workdir, "session-1"), "utf8"));
}

async function testSessionTranscriptStoreFlushesBufferedTranscript(): Promise<void> {
  const workdir = await createTestWorkdir();
  const store = new SessionTranscriptStore(workdir);

  await store.initialize("session-1", [
    {
      role: "system",
      content: "system prompt",
    },
  ]);
  await store.append("session-1", [
    {
      role: "user",
      content: "{\"task\":\"demo\"}",
    },
  ]);
  await store.flush("session-1");

  const transcript = JSON.parse(
    await readFile(resolveSessionTranscriptPath(workdir, "session-1"), "utf8"),
  ) as Array<{ role: string }>;

  assert.equal(transcript.length, 2);
  assert.equal(transcript[0]?.role, "system");
  assert.equal(transcript[1]?.role, "user");
}
