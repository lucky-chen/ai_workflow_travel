import assert from "node:assert/strict";

import { SessionHistoryStore } from "../src/context/session-history-store.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runSessionHistoryStoreTests(): Promise<void> {
  await testSessionHistoryStoreLoadsAndAppendsTranscript();
}

async function testSessionHistoryStoreLoadsAndAppendsTranscript(): Promise<void> {
  const store = new SessionHistoryStore(await createTestWorkdir());

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
