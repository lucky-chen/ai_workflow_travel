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
        signal: controller?.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      return (await response.json()) as TResponse;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private getFetch(): FetchLike {
    return this.fetchFn ?? getDefaultFetch();
  }
}

function getDefaultFetch(): FetchLike {
  const fetchFn = globalThis.fetch as FetchLike | undefined;
  if (!fetchFn) {
    return createNodeFetchFallback();
  }

  return fetchFn;
}

function createNodeFetchFallback(): FetchLike {
  return async (input, init) =>
    new Promise<FetchResponseLike>((resolve, reject) => {
      const url = new URL(input);
      const client = url.protocol === "https:" ? https : http;

      const request = client.request(
        url,
        {
          method: init.method,
          headers: init.headers,
        },
        (response) => {
          const chunks: Buffer[] = [];

          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          response.on("end", () => {
            const bodyText = Buffer.concat(chunks).toString("utf8");
            resolve({
              ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
              status: response.statusCode ?? 500,
              async text() {
                return bodyText;
              },
              async json() {
                return JSON.parse(bodyText);
              },
            });
          });
        },
      );

      request.on("error", reject);

      if (init.signal) {
        const abortHandler = () => {
          request.destroy(new Error("Request aborted."));
        };

        if (init.signal.aborted) {
          abortHandler();
          return;
        }

        init.signal.addEventListener("abort", abortHandler, { once: true });
        request.on("close", () => {
          init.signal?.removeEventListener("abort", abortHandler);
        });
      }

      request.write(init.body);
      request.end();
    });
}
