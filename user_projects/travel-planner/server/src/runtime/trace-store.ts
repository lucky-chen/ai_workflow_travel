import fs from "node:fs/promises";
import { RUN_ID } from "./run-context.js";

export async function initializeTrace(baseUrl: string): Promise<void> {
  try {
    const traceUrl = resolveTraceFileUrl(baseUrl);
    const existing = await readJson(traceUrl);
    if (Array.isArray(existing.events)) {
      return;
    }

    const sourceSnapshot = await loadSourceSnapshot(baseUrl);
    await fs.writeFile(
      traceUrl,
      JSON.stringify(
        {
          run_id: RUN_ID,
          generated_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          file_name: `trace_${RUN_ID}.json`,
          purpose: "Auditable Provider MCP execution trace based on provider-facing MCP calls and local configuration sources.",
          sources: sourceSnapshot.sources,
          service_scope: {
            layer: "Provider MCP Layer",
            responsibility: "Expose provider-facing MCP tools and isolate provider access concerns.",
          },
          events: [],
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {}
}

export async function appendTraceEvent(
  baseUrl: string,
  event: {
    event_type: string;
    tool?: string;
    provider?: string;
    status?: string;
    input?: unknown;
    summary?: string;
    observation?: unknown;
  },
): Promise<void> {
  try {
    const traceUrl = resolveTraceFileUrl(baseUrl);
    const existing = await readJson(traceUrl);
    const events = Array.isArray(existing.events) ? existing.events : [];
    events.push({
      timestamp: new Date().toISOString(),
      event_type: event.event_type,
      ...(event.tool ? { tool: event.tool } : {}),
      ...(event.provider ? { provider: event.provider } : {}),
      ...(event.status ? { status: event.status } : {}),
      ...(event.summary ? { summary: event.summary } : {}),
      ...(event.input !== undefined ? { input: sanitizeValue(event.input) } : {}),
      ...(event.observation !== undefined ? { observation: sanitizeValue(event.observation) } : {}),
    });

    await fs.writeFile(
      traceUrl,
      JSON.stringify(
        {
          run_id: RUN_ID,
          generated_at: existing.generated_at ?? new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          file_name: `trace_${RUN_ID}.json`,
          purpose:
            existing.purpose ??
            "Auditable Provider MCP execution trace based on provider-facing MCP calls and local configuration sources.",
          sources: existing.sources ?? {},
          service_scope: existing.service_scope ?? {
            layer: "Provider MCP Layer",
            responsibility: "Expose provider-facing MCP tools and isolate provider access concerns.",
          },
          events,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {}
}

function resolveTraceFileUrl(baseUrl: string): URL {
  return new URL(`./trace_${RUN_ID}.json`, baseUrl);
}

async function loadSourceSnapshot(baseUrl: string): Promise<{
  sources: Record<string, string>;
}> {
  const architectureUrl = await resolveExistingUrl(baseUrl, ["../../ARCHITECTURE.md", "../ARCHITECTURE.md"]);
  const mcpToolsUrl = await resolveExistingUrl(baseUrl, ["../../references/mcp-tools.md", "../references/mcp-tools.md"]);
  const localEnvExampleUrl = await resolveExistingUrl(baseUrl, ["../../server/local.env.example.json", "../local.env.example.json"]);

  return {
    sources: {
      ...(architectureUrl ? { architecture: architectureUrl.pathname } : {}),
      ...(mcpToolsUrl ? { mcp_tools: mcpToolsUrl.pathname } : {}),
      ...(localEnvExampleUrl ? { local_env_example: localEnvExampleUrl.pathname } : {}),
    },
  };
}

async function resolveExistingUrl(baseUrl: string, candidates: string[]): Promise<URL | undefined> {
  for (const candidate of candidates) {
    const url = new URL(candidate, baseUrl);
    try {
      await fs.access(url);
      return url;
    } catch {}
  }
  return undefined;
}

async function readJson(url: URL): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(url, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretKey(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitizeValue(entry);
  }
  return out;
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("appid") ||
    normalized.includes("api_key") ||
    normalized === "key" ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized === "authorization"
  );
}
