import { createHash } from "node:crypto";
import { requireEnv } from "./env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function searchHotelbedsHotels(input: Record<string, unknown>) {
  try {
    const maxHotels = readPositiveInt(input.maxHotels, 5);
    const sortBy = readHotelSort(input.sortBy);
    const preferredAreas = readPreferredAreas(input.preferredAreas);
    const resolvedDestinationCode =
      typeof input.destinationCode === "string" && input.destinationCode
        ? input.destinationCode
        : await resolveHotelbedsDestinationCode(input);
    const limitedHotelCodes =
      Array.isArray(input.hotelCodes) && input.hotelCodes.length > 0
        ? input.hotelCodes.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : await resolveLimitedHotelCodes(resolvedDestinationCode, input, maxHotels);

    if (!resolvedDestinationCode && limitedHotelCodes.length === 0) {
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

    if (resolvedDestinationCode && limitedHotelCodes.length === 0) {
      body.destination = { code: String(resolvedDestinationCode) };
    }
    if (limitedHotelCodes.length > 0) {
      body.hotels = { hotel: limitedHotelCodes.slice(0, maxHotels) };
    }

    const providerResult = await providerJsonRequest({
      method: "POST",
      url: `${getHotelbedsBaseUrl()}/hotel-api/1.0/hotels`,
      provider: "hotelbedsHotels",
      tool: "travel.search_hotels",
      argumentsPayload: input,
      headers: buildHotelbedsHeaders(),
      body,
    });

    if (providerResult.status === "error") {
      return summarizeHotelbedsError(providerResult, {
        ...input,
        maxHotels,
        sortBy,
        preferredAreas,
      });
    }

    return {
      status: "ok",
      provider: "hotelbedsHotels",
      tool: "travel.search_hotels",
      arguments: {
        ...input,
        maxHotels,
        sortBy,
        preferredAreas,
      },
      result: summarizeHotelbedsHotels(providerResult.result, {
        maxHotels,
        sortBy,
        preferredAreas,
      }),
    };
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

async function resolveLimitedHotelCodes(
  destinationCode: string | undefined,
  input: Record<string, unknown>,
  maxHotels: number,
): Promise<number[]> {
  if (!destinationCode) {
    return [];
  }

  const language = typeof input.language === "string" && input.language ? input.language : "ENG";
  const query = new URLSearchParams({
    fields: "ALL",
    language,
    destinationCodes: destinationCode,
    offset: "0",
    limit: String(maxHotels),
  });

  const result = await providerJsonRequest({
    method: "GET",
    url: `${getHotelbedsBaseUrl()}/transfer-cache-api/1.0/hotels?${query.toString()}`,
    provider: "hotelbedsHotels",
    tool: "hotelbeds.list_hotels",
    argumentsPayload: {
      destinationCode,
      language,
      maxHotels,
    },
    headers: buildHotelbedsHeaders(),
  });

  if (result.status === "error") {
    return [];
  }

  const body = extractBody(result.result);
  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }
      const code = (item as { code?: unknown }).code;
      const numericCode = Number(code);
      return Number.isFinite(numericCode) ? numericCode : undefined;
    })
    .filter((item): item is number => item !== undefined)
    .slice(0, maxHotels);
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

function getHotelbedsBaseUrl(): string {
  return process.env.HOTELBEDS_API_BASE_URL || "https://api.test.hotelbeds.com";
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function summarizeHotelbedsHotels(
  result: unknown,
  options: {
    maxHotels: number;
    sortBy: "price" | "star_rating" | "distance_to_center" | "area";
    preferredAreas: string[];
  },
): Record<string, unknown> {
  const body = extractBody(result);
  const data = body && typeof body === "object" ? (body as { hotels?: unknown; checkIn?: unknown; checkOut?: unknown; total?: unknown }) : {};
  const hotels = data.hotels && typeof data.hotels === "object" && Array.isArray((data.hotels as { hotels?: unknown[] }).hotels)
    ? (data.hotels as { hotels: unknown[] }).hotels
    : [];

  const summarized = hotels.map((hotel) => summarizeHotelbedsHotel(hotel));
  const areaFiltered = filterHotelsByPreferredAreas(summarized, options.preferredAreas);
  const sorted = sortHotels(areaFiltered, options.sortBy);
  const items = sorted.slice(0, options.maxHotels);
  return {
    checkIn: data.checkIn ?? null,
    checkOut: data.checkOut ?? null,
    total: typeof data.total === "number" ? data.total : items.length,
    returned_count: items.length,
    items,
  };
}

function summarizeHotelbedsHotel(hotel: unknown): Record<string, unknown> {
  if (!hotel || typeof hotel !== "object") {
    return {};
  }
  const data = hotel as Record<string, unknown>;
  return {
    code: data.code ?? null,
    name: data.name ?? null,
    categoryName: data.categoryName ?? null,
    destinationName: data.destinationName ?? null,
    zoneName: data.zoneName ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    minRate: data.minRate ?? null,
    maxRate: data.maxRate ?? null,
    currency: data.currency ?? null,
    starRating: parseStarRating(data.categoryCode, data.categoryName),
    rooms: summarizeHotelbedsRooms(data.rooms),
  };
}

function summarizeHotelbedsRooms(rooms: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rooms)) {
    return [];
  }
  return rooms.slice(0, 2).map((room) => {
    if (!room || typeof room !== "object") {
      return {};
    }
    const data = room as Record<string, unknown>;
    const rates = Array.isArray(data.rates) ? data.rates : [];
    return {
      code: data.code ?? null,
      name: data.name ?? null,
      rates: rates.slice(0, 2).map((rate) => summarizeHotelbedsRate(rate)),
    };
  });
}

function summarizeHotelbedsRate(rate: unknown): Record<string, unknown> {
  if (!rate || typeof rate !== "object") {
    return {};
  }
  const data = rate as Record<string, unknown>;
  return {
    rateClass: data.rateClass ?? null,
    rateType: data.rateType ?? null,
    net: data.net ?? null,
    boardName: data.boardName ?? null,
    paymentType: data.paymentType ?? null,
    cancellationPolicies: Array.isArray(data.cancellationPolicies) ? data.cancellationPolicies : [],
  };
}

function readHotelSort(value: unknown): "price" | "star_rating" | "distance_to_center" | "area" {
  if (value === "star_rating" || value === "distance_to_center" || value === "area") {
    return value;
  }
  return "price";
}

function readPreferredAreas(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function filterHotelsByPreferredAreas(
  hotels: Array<Record<string, unknown>>,
  preferredAreas: string[],
): Array<Record<string, unknown>> {
  if (preferredAreas.length === 0) {
    return hotels;
  }
  const normalizedAreas = preferredAreas.map((item) => normalizeText(item));
  const matched = hotels.filter((hotel) => {
    const zoneName = typeof hotel.zoneName === "string" ? normalizeText(hotel.zoneName) : "";
    return normalizedAreas.some((area) => zoneName.includes(area) || area.includes(zoneName));
  });
  return matched.length > 0 ? matched : hotels;
}

function sortHotels(
  hotels: Array<Record<string, unknown>>,
  sortBy: "price" | "star_rating" | "distance_to_center" | "area",
): Array<Record<string, unknown>> {
  const copy = [...hotels];
  copy.sort((left, right) => compareHotels(left, right, sortBy));
  return copy;
}

function compareHotels(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  sortBy: "price" | "star_rating" | "distance_to_center" | "area",
): number {
  if (sortBy === "star_rating") {
    return numberOrZero(right.starRating) - numberOrZero(left.starRating);
  }
  if (sortBy === "area") {
    return stringOrEmpty(left.zoneName).localeCompare(stringOrEmpty(right.zoneName));
  }
  if (sortBy === "distance_to_center") {
    return stringOrEmpty(left.zoneName).localeCompare(stringOrEmpty(right.zoneName));
  }
  return numberOrInfinity(left.minRate) - numberOrInfinity(right.minRate);
}

function parseStarRating(categoryCode: unknown, categoryName: unknown): number | null {
  const code = typeof categoryCode === "string" ? categoryCode : "";
  const name = typeof categoryName === "string" ? categoryName : "";
  const match = code.match(/^(\d)/) ?? name.match(/^(\d)/);
  return match ? Number(match[1]) : null;
}

function numberOrInfinity(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function summarizeHotelbedsError(
  result: { provider: string; tool: string; message?: string; result?: unknown },
  input: Record<string, unknown>,
) {
  return {
    status: "error",
    provider: result.provider,
    tool: result.tool,
    arguments: input,
    message: result.message ?? "Hotelbeds request failed.",
    result: {
      status_code:
        result.result && typeof result.result === "object"
          ? (result.result as { status_code?: unknown }).status_code ?? null
          : null,
    },
  };
}

function extractBody(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  return (result as { body?: unknown }).body;
}
