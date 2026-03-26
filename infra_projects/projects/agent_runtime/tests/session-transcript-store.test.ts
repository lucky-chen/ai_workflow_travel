import assert from "node:assert/strict";

import { SessionTranscriptStore } from "../src/context/session-transcript-store.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runSessionTranscriptStoreTests(): Promise<void> {
  await testSessionTranscriptStoreLoadsAndAppendsTranscript();
}

async function testSessionTranscriptStoreLoadsAndAppendsTranscript(): Promise<void> {
  const store = new SessionTranscriptStore(await createTestWorkdir());

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
}
