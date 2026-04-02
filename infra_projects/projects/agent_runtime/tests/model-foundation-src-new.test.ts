import assert from "node:assert/strict";

import type { FetchLike } from "../src/model/types.js";
import { StreamingEventAdapter } from "../src/model/streaming-event-adapter.js";
import { ModelFactory } from "../src/model/model-factory.js";

export async function runModelFoundationSrcNewTests(): Promise<void> {
  await testModelFactoryCreatesMockModel();
  await testModelFactoryCreatesHttpModel();
  await testStreamingEventAdapterNormalizesProviderPayload();
}

async function testModelFactoryCreatesMockModel(): Promise<void> {
  const factory = new ModelFactory();
  const model = factory.createModel({
    mock: true,
    modeSelection: {},
    mockInfo: {
      content: "mock content",
    },
  });

  const response = await model.execute({
    systemPrompt: [],
    responseFormat: "json",
    userPrompt: { hello: "world" },
    stream: false,
  });

  assert.equal(response.content, "mock content");
  assert.equal(model.isRunning(), false);
}

async function testModelFactoryCreatesHttpModel(): Promise<void> {
  const factory = new ModelFactory();
  const fetchFn: FetchLike = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        choices: [
          {
            message: {
              content: "real content",
            },
          },
        ],
      });
    },
  });
  const model = factory.createModel({
    mock: false,
    modeSelection: {
      url: "https://example.com/model",
      key: "secret",
      model: "gpt-test",
    },
    mockInfo: {
      fetchFn,
    },
  });

  const response = await model.execute({
    systemPrompt: [],
    responseFormat: "json",
    userPrompt: { hello: "world" },
    stream: false,
  });
  const events = [];
  for await (const event of model.stream({
    systemPrompt: [],
    responseFormat: "json",
    userPrompt: { hello: "world" },
    stream: true,
  })) {
    events.push(event);
  }

  assert.equal(response.content, "real content");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.content, "real content");
  assert.equal(events[0]?.done, true);
}

async function testStreamingEventAdapterNormalizesProviderPayload(): Promise<void> {
  const adapter = new StreamingEventAdapter();
  const event = adapter.adapt({
    payload: {
      content: "chunk",
      done: true,
      error: {
        code: "E_STREAM",
        message: "stream failed",
      },
    },
  });

  assert.equal(event.content, "chunk");
  assert.equal(event.done, true);
  assert.equal(event.error?.code, "E_STREAM");
}
