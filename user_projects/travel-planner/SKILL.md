---
name: travel-planner
description: Plan personalized leisure trips from user constraints by querying MCP-provided travel data, comparing transport and lodging options, building a feasible itinerary, and returning a structured trip recommendation. Use when Codex needs to create or revise a personal travel plan based on destination, dates, budget, preferences, pace, transport, lodging, attraction, weather, or visa-related constraints.
---

# Travel Planner

## Overview

Build a personal travel plan from explicit user constraints and MCP data.
Prefer feasible, explainable plans over speculative or overly dense itineraries.
Read the request from `references/plan.json` before planning.

## Input Source

Read [plan.json](./references/plan.json) as the primary request source.
Use [plan.schema.json](./references/plan.schema.json) as the input contract.

If `plan.json` is missing, invalid, or lacks decision-critical fields, output an error and exit.

## Required Inputs

Read these fields from `plan.json` before finalizing a plan:

- origin
- destinations
- travel dates
- traveler count
- total budget
- pace
- interests
- trip preferences
- lodging preferences
- activity preferences
- daily schedule preferences
- output preferences

## Workflow

### 1. Normalize Request

- Read `trip_request` from `plan.json`.
- Extract hard constraints:
  - departure city
  - target destination
  - travel dates
  - budget ceiling
  - required transport conditions
  - required lodging conditions
- Extract soft preferences:
  - food
  - shopping
  - museums
  - hiking
  - nightlife
  - family-friendly activities
- Separate hard constraints from soft preferences.

### 2. Check Missing Decision-Critical Data

If one of these is missing in `plan.json`, output an error:

- destination or candidate destinations
- date range
- budget ceiling
- traveler count when pricing is required

### 3. Query MCP Data

Read [mcp-tools.md](./references/mcp-tools.md) before calling tools.

Select providers by destination geography:

- mainland China destinations:
  - use AMap for place search, attraction lookup, routing, and local transport estimation
- destinations outside mainland China:
  - use Google Maps for place search, attraction lookup, routing, and local transport estimation
- flights:
  - use the flight search MCP tool
- lodging:
  - use the hotel search MCP tool
- weather:
  - use OpenWeather
- budget reconciliation:
  - use the local budget tool

Query in this order unless the user request implies a different priority:

1. destination viability
2. transport options
3. lodging options
4. weather and seasonal conditions
5. attraction candidates and local transport
6. budget reconciliation

Prefer narrowing candidates early rather than collecting large unfiltered result sets.

### 4. Build Candidate Plans

For each candidate plan:

- verify dates are feasible
- verify transport and lodging fit the budget
- estimate local movement overhead
- match activities to user pace
- avoid overfilling arrival and departure days
- reserve buffer time for transfers and check-in/check-out

Reject plans with unresolved hard-constraint conflicts.

### 5. Rank and Select

Rank plans by:

1. hard-constraint satisfaction
2. total budget fit
3. travel friction
4. preference match
5. weather and seasonal suitability

If no plan fully satisfies the request, return the closest feasible option and explain the gap.

### 6. Return Structured Result

Read [output-format.md](./references/output-format.md) and use that structure.

Always include:

- recommended plan
- brief rationale
- day-by-day outline
- budget breakdown
- key risks or uncertainties

Include alternatives when there is a meaningful tradeoff.

## Planning Rules

- Do not present unverified real-world facts as confirmed.
- Mark assumptions separately from MCP-backed facts.
- Prefer 1 recommended plan plus up to 2 alternatives.
- Keep daily activity density realistic.
- Do not schedule long-distance transfers and dense sightseeing in the same block unless explicitly requested.
- When budget is tight, reduce optional activities before violating transport or lodging hard constraints.
- When weather is unfavorable, downgrade outdoor-heavy plans unless the user explicitly prefers them.
- Do not mix AMap and Google Maps in the same destination plan unless one provider is unavailable for a required query.
- Prefer AMap place names, route estimates, and local area terminology for mainland China plans.
- Prefer Google Maps place names, route estimates, and local area terminology for destinations outside mainland China.
- if mcp is not avaiblilty,just output the error and exit. do not use other abilities.

## Output Discipline

- Distinguish facts, assumptions, and recommendations.
- Use concrete currency amounts where available.
- State the date basis of queried data if MCP tools provide timestamps.
- Make budget tradeoffs visible.
- Make fallback options visible when uncertainty is high.

## References

- Use [mcp-tools.md](./references/mcp-tools.md) for MCP tool contracts and provider boundaries.
- Use [plan.schema.json](./references/plan.schema.json) for the input file contract.
- Use [plan.json](./references/plan.json) as the planning input file.
- Use [output-format.md](./references/output-format.md) for the final response shape.

## Example Requests

- `Use $travel-planner to plan a 5-day Osaka trip from Shanghai in May with an RMB 8000 budget and a relaxed pace.`
- `Use $travel-planner to compare Tokyo and Seoul for a 4-day food-focused trip next month.`
- `Use $travel-planner to revise my trip plan after hotel prices exceeded budget.`
