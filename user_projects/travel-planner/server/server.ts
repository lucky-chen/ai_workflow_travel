import { ProviderMcpRegistry } from "./src/provider-mcp-registry.js";
import { RUN_ID } from "./src/run-context.js";
import { loadLocalEnv } from "./src/env-loader.js";
import { appendRecord } from "./src/record-store.js";
import { appendTraceEvent, initializeTrace } from "./src/trace-store.js";
import { estimateBudget } from "./src/budget.js";
import {
  googleDirections,
  googleFindPlaceFromText,
  googleGeocode,
  googleNearbySearch,
} from "./src/google-maps-tools.js";
import { searchDuffelFlightOffers } from "./src/duffel-tools.js";
import { searchHotelbedsHotels } from "./src/hotelbeds-tools.js";
import { searchAttractions } from "./src/travel-attractions.js";

const { McpServer } = (await import(
  resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js")
)) as any;
const { StdioServerTransport } = (await import(
  resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js")
)) as any;
const { default: z } = (await import(resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/zod/index.js"))) as any;

const BASE_URL = import.meta.url;

await loadLocalEnv(BASE_URL);
await initializeTrace(BASE_URL);

const providerRegistry = new ProviderMcpRegistry();
const server = new McpServer({
  name: "travel-planner-local-mcp",
  version: "0.5.0",
});

registerTools();

await server.connect(new StdioServerTransport());

function registerTools(): void {
  server.tool(
    "travel.estimate_budget",
    "Aggregate known cost components into a total trip estimate.",
    {
      flight_total: moneySchema(),
      hotel_total: moneySchema(),
      local_transport_total: moneySchema(),
      days: z.number().int().min(1),
      traveler_count: z.number().int().min(1).default(1),
      food_per_day: moneySchema(),
      activity_buffer: moneySchema(),
    },
  async (input: unknown) =>
    await toToolResult(
      {
        ...estimateBudget(
          input as {
            flight_total: { amount: number; currency: string };
            hotel_total: { amount: number; currency: string };
            local_transport_total: { amount: number; currency: string };
            days: number;
            traveler_count: number;
            food_per_day: { amount: number; currency: string };
            activity_buffer: { amount: number; currency: string };
          },
        ),
        provider: "local",
        tool: "travel.estimate_budget",
        arguments: input as {
          flight_total: { amount: number; currency: string };
          hotel_total: { amount: number; currency: string };
          local_transport_total: { amount: number; currency: string };
          days: number;
          traveler_count: number;
          food_per_day: { amount: number; currency: string };
          activity_buffer: { amount: number; currency: string };
        },
      },
    ),
);

  server.tool(
    "googleMaps.geocode",
    "Geocode address or place input with Google Maps.",
    {
      address: z.string().min(1).optional(),
      latlng: z.string().min(1).optional(),
      place_id: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
    },
    async (input: unknown) => await toToolResult(await googleGeocode(input as Record<string, unknown>)),
  );

  server.tool(
    "googleMaps.findplacefromtext",
    "Find places from free text with Google Maps.",
    {
      input: z.string().min(1),
      inputtype: z.string().min(1),
      fields: z.array(z.string().min(1)).optional(),
      locationbias: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
    },
    async (input: unknown) => await toToolResult(await googleFindPlaceFromText(input as Record<string, unknown>)),
  );

  server.tool(
    "googleMaps.nearbysearch",
    "Search nearby places with Google Maps Places API.",
    {
      location: z.string().min(1),
      radius: z.number().positive().optional(),
      keyword: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
    },
    async (input: unknown) => await toToolResult(await googleNearbySearch(input as Record<string, unknown>)),
  );

  server.tool(
    "googleMaps.directions",
    "Get route directions with Google Maps Directions API.",
    {
      origin: z.string().min(1),
      destination: z.string().min(1),
      mode: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
      units: z.string().min(1).optional(),
    },
    async (input: unknown) => await toToolResult(await googleDirections(input as Record<string, unknown>)),
  );

  registerProxyTool("amapMaps.maps_geo", "amapMaps", "maps_geo", "Geocode address or POI with AMap.", {
    address: z.string().min(1),
    city: z.string().min(1).optional(),
  });

  registerProxyTool("amapMaps.maps_weather", "amapMaps", "maps_weather", "Query city weather with AMap.", {
    city: z.string().min(1),
  });

  registerProxyTool("amapMaps.maps_text_search", "amapMaps", "maps_text_search", "Search POIs by keyword with AMap.", {
    keywords: z.string().min(1),
    city: z.string().min(1).optional(),
    types: z.string().min(1).optional(),
  });

  registerProxyTool(
    "amapMaps.maps_search_detail",
    "amapMaps",
    "maps_search_detail",
    "Get AMap POI detail by POI id.",
    {
      id: z.string().min(1),
    },
  );

  registerProxyTool(
    "amapMaps.maps_direction_transit_integrated",
    "amapMaps",
    "maps_direction_transit_integrated",
    "Get integrated public transit route with AMap.",
    {
      origin: z.string().min(1),
      destination: z.string().min(1),
      city: z.string().min(1),
      cityd: z.string().min(1),
    },
  );

  registerProxyTool(
    "openWeather.getweatherdata",
    "openWeather",
    "getweatherdata",
    "Get current, hourly, and daily forecast by latitude and longitude.",
    {
      lat: z.number(),
      lon: z.number(),
      appid: z.string().min(1),
    },
  );

  server.tool(
    "travel.search_flights",
    "Search flight offers through the configured flight provider.",
    {
      origin: z.string().min(1),
      destination: z.string().min(1),
      departureDate: z.string().min(1),
      returnDate: z.string().min(1).optional(),
      adults: z.number().int().min(1),
      childrenAges: z.array(z.number().int().min(0).max(17)).optional(),
      cabinClass: z.string().min(1).optional(),
      maxConnections: z.number().int().min(0).max(4).optional(),
      limit: z.number().int().min(1).max(20).optional(),
      sortBy: z.enum(["price", "duration", "departure_time"]).optional(),
    },
    async (input: unknown) => await toToolResult(await searchDuffelFlightOffers(input as Record<string, unknown>)),
  );

  server.tool(
    "travel.search_hotels",
    "Search hotels through the configured hotel provider.",
    {
      destinationCode: z.string().min(1).optional(),
      hotelCodes: z.array(z.number().int().positive()).optional(),
      cityName: z.string().min(1).optional(),
      countryCode: z.string().min(2).max(2).optional(),
      adults: z.number().int().min(1),
      checkInDate: z.string().min(1),
      checkOutDate: z.string().min(1),
      children: z.number().int().min(0).optional(),
      rooms: z.number().int().min(1).optional(),
      language: z.string().min(1).optional(),
      maxHotels: z.number().int().min(1).max(20).optional(),
      sortBy: z.enum(["price", "star_rating", "distance_to_center", "area"]).optional(),
      preferredAreas: z.array(z.string().min(1)).optional(),
    },
    async (input: unknown) => await toToolResult(await searchHotelbedsHotels(input as Record<string, unknown>)),
  );

  server.tool(
    "travel.search_attractions",
    "Search attraction candidates for a destination through the configured map provider.",
    {
      cityName: z.string().min(1),
      countryCode: z.string().min(2).max(2),
      keyword: z.string().min(1).optional(),
      interests: z.array(z.string().min(1)).optional(),
      limit: z.number().int().min(1).max(20).optional(),
      radius: z.number().int().min(1).max(50000).optional(),
      language: z.string().min(1).optional(),
      sortBy: z.enum(["relevance", "distance", "rating"]).optional(),
    },
    async (input: unknown) =>
      await toToolResult(await searchAttractions(input as Record<string, unknown>, providerRegistry)),
  );
}

function registerProxyTool(
  localName: string,
  providerName: string,
  upstreamToolName: string,
  description: string,
  inputSchema: Record<string, any>,
): void {
  server.tool(
    localName,
    description,
    inputSchema,
    async (input: unknown) =>
      await toToolResult(
        await providerRegistry.callProviderTool(
          providerName,
          upstreamToolName,
          (input as Record<string, unknown>) ?? {},
        ),
      ),
  );
}

async function toToolResult(result: Record<string, unknown> & { status?: string }) {
  const resultWithRunId: Record<string, unknown> & { status?: string; run_id: string } = {
    run_id: RUN_ID,
    ...result,
  };
  await appendRecord(BASE_URL, resultWithRunId);
  await appendTraceEvent(BASE_URL, {
    event_type: "tool_result_recorded",
    tool: typeof resultWithRunId.tool === "string" ? resultWithRunId.tool : undefined,
    provider: typeof resultWithRunId.provider === "string" ? resultWithRunId.provider : undefined,
    status: typeof resultWithRunId.status === "string" ? resultWithRunId.status : undefined,
    input: resultWithRunId.arguments,
    summary: buildTraceSummary(resultWithRunId),
    observation: buildTraceObservation(resultWithRunId),
  });
  return {
    content: [{ type: "text" as const, text: JSON.stringify(resultWithRunId, null, 2) }],
    structuredContent: resultWithRunId,
    isError: resultWithRunId.status === "error",
  };
}

function buildTraceSummary(result: Record<string, unknown>): string {
  const tool = typeof result.tool === "string" ? result.tool : "unknown";
  const status = typeof result.status === "string" ? result.status : "unknown";
  const provider = typeof result.provider === "string" ? result.provider : "unknown";
  return `${tool} completed with status=${status} via provider=${provider}.`;
}

function buildTraceObservation(result: Record<string, unknown>): Record<string, unknown> {
  const observation: Record<string, unknown> = {};
  const rawResult = result.result;
  if (rawResult && typeof rawResult === "object") {
    const statusCode = (rawResult as { status_code?: unknown }).status_code;
    if (statusCode !== undefined) {
      observation.status_code = statusCode;
    }

    const body = (rawResult as { body?: unknown }).body;
    if (body && typeof body === "object") {
      if (Array.isArray((body as { offers?: unknown[] }).offers)) {
        observation.offer_count = (body as { offers: unknown[] }).offers.length;
      }
      if (typeof (body as { total?: unknown }).total === "number") {
        observation.total = (body as { total: number }).total;
      }
      if (Array.isArray((body as { results?: unknown[] }).results)) {
        observation.result_count = (body as { results: unknown[] }).results.length;
      }
      if (typeof (body as { status?: unknown }).status === "string") {
        observation.provider_status = (body as { status: string }).status;
      }
    }
  }

  if (typeof result.message === "string") {
    observation.message = result.message;
  }

  return observation;
}

function moneySchema() {
  return z.object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
  });
}

function resolveWorkspaceModule(relativePathFromDist: string): string {
  return new URL(relativePathFromDist, import.meta.url).href;
}
