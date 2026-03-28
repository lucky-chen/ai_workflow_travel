import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import {
  DefaultStreamingEventAdapter,
  type StreamingEventAdapter,
} from "./streaming-event-adapter.js";
import type {
  FetchLike,
  FetchResponseLike,
  IModel,
  ModeSelection,
  ModelCreationInput,
  ModelFactory,
  ModuleRequest,
  ModuleResponse,
  ProviderStreamEvent,
  StreamEvent,
} from "./types.js";

export class DefaultModelFactory implements ModelFactory {
  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new DefaultStreamingEventAdapter());
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new HttpModel(input.modeSelection, fetchFn, new DefaultStreamingEventAdapter());
  }
}

class MockModel implements IModel {
  private running = false;

  constructor(
    private readonly mockInfo: Record<string, unknown> | undefined,
    private readonly streamingAdapter: StreamingEventAdapter,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(_input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      return {
        content: typeof this.mockInfo?.content === "string"
          ? this.mockInfo.content
          : JSON.stringify(this.mockInfo ?? { ok: true }),
        error: {
          code: "",
          message: "",
        },
      };
    } finally {
      this.running = false;
    }
  }

  async *stream(input: ModuleRequest): AsyncIterable<StreamEvent> {
    const response = await this.execute(input);
    yield this.streamingAdapter.adapt({
      payload: {
        content: response.content,
        done: true,
      },
    });
  }
}

class HttpModel implements IModel {
  private running = false;

  constructor(
    private readonly modeSelection: ModeSelection,
    private readonly fetchFn: FetchLike,
    private readonly streamingAdapter: StreamingEventAdapter,
  ) {}

  isRunning(): boolean {
    return this.running;
  }

  async execute(input: ModuleRequest): Promise<ModuleResponse> {
    this.running = true;
    try {
      const response = await this.fetchFn(this.modeSelection.url!, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.modeSelection.key!}`,
        },
        body: JSON.stringify({
          model: this.modeSelection.model,
          prompt: input.prompt,
          stream: input.stream,
        }),
      });
      const rawText = await response.text();
      if (!response.ok) {
        return {
          content: "",
          error: {
            code: "MODEL_HTTP_ERROR",
            message: rawText,
          },
        };
      }

      const content = extractResponseContent(rawText);
      return {
        content,
        error: {
          code: "",
          message: "",
        },
      };
    } finally {
      this.running = false;
    }
  }

  async *stream(input: ModuleRequest): AsyncIterable<StreamEvent> {
    const response = await this.execute(input);
    const event: ProviderStreamEvent = {
      payload: {
        content: response.content,
        done: true,
        error: response.error.code
          ? response.error
          : undefined,
      },
    };
    yield this.streamingAdapter.adapt(event);
  }
}

function validateModeSelection(modeSelection: ModeSelection): void {
  if (!modeSelection.url || !modeSelection.key || !modeSelection.model) {
    throw new Error("Mode selection must include url, key, and model for non-mock model creation.");
  }
}

function getFetchOverride(mockInfo?: Record<string, unknown>): FetchLike {
  const candidate = mockInfo?.fetchFn;
  if (typeof candidate === "function") {
    return candidate as FetchLike;
  }
  return nodeFetch;
}

function extractResponseContent(rawText: string): string {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (typeof parsed.content === "string") {
    return parsed.content;
  }

  const choices = parsed.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const message = Reflect.get(firstChoice, "message");
      if (message && typeof message === "object") {
        const content = Reflect.get(message, "content");
        if (typeof content === "string") {
          return content;
        }
      }
    }
  }

  throw new Error("Provider response does not contain supported content.");
}

const nodeFetch: FetchLike = async (input, init) => {
  const url = new URL(input);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: init.method,
        headers: init.headers,
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          resolve({
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            status: response.statusCode ?? 500,
            async text() {
              return data;
            },
          });
        });
      },
    );

    request.on("error", reject);
    request.write(init.body);
    request.end();
  });
};

