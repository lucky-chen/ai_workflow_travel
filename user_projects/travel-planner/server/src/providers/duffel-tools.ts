import { requireEnv } from "../runtime/env-loader.js";
import { providerJsonRequest } from "./provider-http.js";

export async function duffelSearchFlights(input: Record<string, unknown>) {
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
      tool: "duffel.search_flights",
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
        tool: "duffel.search_flights",
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
      tool: "duffel.search_flights",
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
      tool: "duffel.search_flights",
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
      tool: "duffel.search_flights",
      arguments: input,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function duffelSearchStays(input: Record<string, unknown>) {
  try {
    const limit = readPositiveInt(input.limit, 5);
    const sortBy = readStaySort(input.sortBy);
    const rooms = readPositiveInt(input.rooms, 1);
    const guests = [
      ...Array.from({ length: Number(input.adults) }, () => ({ type: "adult" })),
      ...((input.childrenAges as unknown[] | undefined)?.map((age) => ({ type: "child", age: Number(age) })) ?? []),
    ];

    const bodyData: Record<string, unknown> = {
      rooms,
      guests,
      check_in_date: String(input.checkInDate),
      check_out_date: String(input.checkOutDate),
      ...(input.freeCancellationOnly !== undefined
        ? { free_cancellation_only: Boolean(input.freeCancellationOnly) }
        : {}),
      ...(input.mobile !== undefined ? { mobile: Boolean(input.mobile) } : {}),
    };

    const accommodationIds = readAccommodationIds(input.accommodationIds);
    if (accommodationIds.length > 0) {
      bodyData.accommodation = { ids: accommodationIds };
    } else {
      bodyData.location = {
        radius: readPositiveNumber(input.radiusKm, 5),
        geographic_coordinates: {
          latitude: Number(input.latitude),
          longitude: Number(input.longitude),
        },
      };
    }

    const providerResult = await providerJsonRequest({
      method: "POST",
      url: `${getDuffelBaseUrl()}/stays/search`,
      provider: "duffelStays",
      tool: "duffel.search_stays",
      argumentsPayload: input,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireEnv("DUFFEL_ACCESS_TOKEN")}`,
        "Duffel-Version": "v2",
      },
      body: {
        data: bodyData,
      },
    });

    if (providerResult.status === "error") {
      return summarizeDuffelError(providerResult, input);
    }

    return {
      status: "ok",
      provider: "duffelStays",
      tool: "duffel.search_stays",
      arguments: {
        ...input,
        rooms,
        limit,
        sortBy,
      },
      result: summarizeDuffelStays(providerResult.result, limit, sortBy),
    };
  } catch (error) {
    return {
      status: "error",
      provider: "duffelStays",
      tool: "duffel.search_stays",
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

function readStaySort(value: unknown): "price" | "rating" | "review_score" {
  if (value === "rating" || value === "review_score") {
    return value;
  }
  return "price";
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

function summarizeDuffelStays(
  result: unknown,
  limit: number,
  sortBy: "price" | "rating" | "review_score",
): Record<string, unknown> {
  const body = extractBody(result);
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : undefined;
  const payload = data && typeof data === "object" ? (data as { results?: unknown[]; created_at?: unknown }) : {};
  const results = Array.isArray(payload.results) ? payload.results : [];

  const items = results.map((item) => summarizeDuffelStayResult(item));
  const sorted = sortDuffelStays(items, sortBy).slice(0, limit);
  return {
    created_at: payload.created_at ?? null,
    returned_count: sorted.length,
    items: sorted,
  };
}

function summarizeDuffelStayResult(item: unknown): Record<string, unknown> {
  if (!item || typeof item !== "object") {
    return {};
  }

  const data = item as Record<string, unknown>;
  const accommodation =
    data.accommodation && typeof data.accommodation === "object"
      ? (data.accommodation as Record<string, unknown>)
      : {};
  const location =
    accommodation.location && typeof accommodation.location === "object"
      ? (accommodation.location as Record<string, unknown>)
      : {};
  const address =
    location.address && typeof location.address === "object"
      ? (location.address as Record<string, unknown>)
      : {};
  const coordinates =
    location.geographic_coordinates && typeof location.geographic_coordinates === "object"
      ? (location.geographic_coordinates as Record<string, unknown>)
      : {};

  return {
    search_result_id: data.id ?? null,
    expires_at: data.expires_at ?? null,
    check_in_date: data.check_in_date ?? null,
    check_out_date: data.check_out_date ?? null,
    rooms: data.rooms ?? null,
    accommodation: {
      id: accommodation.id ?? null,
      name: accommodation.name ?? null,
      rating: accommodation.rating ?? null,
      review_score: accommodation.review_score ?? null,
      review_count: accommodation.review_count ?? null,
      description: accommodation.description ?? null,
      city_name: address.city_name ?? null,
      region: address.region ?? null,
      country_code: address.country_code ?? null,
      postal_code: address.postal_code ?? null,
      latitude: coordinates.latitude ?? null,
      longitude: coordinates.longitude ?? null,
    },
    cheapest_rate: {
      total_amount: data.cheapest_rate_total_amount ?? null,
      total_currency: data.cheapest_rate_currency ?? null,
      public_amount: data.cheapest_rate_public_amount ?? null,
      public_currency: data.cheapest_rate_public_currency ?? null,
      due_at_accommodation_amount: data.cheapest_rate_due_at_accommodation_amount ?? null,
      due_at_accommodation_currency: data.cheapest_rate_due_at_accommodation_currency ?? null,
      base_amount: data.cheapest_rate_base_amount ?? null,
      base_currency: data.cheapest_rate_base_currency ?? null,
    },
  };
}

function sortDuffelStays(
  items: Array<Record<string, unknown>>,
  sortBy: "price" | "rating" | "review_score",
): Array<Record<string, unknown>> {
  const copy = [...items];
  copy.sort((left, right) => compareDuffelStays(left, right, sortBy));
  return copy;
}

function compareDuffelStays(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  sortBy: "price" | "rating" | "review_score",
): number {
  const leftAccommodation =
    left.accommodation && typeof left.accommodation === "object"
      ? (left.accommodation as Record<string, unknown>)
      : {};
  const rightAccommodation =
    right.accommodation && typeof right.accommodation === "object"
      ? (right.accommodation as Record<string, unknown>)
      : {};

  if (sortBy === "rating") {
    return numberOrZero(rightAccommodation.rating) - numberOrZero(leftAccommodation.rating);
  }

  if (sortBy === "review_score") {
    return numberOrZero(rightAccommodation.review_score) - numberOrZero(leftAccommodation.review_score);
  }

  const leftRate =
    left.cheapest_rate && typeof left.cheapest_rate === "object" ? (left.cheapest_rate as Record<string, unknown>) : {};
  const rightRate =
    right.cheapest_rate && typeof right.cheapest_rate === "object" ? (right.cheapest_rate as Record<string, unknown>) : {};
  return numberOrInfinity(leftRate.total_amount) - numberOrInfinity(rightRate.total_amount);
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

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readAccommodationIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
}

function numberOrInfinity(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
