import { createHash } from "node:crypto";
import { requireEnv } from "./env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function searchHotelbedsHotels(input: Record<string, unknown>) {
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
