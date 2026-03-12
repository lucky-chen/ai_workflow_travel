import assert from "node:assert/strict";

import { parseDesignDocumentBreakdown } from "../../src/shared/design-document-breakdown.js";

export async function runDesignDocumentBreakdownTests(): Promise<void> {
  await testParseDesignDocumentBreakdownUsesFileNameAsName();
  await testParseDesignDocumentBreakdownSupportsMarkdownLinks();
}

async function testParseDesignDocumentBreakdownUsesFileNameAsName(): Promise<void> {
  const content = [
    "## 7.2 Design Document Breakdown",
    "- `sdlc/docs/module_design/Workflow.md`: covers the design of the `Workflow` module.",
    "- `./module_design/trip_application_service.md`: covers the design of the `TripApplicationService` module.",
  ].join("\n");

  assert.deepEqual(parseDesignDocumentBreakdown(content), [
    {
      name: "Workflow",
      documentPath: "sdlc/docs/module_design/Workflow.md",
      description: "covers the design of the `Workflow` module.",
      responsibilities: ["covers the design of the `Workflow` module."],
    },
    {
      name: "trip_application_service",
      documentPath: "./module_design/trip_application_service.md",
      description: "covers the design of the `TripApplicationService` module.",
      responsibilities: ["covers the design of the `TripApplicationService` module."],
    },
  ]);
}

async function testParseDesignDocumentBreakdownSupportsMarkdownLinks(): Promise<void> {
  const content = [
    "## 7.2 Design Document Breakdown",
    "- [plan_service.md](./module_design/plan_service.md)：覆盖 `PlanService` 的设计，包括整体计划生成和整体更新。",
    "- [trip_repository.md](./module_design/trip_repository.md)：覆盖 durable trip state、current plan persistence 和 TripRecord storage boundary 的设计。",
  ].join("\n");

  assert.deepEqual(parseDesignDocumentBreakdown(content), [
    {
      name: "plan_service",
      documentPath: "./module_design/plan_service.md",
      description: "覆盖 `PlanService` 的设计，包括整体计划生成和整体更新。",
      responsibilities: ["覆盖 `PlanService` 的设计，包括整体计划生成和整体更新。"],
    },
    {
      name: "trip_repository",
      documentPath: "./module_design/trip_repository.md",
      description: "覆盖 durable trip state、current plan persistence 和 TripRecord storage boundary 的设计。",
      responsibilities: ["覆盖 durable trip state、current plan persistence 和 TripRecord storage boundary 的设计。"],
    },
  ]);
}
