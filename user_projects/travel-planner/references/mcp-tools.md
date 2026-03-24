# MCP Tool Reference

Last updated: 2026-03-24
Mode: planning-only

## Overview

This skill uses one local MCP server:

- server name: `travelPlanner`
- workspace config: `.vscode/mcp.json`
- source entrypoint: `user_projects/travel-planner/server/server.ts`
- runtime entrypoint: `user_projects/travel-planner/server/dist/server.js`
- local secret file: `user_projects/travel-planner/server/local.env.json`

The local MCP server directly exposes map and weather provider tools.
For flights and hotels, it exposes generic travel tools and handles provider integration internally.

## Exposed Tools

Current runtime-exposed tools:

- `googleMaps.geocode`
- `googleMaps.findplacefromtext`
- `googleMaps.nearbysearch`
- `googleMaps.directions`
- `amapMaps.maps_geo`
- `amapMaps.maps_weather`
- `amapMaps.maps_text_search`
- `amapMaps.maps_search_detail`
- `amapMaps.maps_direction_transit_integrated`
- `openWeather.getweatherdata`
- `travel.search_flights`
- `travel.search_hotels`
- `travel.estimate_budget`

## Runtime Notes

- `destination viability` is not a dedicated MCP tool
- `travel.search_flights` is the generic flight-search capability
- `travel.search_hotels` is the generic hotel-search capability
- `travel.estimate_budget` is the local budget utility tool
- map and weather tools remain provider-facing tools

## Environment Variables

Required secrets:

- `GOOGLE_MAPS_API_KEY`
- `AMAP_MAPS_API_KEY`
- `OPENWEATHER_API_KEY`
- `DUFFEL_ACCESS_TOKEN`
- `HOTELBEDS_API_KEY`
- `HOTELBEDS_SECRET`

The runtime loads these values from `local.env.json` when they are not already present in `process.env`.

## Tool Contracts

### `openWeather.getweatherdata`

Purpose:
Retrieve current weather, hourly forecast, and daily forecast based on latitude and longitude.

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

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.open-mcp.org/servers/open-weather

### `travel.search_flights`

Purpose:
Search flight offers through the configured flight provider.

Input:

```json
{
  "origin": "SHA",
  "destination": "OSA",
  "departureDate": "2026-05-12",
  "returnDate": "2026-05-16",
  "adults": 1,
  "childrenAges": [8],
  "cabinClass": "economy",
  "maxConnections": 1
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

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Notes:

- The current implementation uses Duffel internally.
- The server sends `Authorization: Bearer <DUFFEL_ACCESS_TOKEN>` and `Duffel-Version: v2`.

Source:

- https://duffel.com/docs/api/v2/offer-requests

### `travel.search_hotels`

Purpose:
Search hotels through the configured hotel provider.

Input:

```json
{
  "destinationCode": "JPOSA",
  "adults": 1,
  "checkInDate": "2026-05-12",
  "checkOutDate": "2026-05-16",
  "children": 0,
  "rooms": 1,
  "hotelCodes": [3424, 168],
  "cityName": "Osaka",
  "countryCode": "JP",
  "language": "ENG",
  "maxHotels": 10
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

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Notes:

- The current implementation uses Hotelbeds internally.
- The server sends `Api-key` and `X-Signature` headers to Hotelbeds Booking API.
- If `destinationCode` is missing, the server can resolve it from `cityName + countryCode` before querying hotel availability.

Source:

- https://developer.hotelbeds.com/documentation/hotels/booking-api/workflow/

### `googleMaps.geocode`

Purpose:
Resolve an address, place ID, or coordinates with Google Maps Geocoding API.

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

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.open-mcp.org/servers/google-maps

### `googleMaps.findplacefromtext`

Purpose:
Find a place from free text using Google Maps Places API.

Input:

```json
{
  "input": "Osaka Station",
  "inputtype": "textquery",
  "fields": ["place_id", "formatted_address", "geometry"]
}
```

Required fields:

- `input`
- `inputtype`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.open-mcp.org/servers/google-maps

### `googleMaps.nearbysearch`

Purpose:
Search nearby points of interest using Google Maps Places API.

Input:

```json
{
  "location": "34.6937,135.5023",
  "radius": 1500,
  "keyword": "takoyaki"
}
```

Required fields:

- `location`

Optional fields:

- `radius`
- `keyword`
- `type`
- `language`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.open-mcp.org/servers/google-maps

### `googleMaps.directions`

Purpose:
Get route directions using Google Maps Directions API.

Input:

```json
{
  "origin": "KIX Airport",
  "destination": "Namba Station",
  "mode": "transit",
  "language": "en"
}
```

Required fields:

- `origin`
- `destination`

Optional fields:

- `mode`
- `language`
- `region`
- `units`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.open-mcp.org/servers/google-maps

### `amapMaps.maps_geo`

Purpose:
将结构化地址或地标名称转换为经纬度。

Input:

```json
{
  "address": "上海虹桥站",
  "city": "上海"
}
```

Required fields:

- `address`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.npmjs.com/package/%40amap/amap-maps-mcp-server

### `amapMaps.maps_weather`

Purpose:
根据城市名称或者 adcode 查询天气。

Input:

```json
{
  "city": "上海"
}
```

Required fields:

- `city`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.npmjs.com/package/%40amap/amap-maps-mcp-server

### `amapMaps.maps_text_search`

Purpose:
根据关键词搜索 POI。

Input:

```json
{
  "keywords": "拉面",
  "city": "大阪"
}
```

Required fields:

- `keywords`

Optional fields:

- `city`
- `types`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.npmjs.com/package/%40amap/amap-maps-mcp-server

### `amapMaps.maps_search_detail`

Purpose:
根据 POI ID 查询详情。

Input:

```json
{
  "id": "B0FFG12345"
}
```

Required fields:

- `id`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.npmjs.com/package/%40amap/amap-maps-mcp-server

### `amapMaps.maps_direction_transit_integrated`

Purpose:
查询综合公共交通路径规划。

Input:

```json
{
  "origin": "121.32706,31.20057",
  "destination": "121.49981,31.23967",
  "city": "上海",
  "cityd": "上海"
}
```

Required fields:

- `origin`
- `destination`
- `city`
- `cityd`

Output:

- wrapped as:
  - `status`
  - `provider`
  - `tool`
  - `arguments`
  - `result` or `message`

Source:

- https://www.npmjs.com/package/%40amap/amap-maps-mcp-server

### `travel.estimate_budget`

Purpose:
Aggregate known travel cost components into one budget summary.

Input:

```json
{
  "flight_total": { "amount": 1800, "currency": "CNY" },
  "hotel_total": { "amount": 2200, "currency": "CNY" },
  "local_transport_total": { "amount": 300, "currency": "CNY" },
  "days": 5,
  "traveler_count": 1,
  "food_per_day": { "amount": 180, "currency": "CNY" },
  "activity_buffer": { "amount": 500, "currency": "CNY" }
}
```

Required fields:

- `flight_total`
- `hotel_total`
- `local_transport_total`
- `days`
- `traveler_count`
- `food_per_day`
- `activity_buffer`

Output:

```json
{
  "status": "ok",
  "as_of": "2026-03-24T12:00:00.000Z",
  "summary": {
    "transport_total": { "amount": 2100, "currency": "CNY" },
    "lodging_total": { "amount": 2200, "currency": "CNY" },
    "food_total": { "amount": 900, "currency": "CNY" },
    "activity_buffer": { "amount": 500, "currency": "CNY" },
    "grand_total": { "amount": 5700, "currency": "CNY" }
  }
}
```

## Error Contract

All provider tools return one of:

```json
{
  "status": "ok",
  "provider": "duffelFlights",
  "tool": "travel.search_flights",
  "arguments": {},
  "result": {}
}
```

or:

```json
{
  "status": "error",
  "provider": "hotelbedsHotels",
  "tool": "travel.search_hotels",
  "arguments": {},
  "message": "..."
}
```
