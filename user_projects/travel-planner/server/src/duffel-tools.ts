import { requireEnv } from "./env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function searchDuffelFlightOffers(input: Record<string, unknown>) {
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
