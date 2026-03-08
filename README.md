# AI Meta-Agent Project

## Background

In most cases, it is difficult to turn a product idea into a runnable program directly and at low cost.

If AI can continuously generate and maintain key artifacts from requirements with lower time and staffing cost, product ideas can be validated faster and systems can keep evolving as requirements change.

This project is not just about code generation. It is an `AI-RD-PLATFORM` built to start from requirements and produce outputs that are evolvable, reviewable, and verifiable.

## Product Positioning

The `AI-RD-PLATFORM` turns requirements into stage-based artifacts and keeps those artifacts updated when requirements change.

Core goals:

1. Reduce the cost of turning requirements into product artifacts
2. Support iterative updates after requirement changes
3. Provide outputs that are reviewable, maintainable, and traceable

## Target Users

- Technical founders: validate ideas quickly, write and update requirements and technical artifacts, and get a final program
- Indie developers: build and maintain personal products at low cost, and keep artifacts updated as requirements evolve
- Small product teams (3-5 people): PMs handle requirement authoring and product-side review, while engineers review technical artifacts, confirm key code changes, and validate runtime and test results

## Core Problems and Product Abilities

1. Requirements are usually written in natural language and are not directly actionable
   - The platform structures raw requirements into clearer, more executable inputs
2. The path from requirement to design, implementation, and validation is often disconnected
   - The platform provides an end-to-end generation workflow
3. Requirement changes are frequent, and manually maintaining multi-stage artifacts is expensive
   - The platform supports incremental updates based on existing artifacts instead of rebuilding everything
4. AI output is hard to trust
   - The platform exposes execution progress and pending changes, and requires confirmation before important modifications are applied
5. Generated results are hard to evaluate quickly
   - The platform provides basic validation and test feedback to support further review and iteration

## User Workflow

Standard flow:

1. A PM creates or updates a requirement document and starts a task
2. The platform interprets the requirement and prepares intended changes
3. The PM reviews the interpreted requirement result and decides whether to continue, revise, or stop
4. The platform generates or updates design artifacts
5. An engineer reviews design changes and confirms whether they should be applied
6. The platform generates or updates implementation artifacts
7. An engineer reviews code changes and decides whether to accept or reject them
8. The platform runs validation or test steps and presents a result summary
9. The PM and engineer accept the result together

Supported resume entry points:

- design generation/update
- implementation generation/update
- validation

Failure handling:

- when a stage fails, the workflow stops at the current stage
- the platform does not automatically roll back to an earlier stage
- users fix the issue at the current stage
- after the issue is fixed, the workflow retries from the same stage

## Inputs and Outputs

Inputs:

- requirement document
- project directory

Prerequisite:

- the target project must be stored in a Git repository

Main outputs:

- updated requirement document
- updated design artifacts
- updated code artifacts
- runnable program output for supported scenarios
- validation or test results
- workflow stage information and pending change summaries

## Project Structure

- `meta_layer`
  - `docs/design_docs/`
    - architecture, workflow, execution, contract, interface, and SDK documents
  - `resources/template/`
    - generation templates for each stage
  - `resources/contract/`
    - contracts and template constraints for each stage
- `project_layer`
  - `projects/sdlc/`
    - the current primary implementation project
  - `docs/`
    - collaboration standards and execution plans

## Current Implementation Scope

The current version corresponds to `V1: MVP` in `Requirement.md` and focuses on completing the standard flow from requirement input to runnable demo output through CLI execution.

The main implemented stages in `project_layer/projects/sdlc` are:

1. `requirement_interpretation`
2. `architecture_design`
3. `module_design`
4. `implementation_plan`
5. `validation`

Current scope characteristics:

- execute tasks and resume workflows through CLI
- show key stage information and pending changes
- support the validated demo scenario: Travel Planning Agent

Current non-goals:

- no UI-based review experience
- no support for multiple project types
- no guarantee that every step exposes fully reviewable intermediate artifacts

## Test Organization

`project_layer/projects/sdlc/tests/` is grouped by function and stage:

- `shared/`
- `workflow/`
- `requirement/`
- `architecture/`
- `module-design/`
- `implementation-plan/`
- `implementation-execution/`
- `validation/`

Only these files remain at the test root:

- `run-tests.ts`
- `cli.test.ts`

## Run Tests

Run the following in `project_layer/projects/sdlc`:

```bash
npm test
```

This command first builds:

- `project_layer/projects/sdlc`
- `project_layer/projects/agent_runtime`

It then runs the aggregated test entry at `tests/run-tests.ts`.

## Key Documents

- Chinese execution plan:
  - [project_layer/docs/CodeGenerationExecutionPlan.md](./project_layer/docs/CodeGenerationExecutionPlan.md)
- Collaboration standard:
  - [project_layer/docs/COLLABORATION_STANDARD.md](./project_layer/docs/COLLABORATION_STANDARD.md)
- Workflow design:
  - [meta_layer/docs/design_docs/Workflow/Pipeline.md](./meta_layer/docs/design_docs/Workflow/Pipeline.md)
  - [meta_layer/docs/design_docs/Workflow/StageRunners.md](./meta_layer/docs/design_docs/Workflow/StageRunners.md)
