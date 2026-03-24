import { requireEnv } from "./env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function searchDuffelFlightOffers(input: Record<string, unknown>) {
  try {
    const limit = readPositiveInt(input.limit, 5);
    const sortBy = readFlightSort(input.sortBy);
    const passengers = [
      ...Array.from({ length: Number(input.adults) }, () => ({ type: "adult" })),
      ...((input.childrenAges as unknown[] | undefined)?.map((age) => ({ age: Number(age) })) ?? []),
    ];

    const createResult = await providerJsonRequest({
      method: "POST",
      url: `${getDuffelBaseUrl()}/air/offer_requests?return_offers=false`,
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

    if (createResult.status === "error") {
      return summarizeDuffelError(createResult, input);
    }

    const offerRequestId = extractOfferRequestId(createResult.result);
    if (!offerRequestId) {
      return {
        status: "error",
        provider: "duffelFlights",
        tool: "travel.search_flights",
        arguments: input,
        message: "Duffel did not return an offer request id.",
      };
    }

    const query = new URLSearchParams({
      offer_request_id: offerRequestId,
      limit: String(limit),
      sort: sortBy,
      ...(input.maxConnections !== undefined ? { max_connections: String(Number(input.maxConnections)) } : {}),
    });

    const offersResult = await providerJsonRequest({
      method: "GET",
      url: `${getDuffelBaseUrl()}/air/offers?${query.toString()}`,
      provider: "duffelFlights",
      tool: "travel.search_flights",
      argumentsPayload: input,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireEnv("DUFFEL_ACCESS_TOKEN")}`,
        "Duffel-Version": "v2",
      },
    });

    if (offersResult.status === "error") {
      return summarizeDuffelError(offersResult, input);
    }

    return {
      status: "ok",
      provider: "duffelFlights",
      tool: "travel.search_flights",
      arguments: {
        ...input,
        limit,
        sortBy,
      },
      result: summarizeDuffelOffers(offerRequestId, offersResult.result, limit),
    };
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

function readPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function extractOfferRequestId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const body = (result as { body?: unknown }).body;
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const id = (data as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function readFlightSort(value: unknown): "total_amount" | "total_duration" {
  if (value === "duration") {
    return "total_duration";
  }
  return "total_amount";
}

function summarizeDuffelOffers(offerRequestId: string, result: unknown, limit: number): Record<string, unknown> {
  const body = extractBody(result);
  const offers = Array.isArray(body?.data) ? body.data : [];

  const items = offers.slice(0, limit).map((offer) => summarizeDuffelOffer(offer));
  return {
    offer_request_id: offerRequestId,
    returned_count: items.length,
    items,
  };
}

function summarizeDuffelOffer(offer: unknown): Record<string, unknown> {
  if (!offer || typeof offer !== "object") {
    return {};
  }

  const data = offer as Record<string, unknown>;
  const slices = Array.isArray(data.slices) ? data.slices : [];
  return {
    id: data.id ?? null,
    total_amount: data.total_amount ?? null,
    total_currency: data.total_currency ?? null,
    tax_amount: data.tax_amount ?? null,
    expires_at: data.expires_at ?? null,
    total_duration: summarizeDuffelDurations(slices),
    slices: slices.map((slice) => summarizeDuffelSlice(slice)),
  };
}

function summarizeDuffelSlice(slice: unknown): Record<string, unknown> {
  if (!slice || typeof slice !== "object") {
    return {};
  }

  const data = slice as Record<string, unknown>;
  const segments = Array.isArray(data.segments) ? data.segments : [];
  return {
    origin: summarizeAirport(data.origin),
    destination: summarizeAirport(data.destination),
    duration: data.duration ?? null,
    segment_count: segments.length,
    segments: segments.map((segment) => summarizeDuffelSegment(segment)),
  };
}

function summarizeDuffelSegment(segment: unknown): Record<string, unknown> {
  if (!segment || typeof segment !== "object") {
    return {};
  }
  const data = segment as Record<string, unknown>;
  const marketingCarrier =
    data.marketing_carrier && typeof data.marketing_carrier === "object"
      ? data.marketing_carrier as Record<string, unknown>
      : undefined;

  return {
    origin: summarizeAirport(data.origin),
    destination: summarizeAirport(data.destination),
    departing_at: data.departing_at ?? null,
    arriving_at: data.arriving_at ?? null,
    duration: data.duration ?? null,
    marketing_carrier: marketingCarrier?.name ?? null,
    marketing_carrier_code: marketingCarrier?.iata_code ?? null,
    flight_number: data.marketing_carrier_flight_number ?? null,
  };
}

function summarizeAirport(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const data = value as Record<string, unknown>;
  return {
    city_name: data.city_name ?? null,
    iata_code: data.iata_code ?? null,
    name: data.name ?? null,
  };
}

function summarizeDuffelDurations(slices: unknown[]): string[] {
  return slices
    .map((slice) => (slice && typeof slice === "object" ? (slice as Record<string, unknown>).duration : null))
    .filter((value): value is string => typeof value === "string");
}

function summarizeDuffelError(
  result: { provider: string; tool: string; message?: string; result?: unknown },
  input: Record<string, unknown>,
) {
  return {
    status: "error",
    provider: result.provider,
    tool: result.tool,
    arguments: input,
    message: result.message ?? "Duffel request failed.",
    result: summarizeProviderError(result.result),
  };
}

function summarizeProviderError(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const body = extractBody(result);
  return {
    status_code: (result as { status_code?: unknown }).status_code ?? null,
    body: body ?? null,
  };
}

function extractBody(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const body = (result as { body?: unknown }).body;
  return body && typeof body === "object" ? body as Record<string, unknown> : undefined;
}
