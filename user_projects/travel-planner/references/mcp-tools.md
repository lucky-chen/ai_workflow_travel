# MCP Capability Reference

Last updated: 2026-03-24

## Positioning

This document explains:

- what MCP capabilities are currently available to support `travel-planner`
- which skill steps are supported by MCP
- which skill steps are not provided directly by MCP

This document is not:

- the business requirement document
- the planner implementation document
- the provider SDK implementation document

## Runtime Boundary

Current local MCP server:

- server name: `travelPlanner`
- source entrypoint: `user_projects/travel-planner/server/server.ts`
- runtime entrypoint: `user_projects/travel-planner/server/dist/server.js`

Current server role:

- expose concrete MCP capabilities
- isolate provider authentication, proxy, and outbound access

## Skill Capability Support Map

### 1. Destination viability

Supported by MCP:

- `google_maps_geocode`
- `google_maps_findplacefromtext`
- `amap_maps_geo`
- `amap_maps_text_search`

Skill-side handling:

- decide which provider to use by destination geography
- decide whether the destination has enough usable place data

### 2. Transport options

Supported by MCP:

- `duffel_search_flights`

Skill-side handling:

- compare transport candidates
- apply business-level ranking and selection

### 3. Lodging options

Supported by MCP:

- `hotelbeds_search_hotels`
- `duffel_search_stays`

Skill-side handling:

- default lodging provider for trip planning is `hotelbeds_search_hotels`
- `duffel_search_stays` is optional and should only be used when explicitly requested
- compare lodging candidates
- decide which lodging options fit the trip plan

### 4. Weather and seasonal conditions

Supported by MCP:

- `open_weather_getweatherdata`
- `amap_maps_weather` for mainland China destination support when needed

Skill-side handling:

- interpret weather results for itinerary suitability
- decide whether to reduce outdoor-heavy plans

### 5. Attraction candidates and local transport

Supported by MCP:

- outside mainland China:
  - `google_maps_findplacefromtext`
  - `google_maps_nearbysearch`
  - `google_maps_directions`
- mainland China:
  - `amap_maps_text_search`
  - `amap_maps_search_detail`
  - `amap_maps_direction_transit_integrated`

Skill-side handling:

- choose attraction candidates
- choose route strategy
- generate day-by-day attraction arrangement

### 6. Budget reconciliation

Supported by MCP:

- no direct MCP capability in the current provider-facing layer

Skill-side handling:

- aggregate transport, lodging, local movement, food, and buffer cost
- decide whether the final plan fits the budget ceiling

## Current Exposed MCP Tools

- `google_maps_geocode`
- `google_maps_findplacefromtext`
- `google_maps_nearbysearch`
- `google_maps_directions`
- `amap_maps_geo`
- `amap_maps_weather`
- `amap_maps_text_search`
- `amap_maps_search_detail`
- `amap_maps_direction_transit_integrated`
- `open_weather_getweatherdata`
- `duffel_search_flights`
- `duffel_search_stays`
- `hotelbeds_search_hotels`

## Environment Variables

Required secrets:

- `GOOGLE_MAPS_API_KEY`
- `AMAP_MAPS_API_KEY`
- `OPENWEATHER_API_KEY`
- `DUFFEL_ACCESS_TOKEN`
- `HOTELBEDS_API_KEY`
- `HOTELBEDS_SECRET`

The local MCP server loads these values from:

- `user_projects/travel-planner/server/local.env.json`

when they are not already present in `process.env`.

## MCP Tool Definitions

### `google_maps_geocode`

Purpose:

- resolve address, place ID, or coordinates through Google Maps Geocoding API

Input:

```json
{
  "address": "Osaka Station, Japan",
  "language": "en",
  "region": "jp"
}
```

Primary fields:

- `address`
- `latlng`
- `place_id`

At least one primary field should be provided.

Output:

- wrapped result with:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

### `google_maps_findplacefromtext`

Purpose:

- resolve place candidates from free text through Google Maps Places API

Input:

```json
{
  "input": "Grand Palace Bangkok",
  "inputtype": "textquery",
  "fields": ["place_id", "name", "geometry"],
  "language": "en"
}
```

Required fields:

- `input`
- `inputtype`

### `google_maps_nearbysearch`

Purpose:

- search nearby places through Google Maps Places API

Input:

```json
{
  "location": "13.7500,100.4913",
  "radius": 5000,
  "keyword": "temple",
  "type": "tourist_attraction",
  "language": "en"
}
```

Required fields:

- `location`

### `google_maps_directions`

Purpose:

- retrieve route directions through Google Maps Directions API

Input:

```json
{
  "origin": "Osaka Station",
  "destination": "Kyoto Station",
  "mode": "transit",
  "language": "en"
}
```

Required fields:

- `origin`
- `destination`

### `duffel_search_stays`

Purpose:

- search available accommodation through Duffel Stays

Input:

```json
{
  "latitude": 13.7563,
  "longitude": 100.5018,
  "radiusKm": 5,
  "checkInDate": "2026-05-10",
  "checkOutDate": "2026-05-13",
  "adults": 1,
  "rooms": 1,
  "limit": 3,
  "sortBy": "price"
}
```

Required fields:

- `checkInDate`
- `checkOutDate`
- `adults`
- one of:
  - `latitude` + `longitude`
  - `accommodationIds`

Notes:

- this tool follows Duffel Stays search requirements, so city-name lookup is not built in
- callers should geocode destination names before calling this tool when searching by area

### `amap_maps_geo`

Purpose:

- geocode address or POI with AMap

Input:

```json
{
  "address": "上海虹桥站",
  "city": "上海"
}
```

Required fields:

- `address`

### `amap_maps_weather`

Purpose:

- query city weather with AMap

Input:

```json
{
  "city": "上海"
}
```

Required fields:

- `city`

### `amap_maps_text_search`

Purpose:

- search POIs by keyword with AMap

Input:

```json
{
  "keywords": "外滩",
  "city": "上海",
  "types": "风景名胜"
}
```

Required fields:

- `keywords`

### `amap_maps_search_detail`

Purpose:

- get POI detail by AMap POI id

Input:

```json
{
  "id": "B00155F7PK"
}
```

Required fields:

- `id`

### `amap_maps_direction_transit_integrated`

Purpose:

- get integrated public transit route with AMap

Input:

```json
{
  "origin": "121.4737,31.2304",
  "destination": "121.4998,31.2397",
  "city": "上海",
  "cityd": "上海"
}
```

Required fields:

- `origin`
- `destination`
- `city`
- `cityd`

### `open_weather_getweatherdata`

Purpose:

- retrieve current weather and forecast by latitude and longitude

Input:

```json
{
  "lat": 34.6937,
  "lon": 135.5023,
  "appid": "<OPENWEATHER_API_KEY>"
}
```

Required fields:

- `lat`
- `lon`
- `appid`

### `duffel_search_flights`

Purpose:

- search flight offers through Duffel

Input:

```json
{
  "origin": "HGH",
  "destination": "KIX",
  "departureDate": "2026-05-10",
  "returnDate": "2026-05-16",
  "adults": 1,
  "cabinClass": "economy",
  "maxConnections": 1,
  "limit": 5,
  "sortBy": "price"
}
```

Required fields:

- `origin`
- `destination`
- `departureDate`
- `adults`

Optional fields:

- `returnDate`
- `childrenAges`
- `cabinClass`
- `maxConnections`
- `limit`
- `sortBy`

Notes:

- current implementation uses Duffel HTTP API
- `sortBy` is a provider-side query hint, not a planner decision
- server returns summarized offers instead of full raw provider payloads

### `hotelbeds_search_hotels`

Purpose:

- search hotel availability through Hotelbeds

Input:

```json
{
  "destinationCode": "BKK",
  "adults": 1,
  "checkInDate": "2026-05-10",
  "checkOutDate": "2026-05-16",
  "rooms": 1,
  "maxHotels": 5,
  "sortBy": "price",
  "preferredAreas": ["Sukhumvit", "Silom"]
}
```

Required fields:

- `adults`
- `checkInDate`
- `checkOutDate`
- one of `destinationCode` or `hotelCodes`

Optional fields:

- `destinationCode`
- `hotelCodes`
- `cityName`
- `countryCode`
- `children`
- `rooms`
- `language`
- `maxHotels`
- `sortBy`
- `preferredAreas`

Notes:

- current implementation uses Hotelbeds HTTP API
- server resolves or limits hotel candidates before final availability lookup when possible
- server returns summarized hotel candidates instead of full raw provider payloads

## Skill Steps Without Direct MCP Capability

The following skill steps are not provided directly by the current local MCP server:

- hard-constraint interpretation
- soft-preference interpretation
- candidate-plan generation
- plan ranking
- final budget reconciliation
- final itinerary generation
