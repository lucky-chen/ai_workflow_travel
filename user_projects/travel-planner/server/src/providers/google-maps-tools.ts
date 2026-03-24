import { requireEnv } from "../runtime/env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function googleGeocode(input: Record<string, unknown>) {
  const query = new URLSearchParams({
    key: requireEnv("GOOGLE_MAPS_API_KEY"),
    ...(input.address ? { address: String(input.address) } : {}),
    ...(input.latlng ? { latlng: String(input.latlng) } : {}),
    ...(input.place_id ? { place_id: String(input.place_id) } : {}),
    ...(input.language ? { language: String(input.language) } : {}),
    ...(input.region ? { region: String(input.region) } : {}),
  });

  return providerJsonRequest({
    method: "GET",
    url: `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`,
    provider: "googleMaps",
    tool: "geocode",
    argumentsPayload: input,
  });
}

export async function googleFindPlaceFromText(input: Record<string, unknown>) {
  const query = new URLSearchParams({
    key: requireEnv("GOOGLE_MAPS_API_KEY"),
    input: String(input.input),
    inputtype: String(input.inputtype),
    ...(Array.isArray(input.fields) ? { fields: input.fields.map(String).join(",") } : {}),
    ...(input.locationbias ? { locationbias: String(input.locationbias) } : {}),
    ...(input.language ? { language: String(input.language) } : {}),
  });

  return providerJsonRequest({
    method: "GET",
    url: `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${query.toString()}`,
    provider: "googleMaps",
    tool: "findplacefromtext",
    argumentsPayload: input,
  });
}

export async function googleNearbySearch(input: Record<string, unknown>) {
  const query = new URLSearchParams({
    key: requireEnv("GOOGLE_MAPS_API_KEY"),
    location: String(input.location),
    ...(input.radius !== undefined ? { radius: String(input.radius) } : {}),
    ...(input.keyword ? { keyword: String(input.keyword) } : {}),
    ...(input.type ? { type: String(input.type) } : {}),
    ...(input.language ? { language: String(input.language) } : {}),
  });

  return providerJsonRequest({
    method: "GET",
    url: `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${query.toString()}`,
    provider: "googleMaps",
    tool: "nearbysearch",
    argumentsPayload: input,
  });
}

export async function googleDirections(input: Record<string, unknown>) {
  const query = new URLSearchParams({
    key: requireEnv("GOOGLE_MAPS_API_KEY"),
    origin: String(input.origin),
    destination: String(input.destination),
    ...(input.mode ? { mode: String(input.mode) } : {}),
    ...(input.language ? { language: String(input.language) } : {}),
    ...(input.region ? { region: String(input.region) } : {}),
    ...(input.units ? { units: String(input.units) } : {}),
  });

  return providerJsonRequest({
    method: "GET",
    url: `https://maps.googleapis.com/maps/api/directions/json?${query.toString()}`,
    provider: "googleMaps",
    tool: "directions",
    argumentsPayload: input,
  });
}
