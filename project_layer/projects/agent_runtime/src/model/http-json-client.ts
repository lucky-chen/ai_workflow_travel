import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
  },
) => Promise<FetchResponseLike>;

export class HttpJsonClient {
  constructor(private readonly fetchFn?: FetchLike) {}

  async postJson<TRequest, TResponse>(
    url: string,
    options: {
      headers: Record<string, string>;
      body: TRequest;
      timeoutMs?: number;
    },
  ): Promise<TResponse> {
    const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
    const timeoutId =
      controller && options.timeoutMs
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : undefined;

    try {
      const response = await this.getFetch()(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...options.headers,
        },
        body: JSON.stringify(options.body),
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`HTTP request failed with status ${response.status}: ${responseText}`);
      }

      return await response.json() as TResponse;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private getFetch(): FetchLike {
    return this.fetchFn ?? nodeFetch;
  }
}

const nodeFetch: FetchLike = async (input, init) => {
  const targetUrl = new URL(input);
  const transport = targetUrl.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      targetUrl,
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
            async json() {
              return JSON.parse(data);
            },
          });
        });
      },
    );

    request.on("error", reject);
    if (init.signal) {
      init.signal.addEventListener("abort", () => {
        request.destroy(new Error("Request aborted."));
      });
    }
    request.write(init.body);
    request.end();
  });
};
