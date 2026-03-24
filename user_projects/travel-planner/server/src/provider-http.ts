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
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}

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
    return {
      status: "error",
      provider: input.provider,
      tool: input.tool,
      arguments: input.argumentsPayload,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
