# Travel Planner Output Format

Use this structure for the final trip-planning response.

## Required Sections

### 1. Recommended Plan

Include:

- destination
- trip length
- pace
- recommendation summary

### 2. Rationale

Include short reasons covering:

- budget fit
- transport fit
- lodging fit
- pace fit
- weather fit

### 3. Facts

List MCP-backed facts only.

Examples:

- flight search status
- hotel search status
- weather lookup status
- attraction lookup status
- local transport lookup status

### 4. Assumptions

List assumptions separately from facts.

Examples:

- traveler count defaults
- food budget assumptions
- activity buffer assumptions
- destination viability inference when no dedicated MCP tool exists

### 5. Day-by-Day Outline

Use one subsection per day.

Each day should include:

- day label
- main area or theme
- activity outline
- transfer/load note when needed

### 6. Budget Breakdown

Include:

- flight estimate
- lodging estimate
- local transport estimate
- food estimate
- activity buffer
- total estimate

### 7. Risks Or Uncertainties

Include only material risks.

Examples:

- provider lookup failed
- weather uncertainty
- price volatility
- transfer density risk

### 8. Alternatives

Optional.
Include only when there is a meaningful tradeoff.

## Output Rules

- Distinguish facts, assumptions, and recommendations
- Do not claim booking confirmation
- Keep arrival and departure days light
- Keep relaxed pace realistic
