import { googleGeocode, googleNearbySearch } from "./google-maps-tools.js";
import type { ProviderMcpRegistry } from "./provider-mcp-registry.js";

export async function searchAttractions(
  input: Record<string, unknown>,
  providerRegistry: ProviderMcpRegistry,
): Promise<Record<string, unknown>> {
  const cityName = readRequiredString(input, "cityName");
  const countryCode = readRequiredString(input, "countryCode").toUpperCase();
  const limit = readPositiveInt(input.limit, 5);
  const sortBy = readAttractionSort(input.sortBy);
  const keyword = buildSearchKeyword(input);

  if (countryCode === "CN") {
    return await searchWithAmap({
      cityName,
      countryCode,
      keyword,
      limit,
      sortBy,
      providerRegistry,
      input,
    });
  }

  return await searchWithGoogle({
    cityName,
    countryCode,
    keyword,
    limit,
    sortBy,
    input,
  });
}

async function searchWithAmap(args: {
  cityName: string;
  countryCode: string;
  keyword: string;
  limit: number;
  sortBy: "relevance" | "distance" | "rating";
  providerRegistry: ProviderMcpRegistry;
  input: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const providerResult = await args.providerRegistry.callProviderTool("amapMaps", "maps_text_search", {
    keywords: args.keyword,
    city: args.cityName,
  });

  if (providerResult.status === "error") {
    return {
      status: "error",
      provider: "amapMaps",
      tool: "travel.search_attractions",
      arguments: args.input,
      message: providerResult.message ?? "AMap attraction search failed.",
    };
  }

  const pois = sortAmapPois(extractAmapPois(providerResult.result), args.sortBy).slice(0, args.limit);
  return {
    status: "ok",
    provider: "amapMaps",
    tool: "travel.search_attractions",
    arguments: args.input,
    result: {
      cityName: args.cityName,
      countryCode: args.countryCode,
      keyword: args.keyword,
      sortBy: args.sortBy,
      attractions: pois,
    },
  };
}

async function searchWithGoogle(args: {
  cityName: string;
  countryCode: string;
  keyword: string;
  limit: number;
  sortBy: "relevance" | "distance" | "rating";
  input: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const geocodeResult = await googleGeocode({
    address: `${args.cityName}`,
    region: args.countryCode.toLowerCase(),
    language: typeof args.input.language === "string" ? args.input.language : "en",
  });

  if (geocodeResult.status === "error") {
    return {
      status: "error",
      provider: "googleMaps",
      tool: "travel.search_attractions",
      arguments: args.input,
      message: geocodeResult.message ?? "Google geocode failed.",
    };
  }

  const location = extractGoogleLatLng(geocodeResult.result);
  if (!location) {
    return {
      status: "error",
      provider: "googleMaps",
      tool: "travel.search_attractions",
      arguments: args.input,
      message: "Google geocode did not return a usable location.",
    };
  }

  const nearbyResult = await googleNearbySearch({
    location,
    radius: Number(args.input.radius ?? 5000),
    keyword: args.keyword,
    type: "tourist_attraction",
    language: typeof args.input.language === "string" ? args.input.language : "en",
  });

  if (nearbyResult.status === "error") {
    return {
      status: "error",
      provider: "googleMaps",
      tool: "travel.search_attractions",
      arguments: args.input,
      message: nearbyResult.message ?? "Google nearby search failed.",
    };
  }

  const attractions = sortGooglePlaces(extractGooglePlaces(nearbyResult.result), args.sortBy).slice(0, args.limit);
  return {
    status: "ok",
    provider: "googleMaps",
    tool: "travel.search_attractions",
    arguments: args.input,
    result: {
      cityName: args.cityName,
      countryCode: args.countryCode,
      keyword: args.keyword,
      sortBy: args.sortBy,
      center: location,
      attractions,
    },
  };
}

function buildSearchKeyword(input: Record<string, unknown>): string {
  const explicitKeyword = typeof input.keyword === "string" && input.keyword.trim().length > 0
    ? input.keyword.trim()
    : undefined;
  if (explicitKeyword) {
    return explicitKeyword;
  }

  const interests = Array.isArray(input.interests)
    ? input.interests.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];

  if (interests.length > 0) {
    return interests[0]!;
  }

  return "tourist attractions";
}

function readRequiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`travel.search_attractions requires a non-empty string field "${key}".`);
  }
  return value.trim();
}

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function readAttractionSort(value: unknown): "relevance" | "distance" | "rating" {
  if (value === "distance" || value === "rating") {
    return value;
  }
  return "relevance";
}

function extractAmapPois(result: unknown): Array<Record<string, unknown>> {
  const text = extractProviderText(result);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as { pois?: unknown[] };
    return (parsed.pois ?? [])
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: item.id,
        name: item.name,
        address: item.address,
        typecode: item.typecode,
      }));
  } catch {
    return [];
  }
}

function sortAmapPois(
  pois: Array<Record<string, unknown>>,
  sortBy: "relevance" | "distance" | "rating",
): Array<Record<string, unknown>> {
  if (sortBy === "rating" || sortBy === "distance") {
    return [...pois];
  }
  return pois;
}

function extractGoogleLatLng(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const body = (result as { body?: unknown }).body;
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const results = (body as { results?: unknown[] }).results;
  const first = Array.isArray(results) ? results[0] : undefined;
  if (!first || typeof first !== "object") {
    return undefined;
  }
  const geometry = (first as { geometry?: unknown }).geometry;
  const location = geometry && typeof geometry === "object" ? (geometry as { location?: unknown }).location : undefined;
  const lat = location && typeof location === "object" ? (location as { lat?: unknown }).lat : undefined;
  const lng = location && typeof location === "object" ? (location as { lng?: unknown }).lng : undefined;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return undefined;
  }
  return `${lat},${lng}`;
}

function extractGooglePlaces(result: unknown): Array<Record<string, unknown>> {
  if (!result || typeof result !== "object") {
    return [];
  }
  const body = (result as { body?: unknown }).body;
  if (!body || typeof body !== "object") {
    return [];
  }
  const places = (body as { results?: unknown[] }).results;
  if (!Array.isArray(places)) {
    return [];
  }

  return places
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      place_id: item.place_id,
      name: item.name,
      vicinity: item.vicinity,
      rating: item.rating,
      types: item.types,
      geometry: item.geometry,
    }));
}

function sortGooglePlaces(
  places: Array<Record<string, unknown>>,
  sortBy: "relevance" | "distance" | "rating",
): Array<Record<string, unknown>> {
  const copy = [...places];
  if (sortBy === "rating") {
    copy.sort((left, right) => numberOrZero(right.rating) - numberOrZero(left.rating));
  }
  return copy;
}

function extractProviderText(result: unknown): string | undefined {
  if (!Array.isArray(result) || result.length === 0) {
    return undefined;
  }
  const first = result[0];
  if (!first || typeof first !== "object") {
    return undefined;
  }
  const text = (first as { text?: unknown }).text;
  return typeof text === "string" ? text : undefined;
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
