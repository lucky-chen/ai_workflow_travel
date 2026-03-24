import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

const proxyDispatcher = createProxyDispatcher();

export async function providerJsonRequest(input: {
  method: string;
  url: string;
  provider: string;
  tool: string;
  argumentsPayload: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  try {
    const response = await undiciFetch(input.url, {
      method: input.method,
      dispatcher: proxyDispatcher,
      headers: input.headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}

    if (!response.ok) {
      logProviderHttpError({
        provider: input.provider,
        tool: input.tool,
        method: input.method,
        url: input.url,
        statusCode: response.status,
        body: parsed,
      });
    }

    return {
      status: response.ok ? "ok" : "error",
      provider: input.provider,
      tool: input.tool,
      arguments: input.argumentsPayload,
      result: {
        status_code: response.status,
        body: parsed,
      },
    };
  } catch (error) {
    console.error("[providerJsonRequest] request failed", {
      provider: input.provider,
      tool: input.tool,
      method: input.method,
      url: input.url,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      provider: input.provider,
      tool: input.tool,
      arguments: input.argumentsPayload,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function logProviderHttpError(input: {
  provider: string;
  tool: string;
  method: string;
  url: string;
  statusCode: number;
  body: unknown;
}) {
  console.error("[providerJsonRequest] upstream error", {
    provider: input.provider,
    tool: input.tool,
    method: input.method,
    url: input.url,
    statusCode: input.statusCode,
    bodyPreview: stringifyPreview(input.body),
  });
}

function createProxyDispatcher(): EnvHttpProxyAgent | undefined {
  const hasProxy =
    Boolean(process.env.HTTP_PROXY) ||
    Boolean(process.env.HTTPS_PROXY) ||
    Boolean(process.env.http_proxy) ||
    Boolean(process.env.https_proxy);

  if (!hasProxy) {
    return undefined;
  }

  return new EnvHttpProxyAgent();
}

function stringifyPreview(value: unknown): string {
  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}
