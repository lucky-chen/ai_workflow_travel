import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { ProviderMcpRegistry } from "./src/provider-mcp-registry.js";

const { McpServer } = (await import(
  resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js")
)) as any;
const { StdioServerTransport } = (await import(
  resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js")
)) as any;
const { default: z } = (await import(resolveWorkspaceModule("../../../../project_layer/projects/sdlc/node_modules/zod/index.js"))) as any;

await loadLocalEnv();

const providerRegistry = new ProviderMcpRegistry();
const server = new McpServer({
  name: "travel-planner-local-mcp",
  version: "0.5.0",
});

registerProviderTravelTools();

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
    toToolResult(
      estimateBudget(
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
    ),
);

await server.connect(new StdioServerTransport());

function registerProviderTravelTools(): void {
  registerProxyTool(
    "googleMaps.geocode",
    "googleMaps",
    "geocode",
    "Geocode address or place input with Google Maps.",
    {
      address: z.string().min(1).optional(),
      latlng: z.string().min(1).optional(),
      place_id: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
    },
  );

  registerProxyTool(
    "googleMaps.findplacefromtext",
    "googleMaps",
    "findplacefromtext",
    "Find places from free text with Google Maps.",
    {
      input: z.string().min(1),
      inputtype: z.string().min(1),
      fields: z.array(z.string().min(1)).optional(),
      locationbias: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
    },
  );

  registerProxyTool(
    "googleMaps.nearbysearch",
    "googleMaps",
    "nearbysearch",
    "Search nearby places with Google Maps Places API.",
    {
      location: z.string().min(1),
      radius: z.number().positive().optional(),
      keyword: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
    },
  );

  registerProxyTool(
    "googleMaps.directions",
    "googleMaps",
    "directions",
    "Get route directions with Google Maps Directions API.",
    {
      origin: z.string().min(1),
      destination: z.string().min(1),
      mode: z.string().min(1).optional(),
      language: z.string().min(1).optional(),
      region: z.string().min(1).optional(),
      units: z.string().min(1).optional(),
    },
  );

  registerProxyTool(
    "amapMaps.maps_geo",
    "amapMaps",
    "maps_geo",
    "Geocode address or POI with AMap.",
    {
      address: z.string().min(1),
      city: z.string().min(1).optional(),
    },
  );

  registerProxyTool(
    "amapMaps.maps_weather",
    "amapMaps",
    "maps_weather",
    "Query city weather with AMap.",
    {
      city: z.string().min(1),
    },
  );

  registerProxyTool(
    "amapMaps.maps_text_search",
    "amapMaps",
    "maps_text_search",
    "Search POIs by keyword with AMap.",
    {
      keywords: z.string().min(1),
      city: z.string().min(1).optional(),
      types: z.string().min(1).optional(),
    },
  );

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
    },
    async (input: unknown) => toToolResult(await searchDuffelFlightOffers(input as Record<string, unknown>)),
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
    },
    async (input: unknown) => toToolResult(await searchHotelbedsHotels(input as Record<string, unknown>)),
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
      toToolResult(
        await providerRegistry.callProviderTool(
          providerName,
          upstreamToolName,
          (input as Record<string, unknown>) ?? {},
        ),
      ),
  );
}

function moneySchema() {
  return z.object({
    amount: z.number().nonnegative(),
    currency: z.string().min(1),
  });
}

function estimateBudget(input: {
  flight_total: { amount: number; currency: string };
  hotel_total: { amount: number; currency: string };
  local_transport_total: { amount: number; currency: string };
  days: number;
  traveler_count: number;
  food_per_day: { amount: number; currency: string };
  activity_buffer: { amount: number; currency: string };
}) {
  const foodTotal = roundToTwo(input.food_per_day.amount * input.days * input.traveler_count);
  const grandTotal = roundToTwo(
    input.flight_total.amount +
      input.hotel_total.amount +
      input.local_transport_total.amount +
      foodTotal +
      input.activity_buffer.amount,
  );
  return {
    status: "ok",
    as_of: new Date().toISOString(),
    summary: {
      transport_total: {
        amount: roundToTwo(input.flight_total.amount + input.local_transport_total.amount),
        currency: input.flight_total.currency,
      },
      lodging_total: input.hotel_total,
      food_total: {
        amount: foodTotal,
        currency: input.food_per_day.currency,
      },
      activity_buffer: input.activity_buffer,
      grand_total: {
        amount: grandTotal,
        currency: input.flight_total.currency,
      },
    },
  };
}

function toToolResult(result: Record<string, unknown> & { status?: string }) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
    isError: result.status === "error",
  };
}

function resolveWorkspaceModule(relativePathFromDist: string): string {
  return new URL(relativePathFromDist, import.meta.url).href;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

async function searchDuffelFlightOffers(input: Record<string, unknown>) {
  try {
    const passengers = [
      ...Array.from({ length: Number(input.adults) }, () => ({ type: "adult" })),
      ...((input.childrenAges as unknown[] | undefined)?.map((age) => ({ age: Number(age) })) ?? []),
    ];

    return providerJsonRequest({
      method: "POST",
      url: `${getDuffelBaseUrl()}/air/offer_requests`,
      provider: "duffelFlights",
      tool: "travel.search_flights",
      argumentsPayload: input,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireEnv("DUFFEL_ACCESS_TOKEN")}`,
        "Duffel-Version": "v2",
      },
      body: {
        data: {
          slices: buildDuffelSlices(input),
          passengers,
          ...(input.cabinClass ? { cabin_class: String(input.cabinClass).toLowerCase() } : {}),
          ...(input.maxConnections !== undefined ? { max_connections: Number(input.maxConnections) } : {}),
        },
      },
    });
  } catch (error) {
    return {
      status: "error",
      provider: "duffelFlights",
      tool: "travel.search_flights",
      arguments: input,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function searchHotelbedsHotels(input: Record<string, unknown>) {
  try {
    const resolvedDestinationCode =
      typeof input.destinationCode === "string" && input.destinationCode
        ? input.destinationCode
        : await resolveHotelbedsDestinationCode(input);

    if (!resolvedDestinationCode && !Array.isArray(input.hotelCodes)) {
      return {
        status: "error",
        provider: "hotelbedsHotels",
        tool: "travel.search_hotels",
        arguments: input,
        message: "One of destinationCode, hotelCodes, or cityName+countryCode is required.",
      };
    }

    const body: Record<string, unknown> = {
      stay: {
        checkIn: String(input.checkInDate),
        checkOut: String(input.checkOutDate),
      },
      occupancies: [
        {
          rooms: Number(input.rooms ?? 1),
          adults: Number(input.adults),
          children: Number(input.children ?? 0),
        },
      ],
    };

    if (resolvedDestinationCode) {
      body.destination = { code: String(resolvedDestinationCode) };
    }
    if (Array.isArray(input.hotelCodes) && input.hotelCodes.length > 0) {
      body.hotels = { hotel: input.hotelCodes.map((item) => Number(item)) };
    }

    return providerJsonRequest({
      method: "POST",
      url: `${getHotelbedsBaseUrl()}/hotel-api/1.0/hotels`,
      provider: "hotelbedsHotels",
      tool: "travel.search_hotels",
      argumentsPayload: input,
      headers: buildHotelbedsHeaders(),
      body,
    });
  } catch (error) {
    return {
      status: "error",
      provider: "hotelbedsHotels",
      tool: "travel.search_hotels",
      arguments: input,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function resolveHotelbedsDestinationCode(input: Record<string, unknown>): Promise<string | undefined> {
  if (!input.cityName || !input.countryCode) {
    return undefined;
  }

  const language = typeof input.language === "string" && input.language ? input.language : "ENG";
  const countryCode = String(input.countryCode).toUpperCase();
  const cityName = normalizeText(String(input.cityName));
  const query = new URLSearchParams({
    fields: "ALL",
    language,
    countryCodes: countryCode,
    limit: "1000",
  });

  const result = await providerJsonRequest({
    method: "GET",
    url: `${getHotelbedsBaseUrl()}/transfer-cache-api/1.0/locations/destinations?${query.toString()}`,
    provider: "hotelbedsHotels",
    tool: "hotelbeds.resolve_destination_code",
    argumentsPayload: {
      cityName: input.cityName,
      countryCode,
      language,
    },
    headers: buildHotelbedsHeaders(),
  });

  if (result.status === "error") {
    throw new Error(
      typeof result.message === "string"
        ? result.message
        : `Destination resolution failed with status ${(result.result as { status_code?: unknown } | undefined)?.status_code ?? "unknown"}`,
    );
  }

  const destinations = extractDestinationItems(result.result);
  const exact = destinations.find((item) => normalizeText(item.name) === cityName || normalizeText(item.code) === cityName);
  if (exact) {
    return exact.code;
  }

  const partial = destinations.find((item) => normalizeText(item.name).includes(cityName) || cityName.includes(normalizeText(item.name)));
  return partial?.code;
}

function extractDestinationItems(result: unknown): Array<{ code: string; name: string }> {
  if (!result || typeof result !== "object") {
    return [];
  }
  const body = (result as { body?: unknown }).body;
  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const code = (item as { code?: unknown }).code;
      const name = (item as { name?: unknown }).name;
      if (typeof code !== "string" || typeof name !== "string") {
        return undefined;
      }
      return { code, name };
    })
    .filter((item): item is { code: string; name: string } => Boolean(item));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

async function providerJsonRequest(input: {
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildDuffelSlices(input: Record<string, unknown>): Array<Record<string, unknown>> {
  const slices: Array<Record<string, unknown>> = [
    {
      origin: String(input.origin),
      destination: String(input.destination),
      departure_date: String(input.departureDate),
    },
  ];

  if (input.returnDate) {
    slices.push({
      origin: String(input.destination),
      destination: String(input.origin),
      departure_date: String(input.returnDate),
    });
  }

  return slices;
}

function getDuffelBaseUrl(): string {
  return process.env.DUFFEL_API_BASE_URL || "https://api.duffel.com";
}

function getHotelbedsBaseUrl(): string {
  return process.env.HOTELBEDS_API_BASE_URL || "https://api.test.hotelbeds.com";
}

function buildHotelbedsHeaders(): Record<string, string> {
  const apiKey = requireEnv("HOTELBEDS_API_KEY");
  const secret = requireEnv("HOTELBEDS_SECRET");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha256").update(`${apiKey}${secret}${timestamp}`).digest("hex");

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Api-key": apiKey,
    "X-Signature": signature,
    "Accept-Encoding": "gzip",
  };
}

async function loadLocalEnv(): Promise<void> {
  const candidates = [
    new URL("./local.env.json", import.meta.url),
    new URL("../local.env.json", import.meta.url),
  ];

  for (const url of candidates) {
    try {
      const raw = await fs.readFile(url, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string" && !process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}
