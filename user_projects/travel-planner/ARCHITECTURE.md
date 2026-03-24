# Technical Architecture

## 1. Purpose

Define the overall technical architecture of the `travel-planner` system.

- Team members: provide a shared high-level baseline for system boundaries and collaboration rules.
- Senior engineers: review architecture direction, layer boundaries, and deployment split.
- Junior engineers: understand where planning logic, contracts, and provider access should live.

## 2. Scope

### 2.1 In Scope

- Overall architecture layering for `travel-planner`.
- Major runtime interaction and control flow from planning input to provider access.
- Responsibility boundaries between `Skill Layer`, `Contract Layer`, `Provider MCP Layer`, and `Agent / Planner Layer`.
- Deployment split between host-side provider access and agent-side planning execution.
- Key constraints caused by provider access, local MCP exposure, and agent runtime boundaries.

### 2.2 Out of Scope

- Detailed module internals and implementation logic.
- Detailed MCP parameter definitions and field-level API schemas.
- Storage schema details for trace, record, or local files.
- UI-level interaction design.
- Deployment runbooks, terminal commands, and environment setup details.

Cross-module interaction contracts and detailed tool contracts are covered in follow-up design documents and references, not in full detail here.

---

## 3. Design Drivers

- The system must separate travel business planning from provider access mechanics.
- The system must allow the host machine to solve provider authentication, proxy, and outbound network access outside the agent runtime.
- The system must keep business rules in the skill rather than burying them inside local MCP transport code.
- The system must keep interface contracts explicit and stable for later agent-runtime integration.
- The system must support iterative planning with traceability while avoiding layer mixing.

---

# 4. Architecture Design

### 4.1 Architecture Style

The system adopts a layered architecture with a thin local provider-facing MCP service and an agent-side planning layer.

### 4.2 Layers or Partitions

- `Skill Layer`: defines business rules, planning workflow, provider selection rules, and output discipline.
- `Contract Layer`: defines input contracts, MCP tool contracts, and output format contracts.
- `Provider MCP Layer`: exposes raw provider-facing MCP tools and handles provider-side access concerns.
- `Agent / Planner Layer`: interprets the request, orchestrates tool usage, generates plans, and validates final output.

### 4.3 Allowed Dependencies

ALLOW:

- `Skill Layer` -> `Contract Layer`
- `Agent / Planner Layer` -> `Skill Layer`
- `Agent / Planner Layer` -> `Contract Layer`
- `Agent / Planner Layer` -> `Provider MCP Layer`
- `Provider MCP Layer` -> external APIs or external MCP servers

All unspecified dependencies are forbidden by default.

### 4.4 High-level Diagram

```text
[plan.json + plan.schema.json]
            |
            v
     [Skill Layer] <----> [Contract Layer]
            |
            v
 [Agent / Planner Layer]
            |
            v
  [Provider MCP Layer]
            |
            v
[Google Maps / AMap / OpenWeather / Duffel / Hotelbeds]
```

### 4.5 Runtime Topology

- `Host-side Provider MCP Service`: runs as a local independent MCP process and owns provider access, provider credentials, proxy usage, and MCP exposure.
- `Agent Runtime`: runs the planning logic, reads the request input, applies skill rules, and calls the host-side provider MCP service.
- `Shared Project Files`: provide skill instructions, input contracts, MCP contracts, output contracts, and planning input.

### 4.6 Technology Choices

- `Skill Layer`: Markdown-based skill definition for business rules and planning guidance.
- `Contract Layer`: Markdown and JSON for stable input, tool, and output contracts.
- `Provider MCP Layer`: TypeScript with `@modelcontextprotocol/sdk` for MCP exposure and provider-facing tool integration.
- `Agent / Planner Layer`: agent runtime plus LLM-driven planning logic for orchestration, plan generation, and review.

---

## 5. System Interactions

### 5.1 Primary Interaction Path

```text
plan.json
-> Agent / Planner Layer reads request and skill rules
-> Agent / Planner Layer selects provider-facing tools
-> Provider MCP Layer executes provider access
-> Agent / Planner Layer receives constrained results
-> Agent / Planner Layer generates and validates final trip plan
```

1. The agent reads `plan.json` under the input contract defined by `plan.schema.json`.
2. The agent applies business rules from `SKILL.md` to determine planning flow and provider selection.
3. The agent calls provider-facing MCP tools exposed by the local Provider MCP service.
4. The Provider MCP service performs external provider access and returns tool results.
5. The agent composes tool results into a travel plan and validates the final output against request constraints.

`The reusable control shape is agent-side planning with host-side provider access.`

### 5.2 Core Modules

- **`Skill Layer`**
  - `TravelPlannerSkill`
    - responsibility: define planning rules, provider selection rules, and output discipline.
    - inputs: planning request from `plan.json`, contract references.
    - outputs: planning policy applied by the agent runtime.
    - ownership boundary: business rules only.

- **`Contract Layer`**
  - `PlanContract`
    - responsibility: define the structured planning input model.
    - inputs: user planning intent represented as project input files.
    - outputs: normalized request boundary for agent-side planning.
    - ownership boundary: input contract only.
  - `ToolContract`
    - responsibility: define the MCP tool boundary visible to the planning system.
    - inputs: provider-facing tool descriptions and expected usage constraints.
    - outputs: explicit tool contract reference for planner integration.
    - ownership boundary: contract description only.
  - `OutputContract`
    - responsibility: define the shape of the final plan output.
    - inputs: finalized travel recommendation.
    - outputs: response structure expected from the planner.
    - ownership boundary: output contract only.

- **`Provider MCP Layer`**
  - `ProviderMcpService`
    - responsibility: expose provider-facing MCP tools and isolate provider access concerns.
    - inputs: MCP tool calls from the agent runtime.
    - outputs: provider-level tool results.
    - ownership boundary: provider transport, authentication, proxy, and tool exposure only.

- **`Agent / Planner Layer`**
  - `PlannerOrchestrator`
    - responsibility: interpret the request, orchestrate tool calls, generate candidate plans, select a final plan, and validate output.
    - inputs: planning request, skill rules, contract definitions, provider MCP results.
    - outputs: validated travel plan.
    - ownership boundary: business planning and final recommendation.

### 5.3 Interaction Model

This section describes high-level cross-module interaction.

#### 5.3.1 Request Interpretation And Planning
- user scenario: a user provides a travel request through `plan.json`.
- stage position: current scope.
- goal: convert structured input into a planning task with explicit business constraints.

##### 5.3.1.1 Request Normalization
- summary: the agent reads the request input and interprets it under the skill and contract rules.
- modules involved: `TravelPlannerSkill`, `PlanContract`, `PlannerOrchestrator`
- control focus: the agent owns request interpretation and planning control.

#### 5.3.2 Provider Data Acquisition
- user scenario: the planner requires real travel data before plan generation.
- stage position: current scope.
- goal: acquire constrained provider data without moving provider complexity into the skill.

##### 5.3.2.1 Provider Tool Execution
- summary: the agent selects provider-facing MCP tools and sends requests to the host-side local MCP service.
- modules involved: `PlannerOrchestrator`, `ToolContract`, `ProviderMcpService`
- control focus: the agent owns tool choice; the provider MCP service owns provider access.

#### 5.3.3 Plan Generation And Validation
- user scenario: the planner has collected enough data to generate a trip recommendation.
- stage position: current scope.
- goal: produce a final itinerary without mixing provider mechanics into business planning.

##### 5.3.3.1 Final Plan Composition
- summary: the agent composes constrained results into candidate and final plans, then validates the final output.
- modules involved: `PlannerOrchestrator`, `OutputContract`
- control focus: business planning and final validation remain on the agent side.

### 5.4 Key Considerations

- The `Provider MCP Layer` must remain thin and provider-facing.
- The `Agent / Planner Layer` must own business planning and final recommendation logic.
- The skill must remain the source of planning rules rather than becoming a transport implementation document.
- Provider access instability, proxy handling, and host-only network conditions must not leak into the planning-rule layer.

---

## 6. Non-Functional Considerations

### 6.1 High Availability

- Why it matters:
  - travel planning depends on multiple external providers with uneven availability.
- Architectural support:
  - isolate provider failures inside the `Provider MCP Layer`.
  - keep the planning layer independent from direct provider transport concerns.

### 6.2 High Scalability

- Why it matters:
  - future planner runtimes may need to serve multiple requests while reusing the same provider-access boundary.
- Architectural support:
  - separate the host-side provider access service from the agent-side planner.
  - keep provider access concerns behind a stable MCP boundary.

### 6.3 High Performance

- Why it matters:
  - external provider calls dominate latency and can produce large result sets.
- Architectural support:
  - constrain provider result size before results reach the planning layer.
  - keep the provider-facing layer thin so request shaping and network access remain localized.

---

## 7. Design Documents

### 7.1 Design Document Categories

Different design documents have different focus. All of them must still follow the module boundaries, dependency rules, and shared architectural constraints defined in this architecture.

- `functional_group_design`
- `reference_design`
- `protocol_design`

### 7.2 Design Document Breakdown

- [skill_layer_design](./breakdown_docs/skill_layer_design.md)
  - type: `functional_group_design`
  - scope: planning-rule design for the skill layer
  - include: skill responsibilities, planning policy boundaries, failure policy boundaries

- [contract_layer_design](./breakdown_docs/contract_layer_design.md)
  - type: `reference_design`
  - scope: shared contracts for planning input, provider MCP usage, and output shape
  - include: plan contract boundary, tool contract boundary, output contract boundary

- [provider_mcp_layer_design](./breakdown_docs/provider_mcp_layer_design.md)
  - type: `protocol_design`
  - scope: host-side local MCP service boundary for provider-facing capabilities
  - include: provider tool exposure boundary, provider access boundary, host-side deployment boundary

- [agent_planner_layer_design](./breakdown_docs/agent_planner_layer_design.md)
  - type: `functional_group_design`
  - scope: agent-side planning orchestration and validation boundary
  - include: planner responsibilities, orchestration boundary, validation boundary

---

## 8. Open Issues

- The current implementation still mixes business-level `travel.*` tools into the local MCP service and is not yet fully aligned with the target architecture.
- The future agent-side planner runtime boundary is defined architecturally here, but the final runtime host and integration approach are still not fixed.
- Host-side proxy and provider network access strategy are architecture-relevant constraints and still require a stable operational solution.

---
