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
    const normalizedRequest = buildNormalizedRequest(sourceSnapshot.inputSnapshot);
    const toolPlan = buildToolPlan(normalizedRequest);
    await fs.writeFile(
      traceUrl,
      JSON.stringify(
        {
          run_id: RUN_ID,
          generated_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
          file_name: `trace_${RUN_ID}.json`,
          purpose: "Auditable travel-planner execution trace based on input files, rule files, and MCP tool observations.",
          sources: sourceSnapshot.sources,
          input_snapshot: sourceSnapshot.inputSnapshot,
          normalized_request: normalizedRequest,
          tool_plan: toolPlan,
          decision_summary: [],
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
    const decisionSummary = Array.isArray(existing.decision_summary) ? existing.decision_summary : [];
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
    if (event.summary) {
      decisionSummary.push({
        timestamp: new Date().toISOString(),
        decision: event.summary,
      });
    }

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
            "Auditable travel-planner execution trace based on input files, rule files, and MCP tool observations.",
          sources: existing.sources ?? {},
          input_snapshot: existing.input_snapshot ?? null,
          normalized_request: existing.normalized_request ?? null,
          tool_plan: existing.tool_plan ?? [],
          decision_summary: decisionSummary,
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
  inputSnapshot: unknown;
}> {
  const skillUrl = await resolveExistingUrl(baseUrl, ["../../SKILL.md", "../SKILL.md"]);
  const planUrl = await resolveExistingUrl(baseUrl, ["../../references/plan.json", "../references/plan.json"]);
  const schemaUrl = await resolveExistingUrl(baseUrl, ["../../references/plan.schema.json", "../references/plan.schema.json"]);
  const mcpToolsUrl = await resolveExistingUrl(baseUrl, ["../../references/mcp-tools.md", "../references/mcp-tools.md"]);
  const outputFormatUrl = await resolveExistingUrl(baseUrl, ["../../references/output-format.md", "../references/output-format.md"]);

  return {
    sources: {
      ...(skillUrl ? { skill: skillUrl.pathname } : {}),
      ...(planUrl ? { plan_json: planUrl.pathname } : {}),
      ...(schemaUrl ? { plan_schema: schemaUrl.pathname } : {}),
      ...(mcpToolsUrl ? { mcp_tools: mcpToolsUrl.pathname } : {}),
      ...(outputFormatUrl ? { output_format: outputFormatUrl.pathname } : {}),
    },
    inputSnapshot: planUrl ? sanitizeValue(await readJson(planUrl)) : null,
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

function buildNormalizedRequest(inputSnapshot: unknown): Record<string, unknown> {
  const tripRequest =
    inputSnapshot && typeof inputSnapshot === "object"
      ? (inputSnapshot as { trip_request?: unknown }).trip_request
      : undefined;
  if (!tripRequest || typeof tripRequest !== "object") {
    return {};
  }

  const source = tripRequest as Record<string, unknown>;
  return {
    trip_type: source.trip_type ?? null,
    origin: source.origin ?? null,
    destinations: source.destinations ?? [],
    start_date:
      source.travel_dates && typeof source.travel_dates === "object"
        ? (source.travel_dates as { start_date?: unknown }).start_date ?? null
        : null,
    end_date:
      source.travel_dates && typeof source.travel_dates === "object"
        ? (source.travel_dates as { end_date?: unknown }).end_date ?? null
        : null,
    travelers:
      source.travelers && typeof source.travelers === "object"
        ? {
            adults: (source.travelers as { adults?: unknown }).adults ?? null,
            children: (source.travelers as { children?: unknown }).children ?? null,
            rooms: (source.travelers as { rooms?: unknown }).rooms ?? null,
          }
        : null,
    budget: source.budget ?? null,
    pace: source.pace ?? null,
    interests: source.interests ?? [],
    preferred_transport:
      source.trip_preferences && typeof source.trip_preferences === "object"
        ? (source.trip_preferences as { preferred_transport?: unknown }).preferred_transport ?? []
        : [],
  };
}

function buildToolPlan(normalizedRequest: Record<string, unknown>): Array<Record<string, unknown>> {
  const destinations = Array.isArray(normalizedRequest.destinations)
    ? normalizedRequest.destinations.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
  const firstDestination = destinations[0];
  const lastDestination = destinations[destinations.length - 1];
  const origin = normalizedRequest.origin && typeof normalizedRequest.origin === "object"
    ? normalizedRequest.origin as Record<string, unknown>
    : undefined;
  const travelers = normalizedRequest.travelers && typeof normalizedRequest.travelers === "object"
    ? normalizedRequest.travelers as Record<string, unknown>
    : undefined;

  const toolPlan: Array<Record<string, unknown>> = [];

  if (origin && firstDestination) {
    toolPlan.push({
      tool: "travel.search_flights",
      purpose: "search transport options",
      required_input: {
        origin_city: origin.city_name ?? null,
        destination_city: firstDestination.city_name ?? null,
        start_date: normalizedRequest.start_date ?? null,
        end_date: normalizedRequest.end_date ?? null,
        adults: travelers?.adults ?? null,
      },
    });
  }

  if (firstDestination) {
    toolPlan.push({
      tool: "travel.search_hotels",
      purpose: "search lodging options",
      required_input: {
        destination_city: firstDestination.city_name ?? null,
        destination_country: firstDestination.country_code ?? null,
        start_date: normalizedRequest.start_date ?? null,
        end_date: normalizedRequest.end_date ?? null,
        adults: travelers?.adults ?? null,
        rooms: travelers?.rooms ?? null,
      },
    });
    toolPlan.push({
      tool: "travel.search_attractions",
      purpose: "search attraction candidates",
      required_input: {
        city_name: firstDestination.city_name ?? null,
        country_code: firstDestination.country_code ?? null,
        interests: normalizedRequest.interests ?? [],
      },
    });
  }

  if (lastDestination && firstDestination) {
    toolPlan.push({
      tool: "openWeather.getweatherdata",
      purpose: "check weather and seasonal conditions",
      required_input: {
        destination_city: firstDestination.city_name ?? null,
        destination_country: firstDestination.country_code ?? null,
      },
    });
    toolPlan.push({
      tool: "travel.estimate_budget",
      purpose: "reconcile budget after transport and lodging checks",
      required_input: {
        trip_days: inferTripDays(normalizedRequest.start_date, normalizedRequest.end_date),
        traveler_count: travelers?.adults ?? null,
      },
    });
  }

  return toolPlan;
}

function inferTripDays(startDate: unknown, endDate: unknown): number | null {
  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return null;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return days > 0 ? days : null;
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
