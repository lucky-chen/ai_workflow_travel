import fs from "node:fs/promises";
import { RUN_ID } from "./run-context.js";

export async function appendRecord(baseUrl: string, result: Record<string, unknown> & { status?: string }): Promise<void> {
  try {
    const url = resolveRecordFileUrl(baseUrl);
    const existing = await readRecordFile(url);
    const record = {
      timestamp: new Date().toISOString(),
      tool: typeof result.tool === "string" ? result.tool : "unknown",
      provider: typeof result.provider === "string" ? result.provider : "local",
      input: sanitizeRecordValue(result.arguments ?? null),
      output: sanitizeRecordValue(result),
    };
    const records = Array.isArray(existing.records) ? existing.records : [];
    records.push(record);
    await fs.writeFile(
      url,
      JSON.stringify(
        {
          run_id: RUN_ID,
          generated_at: existing.generated_at ?? new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          file_name: `record_${RUN_ID}.json`,
          purpose: existing.purpose ?? "MCP call input/output records captured during local travel-planner testing.",
          records,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {}
}

function resolveRecordFileUrl(baseUrl: string): URL {
  return new URL(`./record_${RUN_ID}.json`, baseUrl);
}

async function readRecordFile(url: URL): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(url, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sanitizeRecordValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRecordValue(item));
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
    out[key] = sanitizeRecordValue(entry);
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
